// Solmar Bay — procedural texture atlas.
// Written fresh for rebuild #18. The atlas is a 512x512 canvas
// holding 8 tiles of 128px in a 4x2 grid. In Node (no document)
// the canvas is null and the renderer falls back to a 1x1 white
// texture; the UV math still works headlessly.

export const ATLAS_SIZE = 512;
export const TILE = 128;
export const TILES = ['brick', 'asphalt', 'sidewalk', 'sand', 'grass', 'water', 'plain', 'window'];

// UV rect [u0, v0, u1, v1] for a tile name. Tile i sits at
// column i%4, row floor(i/4). Unknown names fall back to plain.
export function tileUV(name) {
  let i = TILES.indexOf(name);
  if (i < 0) i = TILES.indexOf('plain');
  const col = i % 4;
  const row = Math.floor(i / 4);
  const u0 = col * 0.25;
  const v0 = row * 0.25;
  return [u0, v0, u0 + 0.25, v0 + 0.25];
}

// Paint the atlas onto a canvas. Returns null in Node (no document).
export function buildAtlasCanvas() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = ATLAS_SIZE;
  c.height = ATLAS_SIZE;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const paint = [
    // brick: warm red-brown with mortar lines
    (x, y) => {
      ctx.fillStyle = '#9a5a44'; ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#7a4636';
      for (let r = 0; r < 4; r++) ctx.fillRect(x, y + r * 32, TILE, 3);
      ctx.fillStyle = '#b0705a';
      for (let r = 0; r < 4; r++) for (let k = 0; k < 2; k++) ctx.fillRect(x + k * 64 + (r % 2) * 32, y + r * 32, 4, 32);
    },
    // asphalt: dark grey with speckles
    (x, y) => {
      ctx.fillStyle = '#2a2a2e'; ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#3a3a40';
      for (let i = 0; i < 40; i++) ctx.fillRect(x + ((i * 37) % TILE), y + ((i * 53) % TILE), 3, 3);
    },
    // sidewalk: pale concrete slabs
    (x, y) => {
      ctx.fillStyle = '#aeaea8'; ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#8f8f8a';
      ctx.fillRect(x, y + 64, TILE, 3); ctx.fillRect(x + 64, y, 3, TILE);
    },
    // sand: warm pale yellow
    (x, y) => {
      ctx.fillStyle = '#e6cc8a'; ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#d4b878';
      for (let i = 0; i < 30; i++) ctx.fillRect(x + ((i * 41) % TILE), y + ((i * 29) % TILE), 4, 2);
    },
    // grass: green with blades
    (x, y) => {
      ctx.fillStyle = '#6aa061'; ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#5a8f52';
      for (let i = 0; i < 50; i++) ctx.fillRect(x + ((i * 23) % TILE), y + ((i * 31) % TILE), 2, 5);
    },
    // water: bright blue with wave streaks
    (x, y) => {
      ctx.fillStyle = '#33a6e6'; ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#7cc8f0';
      for (let r = 0; r < 4; r++) ctx.fillRect(x, y + r * 32 + 8, TILE, 4);
    },
    // plain: flat light grey (the fallback tile)
    (x, y) => {
      ctx.fillStyle = '#c8c8c8'; ctx.fillRect(x, y, TILE, TILE);
    },
    // window: dark glass with a lit cross
    (x, y) => {
      ctx.fillStyle = '#1d2f4a'; ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#66a6d9';
      ctx.fillRect(x + 12, y + 12, TILE - 24, TILE - 24);
      ctx.fillStyle = '#1d2f4a';
      ctx.fillRect(x + TILE / 2 - 4, y, 8, TILE);
      ctx.fillRect(x, y + TILE / 2 - 4, TILE, 8);
    },
  ];
  for (let i = 0; i < TILES.length; i++) {
    paint[i]((i % 4) * TILE, Math.floor(i / 4) * TILE);
  }
  return c;
}

// Upload the atlas as a GL texture. Returns null without a GL context.
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
