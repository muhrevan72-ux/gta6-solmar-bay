// Solmar Bay — runtime texture atlas (procedural, no files).
// A 512x512 canvas with 8 tiles in a 4x2 grid, each 128x128.
// TILES order is fixed: brick 0, asphalt 1, sidewalk 2, sand 3,
// grass 4, water 5, plain 6, window 7.

export const ATLAS_SIZE = 512;
export const TILE = 128;
export const TILES = ['brick', 'asphalt', 'sidewalk', 'sand', 'grass', 'water', 'plain', 'window'];

export function tileUV(name) {
  let i = TILES.indexOf(name);
  if (i < 0) i = TILES.indexOf('plain');
  const col = i % 4;
  const row = Math.floor(i / 4);
  const u0 = col * 0.25;
  const v0 = row * 0.25;
  return [u0, v0, u0 + 0.25, v0 + 0.25];
}

// Draw the atlas into a canvas (browser only). In Node there is no
// document, so this returns null and the renderer falls back to a
// 1x1 white texture.
export function buildAtlasCanvas() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = ATLAS_SIZE;
  c.height = ATLAS_SIZE;
  const ctx = c.getContext('2d');
  const paint = (name, fn) => {
    const [u0, v0] = tileUV(name);
    const x = u0 * ATLAS_SIZE;
    const y = v0 * ATLAS_SIZE;
    ctx.save();
    ctx.translate(x, y);
    fn(ctx);
    ctx.restore();
  };
  // brick: warm red with darker mortar lines.
  paint('brick', (ctx) => {
    ctx.fillStyle = '#96604a';
    ctx.fillRect(0, 0, TILE, TILE);
    ctx.fillStyle = '#7a4a38';
    for (let y = 0; y < TILE; y += 16) ctx.fillRect(0, y, TILE, 2);
    for (let y = 0; y < TILE; y += 32) {
      for (let x = (y % 64 === 0 ? 0 : 32); x < TILE; x += 64) ctx.fillRect(x, y, 2, 16);
    }
  });
  // asphalt: dark grey with speckle.
  paint('asphalt', (ctx) => {
    ctx.fillStyle = '#2e2e33';
    ctx.fillRect(0, 0, TILE, TILE);
    ctx.fillStyle = '#3a3a40';
    for (let i = 0; i < 200; i++) {
      ctx.fillRect((i * 37) % TILE, (i * 53) % TILE, 2, 2);
    }
  });
  // sidewalk: light grey slabs.
  paint('sidewalk', (ctx) => {
    ctx.fillStyle = '#8a8a8a';
    ctx.fillRect(0, 0, TILE, TILE);
    ctx.fillStyle = '#6f6f6f';
    ctx.fillRect(0, 0, TILE, 3);
    ctx.fillRect(0, 64, TILE, 3);
    ctx.fillRect(64, 0, 3, TILE);
  });
  // sand: warm pale with dots.
  paint('sand', (ctx) => {
    ctx.fillStyle = '#d9bf8a';
    ctx.fillRect(0, 0, TILE, TILE);
    ctx.fillStyle = '#c4a878';
    for (let i = 0; i < 120; i++) {
      ctx.fillRect((i * 29) % TILE, (i * 41) % TILE, 3, 2);
    }
  });
  // grass: green with blades.
  paint('grass', (ctx) => {
    ctx.fillStyle = '#6b9e61';
    ctx.fillRect(0, 0, TILE, TILE);
    ctx.fillStyle = '#5a8a52';
    for (let i = 0; i < 160; i++) {
      ctx.fillRect((i * 23) % TILE, (i * 31) % TILE, 2, 4);
    }
  });
  // water: blue with wave streaks.
  paint('water', (ctx) => {
    ctx.fillStyle = '#33a6e6';
    ctx.fillRect(0, 0, TILE, TILE);
    ctx.fillStyle = '#7cc8f0';
    for (let y = 8; y < TILE; y += 24) ctx.fillRect(0, y, TILE, 3);
  });
  // plain: flat white (vertex colour shows through).
  paint('plain', (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, TILE, TILE);
  });
  // window: dark glass with a bright frame.
  paint('window', (ctx) => {
    ctx.fillStyle = '#22384a';
    ctx.fillRect(0, 0, TILE, TILE);
    ctx.fillStyle = '#66a6cc';
    ctx.fillRect(10, 10, TILE - 20, TILE - 20);
    ctx.fillStyle = '#22384a';
    ctx.fillRect(10, TILE / 2 - 4, TILE - 20, 8);
    ctx.fillRect(TILE / 2 - 4, 10, 8, TILE - 20);
  });
  return c;
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
