// Solmar Bay — WebGL1 renderer.
//
// One batching renderer: BoxBatch accumulates triangles into CPU
// arrays, then uploads them once per frame with bufferData and
// draws with TRIANGLES. (WebGL1 has no four-vertex primitive —
// a draw with one silently draws nothing; there is a test for that.)
// Faces are pushed with CCW winding so backface culling works,
// and a one-pass boxVisible check keeps far boxes out of the
// batch entirely.
//
// FOG — DISTANCE-BASED (round-9 fix, after play-test #7):
// the old shader computed fog from NDC depth (p.z/p.w), which is
// 0.98..1.0 for ALL scene geometry with near=0.1/far=1200 — so at
// golden hour (fogFar 0.9 in NDC units) EVERYTHING fogged to 1.0
// and the whole city vanished into flat orange sky, while at night
// (fogFar 0.5 < edge0 0.55) smoothstep with edge0>edge1 is
// undefined GLSL behaviour and the fog silently disappeared.
// Fog is now a true function of camera distance in METRES:
//   vDist = length(aPos - uCamPos)
//   vFog  = smoothstep(uFogRange.x, uFogRange.y, vDist)
// with fogNear=60 m and fogFar in metres per time of day (see
// weather.js KEYS: day 420, golden 300, sunset 260, night 180).
// Nothing can be fully fogged before 260+ m — the city at 10-100 m
// always stays visible.

import { createAtlasTexture } from './texture.js';

export const BATCH_STRIDE = 8; // pos(3) + colour(3) + uv(2)

// A batch of triangles ready for one buffer upload.
export function BoxBatch() {
  return { pos: [], col: [], uv: [], tri: 0 };
}

export function batchReset(b) {
  b.pos.length = 0;
  b.col.length = 0;
  b.uv.length = 0;
  b.tri = 0;
}

export function batchTris(b) {
  return b.tri;
}

// Push one triangle (aPos/aCol/aUv are arrays of 3 vertices).
export function pushTri(b, aPos, aCol, aUv) {
  for (let i = 0; i < 3; i++) {
    b.pos.push(aPos[i][0], aPos[i][1], aPos[i][2]);
    b.col.push(aCol[i][0], aCol[i][1], aCol[i][2]);
    b.uv.push(aUv[i][0], aUv[i][1]);
  }
  b.tri++;
}

// Push a quad as two triangles. Winding is CCW from outside:
// a-b-c, a-c-d. (A quad pushed as a-b-c-d in one draw is NOT a
// thing in WebGL1 — that is why this helper exists.)
export function pushQuad(b, a, c, d, e, col, uvRect) {
  const [u0, v0, u1, v1] = uvRect;
  const uvA = [u0, v0];
  const uvB = [u1, v0];
  const uvC = [u1, v1];
  const uvD = [u0, v1];
  pushTri(b, [a, c, d], [col, col, col], [uvA, uvB, uvC]);
  pushTri(b, [a, d, e], [col, col, col], [uvA, uvC, uvD]);
}

// Push a solid box (6 faces, 12 triangles). The top and bottom
// faces are tinted differently so the city reads from any angle.
// shadeTop = 1.0, shadeSide = 0.85, shadeBot = 0.7.
export function pushBox(b, x, y, z, w, h, d, col, uvRect) {
  const x0 = x - w / 2;
  const x1 = x + w / 2;
  const y0 = y;
  const y1 = y + h;
  const z0 = z - d / 2;
  const z1 = z + d / 2;
  const top = [col[0] * 1.0, col[1] * 1.0, col[2] * 1.0];
  const side = [col[0] * 0.85, col[1] * 0.85, col[2] * 0.85];
  const bot = [col[0] * 0.7, col[1] * 0.7, col[2] * 0.7];
  const [u0, v0, u1, v1] = uvRect;
  const uv = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
  // Top (+Y): a(x0,y1,z1) b(x1,y1,z1) c(x1,y1,z0) d(x0,y1,z0)
  pushQuad(b, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], top, [u0, v0, u1, v1]);
  // Bottom (-Y)
  pushQuad(b, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], bot, [u0, v0, u1, v1]);
  // Front (+Z)
  pushQuad(b, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], side, [u0, v0, u1, v1]);
  // Back (-Z)
  pushQuad(b, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], side, [u0, v0, u1, v1]);
  // Right (+X)
  pushQuad(b, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], side, [u0, v0, u1, v1]);
  // Left (-X)
  pushQuad(b, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], side, [u0, v0, u1, v1]);
  return uv;
}

// A box rotated around Y (for the train and slalom gates).
export function pushBoxRot(b, x, y, z, w, h, d, yaw, col, uvRect) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const rot = (px, pz) => [x + px * c - pz * s, z + px * s + pz * c];
  const x0 = -w / 2;
  const x1 = w / 2;
  const z0 = -d / 2;
  const z1 = d / 2;
  const y0 = y;
  const y1 = y + h;
  const [u0, v0, u1, v1] = uvRect;
  const side = [col[0] * 0.85, col[1] * 0.85, col[2] * 0.85];
  const top = col;
  const p = (px, py, pz) => {
    const [rx, rz] = rot(px, pz);
    return [rx, py, rz];
  };
  pushQuad(b, p(x0, y1, z1), p(x1, y1, z1), p(x1, y1, z0), p(x0, y1, z0), top, [u0, v0, u1, v1]);
  pushQuad(b, p(x0, y0, z0), p(x1, y0, z0), p(x1, y0, z1), p(x0, y0, z1), side, [u0, v0, u1, v1]);
  pushQuad(b, p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1), side, [u0, v0, u1, v1]);
  pushQuad(b, p(x1, y0, z0), p(x0, y0, z0), p(x0, y1, z0), p(x1, y1, z0), side, [u0, v0, u1, v1]);
  pushQuad(b, p(x1, y0, z1), p(x1, y0, z0), p(x1, y1, z0), p(x1, y1, z1), side, [u0, v0, u1, v1]);
  pushQuad(b, p(x0, y0, z0), p(x0, y0, z1), p(x0, y1, z1), p(x0, y1, z0), side, [u0, v0, u1, v1]);
}

// Frustum + distance culling. A box is visible when its centre is
// in front of the camera and its corner is inside the horizontal
// field of view. Near boxes always pass the far-plane test.
export function boxVisible(cam, x, y, z, r) {
  const dx = x - cam.x;
  const dy = y - cam.y;
  const dz = z - cam.z;
  const d2 = dx * dx + dy * dy + dz * dz;
  if (d2 > 700 * 700) return false; // beyond the far plane
  const fx = cam.tx - cam.x;
  const fy = cam.ty - cam.y;
  const fz = cam.tz - cam.z;
  const fl = Math.hypot(fx, fy, fz) || 1;
  const dot = (dx * fx + dy * fy + dz * fz) / (Math.sqrt(d2 || 1) * fl);
  const cosHalf = Math.cos((60 * Math.PI) / 180 / 2) - 0.15;
  if (dot < cosHalf && d2 > 100 * 100) return false;
  return true;
}

// View-projection = projection * view (both column-major).
export function computeViewProj(cam, w, h) {
  const f = 1 / Math.tan((60 * Math.PI) / 180 / 2);
  const aspect = w / h;
  const near = 0.1;
  const far = 1200;
  const nf = 1 / (near - far);
  const proj = [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ];
  // LookAt view matrix.
  const ex = cam.x;
  const ey = cam.y;
  const ez = cam.z;
  let fx = cam.tx - ex;
  let fy = cam.ty - ey;
  let fz = cam.tz - ez;
  const fl = Math.hypot(fx, fy, fz) || 1;
  fx /= fl;
  fy /= fl;
  fz /= fl;
  let rx = -fz;
  let ry = 0;
  let rz = fx;
  const rl = Math.hypot(rx, ry, rz) || 1;
  rx /= rl;
  ry /= rl;
  rz /= rl;
  const ux = ry * fz - rz * fy;
  const uy = rz * fx - rx * fz;
  const uz = rx * fy - ry * fx;
  const view = [
    rx, ux, -fx, 0,
    ry, uy, -fy, 0,
    rz, uz, -fz, 0,
    -(rx * ex + ry * ey + rz * ez),
    -(ux * ex + uy * ey + uz * ez),
    fx * ex + fy * ey + fz * ez,
    1,
  ];
  // out = proj * view
  const out = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += proj[k * 4 + r] * view[c * 4 + k];
      out[c * 4 + r] = s;
    }
  }
  return out;
}

// ---------- shaders ----------
// Vertex shader: world-space position -> clip, plus the camera
// distance of the vertex for distance-based fog (see header).
const VERT_SHADER = `
attribute vec3 aPos;
attribute vec3 aCol;
attribute vec2 aUv;
uniform mat4 uVP;
uniform vec3 uCamPos;
varying vec3 vCol;
varying vec2 vUv;
varying float vDist;
void main() {
  gl_Position = uVP * vec4(aPos, 1.0);
  vCol = aCol;
  vUv = aUv;
  vDist = length(aPos - uCamPos);
}
`;

const FRAG_SHADER = `
precision mediump float;
varying vec3 vCol;
varying vec2 vUv;
varying float vDist;
uniform sampler2D uTex;
uniform vec3 uFogColor;
uniform vec2 uFogRange; // metres: [near, far]
void main() {
  vec4 tex = texture2D(uTex, vUv);
  vec3 col = vCol * tex.rgb;
  float f = smoothstep(uFogRange.x, uFogRange.y, vDist);
  gl_FragColor = vec4(mix(col, uFogColor, f), 1.0);
}
`;

function compileShader(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    throw new Error('Shader compile failed: ' + log);
  }
  return sh;
}

export function createRenderer(canvas, atlasTex) {
  const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
  if (!gl) throw new Error('WebGL is not available');
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERT_SHADER);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SHADER);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error('Program link failed: ' + gl.getProgramInfoLog(prog));
  }
  gl.useProgram(prog);
  const loc = {
    vp: gl.getUniformLocation(prog, 'uVP'),
    camPos: gl.getUniformLocation(prog, 'uCamPos'),
    fogColor: gl.getUniformLocation(prog, 'uFogColor'),
    fogRange: gl.getUniformLocation(prog, 'uFogRange'),
    tex: gl.getUniformLocation(prog, 'uTex'),
    aPos: gl.getAttribLocation(prog, 'aPos'),
    aCol: gl.getAttribLocation(prog, 'aCol'),
    aUv: gl.getAttribLocation(prog, 'aUv'),
  };
  // Texture: the atlas, or a 1x1 white fallback (colours still show).
  // The atlas is created from THIS context — a texture belongs to
  // the context that created it, so a fresh renderer (after a
  // resize) gets a fresh atlas (round-9 fix, part of the resize
  // repair: the old code passed a stale texture). In Node there
  // is no document, so createAtlasTexture returns null and the
  // white fallback is used.
  let tex = atlasTex || null;
  if (!tex) tex = createAtlasTexture(gl);
  if (!tex) {
    tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
  }
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.uniform1i(loc.tex, 0);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  const posBuf = gl.createBuffer();
  const colBuf = gl.createBuffer();
  const uvBuf = gl.createBuffer();

  const r = {
    gl,
    canvas,
    prog,
    loc,
    posBuf,
    colBuf,
    uvBuf,
    texture: tex,
    staticBatch: BoxBatch(),
    glbBatch: BoxBatch(),
    viewProj: null,
  };

  // Set the camera + fog uniforms for this frame. fogNear/fogFar
  // are METRES (round-9 fix); camPos is the camera position.
  r.setCamera = function (viewProj, fogColor, fogNear, fogFar, camPos) {
    r.viewProj = viewProj;
    gl.uniformMatrix4fv(loc.vp, false, new Float32Array(viewProj));
    gl.uniform3f(loc.fogColor, fogColor[0], fogColor[1], fogColor[2]);
    gl.uniform2f(loc.fogRange, fogNear, fogFar);
    if (camPos) gl.uniform3f(loc.camPos, camPos[0], camPos[1], camPos[2]);
  };

  // Begin a frame: clear colour + depth. This is the ONLY gl.clear
  // in the game — calling clear inside draw() wipes the frame.
  r.beginFrame = function (sky) {
    gl.clearColor(sky[0], sky[1], sky[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  };

  // Upload one batch and draw it. TRIANGLES only — never the
  // four-vertex primitive.
  r.drawBatch = function (b) {
    if (!b || b.tri === 0) return;
    const n = b.tri * 3;
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(b.pos), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(loc.aPos);
    gl.vertexAttribPointer(loc.aPos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(b.col), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(loc.aCol);
    gl.vertexAttribPointer(loc.aCol, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(b.uv), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(loc.aUv);
    gl.vertexAttribPointer(loc.aUv, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, n);
  };

  r.setViewport = function (w, h) {
    gl.viewport(0, 0, w, h);
  };

  return r;
}
