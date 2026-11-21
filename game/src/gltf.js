// Solmar Bay — a tiny GLB (glTF binary) reader.
// The game no longer ships a barrel model: barrels are built
// procedurally from boxes (see world.js). This module stays for
// the GLB format itself — the parser rejects anything that is
// not a valid GLB (bad magic, too short, null) and otherwise
// decodes the mesh into positions + indices.

export function parseGlb(bytes) {
  if (!bytes || !(bytes instanceof Uint8Array) || bytes.length < 20) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = dv.getUint32(0, true);
  if (magic !== 0x46546C67) return null; // 'glTF'
  const version = dv.getUint32(4, true);
  if (version !== 2) return null;
  const totalLen = dv.getUint32(8, true);
  if (totalLen > bytes.length) return null;
  // First chunk: JSON.
  const chunkLen = dv.getUint32(12, true);
  const chunkType = dv.getUint32(16, true);
  if (chunkType !== 0x4E4F534A) return null; // 'JSON'
  let json;
  try {
    const text = new TextDecoder().decode(bytes.slice(20, 20 + chunkLen));
    json = JSON.parse(text);
  } catch (e) {
    return null;
  }
  // Second chunk: BIN (optional).
  let bin = null;
  let off = 20 + chunkLen;
  if (off + 8 <= bytes.length) {
    const binLen = dv.getUint32(off, true);
    const binType = dv.getUint32(off + 4, true);
    if (binType === 0x004E4942) bin = bytes.slice(off + 8, off + 8 + binLen);
  }
  if (!json.meshes || !json.meshes.length || !bin) return null;
  // Decode the first primitive of the first mesh.
  const mesh = json.meshes[0];
  const prim = mesh.primitives && mesh.primitives[0];
  if (!prim || prim.attributes === undefined) return null;
  const positions = readAccessor(json, bin, prim.attributes.POSITION);
  const indices = prim.indices !== undefined ? readAccessor(json, bin, prim.indices) : null;
  if (!positions) return null;
  return { positions, indices, json };
}

function readAccessor(json, bin, accIdx) {
  const acc = json.accessors && json.accessors[accIdx];
  if (!acc) return null;
  const bv = json.bufferViews && json.bufferViews[acc.bufferView];
  if (!bv) return null;
  const compSize = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }[acc.componentType] || 4;
  const numComp = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[acc.type] || 3;
  const stride = bv.byteStride || compSize * numComp;
  const base = (bv.byteOffset || 0) + (acc.byteOffset || 0);
  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  const out = [];
  for (let i = 0; i < acc.count; i++) {
    const o = base + i * stride;
    for (let c = 0; c < numComp; c++) {
      const p = o + c * compSize;
      if (p + compSize > bin.length) return null;
      if (acc.componentType === 5126) out.push(dv.getFloat32(p, true));
      else if (acc.componentType === 5123) out.push(dv.getUint16(p, true));
      else if (acc.componentType === 5125) out.push(dv.getUint32(p, true));
      else if (acc.componentType === 5121) out.push(bin[p]);
      else out.push(0);
    }
  }
  return out;
}

// Push a parsed GLB model's triangles into a batch, transformed
// (translated + scaled) into world space. Returns the number of
// triangles pushed.
export function pushGlbToBatch(batch, model, x, y, z, scale, color, uv) {
  if (!model || !model.positions) return 0;
  const pos = model.positions;
  const idx = model.indices;
  const u = uv || [0, 0, 1, 1];
  const push = (a, b, c) => {
    for (const v of [a, b, c]) {
      batch.pos.push(x + pos[v * 3] * scale, y + pos[v * 3 + 1] * scale, z + pos[v * 3 + 2] * scale);
      batch.col.push(color[0], color[1], color[2]);
      batch.uv.push(u[0], u[1]);
    }
  };
  let n = 0;
  if (idx && idx.length) {
    for (let i = 0; i + 2 < idx.length; i += 3) {
      push(idx[i], idx[i + 1], idx[i + 2]);
      n++;
    }
  } else {
    for (let i = 0; i + 2 < pos.length / 3; i += 3) {
      push(i, i + 1, i + 2);
      n++;
    }
  }
  return n;
}
