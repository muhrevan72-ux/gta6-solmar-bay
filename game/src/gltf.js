// Solmar Bay — minimal static GLB (glTF 2.0) loader.
// Only what the game needs: parse the JSON + BIN chunks, read the
// POSITION accessor and the index accessor, and push the triangles
// into a BoxBatch. No skins, no animations, no materials.

export function parseGlb(bytes) {
  if (!bytes || bytes.length < 20) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = view.getUint32(0, true);
  if (magic !== 0x46546c67) return null; // 'glTF'
  const version = view.getUint32(4, true);
  if (version !== 2) return null;
  const totalLen = view.getUint32(8, true);
  if (totalLen > bytes.length) return null;
  const jsonLen = view.getUint32(12, true);
  const jsonType = view.getUint32(16, true);
  if (jsonType !== 0x4e4f534a) return null; // 'JSON'
  let json;
  try {
    const jsonBytes = bytes.subarray(20, 20 + jsonLen);
    json = JSON.parse(new TextDecoder().decode(jsonBytes));
  } catch (e) {
    return null;
  }
  // The BIN chunk follows the JSON chunk: its header is 8 bytes
  // (length + type), so the BIN data starts at 20 + jsonLen + 8.
  const binStart = 20 + jsonLen + 8;
  if (binStart > bytes.length) return null;
  const binLen = view.getUint32(20 + jsonLen, true);
  const binType = view.getUint32(20 + jsonLen + 4, true);
  if (binType !== 0x004e4942) return null; // 'BIN\0'
  const bin = bytes.subarray(binStart, binStart + binLen);

  const mesh = (json.meshes || [])[0];
  if (!mesh || !mesh.primitives || !mesh.primitives.length) return null;
  const prim = mesh.primitives[0];
  const posAcc = json.accessors[prim.attributes.POSITION];
  const idxAcc = prim.indices !== undefined ? json.accessors[prim.indices] : null;
  if (!posAcc) return null;

  const readAccessor = (acc) => {
    const bv = json.bufferViews[acc.bufferView];
    const base = (bv.byteOffset || 0) + (acc.byteOffset || 0);
    const compBytes = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }[acc.componentType];
    const compCount = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[acc.type];
    const stride = bv.byteStride || compBytes * compCount;
    const out = [];
    for (let i = 0; i < acc.count; i++) {
      const off = base + i * stride;
      for (let c = 0; c < compCount; c++) {
        const o = off + c * compBytes;
        if (acc.componentType === 5126) out.push(readF32(bin, o));
        else if (acc.componentType === 5123) out.push(readU16(bin, o));
        else if (acc.componentType === 5125) out.push(readU32(bin, o));
        else if (acc.componentType === 5121) out.push(bin[o]);
        else if (acc.componentType === 5122) out.push(readI16(bin, o));
        else out.push(bin[o]);
      }
    }
    return out;
  };
  const positions = readAccessor(posAcc);
  const indices = idxAcc ? readAccessor(idxAcc) : null;
  return { positions, indices };
}

function readF32(bin, o) {
  return new DataView(bin.buffer, bin.byteOffset + o, 4).getFloat32(0, true);
}
function readU16(bin, o) {
  return new DataView(bin.buffer, bin.byteOffset + o, 2).getUint16(0, true);
}
function readU32(bin, o) {
  return new DataView(bin.buffer, bin.byteOffset + o, 4).getUint32(0, true);
}
function readI16(bin, o) {
  return new DataView(bin.buffer, bin.byteOffset + o, 2).getInt16(0, true);
}

// Push a parsed GLB model into a batch as triangles, scaled and
// translated, tinted with one colour. Returns the triangle count.
export function pushGlbToBatch(batch, model, x, y, z, scale, color, tile) {
  if (!model || !model.positions || !model.positions.length) return 0;
  const pos = model.positions;
  const idx = model.indices;
  const uv = [0.5, 0.25, 0.75, 0.5]; // plain tile
  let tris = 0;
  const pushTri = (a, b, c) => {
    for (const v of [a, b, c]) {
      batch.pos.push(x + pos[v * 3] * scale, y + pos[v * 3 + 1] * scale, z + pos[v * 3 + 2] * scale);
      batch.col.push(color[0], color[1], color[2]);
      batch.uv.push(uv[0], uv[1]);
    }
    tris++;
  };
  if (idx && idx.length >= 3) {
    for (let i = 0; i + 2 < idx.length; i += 3) pushTri(idx[i], idx[i + 1], idx[i + 2]);
  } else {
    for (let i = 0; i + 8 < pos.length; i += 9) pushTri(i / 3, i / 3 + 1, i / 3 + 2);
  }
  return tris;
}
