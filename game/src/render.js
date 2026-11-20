// Solmar Bay — WebGL1 renderer: shaders, batches, camera math.
// All geometry is boxes (12 triangles) or quads (2 triangles).
// WebGL1 has no four-vertex draw mode — every quad is emitted as
// 2 triangles and drawn with gl.TRIANGLES.

import { createAtlasTexture } from './texture.js';
import { computeViewProj as _computeViewProj } from './shots.js';

export { computeViewProj } from './shots.js';

// ---------- batches ----------
export function BoxBatch() {
  return { pos: [], col: [], uv: [] };
}
export function batchReset(b) {
  b.pos.length = 0;
  b.col.length = 0;
  b.uv.length = 0;
}
export function batchTris(b) {
  return b.pos.length / 9;
}

// Per-face brightness: top 1.0, sides 0.85, bottom 0.7.
const FACE_SHADE = [1.0, 0.7, 0.85, 0.85, 0.85, 0.85];

function pushTri(b, p0, p1, p2, color, shade, uv) {
  for (const p of [p0, p1, p2]) {
    b.pos.push(p[0], p[1], p[2]);
    b.col.push(color[0] * shade, color[1] * shade, color[2] * shade);
    b.uv.push(uv[0], uv[1]);
  }
}

// pushBox: a box centred at (x, z), sitting on y (bottom), with
// width w, height h, depth d. 12 triangles, outward winding.
// Face order: top, bottom, front (+Z), back (-Z), right (+X), left (-X).
export function pushBox(b, x, y, z, w, h, d, color, tile) {
  const uv = tile || [0.5, 0.25, 0.75, 0.5];
  const x0 = x - w / 2, x1 = x + w / 2;
  const y0 = y, y1 = y + h;
  const z0 = z - d / 2, z1 = z + d / 2;
  const c = [
    [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], // top
    [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], // bottom
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], // front +Z
    [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], // back -Z
    [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], // right +X
    [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], // left -X
  ];
  const faces = [
    [0, 1, 2, 0, 2, 3],
    [4, 5, 6, 4, 6, 7],
    [8, 9, 10, 8, 10, 11],
    [12, 13, 14, 12, 14, 15],
    [16, 17, 18, 16, 18, 19],
    [20, 21, 22, 20, 22, 23],
  ];
  for (let f = 0; f < 6; f++) {
    const idx = faces[f];
    pushTri(b, c[idx[0]], c[idx[1]], c[idx[2]], color, FACE_SHADE[f], uv);
    pushTri(b, c[idx[3]], c[idx[4]], c[idx[5]], color, FACE_SHADE[f], uv);
  }
}

// pushBoxRot: a box rotated around Y by rotY radians. 12 triangles.
export function pushBoxRot(b, x, y, z, w, h, d, rotY, color, tile) {
  const uv = tile || [0.5, 0.25, 0.75, 0.5];
  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);
  const rot = (px, pz) => {
    const dx = px - x;
    const dz = pz - z;
    return [x + dx * cos - dz * sin, z + dx * sin + dz * cos];
  };
  const x0 = x - w / 2, x1 = x + w / 2;
  const y0 = y, y1 = y + h;
  const z0 = z - d / 2, z1 = z + d / 2;
  const corners = [
    rot(x0, z0), rot(x1, z0), rot(x1, z1), rot(x0, z1),
  ];
  const c = [
    [corners[3][0], y1, corners[3][1]], [corners[2][0], y1, corners[2][1]],
    [corners[1][0], y1, corners[1][1]], [corners[0][0], y1, corners[0][1]],
    [corners[0][0], y0, corners[0][1]], [corners[1][0], y0, corners[1][1]],
    [corners[2][0], y0, corners[2][1]], [corners[3][0], y0, corners[3][1]],
    [corners[3][0], y0, corners[3][1]], [corners[2][0], y0, corners[2][1]],
    [corners[2][0], y1, corners[2][1]], [corners[3][0], y1, corners[3][1]],
    [corners[1][0], y0, corners[1][1]], [corners[0][0], y0, corners[0][1]],
    [corners[0][0], y1, corners[0][1]], [corners[1][0], y1, corners[1][1]],
    [corners[2][0], y0, corners[2][1]], [corners[1][0], y0, corners[1][1]],
    [corners[1][0], y1, corners[1][1]], [corners[2][0], y1, corners[2][1]],
    [corners[0][0], y0, corners[0][1]], [corners[3][0], y0, corners[3][1]],
    [corners[3][0], y1, corners[3][1]], [corners[0][0], y1, corners[0][1]],
  ];
  const faces = [
    [0, 1, 2, 0, 2, 3],
    [4, 5, 6, 4, 6, 7],
    [8, 9, 10, 8, 10, 11],
    [12, 13, 14, 12, 14, 15],
    [16, 17, 18, 16, 18, 19],
    [20, 21, 22, 20, 22, 23],
  ];
  for (let f = 0; f < 6; f++) {
    const idx = faces[f];
    pushTri(b, c[idx[0]], c[idx[1]], c[idx[2]], color, FACE_SHADE[f], uv);
    pushTri(b, c[idx[3]], c[idx[4]], c[idx[5]], color, FACE_SHADE[f], uv);
  }
}

// pushQuad: 4 corners in order, 2 triangles. The caller orders the
// corners so the winding faces the viewer.
export function pushQuad(b, p0, p1, p2, p3, color, tile) {
  const uv = tile || [0.5, 0.25, 0.75, 0.5];
  pushTri(b, p0, p1, p2, color, 1.0, uv);
  pushTri(b, p0, p2, p3, color, 1.0, uv);
}

// Frustum culling: in front of the camera and inside the 700 m far plane.
export function boxVisible(cam, x, y, z, r) {
  const fx = cam.tx - cam.x;
  const fy = cam.ty - cam.y;
  const fz = cam.tz - cam.z;
  const fl = Math.hypot(fx, fy, fz) || 1;
  const dx = x - cam.x;
  const dy = y - cam.y;
  const dz = z - cam.z;
  const along = (dx * fx + dy * fy + dz * fz) / fl;
  return along > -r && along < 700 + r;
}

// ---------- renderer ----------
const VERT_SRC = `
attribute vec3 aPos;
attribute vec3 aCol;
attribute vec2 aUv;
uniform mat4 uVP;
uniform vec3 uCamPos;
varying vec3 vCol;
varying vec2 vUv;
varying float vDist;
void main() {
  vec4 wp = vec4(aPos, 1.0);
  gl_Position = uVP * wp;
  vCol = aCol;
  vUv = aUv;
  vDist = distance(aPos, uCamPos);
}`;
const FRAG_SRC = `
precision mediump float;
varying vec3 vCol;
varying vec2 vUv;
varying float vDist;
uniform vec2 uFogRange;
uniform vec3 uFogColor;
uniform sampler2D uTex;
void main() {
  vec4 tex = texture2D(uTex, vUv);
  vec3 c = vCol * tex.rgb;
  float f = smoothstep(uFogRange.x, uFogRange.y, vDist);
  gl_FragColor = vec4(mix(c, uFogColor, f), 1.0);
}`;

function compileShader(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  return sh;
}

export function createRenderer(canvas, atlas) {
  // The canvas MUST already be sized before this runs: assigning
  // canvas.width/height afterwards resets the WebGL context and
  // kills the shader program, buffers and textures.
  const gl = canvas.getContext('webgl');
  const renderer = {
    gl,
    canvas,
    staticBatch: BoxBatch(),
    dynamicBatch: BoxBatch(),
    glbBatch: BoxBatch(),
    texture: null,
    _prog: null,
    _loc: {},
    _bufs: {},
    beginFrame(sky) {
      if (!gl) return;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(sky[0], sky[1], sky[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    },
    // Upload one batch and draw it. vp/camPos/fog MUST be the
    // caller's values when given (an identity matrix or a zero
    // camera position renders nothing); when omitted, fall back
    // to safe defaults so a bare drawBatch(batch) never throws.
    drawBatch(batch, vp, camPos, fogRange, fogColor) {
      if (!gl) return;
      const prog = this._prog;
      const v = vp || [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      const cp = camPos || [0, 0, 0];
      const fr = fogRange || [60, 420];
      const fc = fogColor || [0.5, 0.7, 0.9];
      gl.useProgram(prog);
      gl.uniformMatrix4fv(this._loc.uVP, false, new Float32Array(v));
      gl.uniform3f(this._loc.uCamPos, cp[0], cp[1], cp[2]);
      gl.uniform2f(this._loc.uFogRange, fr[0], fr[1]);
      gl.uniform3f(this._loc.uFogColor, fc[0], fc[1], fc[2]);
      gl.uniform1i(this._loc.uTex, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      const arrays = [
        { key: 'pos', data: batch.pos, size: 3, loc: this._loc.aPos },
        { key: 'col', data: batch.col, size: 3, loc: this._loc.aCol },
        { key: 'uv', data: batch.uv, size: 2, loc: this._loc.aUv },
      ];
      for (const a of arrays) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this._bufs[a.key]);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(a.data), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(a.loc);
        gl.vertexAttribPointer(a.loc, a.size, gl.FLOAT, false, 0, 0);
      }
      const tris = batchTris(batch);
      if (tris > 0) gl.drawArrays(gl.TRIANGLES, 0, tris * 3);
    },
  };
  if (!gl) return renderer;
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.useProgram(prog);
  renderer._prog = prog;
  renderer._loc = {
    uVP: gl.getUniformLocation(prog, 'uVP'),
    uCamPos: gl.getUniformLocation(prog, 'uCamPos'),
    uFogRange: gl.getUniformLocation(prog, 'uFogRange'),
    uFogColor: gl.getUniformLocation(prog, 'uFogColor'),
    uTex: gl.getUniformLocation(prog, 'uTex'),
    aPos: gl.getAttribLocation(prog, 'aPos'),
    aCol: gl.getAttribLocation(prog, 'aCol'),
    aUv: gl.getAttribLocation(prog, 'aUv'),
  };
  renderer._bufs = {
    pos: gl.createBuffer(),
    col: gl.createBuffer(),
    uv: gl.createBuffer(),
  };
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  // Set the viewport now (not only in beginFrame): a resize that
  // re-creates the renderer must leave a correct viewport behind
  // even before the next frame is drawn.
  gl.viewport(0, 0, canvas.width, canvas.height);
  // Texture: the atlas when there is a document, else a 1x1 white
  // fallback so vertex colours show through untextured.
  const atlasTex = atlas !== undefined ? atlas : createAtlasTexture(gl);
  if (atlasTex) {
    renderer.texture = atlasTex;
  } else {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    renderer.texture = tex;
  }
  return renderer;
}
