// Solmar Bay — minimal static .glb loader.
//
// Parses a glTF 2.0 binary file (GLB) far enough to push its
// triangles into a BoxBatch: JSON chunk + BIN chunk, POSITION
// accessor + indices (UNSIGNED_SHORT or UNSIGNED_INT). No
// animations, no skins, no materials — flat-shaded static props
// only. Returns a model {positions, indices} or null on bad input.
// Load failures are NOT fatal: the caller falls back to a
// procedural barrel box, so a missing or corrupt model can never
// blank the game.

import { pushTri } from './render.js';

const GLB_MAGIC = 0x46546c67; // 'glTF'
const CHUNK_JSON = 0x4e4f534a; // 'JSON'
const CHUNK_BIN = 0x004e4942; // 'BIN\0'

export function parseGlb(buf) {
  if (!buf || buf.byteLength < 20) return null;
  const view = new DataView(buf.buffer || buf, buf.byteOffset || 0, buf.byteLength);
  if (view.getUint32(0, true) !== GLB_MAGIC) return null;
  if (view.getUint32(4, true) !== 2) return null; // glTF 2.0 only
  let json = null;
  let bin = null;
  let off = 12;
  while (off + 8 <= view.byteLength) {
    const len = view.getUint32(off, true);
    const type = view.getUint32(off + 4, true);
    const data = new Uint8Array(buf.buffer || buf, (buf.byteOffset || 0) + off + 8, len);
    if (type === CHUNK_JSON) {
      json = JSON.parse(new TextDecoder().decode(data));
    } else if (type === CHUNK_BIN) {
      bin = data;
    }
    off += 8 + len;
  }
  if (!json || !bin) return null;
  const mesh = (json.meshes || [])[0];
  if (!mesh || !mesh.primitives || !mesh.primitives.length) return null;
  const prim = mesh.primitives[0];
  const posAcc = json.accessors[prim.attributes.POSITION];
  const idxAcc = prim.indices !== undefined ? json.accessors[prim.indices] : null;
  if (!posAcc) return null;
  const posView = json.bufferViews[posAcc.bufferView];
  const pos = new Float32Array(
    bin.buffer,
    bin.byteOffset + (posView.byteOffset || 0) + (posAcc.byteOffset || 0),
    posAcc.count * 3,
  );
  let indices = null;
  if (idxAcc) {
    const idxView = json.bufferViews[idxAcc.bufferView];
    const base = bin.byteOffset + (idxView.byteOffset || 0) + (idxAcc.byteOffset || 0);
    if (idxAcc.componentType === 5123) {
      indices = new Uint16Array(bin.buffer, base, idxAcc.count);
    } else if (idxAcc.componentType === 5125) {
      indices = new Uint32Array(bin.buffer, base, idxAcc.count);
    }
  }
  return { positions: pos, indices, json };
}

// Push a parsed model into a batch at (x, y, z), scaled and
// coloured. The model's own vertex order is kept; flat shading
// comes from the batch (per-face tint is baked into the colour).
export function pushGlbToBatch(b, model, x, y, z, scale, col, uvRect) {
  if (!model || !model.positions) return 0;
  const [u0, v0, u1, v1] = uvRect;
  const pos = model.positions;
  const idx = model.indices;
  let pushed = 0;
  const tri = (a, c, d) => {
    const pa = [x + pos[a * 3] * scale, y + pos[a * 3 + 1] * scale, z + pos[a * 3 + 2] * scale];
    const pb = [x + pos[c * 3] * scale, y + pos[c * 3 + 1] * scale, z + pos[c * 3 + 2] * scale];
    const pc = [x + pos[d * 3] * scale, y + pos[d * 3 + 1] * scale, z + pos[d * 3 + 2] * scale];
    pushTri(b, [pa, pb, pc], [col, col, col], [[u0, v0], [u1, v0], [u1, v1]]);
    pushed++;
  };
  if (idx) {
    for (let i = 0; i + 2 < idx.length; i += 3) tri(idx[i], idx[i + 1], idx[i + 2]);
  } else {
    for (let i = 0; i + 8 < pos.length; i += 9) tri(i / 3, i / 3 + 1, i / 3 + 2);
  }
  return pushed;
}

// Async fetch + parse. Resolves to a model or null (never rejects).
export async function loadGlb(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return parseGlb(new Uint8Array(buf));
  } catch (e) {
    return null;
  }
}
