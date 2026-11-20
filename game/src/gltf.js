// Solmar Bay — minimal GLB (glTF 2.0 binary) reader (rebuild #15).
// Only what the game needs: parse the header + JSON + BIN chunks,
// then stream the first meshes' triangles into a batch. Returns
// null on a bad magic, a truncated file, or a null input.

export function parseGlb(buf) {
  if (!buf) return null;
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (bytes.length < 12) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = view.getUint32(0, true);
  if (magic !== 0x46546c67) return null; // 'glTF'
  const version = view.getUint32(4, true);
  if (version !== 2) return null;
  const totalLen = view.getUint32(8, true);
  if (totalLen > bytes.length) return null;
  if (bytes.length < 20) return null;
  const jsonLen = view.getUint32(12, true);
  const jsonType = view.getUint32(16, true);
  if (jsonType !== 0x4e4f534a) return null; // 'JSON'
  let json;
  try {
    json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLen)));
  } catch (e) {
    return null;
  }
  let bin = null;
  const binOff = 20 + jsonLen;
  if (bytes.length >= binOff + 8) {
    const binLen = view.getUint32(binOff, true);
    const binType = view.getUint32(binOff + 4, true);
    if (binType === 0x004e4942) bin = bytes.subarray(binOff + 8, binOff + 8 + binLen); // 'BIN\0'
  }
  const model = { json, bin, bytes };
  // Convenience views of the first mesh's first primitive, so
  // callers can inspect the geometry without re-parsing.
  model.positions = new Float32Array(0);
  model.indices = null;
  if (bin && json.meshes && json.meshes.length && json.meshes[0].primitives.length) {
    const prim = json.meshes[0].primitives[0];
    if (prim.attributes.POSITION !== undefined) {
      const info = accessorInfo(model, prim.attributes.POSITION);
      const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
      const arr = new Float32Array(info.acc.count * 3);
      for (let i = 0; i < info.acc.count; i++) {
        const off = info.base + i * info.stride;
        arr[i * 3] = dv.getFloat32(off, true);
        arr[i * 3 + 1] = dv.getFloat32(off + 4, true);
        arr[i * 3 + 2] = dv.getFloat32(off + 8, true);
      }
      model.positions = arr;
    }
    if (prim.indices !== undefined) {
      const info = accessorInfo(model, prim.indices);
      const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
      if (info.acc.componentType === 5125) {
        const arr = new Uint32Array(info.acc.count);
        for (let i = 0; i < info.acc.count; i++) arr[i] = dv.getUint32(info.base + i * info.stride, true);
        model.indices = arr;
      } else {
        const arr = new Uint16Array(info.acc.count);
        for (let i = 0; i < info.acc.count; i++) arr[i] = dv.getUint16(info.base + i * info.stride, true);
        model.indices = arr;
      }
    }
  }
  return model;
}

const COMP_SIZE = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const NUM_COMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function accessorInfo(model, index) {
  const acc = model.json.accessors[index];
  const bv = model.json.bufferViews[acc.bufferView];
  const compSize = COMP_SIZE[acc.componentType] || 4;
  const numComp = NUM_COMP[acc.type] || 1;
  const stride = bv.byteStride || compSize * numComp;
  const base = (bv.byteOffset || 0) + (acc.byteOffset || 0);
  return { acc, compSize, numComp, stride, base };
}

// Push every triangle of the model into the batch, scaled and
// translated. Returns the number of triangles pushed.
export function pushGlbToBatch(b, model, x, y, z, scale, color, uvRect) {
  if (!model || !model.json || !model.json.meshes || !model.bin) return 0;
  const binView = new DataView(model.bin.buffer, model.bin.byteOffset, model.bin.byteLength);
  const u = uvRect || [0, 0, 1, 1];
  let count = 0;
  const pushTri = (p0, p1, p2) => {
    const pts = [p0, p1, p2];
    const uvs = [[u[0], u[1]], [u[2], u[1]], [u[2], u[3]]];
    for (let i = 0; i < 3; i++) {
      b.pos.push(pts[i][0], pts[i][1], pts[i][2]);
      b.col.push(color[0], color[1], color[2]);
      b.uv.push(uvs[i][0], uvs[i][1]);
    }
    count++;
  };
  for (const mesh of model.json.meshes) {
    for (const prim of mesh.primitives) {
      if (prim.attributes.POSITION === undefined) continue;
      const pos = accessorInfo(model, prim.attributes.POSITION);
      const readPos = (i) => {
        const off = pos.base + i * pos.stride;
        return [
          x + binView.getFloat32(off, true) * scale,
          y + binView.getFloat32(off + 4, true) * scale,
          z + binView.getFloat32(off + 8, true) * scale,
        ];
      };
      if (prim.indices !== undefined) {
        const idx = accessorInfo(model, prim.indices);
        const readIdx = (i) => {
          const off = idx.base + i * idx.stride;
          if (idx.acc.componentType === 5123) return binView.getUint16(off, true);
          if (idx.acc.componentType === 5125) return binView.getUint32(off, true);
          return binView.getUint8(off);
        };
        for (let t = 0; t + 2 < idx.acc.count; t += 3) {
          pushTri(readPos(readIdx(t)), readPos(readIdx(t + 1)), readPos(readIdx(t + 2)));
        }
      } else {
        for (let t = 0; t + 2 < pos.acc.count; t += 3) {
          pushTri(readPos(t), readPos(t + 1), readPos(t + 2));
        }
      }
    }
  }
  return count;
}
