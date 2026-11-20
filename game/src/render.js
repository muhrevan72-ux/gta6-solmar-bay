// Solmar Bay — raw WebGL1 voxel renderer (rebuild #15).
// No library: boxes are emitted as triangles (WebGL1 has no
// four-vertex primitive) into batches, uploaded, and drawn with
// gl.TRIANGLES. One clear per frame, in beginFrame only.

import { perspective, matMul, lookAt } from './shots.js';

// ---------- batch ----------
// A batch is three parallel arrays: positions (3 floats/vertex),
// colours (3 floats/vertex, already per-face shaded) and UVs
// (2 floats/vertex). Every face is 2 triangles = 6 vertices.
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

// Face shade factors, in face order: top, bottom, +Z, -Z, +X, -X.
const SHADE = [1.0, 0.7, 0.85, 0.85, 0.85, 0.85];

function pushTri(b, p, c, uv) {
  for (let i = 0; i < 3; i++) {
    b.pos.push(p[i][0], p[i][1], p[i][2]);
    b.col.push(c[0], c[1], c[2]);
    b.uv.push(uv[i][0], uv[i][1]);
  }
}

// Emit one quad (two triangles) from four CCW corners.
function pushFace(b, corners, color, shade, uvRect) {
  const c = [color[0] * shade, color[1] * shade, color[2] * shade];
  const u = uvRect || [0, 0, 1, 1];
  // UV corners follow the position corners:
  // (u0,v0) (u0,v1) (u1,v1) (u1,v0).
  const uvs = [
    [u[0], u[1]],
    [u[0], u[3]],
    [u[2], u[3]],
    [u[2], u[1]],
  ];
  pushTri(b, [corners[0], corners[1], corners[2]], c, [uvs[0], uvs[1], uvs[2]]);
  pushTri(b, [corners[0], corners[2], corners[3]], c, [uvs[0], uvs[2], uvs[3]]);
}

// A box whose base sits at y (spans y..y+h), centred on (x, z).
// Faces, in order: top, bottom, +Z, -Z, +X, -X — each wound CCW
// from outside so its normal points outward.
export function pushBox(b, x, y, z, w, h, d, color, uvRect) {
  const hx = w / 2, hz = d / 2;
  const y0 = y, y1 = y + h;
  const faces = [
    // top (+Y)
    [[x - hx, y1, z - hz], [x - hx, y1, z + hz], [x + hx, y1, z + hz], [x + hx, y1, z - hz]],
    // bottom (-Y)
    [[x - hx, y0, z + hz], [x - hx, y0, z - hz], [x + hx, y0, z - hz], [x + hx, y0, z + hz]],
    // front (+Z)
    [[x - hx, y0, z + hz], [x + hx, y0, z + hz], [x + hx, y1, z + hz], [x - hx, y1, z + hz]],
    // back (-Z)
    [[x + hx, y0, z - hz], [x - hx, y0, z - hz], [x - hx, y1, z - hz], [x + hx, y1, z - hz]],
    // right (+X)
    [[x + hx, y0, z + hz], [x + hx, y0, z - hz], [x + hx, y1, z - hz], [x + hx, y1, z + hz]],
    // left (-X)
    [[x - hx, y0, z - hz], [x - hx, y0, z + hz], [x - hx, y1, z + hz], [x - hx, y1, z - hz]],
  ];
  for (let f = 0; f < 6; f++) pushFace(b, faces[f], color, SHADE[f], uvRect);
}

// A box rotated by yaw around its vertical centre axis.
export function pushBoxRot(b, x, y, z, w, h, d, yaw, color, uvRect) {
  const hx = w / 2, hz = d / 2;
  const y0 = y, y1 = y + h;
  const cs = Math.cos(yaw), sn = Math.sin(yaw);
  const rot = (lx, lz) => [x + lx * cs + lz * sn, z - lx * sn + lz * cs];
  const P = (lx, ly, lz) => {
    const [rx, rz] = rot(lx, lz);
    return [rx, ly, rz];
  };
  const faces = [
    [P(-hx, y1, -hz), P(-hx, y1, hz), P(hx, y1, hz), P(hx, y1, -hz)],
    [P(-hx, y0, hz), P(-hx, y0, -hz), P(hx, y0, -hz), P(hx, y0, hz)],
    [P(-hx, y0, hz), P(hx, y0, hz), P(hx, y1, hz), P(-hx, y1, hz)],
    [P(hx, y0, -hz), P(-hx, y0, -hz), P(-hx, y1, -hz), P(hx, y1, -hz)],
    [P(hx, y0, hz), P(hx, y0, -hz), P(hx, y1, -hz), P(hx, y1, hz)],
    [P(-hx, y0, -hz), P(-hx, y0, hz), P(-hx, y1, hz), P(-hx, y1, -hz)],
  ];
  for (let f = 0; f < 6; f++) pushFace(b, faces[f], color, SHADE[f], uvRect);
}

// A flat quad (two triangles), unshaded, for dashes and signs.
export function pushQuad(b, p0, p1, p2, p3, color, uvRect) {
  const u = uvRect || [0, 0, 1, 1];
  const uvs = [[u[0], u[1]], [u[0], u[3]], [u[2], u[3]], [u[2], u[1]]];
  pushTri(b, [p0, p1, p2], color, [uvs[0], uvs[1], uvs[2]]);
  pushTri(b, [p0, p2, p3], color, [uvs[0], uvs[2], uvs[3]]);
}

// ---------- culling ----------
// True when a sphere at (x,y,z) with the given radius is in front
// of the camera and within the 700 m draw distance.
export function boxVisible(cam, x, y, z, radius) {
  const fx = cam.tx - cam.x, fy = cam.ty - cam.y, fz = cam.tz - cam.z;
  const fl = Math.hypot(fx, fy, fz) || 1;
  const nx = fx / fl, ny = fy / fl, nz = fz / fl;
  const dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
  const along = dx * nx + dy * ny + dz * nz;
  if (along + radius < 0) return false;
  const dist = Math.hypot(dx, dy, dz);
  if (dist - radius > 700) return false;
  return true;
}

// ---------- view-projection ----------
export function computeViewProj(cam, w, h) {
  const view = lookAt(cam.x, cam.y, cam.z, cam.tx, cam.ty, cam.tz);
  const proj = perspective((60 * Math.PI) / 180, w / h, 0.1, 1200);
  return matMul(proj, view);
}

// ---------- renderer ----------
const VERT = `
attribute vec3 aPos;
attribute vec3 aCol;
attribute vec2 aUV;
uniform mat4 uVP;
uniform vec3 uCamPos;
uniform vec2 uFogRange;
varying vec3 vCol;
varying vec2 vUV;
varying float vDist;
void main() {
  vec4 wp = vec4(aPos, 1.0);
  vCol = aCol;
  vUV = aUV;
  vDist = distance(aPos, uCamPos);
  gl_Position = uVP * wp;
}`;
const FRAG = `
precision mediump float;
uniform sampler2D uTex;
uniform vec3 uFogColor;
uniform vec2 uFogRange;
varying vec3 vCol;
varying vec2 vUV;
varying float vDist;
void main() {
  vec4 tex = texture2D(uTex, vUV);
  vec3 col = tex.rgb * vCol;
  float f = smoothstep(uFogRange.x, uFogRange.y, vDist);
  gl_FragColor = vec4(mix(col, uFogColor, f), 1.0);
}`;

// Create the renderer. IMPORTANT: size the canvas BEFORE calling
// this — assigning canvas.width/height afterwards resets the WebGL
// context and kills the program, buffers and textures (the
// round-6/7 boot-order bug). On a later resize, re-create the
// renderer instead of resizing around it.
export function createRenderer(canvas, atlasTex) {
  const gl = canvas.getContext('webgl');
  if (!gl) return null;
  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, VERT);
  gl.compileShader(vs);
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, FRAG);
  gl.compileShader(fs);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.useProgram(prog);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  const aCol = gl.getAttribLocation(prog, 'aCol');
  const aUV = gl.getAttribLocation(prog, 'aUV');
  const uVP = gl.getUniformLocation(prog, 'uVP');
  const uCamPos = gl.getUniformLocation(prog, 'uCamPos');
  const uFogRange = gl.getUniformLocation(prog, 'uFogRange');
  const uFogColor = gl.getUniformLocation(prog, 'uFogColor');
  const uTex = gl.getUniformLocation(prog, 'uTex');
  gl.enableVertexAttribArray(aPos);
  gl.enableVertexAttribArray(aCol);
  gl.enableVertexAttribArray(aUV);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  const posBuf = gl.createBuffer();
  const colBuf = gl.createBuffer();
  const uvBuf = gl.createBuffer();
  // Texture: the atlas when the browser built one, else a 1x1
  // white fallback so the shader still multiplies cleanly.
  let texture = atlasTex || null;
  if (!texture) {
    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(uTex, 0);
  gl.viewport(0, 0, canvas.width, canvas.height);
  const r = {
    gl, canvas, texture,
    staticBatch: BoxBatch(),
    glbBatch: BoxBatch(),
    _prog: prog, _posBuf: posBuf, _colBuf: colBuf, _uvBuf: uvBuf,
    _aPos: aPos, _aCol: aCol, _aUV: aUV,
    _uVP: uVP, _uCamPos: uCamPos, _uFogRange: uFogRange, _uFogColor: uFogColor,
    setView(vp, camPos, fogNear, fogFar, fogColor) {
      const g = this.gl;
      g.uniformMatrix4fv(this._uVP, false, new Float32Array(vp));
      g.uniform3f(this._uCamPos, camPos[0], camPos[1], camPos[2]);
      g.uniform2f(this._uFogRange, fogNear, fogFar);
      g.uniform3f(this._uFogColor, fogColor[0], fogColor[1], fogColor[2]);
    },
    // The ONLY clear per frame. drawBatch never clears.
    beginFrame(sky) {
      const g = this.gl;
      g.viewport(0, 0, this.canvas.width, this.canvas.height);
      g.clearColor(sky[0], sky[1], sky[2], 1);
      g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT);
    },
    drawBatch(batch) {
      const g = this.gl;
      const tris = batchTris(batch);
      if (tris === 0) return;
      g.bindBuffer(g.ARRAY_BUFFER, this._posBuf);
      g.bufferData(g.ARRAY_BUFFER, new Float32Array(batch.pos), g.DYNAMIC_DRAW);
      g.bindBuffer(g.ARRAY_BUFFER, this._colBuf);
      g.bufferData(g.ARRAY_BUFFER, new Float32Array(batch.col), g.DYNAMIC_DRAW);
      g.bindBuffer(g.ARRAY_BUFFER, this._uvBuf);
      g.bufferData(g.ARRAY_BUFFER, new Float32Array(batch.uv), g.DYNAMIC_DRAW);
      g.bindBuffer(g.ARRAY_BUFFER, this._posBuf);
      g.vertexAttribPointer(this._aPos, 3, g.FLOAT, false, 0, 0);
      g.bindBuffer(g.ARRAY_BUFFER, this._colBuf);
      g.vertexAttribPointer(this._aCol, 3, g.FLOAT, false, 0, 0);
      g.bindBuffer(g.ARRAY_BUFFER, this._uvBuf);
      g.vertexAttribPointer(this._aUV, 2, g.FLOAT, false, 0, 0);
      g.drawArrays(g.TRIANGLES, 0, tris * 3);
    },
  };
  return r;
}
