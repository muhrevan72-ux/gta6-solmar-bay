// Solmar Bay — texture atlas (rebuild #13).
// 8 tiles on a 512x512 canvas, 4 columns x 4 rows, 128 px tiles.
// Tile order: brick 0, asphalt 1, sidewalk 2, sand 3, grass 4,
// water 5, plain 6, window 7.
export const ATLAS_SIZE = 512;
export const TILE = 128;
export const TILES = ['brick', 'asphalt', 'sidewalk', 'sand', 'grass', 'water', 'plain', 'window'];

export function tileUV(name) {
  let idx = TILES.indexOf(name);
  if (idx < 0) idx = TILES.indexOf('plain');
  const col = idx % 4;
  const row = Math.floor(idx / 4);
  const u0 = col * 0.25;
  const v0 = row * 0.25;
  return [u0, v0, u0 + 0.25, v0 + 0.25];
}

export function buildAtlasCanvas() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const fills = {
    brick: '#b06048', asphalt: '#2a2a2e', sidewalk: '#8a8a86',
    sand: '#e0c890', grass: '#5a9a50', water: '#2f7fc8',
    plain: '#ffffff', window: '#66a8d8',
  };
  for (let i = 0; i < TILES.length; i++) {
    const col = i % 4, row = Math.floor(i / 4);
    ctx.fillStyle = fills[TILES[i]];
    ctx.fillRect(col * TILE, row * TILE, TILE, TILE);
    if (TILES[i] === 'brick') {
      ctx.fillStyle = '#8a4636';
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          ctx.fillRect(col * TILE + c * 32 + (r % 2) * 16, row * TILE + r * 32, 28, 4);
        }
      }
    }
    if (TILES[i] === 'window') {
      ctx.fillStyle = '#d8ecf8';
      ctx.fillRect(col * TILE + 20, row * TILE + 20, 88, 10);
      ctx.fillRect(col * TILE + 20, row * TILE + 60, 88, 10);
    }
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
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}
