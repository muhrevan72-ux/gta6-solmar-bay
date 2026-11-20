// Solmar Bay — minimal static GLB (glTF 2.0) loader (rebuild #13).
// Reads the JSON chunk + BIN chunk, returns positions + indices.
// Never throws on bad input: returns null.
import { pushBox } from './render.js';

export function parseGlb(bytes) {
  try {
    if (!bytes || bytes.length < 20) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const magic = view.getUint32(0, true);
    if (magic !== 0x46546c67) return null; // 'glTF'
    const version = view.getUint32(4, true);
    if (version !== 2) return null;
    const jsonLen = view.getUint32(12, true);
    const jsonType = view.getUint32(16, true);
    if (jsonType !== 0x4e4f534a) return null; // 'JSON'
    if (20 + jsonLen > bytes.length) return null;
    const jsonText = new TextDecoder('utf-8').decode(bytes.subarray(20, 20 + jsonLen));
    const json = JSON.parse(jsonText);
    // BIN chunk follows the JSON chunk.
    let binStart = 20 + jsonLen;
    let bin = null;
    if (binStart + 8 <= bytes.length) {
      const binLen = view.getUint32(binStart, true);
      const binType = view.getUint32(binStart + 4, true);
      if (binType === 0x004e4942) { // 'BIN\0'
        bin = bytes.subarray(binStart + 8, binStart + 8 + binLen);
      }
    }
    if (!bin) return null;
    const mesh = json.meshes && json.meshes[0];
    const prim = mesh && mesh.primitives && mesh.primitives[0];
    if (!prim || !prim.attributes || prim.attributes.POSITION === undefined) return null;
    const readAccessor = (idx) => {
      const acc = json.accessors[idx];
      const bv = json.bufferViews[acc.bufferView];
      const compSize = { 5126: 4, 5123: 2, 5125: 4, 5121: 1 }[acc.componentType];
      if (!compSize) return null;
      const nComp = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[acc.type] || 1;
      const start = (bv.byteOffset || 0) + (acc.byteOffset || 0);
      const stride = bv.byteStride || compSize * nComp;
      const out = new Float32Array(acc.count * nComp);
      const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
      for (let i = 0; i < acc.count; i++) {
        for (let c = 0; c < nComp; c++) {
          const off = start + i * stride + c * compSize;
          if (acc.componentType === 5126) out[i * nComp + c] = dv.getFloat32(off, true);
          else if (acc.componentType === 5123) out[i * nComp + c] = dv.getUint16(off, true);
          else if (acc.componentType === 5125) out[i * nComp + c] = dv.getUint32(off, true);
          else out[i * nComp + c] = dv.getUint8(off);
        }
      }
      return out;
    };
    const positions = readAccessor(prim.attributes.POSITION);
    if (!positions) return null;
    let indices = null;
    if (prim.indices !== undefined) {
      const acc = json.accessors[prim.indices];
      const bv = json.bufferViews[acc.bufferView];
      const start = (bv.byteOffset || 0) + (acc.byteOffset || 0);
      const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
      if (acc.componentType === 5123) {
        indices = new Uint16Array(acc.count);
        for (let i = 0; i < acc.count; i++) indices[i] = dv.getUint16(start + i * 2, true);
      } else if (acc.componentType === 5125) {
        indices = new Uint32Array(acc.count);
        for (let i = 0; i < acc.count; i++) indices[i] = dv.getUint32(start + i * 4, true);
      } else {
        indices = new Uint8Array(acc.count);
        for (let i = 0; i < acc.count; i++) indices[i] = dv.getUint8(start + i);
      }
    } else {
      indices = new Uint32Array(positions.length / 3);
      for (let i = 0; i < indices.length; i++) indices[i] = i;
    }
    return { positions, indices, json };
  } catch (e) {
    return null;
  }
}

// Push a parsed GLB model into a batch at (x, y, z), scaled, tinted.
// Returns the number of triangles pushed (0 when the model is null).
export function pushGlbToBatch(batch, model, x, y, z, scale, col, uv) {
  if (!model || !model.positions || !model.indices) return 0;
  const pos = model.positions;
  const idx = model.indices;
  const tris = Math.floor(idx.length / 3);
  const [u0, v0, u1, v1] = uv;
  for (let t = 0; t < tris; t++) {
    for (let v = 0; v < 3; v++) {
      const vi = idx[t * 3 + v] * 3;
      batch.pos.push(x + pos[vi] * scale, y + pos[vi + 1] * scale, z + pos[vi + 2] * scale);
      batch.col.push(col[0], col[1], col[2]);
    }
    batch.uv.push(u0, v0, u1, v0, u1, v1);
  }
  return tris;
}

// Fallback when the GLB cannot be fetched (Node / offline): three
// procedural barrels, 12 triangles each = 36 total.
export function pushFallbackBarrels(batch, positions, col, uv) {
  let n = 0;
  for (const p of positions) {
    pushBox(batch, p[0], p[1], p[2], 1.2, 2, 1.2, col, uv);
    n += 12;
  }
  return n;
}
