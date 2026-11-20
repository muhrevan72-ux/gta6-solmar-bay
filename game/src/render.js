// Solmar Bay — the WebGL renderer.
//
// One shader, three vertex buffers (position, colour, UV) and three
// batches per frame: the static city, the dynamic entities and the GLB
// props. Every draw is gl.TRIANGLES — WebGL1 has no four-vertex
// primitive. Boxes carry per-face shading (top 1.0, sides 0.85,
// bottom 0.7) so the city reads in daylight without a light pass.

import { cameraView, perspective, matMul } from './shots.js';

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

// One triangle, colour and UV as given (no shading — the caller chose
// the exact colour, e.g. a GLB vertex or a window quad).
export function pushTri(b, ax, ay, az, bx, by, bz, cx, cy, cz, color, uv) {
  const c = color || [1, 1, 1];
  const t = uv || [0, 0, 1, 1];
  b.pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
  for (let i = 0; i < 3; i++) b.col.push(c[0], c[1], c[2]);
  b.uv.push(t[0], t[1], t[2], t[1], t[2], t[3]);
}

function pushFace(b, verts, shade, color, uv) {
  // verts: 6 corners (two triangles). Shade multiplies the colour.
  const c = color || [1, 1, 1];
  const t = uv || [0, 0, 1, 1];
  const r = c[0] * shade;
  const g = c[1] * shade;
  const bl = c[2] * shade;
  for (let i = 0; i < 6; i++) {
    b.pos.push(verts[i][0], verts[i][1], verts[i][2]);
    b.col.push(r, g, bl);
  }
  // UVs follow the face: (u0,v0) (u0,v1) (u1,v1) (u0,v0) (u1,v1) (u1,v0).
  b.uv.push(t[0], t[1], t[0], t[3], t[2], t[3], t[0], t[1], t[2], t[3], t[2], t[1]);
}

// A box centred on (x, z) and sitting on y (y is the BOTTOM face).
// Faces are emitted top, bottom, +Z, -Z, +X, -X, each counter-clockwise
// from outside so every normal points outward.
export function pushBox(b, x, y, z, w, h, d, color, uv) {
  const x0 = x - w / 2;
  const x1 = x + w / 2;
  const y0 = y;
  const y1 = y + h;
  const z0 = z - d / 2;
  const z1 = z + d / 2;
  pushFace(b, [
    [x0, y1, z0], [x0, y1, z1], [x1, y1, z1],
    [x0, y1, z0], [x1, y1, z1], [x1, y1, z0],
  ], 1.0, color, uv); // top
  pushFace(b, [
    [x0, y0, z0], [x1, y0, z0], [x1, y0, z1],
    [x0, y0, z0], [x1, y0, z1], [x0, y0, z1],
  ], 0.7, color, uv); // bottom
  pushFace(b, [
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1],
    [x0, y0, z1], [x1, y1, z1], [x0, y1, z1],
  ], 0.85, color, uv); // +Z
  pushFace(b, [
    [x0, y0, z0], [x0, y1, z0], [x1, y1, z0],
    [x0, y0, z0], [x1, y1, z0], [x1, y0, z0],
  ], 0.85, color, uv); // -Z
  pushFace(b, [
    [x1, y0, z0], [x1, y1, z0], [x1, y1, z1],
    [x1, y0, z0], [x1, y1, z1], [x1, y0, z1],
  ], 0.85, color, uv); // +X
  pushFace(b, [
    [x0, y0, z0], [x0, y0, z1], [x0, y1, z1],
    [x0, y0, z0], [x0, y1, z1], [x0, y1, z0],
  ], 0.85, color, uv); // -X
}

// A box rotated around the Y axis by rotY (radians), same faces.
export function pushBoxRot(b, x, y, z, w, h, d, rotY, color, uv) {
  const c = Math.cos(rotY || 0);
  const s = Math.sin(rotY || 0);
  const rot = (px, pz) => [x + px * c - pz * s, z + px * s + pz * c];
  const x0 = -w / 2;
  const x1 = w / 2;
  const z0 = -d / 2;
  const z1 = d / 2;
  const y0 = y;
  const y1 = y + h;
  const P = (px, py, pz) => {
    const [rx, rz] = rot(px, pz);
    return [rx, py, rz];
  };
  pushFace(b, [
    P(x0, y1, z0), P(x0, y1, z1), P(x1, y1, z1),
    P(x0, y1, z0), P(x1, y1, z1), P(x1, y1, z0),
  ], 1.0, color, uv);
  pushFace(b, [
    P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1),
    P(x0, y0, z0), P(x1, y0, z1), P(x0, y0, z1),
  ], 0.7, color, uv);
  pushFace(b, [
    P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1),
    P(x0, y0, z1), P(x1, y1, z1), P(x0, y1, z1),
  ], 0.85, color, uv);
  pushFace(b, [
    P(x0, y0, z0), P(x0, y1, z0), P(x1, y1, z0),
    P(x0, y0, z0), P(x1, y1, z0), P(x1, y0, z0),
  ], 0.85, color, uv);
  pushFace(b, [
    P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1),
    P(x1, y0, z0), P(x1, y1, z1), P(x1, y0, z1),
  ], 0.85, color, uv);
  pushFace(b, [
    P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1),
    P(x0, y0, z0), P(x0, y1, z1), P(x0, y1, z0),
  ], 0.85, color, uv);
}

// A flat quad (two triangles), colour exactly as given. Used for
// windows, road surfaces, ground tiles and signs.
export function pushQuad(b, p0, p1, p2, p3, color, uv) {
  const c = color || [1, 1, 1];
  const t = uv || [0, 0, 1, 1];
  const pts = [p0, p1, p2, p0, p2, p3];
  const uvs = [[t[0], t[1]], [t[2], t[1]], [t[2], t[3]], [t[0], t[1]], [t[2], t[3]], [t[0], t[3]]];
  for (let i = 0; i < 6; i++) {
    b.pos.push(pts[i][0], pts[i][1], pts[i][2]);
    b.col.push(c[0], c[1], c[2]);
    b.uv.push(uvs[i][0], uvs[i][1]);
  }
}

// Cheap frustum test: is a box (centre x,y,z, rough size) in front of
// the camera and inside the 700 m far plane? Only the distance along
// the view direction matters — lateral culling is the rasterizer's job.
export function boxVisible(cam, x, y, z, size) {
  const dx = x - cam.x;
  const dy = y - cam.y;
  const dz = z - cam.z;
  const fx = cam.tx - cam.x;
  const fy = (cam.ty || 0) - (cam.y || 0);
  const fz = cam.tz - cam.z;
  const fl = Math.hypot(fx, fy, fz) || 1;
  const along = (dx * fx + dy * fy + dz * fz) / fl;
  return along > -size && along < 700 + size;
}

// View-projection for a camera and a viewport.
export function computeViewProj(cam, w, h) {
  const proj = perspective((60 * Math.PI) / 180, w / h, 0.1, 1200);
  return matMul(proj, cameraView(cam));
}

// ---------- renderer ----------
const VERT_SRC = `
attribute vec3 aPos;
attribute vec3 aCol;
attribute vec2 aUv;
uniform mat4 uVP;
uniform vec3 uCamPos;
uniform vec2 uFogRange;
varying vec3 vCol;
varying vec2 vUv;
varying float vFog;
void main() {
  gl_Position = uVP * vec4(aPos, 1.0);
  vCol = aCol;
  vUv = aUv;
  float d = distance(aPos, uCamPos);
  vFog = smoothstep(uFogRange.x, uFogRange.y, d);
}`;

const FRAG_SRC = `
precision mediump float;
uniform sampler2D uTex;
uniform vec3 uFogColor;
varying vec3 vCol;
varying vec2 vUv;
varying float vFog;
void main() {
  vec3 c = vCol * texture2D(uTex, vUv).rgb;
  gl_FragColor = vec4(mix(c, uFogColor, vFog), 1.0);
}`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  return sh;
}

export function createRenderer(canvas, atlas) {
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT_SRC));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  gl.viewport(0, 0, canvas.width, canvas.height);

  const loc = (name) => gl.getAttribLocation(prog, name);
  const uni = (name) => gl.getUniformLocation(prog, name);
  const bufs = {
    pos: gl.createBuffer(),
    col: gl.createBuffer(),
    uv: gl.createBuffer(),
  };
  const attrs = { pos: loc('aPos'), col: loc('aCol'), uv: loc('aUv') };
  const unis = {
    vp: uni('uVP'),
    camPos: uni('uCamPos'),
    fogRange: uni('uFogRange'),
    fogColor: uni('uFogColor'),
    tex: uni('uTex'),
  };

  // The texture: the atlas when one was built, else a 1x1 white pixel
  // so every colour still renders (the atlas is a browser-only thing).
  let texture = atlas || null;
  if (!texture) {
    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  }

  const renderer = {
    gl,
    canvas,
    program: prog,
    texture,
    staticBatch: BoxBatch(),
    glbBatch: BoxBatch(),
    vp: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    camPos: [0, 0, 0],
    fogNear: 60,
    fogFar: 420,
    fogColor: [0.5, 0.7, 0.9],

    setView(vp, camPos, fogNear, fogFar, fogColor) {
      this.vp = vp;
      this.camPos = camPos;
      this.fogNear = fogNear;
      this.fogFar = fogFar;
      if (fogColor) this.fogColor = fogColor;
    },

    // The only clear in a frame: one call, then the batches draw.
    beginFrame(sky) {
      gl.clearColor(sky[0], sky[1], sky[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    },

    drawBatch(batch, vp, camPos, fog, fogColor) {
      const useVp = vp || this.vp;
      const useCam = camPos || this.camPos;
      const useFog = fog || [this.fogNear, this.fogFar];
      const useFogColor = fogColor || this.fogColor;
      const n = batch.pos.length / 3;
      const upload = (buf, attr, data, size) => {
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(attr);
        gl.vertexAttribPointer(attr, size, gl.FLOAT, false, 0, 0);
      };
      upload(bufs.pos, attrs.pos, batch.pos, 3);
      upload(bufs.col, attrs.col, batch.col, 3);
      upload(bufs.uv, attrs.uv, batch.uv, 2);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(unis.tex, 0);
      gl.uniformMatrix4fv(unis.vp, false, new Float32Array(useVp));
      gl.uniform3f(unis.camPos, useCam[0], useCam[1], useCam[2]);
      gl.uniform2f(unis.fogRange, useFog[0], useFog[1]);
      gl.uniform3f(unis.fogColor, useFogColor[0], useFogColor[1], useFogColor[2]);
      gl.drawArrays(gl.TRIANGLES, 0, n);
    },
  };
  return renderer;
}
