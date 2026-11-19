// Solmar Bay — raw WebGL1 renderer.
//
// REQUIRED (round-4 play-test): WebGL1 has no quad drawing mode at
// all. Every quad is emitted as 2 triangles (6 vertices) and drawn
// with gl.drawArrays(gl.TRIANGLES, ...). The four-letter quad
// constant must never appear in this file or anywhere in the entry.
//
// A box is 6 faces x 2 triangles x 3 vertices = 36 vertices.
// Each vertex is 7 floats: x,y,z, r,g,b,a (28 bytes).
// Face culling is OFF, so winding order cannot break the render.

export const VERTEX_FLOATS = 7;
export const VERTS_PER_BOX = 36;

// One quad (4 corners, counter-clockwise from outside) becomes two
// triangles: a,b,c and a,c,d. `out` is a plain number array.
export function pushQuad(out, a, b, c, d, col, alpha) {
  const r = col[0];
  const g = col[1];
  const bl = col[2];
  const al = alpha === undefined ? 1 : alpha;
  const tris = [a, b, c, a, c, d];
  for (let i = 0; i < 6; i++) {
    const p = tris[i];
    out.push(p[0], p[1], p[2], r, g, bl, al);
  }
}

// Push one axis-aligned box centred at (x, y, z) with size
// (sx, sy, sz). y is the box centre height.
export function pushBox(out, x, y, z, sx, sy, sz, col, alpha) {
  const x0 = x - sx / 2;
  const x1 = x + sx / 2;
  const y0 = y - sy / 2;
  const y1 = y + sy / 2;
  const z0 = z - sz / 2;
  const z1 = z + sz / 2;
  // +X face
  pushQuad(out, [x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], col, alpha);
  // -X face
  pushQuad(out, [x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], col, alpha);
  // +Y top
  pushQuad(out, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], col, alpha);
  // -Y bottom
  pushQuad(out, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], col, alpha);
  // +Z face
  pushQuad(out, [x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1], col, alpha);
  // -Z face
  pushQuad(out, [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], col, alpha);
}

// Build a Float32Array of triangle vertices from a box list.
// Each box: { x, y, z, sx, sy, sz, c: [r,g,b], a? }.
export function buildVertices(boxes) {
  const out = [];
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    pushBox(out, b.x, b.y, b.z, b.sx, b.sy, b.sz, b.c, b.a);
  }
  return new Float32Array(out);
}

// --- mat4 (column-major, WebGL style) ---
export function mat4Identity() {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}
export function mat4Multiply(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      o[c * 4 + r] =
        a[0 * 4 + r] * b[c * 4 + 0] +
        a[1 * 4 + r] * b[c * 4 + 1] +
        a[2 * 4 + r] * b[c * 4 + 2] +
        a[3 * 4 + r] * b[c * 4 + 3];
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
export function mat4LookAt(eye, center, up) {
  let zx = eye[0] - center[0];
  let zy = eye[1] - center[1];
  let zz = eye[2] - center[2];
  let len = Math.hypot(zx, zy, zz) || 1;
  zx /= len; zy /= len; zz /= len;
  let xx = up[1] * zz - up[2] * zy;
  let xy = up[2] * zx - up[0] * zz;
  let xz = up[0] * zy - up[1] * zx;
  len = Math.hypot(xx, xy, xz) || 1;
  xx /= len; xy /= len; xz /= len;
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;
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

const VERT = `
attribute vec3 aPos;
attribute vec4 aCol;
uniform mat4 uMVP;
uniform vec3 uCam;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
varying vec4 vCol;
varying float vFog;
void main() {
  vec4 p = uMVP * vec4(aPos, 1.0);
  gl_Position = p;
  vCol = aCol;
  float d = distance(aPos, uCam);
  vFog = clamp((d - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
}`;
const FRAG = `
precision mediump float;
uniform vec3 uFogColor;
varying vec4 vCol;
varying float vFog;
void main() {
  vec3 rgb = mix(vCol.rgb, uFogColor, vFog);
  gl_FragColor = vec4(rgb, vCol.a);
}`;

// Create the renderer. In Node (no canvas / no WebGL) returns a stub
// with the same method names so headless tests can run.
export function createRenderer(canvas) {
  let gl = null;
  try {
    gl = canvas && canvas.getContext ? canvas.getContext('webgl', { antialias: true }) : null;
  } catch (e) {
    gl = null;
  }
  if (!gl) {
    return {
      stub: true,
      gl: null,
      setStatic() {},
      setWater() {},
      draw() {},
      resize() {},
      staticVerts: 0,
    };
  }

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
  const uCam = gl.getUniformLocation(prog, 'uCam');
  const uFogColor = gl.getUniformLocation(prog, 'uFogColor');
  const uFogNear = gl.getUniformLocation(prog, 'uFogNear');
  const uFogFar = gl.getUniformLocation(prog, 'uFogFar');

  gl.disable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const staticBuf = gl.createBuffer();
  const waterBuf = gl.createBuffer();
  const dynBuf = gl.createBuffer();
  let staticCount = 0;
  let waterCount = 0;
  let fogColor = [0.98, 0.74, 0.58];

  function upload(buf, verts) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
  }
  function drawBuffer(buf, count) {
    if (count <= 0) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 28, 0);
    gl.vertexAttribPointer(aCol, 4, gl.FLOAT, false, 28, 12);
    gl.enableVertexAttribArray(aPos);
    gl.enableVertexAttribArray(aCol);
    gl.drawArrays(gl.TRIANGLES, 0, count);
  }

  return {
    stub: false,
    gl,
    setFogColor(c) {
      fogColor = c;
    },
    setStatic(boxes) {
      const verts = buildVertices(boxes);
      upload(staticBuf, verts);
      staticCount = verts.length / VERTEX_FLOATS;
      this.staticVerts = staticCount;
    },
    setWater(boxes) {
      const verts = buildVertices(boxes);
      upload(waterBuf, verts);
      waterCount = verts.length / VERTEX_FLOATS;
    },
    // camera: { eye:[x,y,z], center:[x,y,z], fov, aspect }
    // dynamicBoxes: box list for this frame (cars, peds, player...)
    draw(camera, dynamicBoxes, fogNear, fogFar) {
      const w = canvas.width;
      const h = canvas.height;
      gl.viewport(0, 0, w, h);
      gl.clearColor(fogColor[0], fogColor[1], fogColor[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const proj = mat4Perspective(camera.fov, w / h, 0.5, 1400);
      const view = mat4LookAt(camera.eye, camera.center, [0, 1, 0]);
      const mvp = mat4Multiply(proj, view);
      gl.uniformMatrix4fv(uMVP, false, new Float32Array(mvp));
      gl.uniform3fv(uCam, new Float32Array(camera.eye));
      gl.uniform3fv(uFogColor, new Float32Array(fogColor));
      gl.uniform1f(uFogNear, fogNear === undefined ? 120 : fogNear);
      gl.uniform1f(uFogFar, fogFar === undefined ? 700 : fogFar);
      drawBuffer(staticBuf, staticCount);
      if (dynamicBoxes && dynamicBoxes.length) {
        const verts = buildVertices(dynamicBoxes);
        gl.bindBuffer(gl.ARRAY_BUFFER, dynBuf);
        gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);
        drawBuffer(dynBuf, verts.length / VERTEX_FLOATS);
      }
      drawBuffer(waterBuf, waterCount);
    },
    resize(w, h) {
      canvas.width = w;
      canvas.height = h;
    },
    staticVerts: 0,
  };
}
