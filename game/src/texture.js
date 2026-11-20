// Solmar Bay — procedural texture atlas (rebuild #14).
// One 512x512 canvas holds 8 tiles of 128px; boxes reference a
// tile by UV rectangle so walls read as brick, roads as asphalt,
// and windows as framed glass instead of flat colour.

export const ATLAS_SIZE = 512;
export const TILE = 128;
export const TILES = ['brick', 'asphalt', 'sidewalk', 'sand', 'grass', 'water', 'plain', 'window'];

// UV rect [u0, v0, u1, v1] for a tile name. Unknown names fall
// back to the plain tile.
export function tileUV(name) {
  let idx = TILES.indexOf(name);
  if (idx < 0) idx = TILES.indexOf('plain');
  const col = idx % 4;
  const row = Math.floor(idx / 4);
  const s = TILE / ATLAS_SIZE;
  return [col * s, row * s, (col + 1) * s, (row + 1) * s];
}

function drawTile(ctx, name, x, y) {
  ctx.save();
  ctx.translate(x, y);
  if (name === 'brick') {
    ctx.fillStyle = '#a34a38';
    ctx.fillRect(0, 0, TILE, TILE);
    ctx.fillStyle = '#7e352a';
    for (let r = 0; r < 8; r++) {
      ctx.fillRect(0, r * 16, TILE, 2);
      const off = (r % 2) * 16;
      for (let c = 0; c < 4; c++) ctx.fillRect(((c * 32) + off) % TILE, r * 16, 2, 16);
    }
  } else if (name === 'asphalt') {
    ctx.fillStyle = '#2a2a2e';
    ctx.fillRect(0, 0, TILE, TILE);
    ctx.fillStyle = '#3a3a3e';
    for (let i = 0; i < 60; i++) ctx.fillRect((i * 37) % TILE, (i * 53) % TILE, 3, 3);
  } else if (name === 'sidewalk') {
    ctx.fillStyle = '#9a9a94';
    ctx.fillRect(0, 0, TILE, TILE);
    ctx.strokeStyle = '#7a7a74';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, TILE - 2, TILE - 2);
    ctx.beginPath();
    ctx.moveTo(TILE / 2, 0); ctx.lineTo(TILE / 2, TILE);
    ctx.moveTo(0, TILE / 2); ctx.lineTo(TILE, TILE / 2);
    ctx.stroke();
  } else if (name === 'sand') {
    ctx.fillStyle = '#e0c88f';
    ctx.fillRect(0, 0, TILE, TILE);
    ctx.fillStyle = '#c9ae6e';
    for (let i = 0; i < 40; i++) ctx.fillRect((i * 29) % TILE, (i * 41) % TILE, 3, 2);
  } else if (name === 'grass') {
    ctx.fillStyle = '#5d9c4a';
    ctx.fillRect(0, 0, TILE, TILE);
    ctx.fillStyle = '#4a7d38';
    for (let i = 0; i < 50; i++) ctx.fillRect((i * 23) % TILE, (i * 31) % TILE, 2, 5);
  } else if (name === 'water') {
    ctx.fillStyle = '#2f7fc4';
    ctx.fillRect(0, 0, TILE, TILE);
    ctx.strokeStyle = '#7fb8e8';
    ctx.lineWidth = 3;
    for (let r = 0; r < 4; r++) {
      ctx.beginPath();
      ctx.moveTo(0, 20 + r * 32);
      for (let px = 0; px <= TILE; px += 16) ctx.lineTo(px, 20 + r * 32 + ((px / 16) % 2 ? 4 : -4));
      ctx.stroke();
    }
  } else if (name === 'window') {
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(0, 0, TILE, TILE);
    ctx.fillStyle = '#7fb3d5';
    ctx.fillRect(16, 16, TILE - 32, TILE - 32);
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(TILE / 2 - 4, 16, 8, TILE - 32);
    ctx.fillRect(16, TILE / 2 - 4, TILE - 32, 8);
    ctx.fillStyle = '#d5e8f5';
    ctx.fillRect(24, 24, 24, 24);
  } else {
    ctx.fillStyle = '#dddddd';
    ctx.fillRect(0, 0, TILE, TILE);
  }
  ctx.restore();
}

// Build the atlas canvas. Returns null without a document (Node)
// or when the 2D context cannot draw (a stub context).
export function buildAtlasCanvas(doc) {
  if (!doc || typeof doc.createElement !== 'function') return null;
  try {
    const canvas = doc.createElement('canvas');
    canvas.width = ATLAS_SIZE;
    canvas.height = ATLAS_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx || typeof ctx.translate !== 'function') return null;
    for (let i = 0; i < TILES.length; i++) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      drawTile(ctx, TILES[i], col * TILE, row * TILE);
    }
    return canvas;
  } catch (e) {
    return null;
  }
}

// Upload the atlas as a GL texture. Null when there is no GL
// context (or no atlas canvas), so the renderer falls back to its
// 1x1 white texture.
export function createAtlasTexture(gl, doc) {
  if (!gl) return null;
  const canvas = buildAtlasCanvas(doc);
  if (!canvas) return null;
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return tex;
}
