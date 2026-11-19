// Solmar Bay — the WebGL1 renderer.
//
// Raw WebGL1, no libraries. Every solid surface is a box built from
// triangle faces: each face is emitted as TWO triangles (6 vertices,
// same winding) and drawn with gl.TRIANGLES. WebGL1 has no other
// filled-primitive draw mode, and a point-cloud scene is what you get
// if you try anything else — the round-4 play-test proved it.
//
// THE FRAME RULE (play-test #5, 20 Nov 2026 — read this before
// touching this file): the colour/depth buffers are cleared EXACTLY
// ONCE per frame, in beginFrame(), before any batch is drawn. The
// old build called gl.clear() at the start of every draw() — and the
// frame draws three batches (static city, GLB props, dynamic
// objects) — so the second and third clears erased everything drawn
// before them. The final image was only the tiny dynamic batch
// against the sky clear colour: a flat orange screen, no buildings,
// no roads, exactly what play-test #5 saw twice. draw() MUST NEVER
// clear. A headless test enforces it: gl.clear appears exactly once
// in this file, inside beginFrame.
//
// The renderer is split in two halves so headless tests can use the
// pure half: BoxBatch (geometry) and the mat4 helpers are plain JS;
// createRenderer (the GL context, shaders, draw calls) only runs in
// a browser. BoxBatch is also where frustum culling and LOD live.

import { COL } from './config.js';
import { faceUV, tileUV, createAtlasTexture } from './texture.js';

// Centre of the plain (white) tile in the atlas — pushTri samples
// here so non-box triangles render in their flat colour.
const PLAIN_UV = (() => {
  const [u0, v0, u1, v1] = tileUV('plain');
  return [(u0 + u1) / 2, (v0 + v1) / 2];
})();

// Per-face shading so voxel boxes read as 3D: top brightest, bottom
// darkest, sides in between. Order matches the FACES table below:
// +Z, -Z, +X, -X, +Y, -Y.
const FACE_SHADE = [0.75, 0.75, 0.85, 0.85, 1.0, 0.6];

// A batch of coloured boxes. Positions and colours are flat arrays
// of 3 floats per vertex; UVs are 2 floats per vertex (see
// texture.js). Every face contributes exactly 6 vertices (two
// triangles). `count` is the vertex count for gl.drawArrays.
//
// Invariant the tests check: pos.length / 3 === col.length / 3 ===
// uv.length / 2 === count. If a push method ever breaks that, the
// shader reads the wrong attribute stream and the scene draws
// garbage (or nothing) with no error from WebGL.
export class BoxBatch {
  constructor() {
    this.pos = [];
    this.col = [];
    this.uv = [];
    this.boxes = 0;
  }
  get count() {
    return this.pos.length / 3;
  }
  clear() {
    this.pos.length = 0;
    this.col.length = 0;
    this.uv.length = 0;
    this.boxes = 0;
  }
  // Emit one face (4 corner positions) as two triangles. `shade` is
  // the per-face brightness, `u0,v0,u1,v1` the atlas rect for it.
  _face(corners, shade, colour, uvRect) {
    const [u0, v0, u1, v1] = uvRect;
    const r = Math.min(1.4, colour[0] * shade);
    const g = Math.min(1.4, colour[1] * shade);
    const b = Math.min(1.4, colour[2] * shade);
    // Triangle 1: corners 0,1,2 — triangle 2: corners 0,2,3.
    // UV corners: (u0,v0) (u1,v0) (u1,v1) (u0,v0) (u1,v1) (u0,v1).
    const order = [0, 1, 2, 0, 2, 3];
    for (let k = 0; k < 6; k++) {
      const p = corners[order[k]];
      this.pos.push(p[0], p[1], p[2]);
      this.col.push(r, g, b);
      const u = (k === 1 || k === 2 || k === 4) ? u1 : u0;
      const v = (k === 2 || k === 4 || k === 5) ? v1 : v0;
      this.uv.push(u, v);
    }
  }
  // Push one axis-aligned box centred at (x, y, z) with size
  // (sx, sy, sz). `tile` names a texture-atlas tile (default 'plain'
  // = white, so the box renders exactly as before); the tile repeats
  // every few world units on each face (see faceUV in texture.js).
  pushBox(x, y, z, sx, sy, sz, c, shadeScale, tile) {
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const scale = shadeScale === undefined ? 1 : shadeScale;
    // 8 corners: 0..3 bottom ring (-Y), 4..7 top ring (+Y).
    const v = [
      [x - hx, y - hy, z - hz], [x + hx, y - hy, z - hz],
      [x + hx, y + hy, z - hz], [x - hx, y + hy, z - hz],
      [x - hx, y - hy, z + hz], [x + hx, y - hy, z + hz],
      [x + hx, y + hy, z + hz], [x - hx, y + hy, z + hz],
    ];
    // 6 faces, each as 4 corner indices in counter-clockwise order
    // seen from outside the box (front faces for BACK culling).
    const faces = [
      [4, 5, 6, 7], // +Z
      [1, 0, 3, 2], // -Z
      [5, 1, 2, 6], // +X
      [0, 4, 7, 3], // -X
      [7, 6, 2, 3], // +Y (top)
      [0, 1, 5, 4], // -Y (bottom)
    ];
    const faceW = [sx, sx, sz, sz, sx, sx];
    const faceH = [sy, sy, sy, sy, sz, sz];
    for (let f = 0; f < 6; f++) {
      const idx = faces[f];
      const corners = [v[idx[0]], v[idx[1]], v[idx[2]], v[idx[3]]];
      this._face(corners, FACE_SHADE[f] * scale, c, faceUV(tile || 'plain', faceW[f], faceH[f]));
    }
    this.boxes++;
  }
  // Push a box rotated around the Y axis by `yaw` radians (for
  // vehicles facing their heading, signs, etc.). Yaw 0 is identical
  // to pushBox. Vertices are rotated in the XZ plane about (x, z).
  pushBoxRot(x, y, z, sx, sy, sz, c, yaw, shadeScale, tile) {
    if (!yaw) {
      this.pushBox(x, y, z, sx, sy, sz, c, shadeScale, tile);
      return;
    }
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const scale = shadeScale === undefined ? 1 : shadeScale;
    const cos = Math.cos(yaw), sin = Math.sin(yaw);
    const rot = (px, pz) => [x + px * cos - pz * sin, z + px * sin + pz * cos];
    const c0 = rot(-hx, -hz), c1 = rot(hx, -hz), c2 = rot(hx, hz), c3 = rot(-hx, hz);
    const v = [
      [c0[0], y - hy, c0[1]], [c1[0], y - hy, c1[1]],
      [c1[0], y + hy, c1[1]], [c0[0], y + hy, c0[1]],
      [c3[0], y - hy, c3[1]], [c2[0], y - hy, c2[1]],
      [c2[0], y + hy, c2[1]], [c3[0], y + hy, c3[1]],
    ];
    const faces = [
      [4, 5, 6, 7], [1, 0, 3, 2], [5, 1, 2, 6],
      [0, 4, 7, 3], [7, 6, 2, 3], [0, 1, 5, 4],
    ];
    const faceW = [sx, sx, sz, sz, sx, sx];
    const faceH = [sy, sy, sy, sy, sz, sz];
    for (let f = 0; f < 6; f++) {
      const idx = faces[f];
      const corners = [v[idx[0]], v[idx[1]], v[idx[2]], v[idx[3]]];
      this._face(corners, FACE_SHADE[f] * scale, c, faceUV(tile || 'plain', faceW[f], faceH[f]));
    }
    this.boxes++;
  }
  // Push one arbitrary triangle (9 coordinates, one flat colour) —
  // used by the glTF loader for non-box geometry. UVs are the centre
  // of the plain (white) tile, so the colour is unaffected by the
  // atlas. Counts as one box for the batch-cap accounting.
  pushTri(ax, ay, az, bx, by, bz, cx, cy, cz, c) {
    this.pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    this.col.push(c[0], c[1], c[2], c[0], c[1], c[2], c[0], c[1], c[2]);
    this.uv.push(PLAIN_UV[0], PLAIN_UV[1], PLAIN_UV[0], PLAIN_UV[1], PLAIN_UV[0], PLAIN_UV[1]);
    this.boxes++;
  }
  // Push a thin flat quad lying on the ground (one face, 2 triangles,
  // 6 vertices) — road dashes, towels, water glints. Facing +Y: the
  // winding is (0,1,2) (0,2,3) over corners ordered so the computed
  // normal is +Y (same convention as the top face in pushBox).
  pushFlat(x, y, z, sx, sz, c, tile) {
    const hx = sx / 2, hz = sz / 2;
    const quad = [
      [x - hx, y, z - hz], [x - hx, y, z + hz],
      [x + hx, y, z + hz], [x + hx, y, z - hz],
    ];
    const [u0, v0, u1, v1] = faceUV(tile || 'plain', sx, sz);
    const order = [0, 1, 2, 0, 2, 3];
    for (let k = 0; k < 6; k++) {
      const p = quad[order[k]];
      this.pos.push(p[0], p[1], p[2]);
      this.col.push(c[0], c[1], c[2]);
      const u = (k === 2 || k === 4 || k === 5) ? u1 : u0;
      const v = (k === 1 || k === 2 || k === 4) ? v1 : v0;
      this.uv.push(u, v);
    }
    this.boxes++;
  }
  // Push a thin flat panel (one face, 2 triangles, 6 vertices) — used
  // for windows, signs and lane dashes. `axis` is 'x' or 'z'.
  pushPanel(x, y, z, w, h, c, axis, tile) {
    const hw = w / 2, hh = h / 2;
    let quad;
    if (axis === 'x') {
      quad = [[x, y - hh, z - hw], [x, y - hh, z + hw], [x, y + hh, z + hw], [x, y + hh, z - hw]];
    } else {
      quad = [[x - hw, y - hh, z], [x + hw, y - hh, z], [x + hw, y + hh, z], [x - hw, y + hh, z]];
    }
    const [u0, v0, u1, v1] = faceUV(tile || 'plain', w, h);
    const order = [0, 1, 2, 0, 2, 3];
    for (let k = 0; k < 6; k++) {
      const p = quad[order[k]];
      this.pos.push(p[0], p[1], p[2]);
      this.col.push(c[0], c[1], c[2]);
      const u = (k === 1 || k === 2 || k === 4) ? u1 : u0;
      const v = (k === 2 || k === 4 || k === 5) ? v1 : v0;
      this.uv.push(u, v);
    }
    this.boxes++;
  }
}

// Frustum + distance culling: keep only boxes whose centre is within
// `maxDist` of the camera and inside the view cone (cheap check: the
// box must be in front of the camera within a wide field of view).
export function boxVisible(bx, bz, cam, maxDist) {
  const dx = bx - cam.x;
  const dz = bz - cam.z;
  const d2 = dx * dx + dz * dz;
  if (d2 > maxDist * maxDist) return false;
  // In front of the camera? Dot with the forward vector.
  const fx = Math.sin(cam.yaw);
  const fz = Math.cos(cam.yaw);
  const dot = dx * fx + dz * fz;
  if (dot < -20) return false; // behind the camera
  return true;
}

// ---- mat4 helpers (column-major, like WebGL expects) ----

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
  return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
}

export function mat4LookAt(eye, target, up) {
  const zx = eye[0] - target[0];
  const zy = eye[1] - target[1];
  const zz = eye[2] - target[2];
  let zl = Math.sqrt(zx * zx + zy * zy + zz * zz) || 1;
  const z = [zx / zl, zy / zl, zz / zl];
  let xx = up[1] * z[2] - up[2] * z[1];
  let xy = up[2] * z[0] - up[0] * z[2];
  let xz = up[0] * z[1] - up[1] * z[0];
  let xl = Math.sqrt(xx * xx + xy * xy + xz * xz) || 1;
  const x = [xx / xl, xy / xl, xz / xl];
  const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  return [
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]),
    -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]),
    -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]),
    1,
  ];
}

// Project a world point through a view-projection matrix to NDC
// (x, y in [-1, 1] when visible). Pure maths, for the camera-framing
// test: a downtown building must project into the central band of
// the screen, not just the top edge.
export function projectPoint(vp, pt) {
  const [x, y, z] = pt;
  const cx = vp[0] * x + vp[4] * y + vp[8] * z + vp[12];
  const cy = vp[1] * x + vp[5] * y + vp[9] * z + vp[13];
  const cz = vp[2] * x + vp[6] * y + vp[10] * z + vp[14];
  const cw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
  return { x: cx / cw, y: cy / cw, z: cz / cw, behind: cw <= 0 };
}

// ---- Browser-only renderer (WebGL1) ----

export function createRenderer(canvas) {
  if (typeof document === 'undefined' || !canvas) return null;
  const gl = canvas.getContext('webgl', { antialias: false });
  if (!gl) return null;
  const vs = `
    attribute vec3 aPos;
    attribute vec3 aCol;
    attribute vec2 aUV;
    uniform mat4 uVP;
    varying vec3 vCol;
    varying vec2 vUV;
    varying float vFog;
    void main() {
      vec4 p = uVP * vec4(aPos, 1.0);
      gl_Position = p;
      vCol = aCol;
      vUV = aUV;
      vFog = clamp((p.z / p.w + 1.0) * 0.5, 0.0, 1.0);
    }`;
  const fs = `
    precision mediump float;
    varying vec3 vCol;
    varying vec2 vUV;
    varying float vFog;
    uniform vec3 uFogCol;
    uniform float uFogNear;
    uniform float uFogFar;
    uniform sampler2D uTex;
    void main() {
      float f = clamp((vFog - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
      vec3 col = mix(vCol * texture2D(uTex, vUV).rgb, uFogCol, f);
      gl_FragColor = vec4(col, 1.0);
    }`;
  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    return sh;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  const locPos = gl.getAttribLocation(prog, 'aPos');
  const locCol = gl.getAttribLocation(prog, 'aCol');
  const locUv = gl.getAttribLocation(prog, 'aUV');
  const locVP = gl.getUniformLocation(prog, 'uVP');
  const locFogCol = gl.getUniformLocation(prog, 'uFogCol');
  const locFogNear = gl.getUniformLocation(prog, 'uFogNear');
  const locFogFar = gl.getUniformLocation(prog, 'uFogFar');
  const locTex = gl.getUniformLocation(prog, 'uTex');
  const bufPos = gl.createBuffer();
  const bufCol = gl.createBuffer();
  const bufUv = gl.createBuffer();
  // Procedural texture atlas (canvas-generated); falls back to a 1x1
  // white texture, in which case the game renders exactly as before.
  const atlas = createAtlasTexture(gl);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  return {
    gl,
    // Start a frame: set the sky clear colour and clear the buffers.
    // This is the ONLY clear in the whole renderer — it runs once
    // per frame, before the first draw. See the frame rule at the
    // top of this file.
    beginFrame(sky) {
      gl.clearColor(sky[0], sky[1], sky[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    },
    // Draw one batch. Never clears — the caller clears once via
    // beginFrame, then draws every batch into the same frame.
    draw(batch, vp, fogCol, fogNear, fogFar) {
      if (!batch || batch.count === 0) return;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, atlas);
      gl.uniform1i(locTex, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufPos);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(batch.pos), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(locPos);
      gl.vertexAttribPointer(locPos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufCol);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(batch.col), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(locCol);
      gl.vertexAttribPointer(locCol, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufUv);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(batch.uv), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(locUv);
      gl.vertexAttribPointer(locUv, 2, gl.FLOAT, false, 0, 0);
      gl.uniformMatrix4fv(locVP, false, new Float32Array(vp));
      gl.uniform3fv(locFogCol, new Float32Array(fogCol));
      gl.uniform1f(locFogNear, fogNear);
      gl.uniform1f(locFogFar, fogFar);
      gl.drawArrays(gl.TRIANGLES, 0, batch.count);
    },
  };
}

export { COL, FACE_SHADE };
