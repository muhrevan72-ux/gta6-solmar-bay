// Solmar Bay — minimal STATIC glTF 2.0 loader (visual overhaul).
//
// This is a geometry-only loader for a single static prop: it reads a
// .glb (the binary glTF container), pulls out the first mesh's
// POSITION + index accessors, and emits the triangles into a BoxBatch
// with flat per-face shading that matches the voxel look (top 1.0,
// +/-X 0.85, +/-Z 0.75, bottom 0.6 — the same shade order as
// BoxBatch.pushBox). It deliberately does NOT support: skins, skeletal
// animation, morph targets, multiple meshes, or textures — the model
// is drawn in one flat colour (the caller supplies it, e.g. the red
// of the oil drum). A model that needs any of those is out of scope;
// report it as cut instead of claiming it works.
//
// The one model shipped is Barrel_01 from Poly Haven
// (https://polyhaven.com/a/Barrel_01, CC0 public domain, author Jorge
// Camacho), repacked from its .gltf + .bin into game/assets/barrel.glb
// (83,424 bytes). The Khronos "Duck" sample was REJECTED for this
// slot: it is under the SCEA Shared Source License, not a permissive
// open licence, so it does not meet the "legally licensed assets" rule.
//
// Loading is async (fetch) and the game never waits for it: if the
// fetch or parse fails, the caller falls back to procedural boxes, so
// the game still works offline and the prop is never load-bearing.

const COMP = {
  5120: { size: 1, get: (v, o) => v.getInt8(o) },
  5121: { size: 1, get: (v, o) => v.getUint8(o) },
  5122: { size: 2, get: (v, o) => v.getInt16(o, true) },
  5123: { size: 2, get: (v, o) => v.getUint16(o, true) },
  5125: { size: 4, get: (v, o) => v.getUint32(o, true) },
  5126: { size: 4, get: (v, o) => v.getFloat32(o, true) },
};
const TYPE_COUNT = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

// Parse a .glb ArrayBuffer. Returns { positions: Float32Array,
// indices: Uint16Array|Uint32Array, triangles: number } — the first
// mesh's first primitive, unindexed order preserved. Throws on a bad
// magic, a bad version, a missing JSON chunk, or an unsupported
// accessor (only float32 POSITION and integer indices are read).
export function parseGLB(buf) {
  const view = new DataView(buf);
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error('glb: bad magic (not a .glb file)');
  if (view.getUint32(4, true) !== 2) throw new Error('glb: only glTF 2.0 is supported');
  const total = view.getUint32(8, true);
  if (total !== buf.byteLength) throw new Error('glb: length field does not match the file');
  let off = 12;
  let json = null;
  let bin = null;
  while (off + 8 <= buf.byteLength) {
    const len = view.getUint32(off, true);
    const type = view.getUint32(off + 4, true);
    const start = off + 8;
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, start, len)));
    else if (type === 0x004e4942) bin = new DataView(buf, start, len);
    off = start + len;
  }
  if (!json) throw new Error('glb: no JSON chunk');
  if (!bin) throw new Error('glb: no BIN chunk');
  const mesh = (json.meshes || [])[0];
  if (!mesh) throw new Error('glb: no meshes');
  const prim = (mesh.primitives || [])[0];
  if (!prim || prim.attributes.POSITION === undefined || prim.indices === undefined) {
    throw new Error('glb: first primitive has no POSITION + indices');
  }
  const readAccessor = (idx) => {
    const acc = json.accessors[idx];
    const bv = json.bufferViews[acc.bufferView];
    const comp = COMP[acc.componentType];
    if (!comp) throw new Error('glb: unsupported componentType ' + acc.componentType);
    const n = TYPE_COUNT[acc.type];
    const base = (bv.byteOffset || 0) + (acc.byteOffset || 0);
    const stride = bv.byteStride || comp.size * n;
    const out = new Float32Array(acc.count * n);
    for (let i = 0; i < acc.count; i++) {
      for (let k = 0; k < n; k++) out[i * n + k] = comp.get(bin, base + i * stride + k * comp.size);
    }
    return { data: out, count: acc.count, n };
  };
  const pos = readAccessor(prim.attributes.POSITION);
  if (pos.n !== 3) throw new Error('glb: POSITION is not a VEC3');
  const idxAcc = json.accessors[prim.indices];
  const idxBv = json.bufferViews[idxAcc.bufferView];
  const idxComp = COMP[idxAcc.componentType];
  if (!idxComp || idxComp.size > 4) throw new Error('glb: unsupported index componentType ' + idxAcc.componentType);
  const idxBase = (idxBv.byteOffset || 0) + (idxAcc.byteOffset || 0);
  const idxStride = idxBv.byteStride || idxComp.size;
  const indices = idxComp.size === 4 ? new Uint32Array(idxAcc.count) : new Uint16Array(idxAcc.count);
  for (let i = 0; i < idxAcc.count; i++) indices[i] = idxComp.get(bin, idxBase + i * idxStride);
  return { positions: pos.data, indices, triangles: idxAcc.count / 3 };
}

// Fetch + parse a .glb URL. Returns the parsed model, or null on any
// failure (network, bad file) so the caller can fall back.
export async function loadGLB(url) {
  try {
    if (typeof fetch === 'undefined') return null;
    const res = await fetch(url);
    if (!res.ok) return null;
    return parseGLB(await res.arrayBuffer());
  } catch (e) {
    return null;
  }
}

// Emit a parsed model into a BoxBatch at (x, z) with a yaw and a
// scale, in one flat colour. Each triangle is shaded by its face
// normal's dominant axis (top 1.0, +/-X 0.85, +/-Z 0.75, bottom
// 0.6) so the model reads like the voxel boxes around it.
export function addGLBToBatch(batch, model, opts) {
  if (!model) return 0;
  const { x, z, yaw = 0, scale = 1, color } = opts;
  const cos = Math.cos(yaw), sin = Math.sin(yaw);
  const pos = model.positions;
  const idx = model.indices;
  let emitted = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const pts = [];
    for (let k = 0; k < 3; k++) {
      const vi = idx[t + k] * 3;
      const px = pos[vi] * scale;
      const py = pos[vi + 1] * scale;
      const pz = pos[vi + 2] * scale;
      pts.push([x + px * cos - pz * sin, py, z + px * sin + pz * cos]);
    }
    // Face normal (unnormalised is fine — only the dominant axis
    // matters for the shade).
    const ux = pts[1][0] - pts[0][0], uy = pts[1][1] - pts[0][1], uz = pts[1][2] - pts[0][2];
    const vx = pts[2][0] - pts[0][0], vy = pts[2][1] - pts[0][1], vz = pts[2][2] - pts[0][2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
    let shade = 0.75;
    if (ay >= ax && ay >= az) shade = ny > 0 ? 1.0 : 0.6;
    else if (ax >= az) shade = 0.85;
    else shade = 0.75;
    const c = [
      Math.min(1.4, color[0] * shade),
      Math.min(1.4, color[1] * shade),
      Math.min(1.4, color[2] * shade),
    ];
    batch.pushTri(pts[0][0], pts[0][1], pts[0][2], pts[1][0], pts[1][1], pts[1][2], pts[2][0], pts[2][1], pts[2][2], c);
    emitted++;
  }
  return emitted;
}
