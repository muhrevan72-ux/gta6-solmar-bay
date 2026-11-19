// Solmar Bay — procedural texture atlas (visual overhaul).
//
// The renderer is vertex-coloured; this atlas adds subtle surface
// detail (brick, asphalt, sidewalk, sand, grass, water) without any
// external files: the atlas is drawn on a canvas at runtime, so the
// game stays dependency-free and offline. The fragment shader
// multiplies the texture by the vertex colour, so a building keeps
// its own tint — the tiles are deliberately light and low-contrast.
//
// Atlas: 512x512, one row of 64x64 tiles. Tile rects are in UV space
// (v = 1 at the top of the canvas, because the upload flips Y).
// BoxBatch emits UVs per face (see render.js); the 'plain' tile is
// white, so every call that does not ask for a texture renders
// exactly as before. Pure tile math is headless-testable; the canvas
// drawing and the GL upload run in the browser only.

export const ATLAS_SIZE = 512;
export const TILE_PX = 64;
export const TILE_COLS = ATLAS_SIZE / TILE_PX; // 8

// name -> [col, row] (row 0 = top of the canvas) and the world size
// of one tile repeat.
export const TILES = {
  plain: { col: 0, row: 0, size: 0 }, // no repeat (white)
  brick: { col: 1, row: 0, size: 4 },
  asphalt: { col: 2, row: 0, size: 8 },
  sidewalk: { col: 3, row: 0, size: 4 },
  sand: { col: 4, row: 0, size: 8 },
  grass: { col: 5, row: 0, size: 8 },
  water: { col: 6, row: 0, size: 8 },
};

// UV rect [u0, v0, u1, v1] for a tile name. Pure — headless-testable.
export function tileUV(name) {
  const t = TILES[name] || TILES.plain;
  const u0 = t.col / TILE_COLS;
  const u1 = (t.col + 1) / TILE_COLS;
  const v1 = 1 - t.row / TILE_COLS;
  const v0 = 1 - (t.row + 1) / TILE_COLS;
  return [u0, v0, u1, v1];
}

// UV rect for one face of size (w, h) in world units: the tile
// repeats every `size` world units (plain never repeats). Pure.
export function faceUV(name, w, h) {
  const t = TILES[name] || TILES.plain;
  const [u0, v0, u1, v1] = tileUV(name);
  if (!t.size) return [u0, v0, u1, v1];
  const ru = Math.max(1, Math.round(w / t.size));
  const rv = Math.max(1, Math.round(h / t.size));
  return [u0, v0, u0 + (u1 - u0) * ru, v0 + (v1 - v0) * rv];
}

// Draw the atlas onto a 2D canvas context (browser only).
// Every tile is light and low-contrast: it multiplies the vertex
// colour, so the building/road keeps its own tint.
export function drawAtlas(ctx) {
  const S = TILE_PX;
  function tile(name) {
    const t = TILES[name];
    return { x: t.col * S, y: t.row * S };
  }
  function speckle(x, y, n, colours) {
    for (let i = 0; i < n; i++) {
      const px = x + ((i * 37) % S);
      const py = y + ((i * 53) % S);
      ctx.fillStyle = colours[i % colours.length];
      ctx.fillRect(px, py, 2, 2);
    }
  }
  // plain: white.
  let p = tile('plain');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(p.x, p.y, S, S);
  // brick: pale base, darker mortar lines (offset rows).
  p = tile('brick');
  ctx.fillStyle = '#e8e0d8';
  ctx.fillRect(p.x, p.y, S, S);
  ctx.fillStyle = '#c8bcb0';
  for (let r = 0; r < 4; r++) {
    ctx.fillRect(p.x, p.y + r * 16, S, 2);
    const off = (r % 2) * 16;
    for (let c = -1; c < 3; c++) ctx.fillRect(p.x + off + c * 32, p.y + r * 16, 2, 16);
  }
  // asphalt: light grey with darker speckles.
  p = tile('asphalt');
  ctx.fillStyle = '#d8d8d8';
  ctx.fillRect(p.x, p.y, S, S);
  speckle(p.x, p.y, 60, ['#b0b0b0', '#c0c0c0', '#a8a8a8']);
  // sidewalk: pale grey with a grid.
  p = tile('sidewalk');
  ctx.fillStyle = '#e0e0e0';
  ctx.fillRect(p.x, p.y, S, S);
  ctx.fillStyle = '#b8b8b8';
  ctx.fillRect(p.x + 31, p.y, 2, S);
  ctx.fillRect(p.x, p.y + 31, S, 2);
  speckle(p.x, p.y, 20, ['#c8c8c8']);
  // sand: warm pale with speckles.
  p = tile('sand');
  ctx.fillStyle = '#f0e0c0';
  ctx.fillRect(p.x, p.y, S, S);
  speckle(p.x, p.y, 50, ['#d8c090', '#e8d0a0', '#c8b088']);
  // grass: pale green with speckles.
  p = tile('grass');
  ctx.fillStyle = '#c8e0b0';
  ctx.fillRect(p.x, p.y, S, S);
  speckle(p.x, p.y, 50, ['#a8c890', '#b8d8a0', '#98b888']);
  // water: pale blue with wave lines.
  p = tile('water');
  ctx.fillStyle = '#c0d8e8';
  ctx.fillRect(p.x, p.y, S, S);
  ctx.strokeStyle = '#90b8d0';
  ctx.lineWidth = 2;
  for (let r = 0; r < 4; r++) {
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + 8 + r * 16);
    ctx.bezierCurveTo(p.x + 20, p.y + 4 + r * 16, p.x + 40, p.y + 12 + r * 16, p.x + S, p.y + 8 + r * 16);
    ctx.stroke();
  }
}

// Build the atlas texture (browser only). Falls back to a 1x1 white
// texture if the canvas cannot be created, so the game still renders
// exactly as before (white x vertex colour = vertex colour).
export function createAtlasTexture(gl) {
  const white = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, white);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  try {
    if (typeof document === 'undefined') return white;
    const canvas = document.createElement('canvas');
    canvas.width = ATLAS_SIZE;
    canvas.height = ATLAS_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return white;
    drawAtlas(ctx);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return tex;
  } catch (e) {
    return white;
  }
}
