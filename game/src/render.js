// Solmar Bay — raw WebGL1 voxel renderer. No libraries.
// One unit-cube geometry, per-face normals, vertex colours, one
// directional light + distance fog. Static city baked once, dynamic
// entities rebuilt every frame, water drawn as a transparent pass.

import { WORLD } from './config.js';

// ---- tiny mat4 helpers (column-major, WebGL convention) ----

export function mat4Perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

export function mat4LookAt(eye, target, up) {
  const zx = eye[0] - target[0];
  const zy = eye[1] - target[1];
  const zz = eye[2] - target[2];
  let zl = Math.hypot(zx, zy, zz) || 1;
  const z = [zx / zl, zy / zl, zz / zl];
  const xx = up[1] * z[2] - up[2] * z[1];
  const xy = up[2] * z[0] - up[0] * z[2];
  const xz = up[0] * z[1] - up[1] * z[0];
  zl = Math.hypot(xx, xy, xz) || 1;
  const x = [xx / zl, xy / zl, xz / zl];
  const y = [
    z[1] * x[2] - z[2] * x[1],
    z[2] * x[0] - z[0] * x[2],
    z[0] * x[1] - z[1] * x[0],
  ];
  return new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]),
    -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]),
    -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]),
    1,
  ]);
}

export function mat4Multiply(a, b) {
  // returns a * b (column-major)
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = s;
    }
  }
  return out;
}

// ---- cube face table: 4 corners each, CCW from outside ----
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { n: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { n: [0, 1, 0], c: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] },
  { n: [0, -1, 0], c: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]] },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];

// Push one box (36 vertices, 9 floats each) into a plain number array.
// cx,cy,cz = centre; sx,sy,sz = size; yaw = rotation around Y (radians);
// pitch = nose-up tilt around the local X axis (radians, for the plane).
// color = [r,g,b] for the sides, topColor for the +y face (or same).
export function pushBoxVerts(arr, cx, cy, cz, sx, sy, sz, yaw, color, topColor, pitch) {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const cp = Math.cos(pitch || 0);
  const sp = Math.sin(pitch || 0);
  const hx = sx / 2, hy = sy / 2, hz = sz / 2;
  for (let f = 0; f < 6; f++) {
    const face = FACES[f];
    const col = (f === 2 && topColor) ? topColor : color;
    // rotate the face normal: pitch around X, then yaw around Y
    let nx = face.n[0], ny = face.n[1], nz = face.n[2];
    const ny2 = ny * cp - nz * sp;
    const nz2 = ny * sp + nz * cp;
    ny = ny2; nz = nz2;
    const nx2 = nx * cos + nz * sin;
    const nz3 = -nx * sin + nz * cos;
    nx = nx2; nz = nz3;
    const tris = [0, 1, 2, 0, 2, 3];
    for (let t = 0; t < 6; t++) {
      const corner = face.c[tris[t]];
      const lx = (corner[0] - 0.5) * sx;
      const ly = (corner[1] - 0.5) * sy;
      const lz = (corner[2] - 0.5) * sz;
      // pitch around X, then yaw around Y
      const py = ly * cp - lz * sp;
      const pz = ly * sp + lz * cp;
      const wx = cx + lx * cos + pz * sin;
      const wz = cz - lx * sin + pz * cos;
      arr.push(wx, cy + py, wz, nx, ny, nz, col[0], col[1], col[2]);
    }
  }
}

const VERT = `
attribute vec3 aPos;
attribute vec3 aNor;
attribute vec3 aCol;
uniform mat4 uPV;
uniform vec3 uEye;
varying vec3 vCol;
varying vec3 vNor;
varying float vFog;
void main() {
  gl_Position = uPV * vec4(aPos, 1.0);
  vCol = aCol;
  vNor = aNor;
  vFog = distance(aPos, uEye);
}
`;

const FRAG = `
precision mediump float;
varying vec3 vCol;
varying vec3 vNor;
varying float vFog;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uAlpha;
void main() {
  vec3 L = normalize(vec3(0.45, 0.8, 0.35));
  float d = max(dot(normalize(vNor), L), 0.0);
  vec3 c = vCol * (0.42 + 0.58 * d);
  float f = clamp((vFog - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
  gl_FragColor = vec4(mix(c, uFogColor, f), uAlpha);
}
`;

function compileShader(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error('shader: ' + gl.getShaderInfoLog(sh));
  }
  return sh;
}

export function createRenderer(canvas) {
  const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
  if (!gl) throw new Error('WebGL not available');
  const prog = gl.createProgram();
  gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error('program: ' + gl.getProgramInfoLog(prog));
  }
  gl.useProgram(prog);
  const loc = {
    pv: gl.getUniformLocation(prog, 'uPV'),
    eye: gl.getUniformLocation(prog, 'uEye'),
    fogColor: gl.getUniformLocation(prog, 'uFogColor'),
    fogNear: gl.getUniformLocation(prog, 'uFogNear'),
    fogFar: gl.getUniformLocation(prog, 'uFogFar'),
    alpha: gl.getUniformLocation(prog, 'uAlpha'),
    pos: gl.getAttribLocation(prog, 'aPos'),
    nor: gl.getAttribLocation(prog, 'aNor'),
    col: gl.getAttribLocation(prog, 'aCol'),
  };
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  gl.clearColor(WORLD.skyTop[0], WORLD.skyTop[1], WORLD.skyTop[2], 1);

  const FLOATS_PER_BOX = 36 * 9;
  const dynCapacity = 900; // boxes per frame, dynamic
  const dynArray = new Float32Array(dynCapacity * FLOATS_PER_BOX);
  const waterCapacity = 64;
  const waterArray = new Float32Array(waterCapacity * FLOATS_PER_BOX);
  let dynCount = 0;
  let waterCount = 0;

  const dynBuf = gl.createBuffer();
  const waterBuf = gl.createBuffer();
  let staticBuf = null;
  let staticCount = 0;

  function upload(buf, data, verts) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, verts * 9), gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, 36, 0);
    gl.vertexAttribPointer(loc.nor, 3, gl.FLOAT, false, 36, 12);
    gl.vertexAttribPointer(loc.col, 3, gl.FLOAT, false, 36, 24);
    gl.enableVertexAttribArray(loc.pos);
    gl.enableVertexAttribArray(loc.nor);
    gl.enableVertexAttribArray(loc.col);
    gl.drawArrays(gl.TRIANGLES, 0, verts);
  }

  return {
    gl,
    // Bake the static city once. boxes: [{x,y,z,sx,sy,sz,yaw,color,top}]
    bakeStatic(boxes) {
      const arr = [];
      for (const b of boxes) {
        pushBoxVerts(arr, b.x, b.y, b.z, b.sx, b.sy, b.sz, b.yaw || 0, b.color, b.top || null);
      }
      staticBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, staticBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW);
      staticCount = arr.length / 9;
    },
    // Begin a frame: set camera, clear, draw the static city.
    beginFrame(eye, target, aspect) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const proj = mat4Perspective(1.13, aspect, 0.1, 1400);
      const view = mat4LookAt(eye, target, [0, 1, 0]);
      const pv = mat4Multiply(proj, view);
      gl.uniformMatrix4fv(loc.pv, false, pv);
      gl.uniform3fv(loc.eye, eye);
      gl.uniform3fv(loc.fogColor, WORLD.fogColor);
      gl.uniform1f(loc.fogNear, WORLD.fogNear);
      gl.uniform1f(loc.fogFar, WORLD.fogFar);
      gl.uniform1f(loc.alpha, 1);
      gl.disable(gl.BLEND);
      gl.depthMask(true);
      if (staticBuf) {
        gl.bindBuffer(gl.ARRAY_BUFFER, staticBuf);
        gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, 36, 0);
        gl.vertexAttribPointer(loc.nor, 3, gl.FLOAT, false, 36, 12);
        gl.vertexAttribPointer(loc.col, 3, gl.FLOAT, false, 36, 24);
        gl.enableVertexAttribArray(loc.pos);
        gl.enableVertexAttribArray(loc.nor);
        gl.enableVertexAttribArray(loc.col);
        gl.drawArrays(gl.TRIANGLES, 0, staticCount);
      }
      dynCount = 0;
      waterCount = 0;
    },
    // Queue a box for this frame (dynamic batch). pitch tilts it nose-up.
    box(x, y, z, sx, sy, sz, yaw, color, top, pitch) {
      if (dynCount >= dynCapacity) return;
      const start = dynCount * FLOATS_PER_BOX;
      const tmp = [];
      pushBoxVerts(tmp, x, y, z, sx, sy, sz, yaw || 0, color, top || null, pitch || 0);
      dynArray.set(tmp, start);
      dynCount++;
    },
    // Queue a translucent water box (drawn last).
    water(x, y, z, sx, sy, sz, color) {
      if (waterCount >= waterCapacity) return;
      const start = waterCount * FLOATS_PER_BOX;
      const tmp = [];
      pushBoxVerts(tmp, x, y, z, sx, sy, sz, 0, color, null);
      waterArray.set(tmp, start);
      waterCount++;
    },
    // Flush dynamic + water batches.
    endFrame() {
      gl.uniform1f(loc.alpha, 1);
      gl.disable(gl.BLEND);
      gl.depthMask(true);
      if (dynCount > 0) upload(dynBuf, dynArray, dynCount * 36);
      if (waterCount > 0) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        gl.uniform1f(loc.alpha, 0.72);
        upload(waterBuf, waterArray, waterCount * 36);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
        gl.uniform1f(loc.alpha, 1);
      }
    },
  };
}
