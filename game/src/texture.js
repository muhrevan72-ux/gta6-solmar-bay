// Solmar Bay — the 8-tile texture atlas.
// The atlas is a 512x512 canvas (4 columns x 2 rows of 128 px
// tiles). In Node there is no document, so buildAtlasCanvas
// returns null and createAtlasTexture returns null — the
// renderer then falls back to a 1x1 white texture.

export const ATLAS_SIZE = 512;
export const TILE = 128;

export const TILES = ['brick', 'asphalt', 'sidewalk', 'sand', 'grass', 'water', 'plain', 'window'];

// Tile index -> UV rect [u0, v0, u1, v1].
// The atlas is a 4x4 grid of 128 px tiles (the 8 tiles occupy
// the first two rows): tile i sits at column i%4, row floor(i/4);
// each tile spans 0.25 in u and v.
export function tileUV(name) {
  const idx = TILES.indexOf(name);
  const i = idx < 0 ? 6 : idx; // unknown names fall back to 'plain'
  const col = i % 4, row = Math.floor(i / 4);
  return [col / 4, row / 4, (col + 1) / 4, (row + 1) / 4];
}

// Paint a simple procedural tile pattern on a canvas context.
function paintTile(ctx, name, x, y) {
  const s = TILE;
  ctx.save();
  ctx.translate(x, y);
  if (name === 'brick') {
    ctx.fillStyle = '#a85c4a';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#8a4638';
    for (let r = 0; r < 8; r++) {
      const off = (r % 2) * 16;
      for (let c = -1; c < 4; c++) ctx.fillRect(c * 32 + off + 2, r * 16 + 2, 28, 12);
    }
  } else if (name === 'asphalt') {
    ctx.fillStyle = '#2a2a2e';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#3a3a3e';
    for (let i = 0; i < 40; i++) ctx.fillRect((i * 37) % s, (i * 23) % s, 3, 3);
  } else if (name === 'sidewalk') {
    ctx.fillStyle = '#8c8c92';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#6c6c72';
    ctx.fillRect(0, 62, s, 4);
    ctx.fillRect(62, 0, 4, s);
  } else if (name === 'sand') {
    ctx.fillStyle = '#e6cc8c';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#d4b878';
    for (let i = 0; i < 30; i++) ctx.fillRect((i * 41) % s, (i * 29) % s, 4, 2);
  } else if (name === 'grass') {
    ctx.fillStyle = '#6ba060';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#4e8a48';
    for (let i = 0; i < 40; i++) ctx.fillRect((i * 31) % s, (i * 17) % s, 2, 6);
  } else if (name === 'water') {
    ctx.fillStyle = '#3380e6';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#66aae6';
    for (let r = 0; r < 6; r++) ctx.fillRect(0, r * 22 + 6, s, 3);
  } else if (name === 'window') {
    ctx.fillStyle = '#2c4a6a';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#8cc0e6';
    ctx.fillRect(10, 10, 50, 50);
    ctx.fillRect(68, 10, 50, 50);
    ctx.fillRect(10, 68, 50, 50);
    ctx.fillRect(68, 68, 50, 50);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, s, s);
  }
  ctx.restore();
}

export function buildAtlasCanvas() {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = ATLAS_SIZE;
  cv.height = ATLAS_SIZE;
  const ctx = cv.getContext('2d');
  for (let i = 0; i < TILES.length; i++) {
    const col = i % 4, row = Math.floor(i / 4);
    paintTile(ctx, TILES[i], col * TILE, row * TILE);
  }
  return cv;
}

// In Node this returns null (no document); the renderer uses a
// 1x1 white texture instead.
export function createAtlasTexture(gl) {
  const cv = buildAtlasCanvas();
  if (!cv || !gl) return null;
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}
