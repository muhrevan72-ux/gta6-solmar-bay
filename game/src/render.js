// Solmar Bay — software batch + WebGL renderer.
// Written fresh for rebuild #18. Geometry is accumulated into a
// BoxBatch (plain pos/col/uv arrays) and uploaded to GL in one
// drawBatch call: 3 bufferData uploads (pos, col, uv), all with
// TRIANGLES. There is no four-vertex primitive in WebGL1.

// ---------- batch ----------
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

// Face shading: top 1.0, bottom 0.7, sides 0.85.
const SHADE = [1.0, 0.7, 0.85, 0.85, 0.85, 0.85];

// Push a box. (x, z) is the centre, y is the BASE (the box spans
// y..y+h). 12 triangles, 108 floats. Face order: top, bottom,
// +Z, -Z, +X, -X — all wound CCW from outside.
export function pushBox(b, x, y, z, w, h, d, color, uv) {
  const x0 = x - w / 2, x1 = x + w / 2;
  const y0 = y, y1 = y + h;
  const z0 = z - d / 2, z1 = z + d / 2;
  const u = uv || [0, 0, 1, 1];
  // Each face: 6 vertices (2 tris), CCW from outside.
  const faces = [
    // top (+Y)
    [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x0, y1, z0], [x1, y1, z1], [x1, y1, z0]],
    // bottom (-Y)
    [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z0], [x1, y0, z1], [x0, y0, z1]],
    // front (+Z)
    [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y0, z1], [x1, y1, z1], [x0, y1, z1]],
    // back (-Z)
    [[x0, y0, z0], [x1, y1, z0], [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]],
    // right (+X)
    [[x1, y0, z0], [x1, y1, z1], [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]],
    // left (-X)
    [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y0, z0], [x0, y1, z1], [x0, y1, z0]],
  ];
  const faceUV = [
    [[u[0], u[1]], [u[0], u[3]], [u[2], u[3]], [u[0], u[1]], [u[2], u[3]], [u[2], u[1]]],
    [[u[0], u[1]], [u[2], u[1]], [u[2], u[3]], [u[0], u[1]], [u[2], u[3]], [u[0], u[3]]],
    [[u[0], u[1]], [u[2], u[1]], [u[2], u[3]], [u[0], u[1]], [u[2], u[3]], [u[0], u[3]]],
    [[u[0], u[1]], [u[2], u[3]], [u[2], u[1]], [u[0], u[1]], [u[0], u[3]], [u[2], u[3]]],
    [[u[0], u[1]], [u[2], u[3]], [u[0], u[3]], [u[0], u[1]], [u[2], u[1]], [u[2], u[3]]],
    [[u[0], u[1]], [u[0], u[3]], [u[2], u[3]], [u[0], u[1]], [u[2], u[3]], [u[2], u[1]]],
  ];
  for (let f = 0; f < 6; f++) {
    const s = SHADE[f];
    const r = color[0] * s, g = color[1] * s, bl = color[2] * s;
    for (let v = 0; v < 6; v++) {
      const p = faces[f][v];
      b.pos.push(p[0], p[1], p[2]);
      b.col.push(r, g, bl);
      b.uv.push(faceUV[f][v][0], faceUV[f][v][1]);
    }
  }
  return 12;
}

// Push a box rotated around the Y axis by `angle` radians.
export function pushBoxRot(b, x, y, z, w, h, d, angle, color, uv) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const x0 = -w / 2, x1 = w / 2;
  const y0 = y, y1 = y + h;
  const z0 = -d / 2, z1 = d / 2;
  const u = uv || [0, 0, 1, 1];
  const rot = (lx, ly, lz) => [x + lx * c + lz * s, ly, z - lx * s + lz * c];
  const faces = [
    [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x0, y1, z0], [x1, y1, z1], [x1, y1, z0]],
    [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z0], [x1, y0, z1], [x0, y0, z1]],
    [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y0, z1], [x1, y1, z1], [x0, y1, z1]],
    [[x0, y0, z0], [x1, y1, z0], [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]],
    [[x1, y0, z0], [x1, y1, z1], [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]],
    [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y0, z0], [x0, y1, z1], [x0, y1, z0]],
  ];
  const faceUV = [
    [[u[0], u[1]], [u[0], u[3]], [u[2], u[3]], [u[0], u[1]], [u[2], u[3]], [u[2], u[1]]],
    [[u[0], u[1]], [u[2], u[1]], [u[2], u[3]], [u[0], u[1]], [u[2], u[3]], [u[0], u[3]]],
    [[u[0], u[1]], [u[2], u[1]], [u[2], u[3]], [u[0], u[1]], [u[2], u[3]], [u[0], u[3]]],
    [[u[0], u[1]], [u[2], u[3]], [u[2], u[1]], [u[0], u[1]], [u[0], u[3]], [u[2], u[3]]],
    [[u[0], u[1]], [u[2], u[3]], [u[0], u[3]], [u[0], u[1]], [u[2], u[1]], [u[2], u[3]]],
    [[u[0], u[1]], [u[0], u[3]], [u[2], u[3]], [u[0], u[1]], [u[2], u[3]], [u[2], u[1]]],
  ];
  for (let f = 0; f < 6; f++) {
    const sh = SHADE[f];
    const r = color[0] * sh, g = color[1] * sh, bl = color[2] * sh;
    for (let v = 0; v < 6; v++) {
      const lp = faces[f][v];
      const p = rot(lp[0], lp[1], lp[2]);
      b.pos.push(p[0], p[1], p[2]);
      b.col.push(r, g, bl);
      b.uv.push(faceUV[f][v][0], faceUV[f][v][1]);
    }
  }
  return 12;
}

// Push a flat quad (2 triangles), full colour, no shading.
// p0..p3 are the corners in order.
export function pushQuad(b, p0, p1, p2, p3, color, uv) {
  const u = uv || [0, 0, 1, 1];
  const pts = [p0, p1, p2, p0, p2, p3];
  const uvs = [[u[0], u[1]], [u[2], u[1]], [u[2], u[3]], [u[0], u[1]], [u[2], u[3]], [u[0], u[3]]];
  for (let v = 0; v < 6; v++) {
    b.pos.push(pts[v][0], pts[v][1], pts[v][2]);
    b.col.push(color[0], color[1], color[2]);
    b.uv.push(uvs[v][0], uvs[v][1]);
  }
  return 2;
}

// Frustum / distance culling for one box. `cam` carries the eye
// (x, y, z) and the look target (tx, ty, tz). A box is visible
// when it is in front of the camera and within the 700 m far plane.
export function boxVisible(cam, x, y, z, radius) {
  const cx = cam.x || 0, cy = cam.y || 0, cz = cam.z || 0;
  const dx = x - cx, dy = y - cy, dz = z - cz;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (dist - (radius || 0) > 700) return false;
  const fx = (cam.tx !== undefined ? cam.tx : 0) - cx;
  const fy = (cam.ty !== undefined ? cam.ty : 0) - cy;
  const fz = (cam.tz !== undefined ? cam.tz : -100) - cz;
  const fl = Math.sqrt(fx * fx + fy * fy + fz * fz) || 1;
  const dot = (dx * fx + dy * fy + dz * fz) / (dist * fl || 1);
  if (dist < (radius || 0)) return true;
  return dot > 0;
}

// ---------- renderer ----------
import { perspective, matMul, cameraView } from './shots.js';
import { createAtlasTexture } from './texture.js';

const VERT_SRC = `
attribute vec3 aPos; attribute vec3 aCol; attribute vec2 aUV;
uniform mat4 uVP;
varying vec3 vCol; varying vec2 vUV; varying vec3 vWorld;
void main() {
  vCol = aCol; vUV = aUV; vWorld = aPos;
  gl_Position = uVP * vec4(aPos, 1.0);
}`;

const FRAG_SRC = `
precision mediump float;
varying vec3 vCol; varying vec2 vUV; varying vec3 vWorld;
uniform sampler2D uTex;
uniform vec3 uCamPos; uniform vec2 uFogRange; uniform vec3 uFogColor;
void main() {
  vec3 col = vCol * texture2D(uTex, vUV).rgb;
  float d = distance(vWorld, uCamPos);
  float f = smoothstep(uFogRange.x, uFogRange.y, d);
  gl_FragColor = vec4(mix(col, uFogColor, f), 1.0);
}`;

// View-projection matrix for a camera and a viewport size.
export function computeViewProj(cam, w, h) {
  const proj = perspective((60 * Math.PI) / 180, w / h, 0.1, 1200);
  const view = cameraView(cam);
  return matMul(proj, view);
}

export function createRenderer(canvas, doc, keep) {
  const gl = canvas.getContext('webgl');
  const renderer = {
    gl,
    canvas,
    staticBatch: (keep && keep.staticBatch) || BoxBatch(),
    glbBatch: (keep && keep.glbBatch) || BoxBatch(),
    texture: null,
    posBuf: null,
    colBuf: null,
    uvBuf: null,
    program: null,
    aPos: -1,
    aCol: -1,
    aUV: -1,
    uVP: null,
    uCamPos: null,
    uFogRange: null,
    uFogColor: null,
  };

  if (!gl) return renderer;

  // Shaders + program.
  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, VERT_SRC);
  gl.compileShader(vs);
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, FRAG_SRC);
  gl.compileShader(fs);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.useProgram(prog);
  renderer.program = prog;
  renderer.aPos = gl.getAttribLocation(prog, 'aPos');
  renderer.aCol = gl.getAttribLocation(prog, 'aCol');
  renderer.aUV = gl.getAttribLocation(prog, 'aUV');
  renderer.uVP = gl.getUniformLocation(prog, 'uVP');
  renderer.uCamPos = gl.getUniformLocation(prog, 'uCamPos');
  renderer.uFogRange = gl.getUniformLocation(prog, 'uFogRange');
  renderer.uFogColor = gl.getUniformLocation(prog, 'uFogColor');

  // Buffers.
  renderer.posBuf = gl.createBuffer();
  renderer.colBuf = gl.createBuffer();
  renderer.uvBuf = gl.createBuffer();

  // Texture: the atlas when available, else a 1x1 white fallback.
  let tex = null;
  try {
    tex = createAtlasTexture(gl);
  } catch (e) {
    tex = null;
  }
  if (!tex) {
    tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  }
  renderer.texture = tex;
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.uniform1i(gl.getUniformLocation(prog, 'uTex'), 0);

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  gl.viewport(0, 0, canvas.width, canvas.height);

  // Fallback barrels: the GLB model is 3 procedural barrels.
  if (!keep || !keep.glbBatch) {
    pushBox(renderer.glbBatch, 60, 0, 320, 1, 1.2, 1, [0.85, 0.2, 0.15], [0, 0, 1, 1]);
    pushBox(renderer.glbBatch, 63, 0, 320, 1, 1.2, 1, [0.85, 0.2, 0.15], [0, 0, 1, 1]);
    pushBox(renderer.glbBatch, 66, 0, 320, 1, 1.2, 1, [0.85, 0.2, 0.15], [0, 0, 1, 1]);
  }

  // The only clear per frame lives here.
  renderer.beginFrame = function (clearColor) {
    const c = clearColor || [0.5, 0.7, 0.9];
    gl.clearColor(c[0], c[1], c[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  };

  renderer.setUniforms = function (vp, camPos, fogRange, fogColor) {
    if (renderer.uVP !== null && renderer.uVP !== undefined) gl.uniformMatrix4fv(renderer.uVP, false, vp);
    if (renderer.uCamPos !== null && renderer.uCamPos !== undefined) gl.uniform3f(renderer.uCamPos, camPos[0], camPos[1], camPos[2]);
    if (renderer.uFogRange !== null && renderer.uFogRange !== undefined) gl.uniform2f(renderer.uFogRange, fogRange[0], fogRange[1]);
    if (renderer.uFogColor !== null && renderer.uFogColor !== undefined) gl.uniform3f(renderer.uFogColor, fogColor[0], fogColor[1], fogColor[2]);
  };

  // Upload one batch (pos, col, uv — 3 bufferData calls) and draw it.
  // Never clears. Always uploads, even when empty, so the per-frame
  // upload order stays deterministic (static, glb, dynamic).
  renderer.drawBatch = function (b) {
    const batch = b || BoxBatch();
    gl.bindBuffer(gl.ARRAY_BUFFER, renderer.posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(batch.pos), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, renderer.colBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(batch.col), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, renderer.uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(batch.uv), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, renderer.posBuf);
    gl.vertexAttribPointer(renderer.aPos, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(renderer.aPos);
    gl.bindBuffer(gl.ARRAY_BUFFER, renderer.colBuf);
    gl.vertexAttribPointer(renderer.aCol, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(renderer.aCol);
    gl.bindBuffer(gl.ARRAY_BUFFER, renderer.uvBuf);
    gl.vertexAttribPointer(renderer.aUV, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(renderer.aUV);
    gl.drawArrays(gl.TRIANGLES, 0, batch.pos.length / 3);
  };

  return renderer;
}
