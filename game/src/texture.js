// Solmar Bay — texture atlas.
//
// One 512x512 canvas holds eight 128x128 tiles on a 4x2 grid. Every
// box and quad in the game samples a tile through tileUV, so the whole
// city is textured from a single upload. In Node there is no document,
// so the atlas builder returns null and the renderer falls back to a
// 1x1 white texture (colours then come through untextured).

export const ATLAS_SIZE = 512;
export const TILE = 128;

// Grid order, index 0..7: brick 0, asphalt 1, sidewalk 2, sand 3,
// grass 4, water 5, plain 6, window 7. Plain is col 2, row 1.
export const TILES = ['brick', 'asphalt', 'sidewalk', 'sand', 'grass', 'water', 'plain', 'window'];

// [u0, v0, u1, v1] for a tile. Unknown names fall back to plain.
export function tileUV(name) {
  let i = TILES.indexOf(name);
  if (i < 0) i = TILES.indexOf('plain');
  const col = i % 4;
  const row = Math.floor(i / 4);
  const u0 = col * 0.25;
  const v0 = row * 0.25;
  return [u0, v0, u0 + 0.25, v0 + 0.25];
}

// Paint the atlas. Returns null where there is no document.
export function buildAtlasCanvas() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = ATLAS_SIZE;
  c.height = ATLAS_SIZE;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const paint = (name, fn) => {
    const i = TILES.indexOf(name);
    const x = (i % 4) * TILE;
    const y = Math.floor(i / 4) * TILE;
    ctx.save();
    ctx.translate(x, y);
    fn(ctx);
    ctx.restore();
  };
  // Brick courses.
  paint('brick', (ctx) => {
    ctx.fillStyle = '#8a4a3a';
    ctx.fillRect(0, 0, TILE, TILE);
    ctx.fillStyle = '#a85f4a';
    for (let r = 0; r < 4; r++) {
      for (let col = 0; col < 2; col++) {
        ctx.fillRect(col * 64 + (r % 2 ? 32 : 0) - 32, r * 32 + 3, 58, 26);
      }
    }
  });
  // Asphalt speckle.
  paint('asphalt', (ctx) => {
    ctx.fillStyle = '#2a2a2e';
    ctx.fillRect(0, 0, TILE, TILE);
    for (let i = 0; i < 220; i++) {
      const g = 30 + Math.floor(Math.random() * 40);
      ctx.fillStyle = `rgb(${g},${g},${g + 6})`;
      ctx.fillRect(Math.random() * TILE, Math.random() * TILE, 2, 2);
    }
  });
  // Sidewalk slabs.
  paint('sidewalk', (ctx) => {
    ctx.fillStyle = '#8d8d90';
    ctx.fillRect(0, 0, TILE, TILE);
    ctx.strokeStyle = '#6f6f72';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, TILE - 4, TILE - 4);
    ctx.beginPath();
    ctx.moveTo(TILE / 2, 0);
    ctx.lineTo(TILE / 2, TILE);
    ctx.moveTo(0, TILE / 2);
    ctx.lineTo(TILE, TILE / 2);
    ctx.stroke();
  });
  // Sand dots.
  paint('sand', (ctx) => {
    ctx.fillStyle = '#d9bf8a';
    ctx.fillRect(0, 0, TILE, TILE);
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? '#c9ad72' : '#e8d09a';
      ctx.fillRect(Math.random() * TILE, Math.random() * TILE, 3, 2);
    }
  });
  // Grass blades.
  paint('grass', (ctx) => {
    ctx.fillStyle = '#6a9e61';
    ctx.fillRect(0, 0, TILE, TILE);
    for (let i = 0; i < 200; i++) {
      ctx.strokeStyle = Math.random() < 0.5 ? '#557f4d' : '#7fb473';
      ctx.beginPath();
      const x = Math.random() * TILE;
      const y = Math.random() * TILE;
      ctx.moveTo(x, y);
      ctx.lineTo(x + 2, y - 6);
      ctx.stroke();
    }
  });
  // Water waves.
  paint('water', (ctx) => {
    ctx.fillStyle = '#33a5e6';
    ctx.fillRect(0, 0, TILE, TILE);
    ctx.strokeStyle = '#7cc8f0';
    ctx.lineWidth = 3;
    for (let r = 0; r < 4; r++) {
      ctx.beginPath();
      for (let x = 0; x <= TILE; x += 8) {
        const y = r * 32 + 16 + Math.sin(x / 16 + r) * 5;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });
  // Plain white (the fallback tile).
  paint('plain', (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, TILE, TILE);
  });
  // Window: dark glass with a bright frame and a lit pane.
  paint('window', (ctx) => {
    ctx.fillStyle = '#20344a';
    ctx.fillRect(0, 0, TILE, TILE);
    ctx.fillStyle = '#66a6cc';
    ctx.fillRect(10, 10, TILE - 20, TILE - 20);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(18, 18, 34, 26);
    ctx.strokeStyle = '#20344a';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, TILE - 20, TILE - 20);
    ctx.beginPath();
    ctx.moveTo(TILE / 2, 10);
    ctx.lineTo(TILE / 2, TILE - 10);
    ctx.stroke();
  });
  return c;
}

// Upload the atlas as a GL texture. Null when there is no GL context
// or no atlas canvas (Node): the renderer then uses its white fallback.
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
