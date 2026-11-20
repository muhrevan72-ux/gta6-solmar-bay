// Solmar Bay — minimal static .glb loader.
//
// Parses a binary glTF file far enough to draw one static mesh:
// the JSON chunk (nodes, meshes, accessors, bufferViews) and the
// BIN chunk (positions, indices). No skinning, no animation, no
// materials beyond a flat colour — the barrel prop is a static
// decoration. If anything fails, the caller draws procedural boxes
// instead, so a bad model can never break the game.
//
// Source of the shipped model: Barrel_01 by Jorge Camacho,
// Poly Haven (https://polyhaven.com/a/Barrel_01), CC0 licence,
// 2,682 triangles, stored at game/assets/barrel.glb.

const GLB_MAGIC = 0x46546c67; // 'glTF'
const CHUNK_JSON = 0x4e4f534a; // 'JSON'
const CHUNK_BIN = 0x004e4942; // 'BIN\0'

// Pure parser: ArrayBuffer -> {positions: Float32Array, indices:
// Uint16Array|Uint32Array, count} or null on any error. Testable
// in Node without fetch or WebGL.
export function parseGlb(buf) {
  try {
    if (!buf || buf.byteLength < 20) return null;
    const view = new DataView(buf);
    if (view.getUint32(0, true) !== GLB_MAGIC) return null;
    if (view.getUint32(4, true) !== 2) return null; // glTF 2.0 only
    let off = 12;
    let json = null;
    let bin = null;
    while (off + 8 <= buf.byteLength) {
      const len = view.getUint32(off, true);
      const type = view.getUint32(off + 4, true);
      const start = off + 8;
      if (type === CHUNK_JSON) {
        const text = new TextDecoder('utf-8').decode(new Uint8Array(buf, start, len));
        json = JSON.parse(text);
      } else if (type === CHUNK_BIN) {
        bin = new Uint8Array(buf, start, len);
      }
      off = start + len;
    }
    if (!json || !bin) return null;
    const mesh = json.meshes && json.meshes[0];
    if (!mesh || !mesh.primitives || !mesh.primitives[0]) return null;
    const prim = mesh.primitives[0];
    const posAcc = json.accessors[prim.attributes.POSITION];
    const idxAcc = prim.indices !== undefined ? json.accessors[prim.indices] : null;
    if (!posAcc) return null;
    const posView = json.bufferViews[posAcc.bufferView];
    const posOff = (posView.byteOffset || 0) + (posAcc.byteOffset || 0);
    const positions = new Float32Array(bin.buffer, bin.byteOffset + posOff, posAcc.count * 3);
    let indices = null;
    if (idxAcc) {
      const idxView = json.bufferViews[idxAcc.bufferView];
      const idxOff = (idxView.byteOffset || 0) + (idxAcc.byteOffset || 0);
      // 5123 = UNSIGNED_SHORT, 5125 = UNSIGNED_INT.
      if (idxAcc.componentType === 5123) {
        indices = new Uint16Array(bin.buffer, bin.byteOffset + idxOff, idxAcc.count);
      } else if (idxAcc.componentType === 5125) {
        indices = new Uint32Array(bin.buffer, bin.byteOffset + idxOff, idxAcc.count);
      } else {
        return null;
      }
    }
    return { positions, indices, count: posAcc.count };
  } catch (e) {
    return null;
  }
}

// Push a parsed model into a BoxBatch as flat-shaded triangles,
// scaled and translated to a world position. Colour is flat
// (the barrel is one rusty-red prop).
export function pushGlbToBatch(batch, model, x, y, z, scale, colour) {
  if (!model || !model.positions) return 0;
  const { positions, indices } = model;
  let pushed = 0;
  const tri = (a, b, c) => {
    const p1 = [x + positions[a * 3] * scale, y + positions[a * 3 + 1] * scale, z + positions[a * 3 + 2] * scale];
    const p2 = [x + positions[b * 3] * scale, y + positions[b * 3 + 1] * scale, z + positions[b * 3 + 2] * scale];
    const p3 = [x + positions[c * 3] * scale, y + positions[c * 3 + 1] * scale, z + positions[c * 3 + 2] * scale];
    batch.pushTri(p1, p2, p3, colour);
    pushed += 1;
  };
  if (indices) {
    for (let i = 0; i + 2 < indices.length; i += 3) tri(indices[i], indices[i + 1], indices[i + 2]);
  } else {
    for (let i = 0; i + 2 < model.count; i += 3) tri(i, i + 1, i + 2);
  }
  return pushed;
}

// Browser loader: fetch the .glb, parse it, hand it to the
// callback. Never throws — on failure the callback gets null and
// the caller falls back to procedural boxes.
export function loadGlb(url, onDone) {
  if (typeof fetch === 'undefined') {
    onDone(null);
    return;
  }
  fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.arrayBuffer();
    })
    .then((buf) => onDone(parseGlb(buf)))
    .catch(() => onDone(null));
}
