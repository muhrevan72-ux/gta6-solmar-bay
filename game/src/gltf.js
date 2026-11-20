// Solmar Bay — tiny GLB (glTF 2.0 binary) loader.
//
// Only what the game needs: the first mesh's POSITION accessor and its
// index accessor, read out of the BIN chunk. Anything malformed returns
// null instead of throwing, so a missing or corrupt asset degrades to
// the procedural fallback barrels.

import { pushTri } from './render.js';

function u32(view, off) {
  return view.getUint32(off, true);
}

// Parse a GLB buffer into {positions, indices} or null.
export function parseGlb(data) {
  if (!data || data.length < 20) return null;
  // Magic 'glTF', version 2.
  if (data[0] !== 0x67 || data[1] !== 0x6c || data[2] !== 0x54 || data[3] !== 0x46) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (u32(view, 4) !== 2) return null;
  const jsonLen = u32(view, 12);
  if (20 + 8 + jsonLen > data.length) return null;
  let json;
  try {
    const text = new TextDecoder('utf-8').decode(data.subarray(20, 20 + jsonLen));
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const mesh = json.meshes && json.meshes[0];
  const prim = mesh && mesh.primitives && mesh.primitives[0];
  if (!prim || !prim.attributes || prim.attributes.POSITION === undefined || prim.indices === undefined) return null;
  // Layout: 12-byte header, 8-byte JSON chunk header, the JSON,
  // then the 8-byte BIN chunk header and the BIN data.
  const binStart = 20 + jsonLen + 8; // past the BIN chunk header
  if (binStart > data.length) return null;
  const readAccessor = (idx) => {
    const acc = json.accessors && json.accessors[idx];
    if (!acc) return null;
    const bv = json.bufferViews && json.bufferViews[acc.bufferView];
    if (!bv) return null;
    const off = binStart + (bv.byteOffset || 0) + (acc.byteOffset || 0);
    return { acc, off };
  };
  const pos = readAccessor(prim.attributes.POSITION);
  const idx = readAccessor(prim.indices);
  if (!pos || !idx) return null;
  if (pos.acc.componentType !== 5126 || pos.acc.type !== 'VEC3') return null;
  const positions = new Float32Array(data.buffer, data.byteOffset + pos.off, pos.acc.count * 3);
  let indices = null;
  if (idx.acc.componentType === 5123) {
    indices = new Uint16Array(data.buffer, data.byteOffset + idx.off, idx.acc.count);
  } else if (idx.acc.componentType === 5125) {
    indices = new Uint32Array(data.buffer, data.byteOffset + idx.off, idx.acc.count);
  } else {
    return null;
  }
  if (indices.length % 3 !== 0) return null;
  return { positions, indices };
}

// Stamp a parsed model into a batch, scaled and translated, and return
// how many triangles were added. The model is in its own local space
// (the barrel stands ~0.88 m tall on y=0), so callers place it with
// (x, y, z) and a uniform scale.
export function pushGlbToBatch(batch, model, x, y, z, scale, color, uv) {
  if (!model || !model.positions || !model.indices) return 0;
  const s = scale || 1;
  const c = color || [0.7, 0.3, 0.15];
  const t = uv || [0, 0, 1, 1];
  const p = model.positions;
  const idx = model.indices;
  let tris = 0;
  for (let i = 0; i + 2 < idx.length; i += 3) {
    const a = idx[i] * 3;
    const b = idx[i + 1] * 3;
    const d = idx[i + 2] * 3;
    pushTri(
      batch,
      x + p[a] * s, y + p[a + 1] * s, z + p[a + 2] * s,
      x + p[b] * s, y + p[b + 1] * s, z + p[b + 2] * s,
      x + p[d] * s, y + p[d + 1] * s, z + p[d + 2] * s,
      c, t,
    );
    tris++;
  }
  return tris;
}
