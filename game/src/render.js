// Solmar Bay — raw WebGL1 voxel renderer. No libraries.
// All art is coloured boxes. One directional light (baked into
// per-face brightness) + distance fog. Static city geometry is baked
// into one vertex buffer; moving things go through a dynamic batch.
//
// Importing this module is safe in Node (no GL work happens until
// createRenderer is called with a real canvas).

// ---- pure matrix math (testable) ----
export function mat4Identity() {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

export function mat4Multiply(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
  }
  return o;
}

export function mat4Perspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2);
  const nf = 1 / (near - far);
  return [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ];
}

export function mat4LookAt(eye, target, up) {
  let zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
  let zl = Math.hypot(zx, zy, zz) || 1;
  zx /= zl; zy /= zl; zz /= zl;
  let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
  let xl = Math.hypot(xx, xy, xz) || 1;
  xx /= xl; xy /= xl; xz /= xl;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  return [
    xx, yx, zx, 0,
    xy, yy, zy, 0,
    xz, yz, zz, 0,
    -(xx * eye[0] + xy * eye[1] + xz * eye[2]),
    -(yx * eye[0] + yy * eye[1] + yz * eye[2]),
    -(zx * eye[0] + zy * eye[1] + zz * eye[2]),
    1,
  ];
}

// Rotate a point around Y (yaw), then around the local forward axis
// (roll), then around the local right axis (pitch). Returns [x, y, z].
export function rotatePoint(p, yaw, roll, pitch) {
  let [x, y, z] = p;
  if (yaw) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const nx = x * c + z * s, nz = -x * s + z * c;
    x = nx; z = nz;
  }
  if (pitch) {
    const c = Math.cos(pitch), s = Math.sin(pitch);
    const ny = y * c - z * s, nz = y * s + z * c;
    y = ny; z = nz;
  }
  if (roll) {
    const c = Math.cos(roll), s = Math.sin(roll);
    const nx = x * c - y * s, ny = x * s + y * c;
    x = nx; y = ny;
  }
  return [x, y, z];
}

// The 8 corners of a box centred on the origin, half-extents given.
export function boxCorners(sx, sy, sz, yaw, roll, pitch) {
  const hx = sx / 2, hy = sy / 2, hz = sz / 2;
  const raw = [
    [-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz],
    [-hx, hy, -hz], [hx, hy, -hz], [hx, hy, hz], [-hx, hy, hz],
  ];
  return raw.map((p) => rotatePoint(p, yaw || 0, roll || 0, pitch || 0));
}

// Face definitions over the corner indices above, with a shade
// (fake directional light: top brightest, bottom darkest).
const FACES = [
  { idx: [4, 5, 6, 7], shade: 1.0 }, // top
  { idx: [3, 2, 1, 0], shade: 0.5 }, // bottom
  { idx: [1, 5, 6, 2], shade: 0.82 }, // +x
  { idx: [0, 4, 7, 3], shade: 0.68 }, // -x
  { idx: [2, 6, 7, 3], shade: 0.9 }, // +z
  { idx: [0, 1, 5, 4], shade: 0.76 }, // -z
];

// Emit one box into a flat vertex array (7 floats per vertex:
// x, y, z, r, g, b, a). Used by both the static bake and the
// dynamic batch, so the geometry is identical either way.
export function emitBox(arr, cx, cy, cz, sx, sy, sz, color, alpha, yaw, roll, pitch) {
  const corners = boxCorners(sx, sy, sz, yaw, roll, pitch);
  const a = alpha === undefined ? 1 : alpha;
  for (const f of FACES) {
    for (const ci of f.idx) {
      const p = corners[ci];
      arr.push(
        cx + p[0], cy + p[1], cz + p[2],
        color[0] * f.shade, color[1] * f.shade, color[2] * f.shade, a,
      );
    }
  }
}

const VERT = `
attribute vec3 aPos;
attribute vec4 aCol;
uniform mat4 uMVP;
varying vec4 vCol;
varying float vDepth;
void main() {
  vec4 view = uMVP * vec4(aPos, 1.0);
  vCol = aCol;
  vDepth = -view.z;
  gl_Position = view;
}
`;

const FRAG = `
precision mediump float;
varying vec4 vCol;
varying float vDepth;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
void main() {
  float f = clamp((vDepth - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
  vec3 col = mix(vCol.rgb, uFogColor, f);
  gl_FragColor = vec4(col, vCol.a);
}
`;

export const DYNAMIC_BOX_CAP = 2400;

export function createRenderer(canvas, fog) {
  const gl = canvas.getContext('webgl', { antialias: true });
  if (!gl) throw new Error('WebGL is not available');

  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error('shader: ' + gl.getShaderInfoLog(sh));
    }
    return sh;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const aPos = gl.getAttribLocation(prog, 'aPos');
  const aCol = gl.getAttribLocation(prog, 'aCol');
  const uMVP = gl.getUniformLocation(prog, 'uMVP');
  const uFogColor = gl.getUniformLocation(prog, 'uFogColor');
  const uFogNear = gl.getUniformLocation(prog, 'uFogNear');
  const uFogFar = gl.getUniformLocation(prog, 'uFogFar');

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(fog[0], fog[1], fog[2], 1);

  const staticBuf = gl.createBuffer();
  const dynBuf = gl.createBuffer();
  let staticCount = 0;
  let dynVerts = [];
  let dynCount = 0;
  let mvp = mat4Identity();

  function drawBuffer(buf, count) {
    if (count <= 0) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 28, 0);
    gl.vertexAttribPointer(aCol, 4, gl.FLOAT, false, 28, 12);
    gl.enableVertexAttribArray(aPos);
    gl.enableVertexAttribArray(aCol);
    gl.uniformMatrix4fv(uMVP, false, new Float32Array(mvp));
    gl.drawArrays(gl.QUADS, 0, count);
  }

  return {
    // Bake the static city into one buffer. `boxes` are
    // {x,y,z,sx,sy,sz,color,alpha?,yaw?,roll?,pitch?}.
    bakeStatic(boxes) {
      const arr = [];
      for (const b of boxes) {
        emitBox(arr, b.x, b.y, b.z, b.sx, b.sy, b.sz, b.color,
          b.alpha === undefined ? 1 : b.alpha, b.yaw || 0, b.roll || 0, b.pitch || 0);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, staticBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW);
      staticCount = arr.length / 7;
    },
    beginFrame(eye, target, aspect) {
      const view = mat4LookAt(eye, target, [0, 1, 0]);
      const proj = mat4Perspective(1.05, aspect, 0.5, 1200);
      mvp = mat4Multiply(proj, view);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniform3f(uFogColor, fog[0], fog[1], fog[2]);
      gl.uniform1f(uFogNear, 150);
      gl.uniform1f(uFogFar, 650);
      dynVerts = [];
      dynCount = 0;
      drawBuffer(staticBuf, staticCount);
    },
    // One dynamic box. Same shape as the static bake.
    box(x, y, z, sx, sy, sz, color, alpha, yaw, roll, pitch) {
      if (dynCount >= DYNAMIC_BOX_CAP) return false;
      emitBox(dynVerts, x, y, z, sx, sy, sz, color,
        alpha === undefined ? 1 : alpha, yaw || 0, roll || 0, pitch || 0);
      dynCount += 24;
      return true;
    },
    water(x, y, z, sx, sy, sz, color) {
      return this.box(x, y, z, sx, sy, sz, color, 0.72);
    },
    endFrame() {
      if (dynCount > 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, dynBuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(dynVerts), gl.DYNAMIC_DRAW);
        drawBuffer(dynBuf, dynCount);
      }
    },
    get dynamicDropped() { return dynCount >= DYNAMIC_BOX_CAP; },
  };
}
