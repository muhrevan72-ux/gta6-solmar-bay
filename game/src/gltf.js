// Solmar Bay — minimal GLB (glTF binary) reader.
//
// The entry ships no .glb files: barrels are procedural boxes and the
// renderer falls back to them. This parser still exists so a model file
// dropped into the entry later loads, and so bad input fails cleanly
// (bad magic, truncated file, or null all return null).

const GLB_MAGIC = 0x46546c67; // 'glTF'
const JSON_CHUNK = 0x4e4f534a; // 'JSON'
const BIN_CHUNK = 0x004e4942; // 'BIN\0'

export function parseGlb(buf) {
  if (!buf) return null;
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (bytes.byteLength < 12) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== GLB_MAGIC) return null;
  if (view.getUint32(4, true) !== 2) return null;
  const total = view.getUint32(8, true);
  if (total > bytes.byteLength) return null;
  if (bytes.byteLength < 20) return null;
  const jsonLen = view.getUint32(12, true);
  if (view.getUint32(16, true) !== JSON_CHUNK) return null;
  if (20 + jsonLen > bytes.byteLength) return null;
  let json;
  try {
    json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLen)));
  } catch {
    return null;
  }
  // Find the BIN chunk (if any) for vertex data.
  let binStart = 20 + jsonLen;
  let bin = null;
  if (binStart + 8 <= bytes.byteLength) {
    const binLen = view.getUint32(binStart, true);
    if (view.getUint32(binStart + 4, true) === BIN_CHUNK) {
      bin = bytes.subarray(binStart + 8, binStart + 8 + binLen);
    }
  }
  if (!json.meshes || !json.meshes.length) return null;
  const prim = json.meshes[0].primitives && json.meshes[0].primitives[0];
  if (!prim || prim.attributes === undefined || prim.attributes.POSITION === undefined) return null;
  const positions = readAccessor(json, bin, prim.attributes.POSITION);
  if (!positions) return null;
  let indices = null;
  if (prim.indices !== undefined) {
    indices = readAccessor(json, bin, prim.indices);
  }
  if (!indices) {
    indices = [];
    for (let i = 0; i < positions.length / 3; i++) indices.push(i);
  }
  return { positions: Array.from(positions), indices: Array.from(indices) };
}

function readAccessor(json, bin, accessorIndex) {
  const acc = json.accessors && json.accessors[accessorIndex];
  if (!acc || !bin) return null;
  const bv = json.bufferViews && json.bufferViews[acc.bufferView];
  if (!bv) return null;
  const start = (bv.byteOffset || 0) + (acc.byteOffset || 0);
  const count = acc.count;
  const compBytes = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }[acc.componentType];
  if (!compBytes) return null;
  const numComp = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[acc.type];
  if (!numComp) return null;
  const stride = bv.byteStride || compBytes * numComp;
  const out = new Float32Array(count * numComp);
  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  for (let i = 0; i < count; i++) {
    for (let c = 0; c < numComp; c++) {
      const off = start + i * stride + c * compBytes;
      if (off + compBytes > bin.byteLength) return null;
      let v;
      if (acc.componentType === 5126) v = dv.getFloat32(off, true);
      else if (acc.componentType === 5123) v = dv.getUint16(off, true);
      else if (acc.componentType === 5125) v = dv.getUint32(off, true);
      else if (acc.componentType === 5121) v = dv.getUint8(off);
      else if (acc.componentType === 5120) v = dv.getInt8(off);
      else v = dv.getInt16(off, true);
      out[i * numComp + c] = v;
    }
  }
  return out;
}

// Push a parsed model into a batch at (x, y, z) with a uniform scale.
// Returns the number of triangles written.
export function pushGlbToBatch(b, model, x, y, z, scale, color, uv) {
  if (!model || !model.positions || !model.indices) return 0;
  const s = scale || 1;
  const c = color || [1, 1, 1];
  const u = uv || [0, 0, 1, 1];
  const [u0, v0, u1, v1] = u;
  let tris = 0;
  const idx = model.indices;
  const pos = model.positions;
  for (let t = 0; t + 2 < idx.length; t += 3) {
    const verts = [];
    for (let k = 0; k < 3; k++) {
      const vi = idx[t + k] * 3;
      verts.push([
        x + (pos[vi] || 0) * s,
        y + (pos[vi + 1] || 0) * s,
        z + (pos[vi + 2] || 0) * s,
      ]);
    }
    // Flat normal for the triangle.
    const ux = verts[1][0] - verts[0][0];
    const uy = verts[1][1] - verts[0][1];
    const uz = verts[1][2] - verts[0][2];
    const vx = verts[2][0] - verts[0][0];
    const vy = verts[2][1] - verts[0][1];
    const vz = verts[2][2] - verts[0][2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    const uvs = [[u0, v0], [u1, v0], [u1, v1]];
    for (let k = 0; k < 3; k++) {
      b.pos.push(verts[k][0], verts[k][1], verts[k][2]);
      b.col.push(c[0], c[1], c[2]);
      b.uv.push(uvs[k][0], uvs[k][1]);
      b.norm.push(nx, ny, nz);
    }
    tris++;
  }
  return tris;
}
