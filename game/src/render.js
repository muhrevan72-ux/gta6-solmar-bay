// Solmar Bay — the WebGL1 renderer.
//
// Raw WebGL1, no libraries. One directional light is faked with
// per-face shading (top bright, sides dimmer, bottom darkest) and
// distance fog. The texture atlas multiplies each vertex colour.
//
// THE FRAME RULE (play-test #5, round 7): beginFrame() is the
// ONLY place gl.clear() is called, once per frame, before any
// batch is drawn. draw() NEVER clears — the old build cleared at
// the start of every draw() and renderFrame drew 3x/frame, so
// each draw erased the previous ones and the frame showed only a
// small dynamic batch against the sky colour. A headless test
// enforces it: gl.clear appears exactly once in this file, inside
// beginFrame.
// WebGL1 has no four-vertex primitive — every quad is emitted
// as 2 triangles (6 vertices, same winding) and drawn with
// gl.TRIANGLES. The four-letter primitive name must never appear
// in any entry file (the dossier check fails the build on it).

import { tileUV, createAtlasTexture } from './texture.js';
import { cameraView, perspective, matMul } from './shots.js';

// Per-face shading: top 1.0, +X/-X 0.85, +Z/-Z 0.75, bottom 0.6.
export const FACE_SHADE = { top: 1.0, px: 0.85, nx: 0.85, pz: 0.75, nz: 0.75, bottom: 0.6 };

const VERT_SHADER = `
attribute vec3 aPos;
attribute vec3 aCol;
attribute vec2 aUV;
uniform mat4 uVP;
uniform vec2 uFogRange;
varying vec3 vCol;
varying vec2 vUV;
varying float vFog;
void main() {
  vec4 p = uVP * vec4(aPos, 1.0);
  gl_Position = p;
  vCol = aCol;
  vUV = aUV;
  float depth = clamp(p.z / p.w, 0.0, 1.0);
  vFog = smoothstep(uFogRange.x, uFogRange.y, depth);
}
`;

const FRAG_SHADER = `
precision mediump float;
varying vec3 vCol;
varying vec2 vUV;
varying float vFog;
uniform sampler2D uTex;
uniform vec3 uFogColor;
void main() {
  vec3 tex = texture2D(uTex, vUV).rgb;
  vec3 c = vCol * tex;
  gl_FragColor = vec4(mix(c, uFogColor, vFog), 1.0);
}
`;

// ---------- box batch (pure JS, testable without WebGL) ----------

// One vertex = position(3) + colour(3) + uv(2) = 8 floats.
export class BoxBatch {
  constructor() {
    this.pos = [];
    this.col = [];
    this.uv = [];
    this.verts = 0;
    this.boxes = 0;
    this.tris = 0;
  }

  reset() {
    this.pos.length = 0;
    this.col.length = 0;
    this.uv.length = 0;
    this.verts = 0;
    this.boxes = 0;
    this.tris = 0;
  }

  // Emit one triangle (3 vertices). UVs use the plain (white) tile
  // so the colour shows unmodified — used by the GLB loader.
  pushTri(p1, p2, p3, colour) {
    const [u0, v0, u1, v1] = tileUV('plain');
    const uc = (u0 + u1) / 2;
    const vc = (v0 + v1) / 2;
    for (const p of [p1, p2, p3]) {
      this.pos.push(p[0], p[1], p[2]);
      this.col.push(colour[0], colour[1], colour[2]);
      this.uv.push(uc, vc);
    }
    this.verts += 3;
    this.tris += 1;
  }

  // Emit one quad as 2 triangles (6 vertices). Corners are given
  // in counter-clockwise order as seen from outside the face.
  pushQuad(a, b, c, d, colour, tile, shade) {
    const [u0, v0, u1, v1] = tileUV(tile);
    const sh = shade;
    const col = [colour[0] * sh, colour[1] * sh, colour[2] * sh];
    const verts = [
      [a, u0, v0],
      [b, u1, v0],
      [c, u1, v1],
      [a, u0, v0],
      [c, u1, v1],
      [d, u0, v1],
    ];
    for (const [p, u, v] of verts) {
      this.pos.push(p[0], p[1], p[2]);
      this.col.push(col[0], col[1], col[2]);
      this.uv.push(u, v);
    }
    this.verts += 6;
    this.tris += 2;
  }

  // Push an axis-aligned box. (x, z) is the centre, y is the BOTTOM,
  // w/d the footprint, h the height. 6 faces, 36 vertices.
  pushBox(x, y, z, w, h, d, colour, tile = 'plain') {
    const x0 = x - w / 2;
    const x1 = x + w / 2;
    const y0 = y;
    const y1 = y + h;
    const z0 = z - d / 2;
    const z1 = z + d / 2;
    // Top (+Y), bottom (-Y), +X, -X, +Z, -Z. Winding is CCW from
    // outside; face culling is disabled anyway, so the depth buffer
    // decides what shows.
    this.pushQuad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], colour, tile, FACE_SHADE.top);
    this.pushQuad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], colour, tile, FACE_SHADE.bottom);
    this.pushQuad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], colour, tile, FACE_SHADE.px);
    this.pushQuad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], colour, tile, FACE_SHADE.nx);
    this.pushQuad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], colour, tile, FACE_SHADE.pz);
    this.pushQuad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], colour, tile, FACE_SHADE.nz);
    this.boxes += 1;
  }

  // Push a box rotated around Y by yaw (radians) — downtown towers
  // and angled props. Same 36 vertices, corners rotated first.
  pushBoxRot(x, y, z, w, h, d, yaw, colour, tile = 'plain') {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const rot = (px, pz) => {
      const dx = px - x;
      const dz = pz - z;
      return [x + dx * c - dz * s, z + dx * s + dz * c];
    };
    const x0 = x - w / 2;
    const x1 = x + w / 2;
    const z0 = z - d / 2;
    const z1 = z + d / 2;
    const y0 = y;
    const y1 = y + h;
    const c00 = rot(x0, z0);
    const c10 = rot(x1, z0);
    const c01 = rot(x0, z1);
    const c11 = rot(x1, z1);
    const P = (cx, cy, cz) => [cx, cy, cz];
    this.pushQuad(P(c01[0], y1, c01[1]), P(c11[0], y1, c11[1]), P(c10[0], y1, c10[1]), P(c00[0], y1, c00[1]), colour, tile, FACE_SHADE.top);
    this.pushQuad(P(c00[0], y0, c00[1]), P(c10[0], y0, c10[1]), P(c11[0], y0, c11[1]), P(c01[0], y0, c01[1]), colour, tile, FACE_SHADE.bottom);
    this.pushQuad(P(c11[0], y0, c11[1]), P(c10[0], y0, c10[1]), P(c10[0], y1, c10[1]), P(c11[0], y1, c11[1]), colour, tile, FACE_SHADE.px);
    this.pushQuad(P(c00[0], y0, c00[1]), P(c01[0], y0, c01[1]), P(c01[0], y1, c01[1]), P(c00[0], y1, c00[1]), colour, tile, FACE_SHADE.nx);
    this.pushQuad(P(c01[0], y0, c01[1]), P(c11[0], y0, c11[1]), P(c11[0], y1, c11[1]), P(c01[0], y1, c01[1]), colour, tile, FACE_SHADE.pz);
    this.pushQuad(P(c10[0], y0, c10[1]), P(c00[0], y0, c00[1]), P(c00[0], y1, c00[1]), P(c10[0], y1, c10[1]), colour, tile, FACE_SHADE.nz);
    this.boxes += 1;
  }

  vertexCount() {
    return this.verts;
  }

  boxCount() {
    return this.boxes;
  }
}

// Distance + forward-facing cull. Returns false when the point is
// behind the camera or beyond maxDist. Used for the dynamic batch
// and by the QA panorama test.
export function boxVisible(cam, x, y, z, maxDist) {
  const dx = x - cam.x;
  const dy = y - cam.y;
  const dz = z - cam.z;
  const d2 = dx * dx + dy * dy + dz * dz;
  if (d2 > maxDist * maxDist) return false;
  // Forward vector: from camera toward its look target.
  const fx = cam.tx - cam.x;
  const fy = cam.ty - cam.y;
  const fz = cam.tz - cam.z;
  const fl = Math.hypot(fx, fy, fz) || 1;
  const dot = (dx * fx + dy * fy + dz * fz) / (fl * (Math.sqrt(d2) || 1));
  return dot > -0.25; // allow a generous margin at the edges
}

// View-projection matrix for a camera and aspect ratio.
export function computeViewProj(cam, aspect) {
  const view = cameraView(cam);
  const proj = perspective((60 * Math.PI) / 180, aspect, 0.1, 1200);
  return matMul(proj, view);
}

// ---------- the renderer (needs a real canvas) ----------

function compileShader(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    throw new Error('shader compile failed: ' + log);
  }
  return sh;
}

export function createRenderer(canvas) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
  if (!gl) return null;
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERT_SHADER);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SHADER);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error('program link failed: ' + gl.getProgramInfoLog(prog));
  }
  gl.useProgram(prog);
  const loc = {
    pos: gl.getAttribLocation(prog, 'aPos'),
    col: gl.getAttribLocation(prog, 'aCol'),
    uv: gl.getAttribLocation(prog, 'aUV'),
    vp: gl.getUniformLocation(prog, 'uVP'),
    fogRange: gl.getUniformLocation(prog, 'uFogRange'),
    fogColor: gl.getUniformLocation(prog, 'uFogColor'),
    tex: gl.getUniformLocation(prog, 'uTex'),
  };
  const posBuf = gl.createBuffer();
  const colBuf = gl.createBuffer();
  const uvBuf = gl.createBuffer();
  // Atlas texture, or a 1x1 white fallback so colours still show
  // if the atlas could not be built.
  let tex = createAtlasTexture(gl);
  if (!tex) {
    tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  }
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.disable(gl.CULL_FACE);
  gl.disable(gl.BLEND);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.uniform1i(loc.tex, 0);

  const renderer = {
    gl,
    canvas,
    batch: new BoxBatch(),
    staticBatch: new BoxBatch(),
    glbBatch: new BoxBatch(),
    // THE ONLY gl.clear in the whole game. Once per frame, before
    // any batch is drawn. draw() never clears.
    beginFrame(sky) {
      gl.clearColor(sky[0], sky[1], sky[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    },
    setViewport(w, h) {
      gl.viewport(0, 0, w, h);
    },
    setCamera(viewProj, fogColor, fogNear, fogFar) {
      gl.uniformMatrix4fv(loc.vp, false, new Float32Array(viewProj));
      gl.uniform2f(loc.fogRange, fogNear, fogFar);
      gl.uniform3f(loc.fogColor, fogColor[0], fogColor[1], fogColor[2]);
    },
    // Draw one batch. Never clears. Uploads the batch arrays and
    // issues a single TRIANGLES draw.
    drawBatch(batch) {
      if (batch.verts === 0) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(batch.pos), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(loc.pos);
      gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(batch.col), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(loc.col);
      gl.vertexAttribPointer(loc.col, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(batch.uv), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(loc.uv);
      gl.vertexAttribPointer(loc.uv, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, batch.verts);
    },
  };
  return renderer;
}
