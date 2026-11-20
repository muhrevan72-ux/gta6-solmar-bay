// Solmar Bay — procedural texture atlas.
//
// A runtime-generated atlas (canvas 512x512, 7 tiles), no external
// files. The renderer multiplies each vertex colour by the tile
// texel, so brick walls, asphalt, sand and water get real texture
// while the voxel colours stay in charge. In Node (no document)
// the canvas step is skipped and only the UV maths is available,
// so headless tests can still check tile layout.

// Tile layout: 4 columns x 2 rows of 128px tiles.
export const ATLAS_SIZE = 512;
export const TILE = 128;
export const TILES = ['brick', 'asphalt', 'sidewalk', 'sand', 'grass', 'water', 'plain'];

const TILE_INDEX = {};
TILES.forEach((name, i) => {
  TILE_INDEX[name] = i;
});

// UV rect [u0, v0, u1, v1] for a tile name. Pure maths, works in Node.
export function tileUV(name) {
  const i = TILE_INDEX[name] !== undefined ? TILE_INDEX[name] : TILE_INDEX.plain;
  const col = i % 4;
  const row = Math.floor(i / 4);
  const u0 = (col * TILE) / ATLAS_SIZE;
  const v0 = (row * TILE) / ATLAS_SIZE;
  const u1 = ((col + 1) * TILE) / ATLAS_SIZE;
  const v1 = ((row + 1) * TILE) / ATLAS_SIZE;
  return [u0, v0, u1, v1];
}

function drawBrick(ctx, x, y) {
  ctx.fillStyle = '#b0705a';
  ctx.fillRect(x, y, TILE, TILE);
  ctx.strokeStyle = 'rgba(60,20,10,0.55)';
  ctx.lineWidth = 2;
  for (let r = 0; r < 8; r++) {
    const yy = y + r * 16;
    ctx.beginPath();
    ctx.moveTo(x, yy);
    ctx.lineTo(x + TILE, yy);
    ctx.stroke();
    const off = r % 2 ? 16 : 0;
    for (let c = -1; c < 4; c++) {
      const xx = x + c * 32 + off;
      ctx.beginPath();
      ctx.moveTo(xx, yy);
      ctx.lineTo(xx, yy + 16);
      ctx.stroke();
    }
  }
  // Speckle for a worn-brick feel.
  ctx.fillStyle = 'rgba(255,220,180,0.12)';
  for (let i = 0; i < 40; i++) {
    ctx.fillRect(x + ((i * 37) % TILE), y + ((i * 53) % TILE), 3, 3);
  }
}

function drawAsphalt(ctx, x, y) {
  ctx.fillStyle = '#2a2a2e';
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < 90; i++) {
    ctx.fillRect(x + ((i * 41) % TILE), y + ((i * 29) % TILE), 2, 2);
  }
  ctx.fillStyle = '#d8c33c';
  ctx.fillRect(x + TILE / 2 - 2, y, 4, TILE);
}

function drawSidewalk(ctx, x, y) {
  ctx.fillStyle = '#8f8f96';
  ctx.fillRect(x, y, TILE, TILE);
  ctx.strokeStyle = 'rgba(40,40,45,0.5)';
  ctx.lineWidth = 2;
  for (let r = 0; r <= 4; r++) {
    const yy = y + r * 32;
    ctx.beginPath();
    ctx.moveTo(x, yy);
    ctx.lineTo(x + TILE, yy);
    ctx.stroke();
  }
  for (let c = 0; c <= 4; c++) {
    const xx = x + c * 32;
    ctx.beginPath();
    ctx.moveTo(xx, y);
    ctx.lineTo(xx, y + TILE);
    ctx.stroke();
  }
}

function drawSand(ctx, x, y) {
  ctx.fillStyle = '#ecd194';
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = 'rgba(180,140,60,0.35)';
  for (let i = 0; i < 70; i++) {
    ctx.fillRect(x + ((i * 23) % TILE), y + ((i * 47) % TILE), 2, 2);
  }
}

function drawGrass(ctx, x, y) {
  ctx.fillStyle = '#4d8a3f';
  ctx.fillRect(x, y, TILE, TILE);
  ctx.strokeStyle = 'rgba(20,80,20,0.6)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 60; i++) {
    const bx = x + ((i * 31) % TILE);
    const by = y + ((i * 17) % TILE);
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + 2, by - 5);
    ctx.stroke();
  }
}

function drawWater(ctx, x, y) {
  ctx.fillStyle = '#1d6f96';
  ctx.fillRect(x, y, TILE, TILE);
  ctx.strokeStyle = 'rgba(200,240,255,0.5)';
  ctx.lineWidth = 2;
  for (let r = 0; r < 6; r++) {
    const yy = y + 12 + r * 20;
    ctx.beginPath();
    for (let px = 0; px <= TILE; px += 8) {
      const wy = yy + Math.sin((px / TILE) * Math.PI * 2 + r) * 3;
      if (px === 0) ctx.moveTo(x + px, wy);
      else ctx.lineTo(x + px, wy);
    }
    ctx.stroke();
  }
}

function drawPlain(ctx, x, y) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, TILE, TILE);
}

const PAINTERS = {
  brick: drawBrick,
  asphalt: drawAsphalt,
  sidewalk: drawSidewalk,
  sand: drawSand,
  grass: drawGrass,
  water: drawWater,
  plain: drawPlain,
};

// Build the atlas canvas (browser only). Returns the canvas or null.
export function buildAtlasCanvas() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext('2d');
  TILES.forEach((name, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    PAINTERS[name](ctx, col * TILE, row * TILE);
  });
  return canvas;
}

// Upload the atlas as a WebGL texture. Returns the texture or null
// (null in Node, or when WebGL is unavailable — the renderer then
// falls back to a 1x1 white texture so colours still show).
export function createAtlasTexture(gl) {
  if (!gl || typeof document === 'undefined') return null;
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
