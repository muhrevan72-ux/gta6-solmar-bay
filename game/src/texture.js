// Solmar Bay — the texture atlas.
//
// One 512x512 canvas holds eight 128x128 tiles in a 4x2 grid. Boxes in
// the world pick a tile by name; tileUV returns its rectangle in
// [0,1] space. In Node there is no document, so the atlas builder
// returns null and the renderer falls back to a white 1x1 texture.

export const ATLAS_SIZE = 512;
export const TILE = 128;

export const TILES = [
  'brick',
  'asphalt',
  'sidewalk',
  'sand',
  'grass',
  'water',
  'plain',
  'window',
];

export function tileUV(name) {
  let i = TILES.indexOf(name);
  if (i < 0) i = TILES.indexOf('plain');
  // 4 columns x 2 rows of 128px tiles on a 512px atlas: each tile is
  // 0.25 x 0.25 in UV space. Brick is tile 0 [0,0], plain is tile 6
  // [0.5,0.25], window is tile 7 [0.75,0.25].
  const col = i % 4;
  const row = Math.floor(i / 4);
  const u0 = col * 0.25;
  const v0 = row * 0.25;
  return [u0, v0, u0 + 0.25, v0 + 0.25];
}

// Paint one tile into a 2d context at (ox, oy).
function paintTile(ctx, name, ox, oy) {
  const s = TILE;
  if (name === 'brick') {
    ctx.fillStyle = '#9a4a38';
    ctx.fillRect(ox, oy, s, s);
    ctx.fillStyle = '#7c3627';
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 2; c++) {
        ctx.fillRect(ox + c * 64 + (r % 2) * 32 - 32, oy + r * 32 + 4, 58, 24);
      }
    }
    ctx.fillStyle = '#b98a7a';
    for (let r = 0; r <= 4; r++) ctx.fillRect(ox, oy + r * 32, s, 2);
  } else if (name === 'asphalt') {
    ctx.fillStyle = '#2e2e33';
    ctx.fillRect(ox, oy, s, s);
    ctx.fillStyle = '#45454c';
    for (let i = 0; i < 40; i++) {
      ctx.fillRect(ox + ((i * 37) % s), oy + ((i * 53) % s), 3, 3);
    }
  } else if (name === 'sidewalk') {
    ctx.fillStyle = '#9d9d96';
    ctx.fillRect(ox, oy, s, s);
    ctx.fillStyle = '#7f7f78';
    ctx.fillRect(ox, oy + 62, s, 4);
    ctx.fillRect(ox + 62, oy, 4, s);
    ctx.fillStyle = '#b5b5ae';
    for (let i = 0; i < 20; i++) {
      ctx.fillRect(ox + ((i * 29) % s), oy + ((i * 41) % s), 2, 2);
    }
  } else if (name === 'sand') {
    ctx.fillStyle = '#e0c48f';
    ctx.fillRect(ox, oy, s, s);
    ctx.fillStyle = '#c9a86a';
    for (let i = 0; i < 30; i++) {
      ctx.fillRect(ox + ((i * 43) % s), oy + ((i * 31) % s), 3, 2);
    }
  } else if (name === 'grass') {
    ctx.fillStyle = '#4d8a3f';
    ctx.fillRect(ox, oy, s, s);
    ctx.fillStyle = '#3a6e2f';
    for (let i = 0; i < 36; i++) {
      ctx.fillRect(ox + ((i * 23) % s), oy + ((i * 47) % s), 2, 6);
    }
    ctx.fillStyle = '#66a854';
    for (let i = 0; i < 20; i++) {
      ctx.fillRect(ox + ((i * 59) % s), oy + ((i * 17) % s), 2, 5);
    }
  } else if (name === 'water') {
    ctx.fillStyle = '#2f7fc4';
    ctx.fillRect(ox, oy, s, s);
    ctx.fillStyle = '#5aa8e0';
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 3; c++) {
        ctx.fillRect(ox + c * 44 + (r % 2) * 20, oy + r * 32 + 10, 28, 3);
      }
    }
  } else if (name === 'window') {
    ctx.fillStyle = '#1c2f4a';
    ctx.fillRect(ox, oy, s, s);
    ctx.fillStyle = '#4d7fb5';
    ctx.fillRect(ox + 10, oy + 10, s - 20, s - 20);
    ctx.fillStyle = '#8fb8dd';
    ctx.fillRect(ox + 10, oy + 10, s - 20, 18);
    ctx.fillStyle = '#1c2f4a';
    ctx.fillRect(ox + 60, oy + 10, 8, s - 20);
    ctx.fillRect(ox + 10, oy + 60, s - 20, 8);
  } else {
    // plain
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ox, oy, s, s);
  }
}

export function buildAtlasCanvas() {
  const doc = typeof globalThis !== 'undefined' ? globalThis.document : null;
  if (!doc || typeof doc.createElement !== 'function') return null;
  const canvas = doc.createElement('canvas');
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  for (let i = 0; i < TILES.length; i++) {
    const col = i % 4;
    const row = Math.floor(i / 4);
    paintTile(ctx, TILES[i], col * TILE, row * TILE);
  }
  return canvas;
}

export function createAtlasTexture(gl) {
  if (!gl) return null;
  const canvas = buildAtlasCanvas();
  if (!canvas) return null;
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}
