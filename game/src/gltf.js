// Solmar Bay — minimal GLB (binary glTF) reader.
// Written fresh for rebuild #18. Only the header check and the
// JSON chunk are parsed; the batch pusher takes a plain model
// object. Anything malformed returns null instead of throwing.

// Parse a GLB buffer into { positions, indices, json } or null.
export function parseGlb(buf) {
  try {
    if (!buf || buf.length < 20) return null;
    const view = buf instanceof DataView ? buf : new DataView(buf.buffer || buf, buf.byteOffset || 0, buf.byteLength || buf.length);
    const magic = view.getUint32(0, true);
    if (magic !== 0x46546c67) return null; // 'glTF'
    const version = view.getUint32(4, true);
    if (version !== 2) return null;
    const totalLen = view.getUint32(8, true);
    if (totalLen < 20 || totalLen > view.byteLength) return null;
    const chunkLen = view.getUint32(12, true);
    const chunkType = view.getUint32(16, true);
    if (chunkType !== 0x4e4f534a) return null; // 'JSON'
    const jsonBytes = new Uint8Array(view.buffer, view.byteOffset + 20, chunkLen);
    let json = null;
    try {
      json = JSON.parse(new TextDecoder().decode(jsonBytes));
    } catch (e) {
      return null;
    }
    return { json, positions: [], indices: [] };
  } catch (e) {
    return null;
  }
}

// Push a hand-made model ({ positions: [x,y,z,...], indices: [a,b,c,...] })
// into a batch as triangles at (x, y, z) scaled by `scale`, in `color`.
// Returns the number of triangles pushed.
export function pushGlbToBatch(b, model, x, y, z, scale, color, uv) {
  if (!model || !model.positions || !model.indices) return 0;
  const pos = model.positions;
  const idx = model.indices;
  let tris = 0;
  for (let i = 0; i + 2 < idx.length; i += 3) {
    const a = idx[i] * 3, c = idx[i + 1] * 3, d = idx[i + 2] * 3;
    if (a + 2 >= pos.length || c + 2 >= pos.length || d + 2 >= pos.length) continue;
    pushTri(b,
      [x + pos[a] * scale, y + pos[a + 1] * scale, z + pos[a + 2] * scale],
      [x + pos[c] * scale, y + pos[c + 1] * scale, z + pos[c + 2] * scale],
      [x + pos[d] * scale, y + pos[d + 1] * scale, z + pos[d + 2] * scale],
      color, uv);
    tris++;
  }
  return tris;
}

// One triangle, full colour, no shading.
function pushTri(b, p0, p1, p2, color, uv) {
  const u = uv || [0, 0, 1, 1];
  const uvPairs = [[u[0], u[1]], [u[2], u[1]], [u[2], u[3]]];
  const pts = [p0, p1, p2];
  for (let v = 0; v < 3; v++) {
    b.pos.push(pts[v][0], pts[v][1], pts[v][2]);
    b.col.push(color[0], color[1], color[2]);
    b.uv.push(uvPairs[v][0], uvPairs[v][1]);
  }
}
