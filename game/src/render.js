// Solmar Bay — the software renderer.
//
// A batch is four flat arrays (positions, colours, uvs, normals) filled
// with triangles. pushBox writes a box as 12 triangles; the renderer
// uploads three batches per frame (static city, dynamic actors, fallback
// barrels) and draws them all as triangles. The vertex shader does the
// fog; the fragment shader multiplies the atlas texture by the vertex
// colour.

import { computeViewProj as shotsViewProj } from './shots.js';

export { shotsViewProj as computeViewProj };

// ---------- batches ----------
export function BoxBatch() {
  return { pos: [], col: [], uv: [], norm: [] };
}

export function batchReset(b) {
  b.pos.length = 0;
  b.col.length = 0;
  b.uv.length = 0;
  b.norm.length = 0;
}

export function batchTris(b) {
  return Math.floor(b.pos.length / 9);
}

// ---------- geometry ----------
// Face order is fixed: top, bottom, front (+Z), back (-Z), right (+X),
// left (-X). Each face is two triangles, wound counter-clockwise seen
// from outside, so the cross-product normal points outward. Shading is
// baked into the vertex colours: top 1.0, sides 0.85, bottom 0.7.
const FACE_SHADE = [1.0, 0.7, 0.85, 0.85, 0.85, 0.85];
const FACE_NORMAL = [
  [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0],
];

function boxCorners(x, y, z, w, h, d) {
  const x0 = x - w / 2, x1 = x + w / 2;
  const y0 = y, y1 = y + h;
  const z0 = z - d / 2, z1 = z + d / 2;
  return [
    // top
    [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]],
    // bottom
    [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]],
    // front (+Z)
    [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]],
    // back (-Z)
    [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]],
    // right (+X)
    [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]],
    // left (-X)
    [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]],
  ];
}

function emitFace(b, corners, normal, shade, color, uv) {
  const [u0, v0, u1, v1] = uv;
  const faceUv = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
  const tris = [[0, 1, 2], [0, 2, 3]];
  for (const [a, c, d] of tris) {
    for (const i of [a, c, d]) {
      const p = corners[i];
      b.pos.push(p[0], p[1], p[2]);
      b.col.push(color[0] * shade, color[1] * shade, color[2] * shade);
      b.uv.push(faceUv[i][0], faceUv[i][1]);
      b.norm.push(normal[0], normal[1], normal[2]);
    }
  }
}

export function pushBox(b, x, y, z, w, h, d, color, uv) {
  const c = color || [1, 1, 1];
  const u = uv || [0, 0, 1, 1];
  const faces = boxCorners(x, y, z, w, h, d);
  for (let f = 0; f < 6; f++) {
    emitFace(b, faces[f], FACE_NORMAL[f], FACE_SHADE[f], c, u);
  }
  return 12;
}

// A box rotated around the Y axis. Local (lx, lz) maps to world as
// (lx*cos + lz*sin, -lx*sin + lz*cos) for the given heading.
export function pushBoxRot(b, x, y, z, w, h, d, heading, color, uv) {
  const c = color || [1, 1, 1];
  const u = uv || [0, 0, 1, 1];
  const cos = Math.cos(heading);
  const sin = Math.sin(heading);
  const rot = (p) => {
    const lx = p[0] - x;
    const lz = p[2] - z;
    return [x + lx * cos + lz * sin, p[1], z - lx * sin + lz * cos];
  };
  const faces = boxCorners(x, y, z, w, h, d);
  for (let f = 0; f < 6; f++) {
    const rotated = faces[f].map(rot);
    // Rotate the face normal the same way (yaw only, so y is unchanged).
    const n = FACE_NORMAL[f];
    const rn = [n[0] * cos + n[2] * sin, n[1], -n[0] * sin + n[2] * cos];
    emitFace(b, rotated, rn, FACE_SHADE[f], c, u);
  }
  return 12;
}

export function pushQuad(b, p0, p1, p2, p3, color, uv) {
  const c = color || [1, 1, 1];
  const u = uv || [0, 0, 1, 1];
  const [u0, v0, u1, v1] = u;
  const pts = [p0, p1, p2, p3];
  const uvs = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
  // Flat normal from the first triangle.
  const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
  const vx = p2[0] - p0[0], vy = p2[1] - p0[1], vz = p2[2] - p0[2];
  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz) || 1;
  nx /= len; ny /= len; nz /= len;
  for (const i of [0, 1, 2, 0, 2, 3]) {
    const p = pts[i];
    b.pos.push(p[0], p[1], p[2]);
    b.col.push(c[0], c[1], c[2]);
    b.uv.push(uvs[i][0], uvs[i][1]);
    b.norm.push(nx, ny, nz);
  }
  return 2;
}

// ---------- culling ----------
// True when a box of the given size at (x, y, z) could be seen from the
// camera: inside the 700 m far plane and not behind the eye.
export function boxVisible(cam, x, y, z, size) {
  const dx = x - cam.x;
  const dy = y - cam.y;
  const dz = z - cam.z;
  const dist = Math.hypot(dx, dy, dz);
  if (dist - size > 700) return false;
  const fx = cam.tx - cam.x;
  const fy = cam.ty - cam.y;
  const fz = cam.tz - cam.z;
  const fl = Math.hypot(fx, fy, fz) || 1;
  const dot = (dx * fx + dy * fy + dz * fz) / fl;
  return dot > -size;
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
  vCol = aCol;
  vUv = aUv;
  vDist = distance(aPos, uCamPos);
  gl_Position = uVP * wp;
}`;

const FRAG_SRC = `
precision mediump float;
varying vec3 vCol;
varying vec2 vUv;
varying float vDist;
uniform sampler2D uTex;
uniform vec2 uFogRange;
uniform vec3 uFogColor;
void main() {
  vec4 tex = texture2D(uTex, vUv);
  float f = smoothstep(uFogRange.x, uFogRange.y, vDist);
  vec3 rgb = mix(vCol * tex.rgb, uFogColor, f);
  gl_FragColor = vec4(rgb, 1.0);
}`;

function compileShader(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  return sh;
}

export function createRenderer(canvas, atlasCanvas) {
  const gl = canvas.getContext('webgl');
  const prog = gl.createProgram();
  gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER, VERT_SRC));
  gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const loc = {
    pos: gl.getAttribLocation(prog, 'aPos'),
    col: gl.getAttribLocation(prog, 'aCol'),
    uv: gl.getAttribLocation(prog, 'aUv'),
    vp: gl.getUniformLocation(prog, 'uVP'),
    camPos: gl.getUniformLocation(prog, 'uCamPos'),
    fogRange: gl.getUniformLocation(prog, 'uFogRange'),
    fogColor: gl.getUniformLocation(prog, 'uFogColor'),
    tex: gl.getUniformLocation(prog, 'uTex'),
  };

  const bufPos = gl.createBuffer();
  const bufCol = gl.createBuffer();
  const bufUv = gl.createBuffer();

  // Texture: the atlas when one was built, otherwise a 1x1 white
  // fallback so the shader still has something to sample.
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  if (atlasCanvas) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlasCanvas);
  } else {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
  }
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.enable(gl.DEPTH_TEST);
  gl.viewport(0, 0, canvas.width, canvas.height);

  const staticBatch = BoxBatch();
  const glbBatch = BoxBatch();
  bakeGlbBatch(glbBatch);

  const renderer = {
    gl,
    canvas,
    staticBatch,
    glbBatch,
    texture,
    program: prog,

    beginFrame(sky) {
      gl.clearColor(sky[0], sky[1], sky[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    },

    setFrame(vp, camPos, fogRange, fogColor) {
      gl.uniformMatrix4fv(loc.vp, false, vp);
      gl.uniform3f(loc.camPos, camPos[0], camPos[1], camPos[2]);
      gl.uniform2f(loc.fogRange, fogRange[0], fogRange[1]);
      gl.uniform3f(loc.fogColor, fogColor[0], fogColor[1], fogColor[2]);
      gl.uniform1i(loc.tex, 0);
    },

    drawBatch(b) {
      const n = batchTris(b);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufPos);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(b.pos), gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufCol);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(b.col), gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufUv);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(b.uv), gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufPos);
      gl.enableVertexAttribArray(loc.pos);
      gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufCol);
      gl.enableVertexAttribArray(loc.col);
      gl.vertexAttribPointer(loc.col, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufUv);
      gl.enableVertexAttribArray(loc.uv);
      gl.vertexAttribPointer(loc.uv, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, n * 3);
    },
  };
  return renderer;
}

// The GLB fallback: three procedural dock barrels. There is no barrel
// model file in the entry; these boxes stand in for it, and the boot
// path re-bakes them after the (failed) model fetch settles.
export function bakeGlbBatch(b) {
  batchReset(b);
  const red = [0.85, 0.2, 0.15];
  pushBox(b, -280, 0, 170, 0.9, 1.1, 0.9, red, [0, 0, 1, 1]);
  pushBox(b, -278, 0, 172, 0.9, 1.1, 0.9, red, [0, 0, 1, 1]);
  pushBox(b, -282, 0, 172, 0.9, 1.1, 0.9, red, [0, 0, 1, 1]);
  return b;
}
