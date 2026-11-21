// Solmar Bay — the raw-WebGL1 renderer.
// Every quad is emitted as 2 triangles (6 vertices); WebGL1 has
// no four-vertex primitive, so a quad primitive would render as
// a point cloud. Boxes are 12 triangles (36 vertices) with
// per-face shading: top 1.0, sides 0.85, bottom 0.7.

import { perspective, matMul, cameraView } from './shots.js';

// A batch is three parallel float arrays (positions, colours, UVs).
export function BoxBatch() {
  return { pos: [], col: [], uv: [] };
}
export function batchTris(b) {
  return Math.floor(b.pos.length / 9);
}
export function batchReset(b) {
  b.pos.length = 0;
  b.col.length = 0;
  b.uv.length = 0;
}

function pushTri(b, p0, p1, p2, shade, color, uv) {
  const r = color[0] * shade, g = color[1] * shade, bl = color[2] * shade;
  const pts = [p0, p1, p2];
  const uvs = [[uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]]];
  for (let i = 0; i < 3; i++) {
    b.pos.push(pts[i][0], pts[i][1], pts[i][2]);
    b.col.push(r, g, bl);
    b.uv.push(uvs[i][0], uvs[i][1]);
  }
}

// Push a quad as 2 triangles. p0..p3 are the four corners in order.
export function pushQuad(b, p0, p1, p2, p3, color, uv) {
  pushTri(b, p0, p1, p2, 1, color, [uv[0], uv[1], uv[2], uv[3]]);
  // Second triangle re-uses the same UV rect: p0 (u0,v0), p2 (u1,v1), p3 (u0,v1).
  const r = color[0], g = color[1], bl = color[2];
  const pts = [p0, p2, p3];
  const uvs = [[uv[0], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]]];
  for (let i = 0; i < 3; i++) {
    b.pos.push(pts[i][0], pts[i][1], pts[i][2]);
    b.col.push(r, g, bl);
    b.uv.push(uvs[i][0], uvs[i][1]);
  }
}

// Push an axis-aligned box. (x, z) is the centre, y is the BOTTOM
// of the box (it sits on the ground). Face order: top, bottom,
// front (+Z), back (-Z), right (+X), left (-X).
export function pushBox(b, x, y, z, w, h, d, color, uv) {
  const x0 = x - w / 2, x1 = x + w / 2;
  const y0 = y, y1 = y + h;
  const z0 = z - d / 2, z1 = z + d / 2;
  const u = uv || [0, 0, 1, 1];
  // Top (+Y), shade 1.0 — first, so the batch colour at index 0
  // is the full box colour (tests read the top face colour).
  pushTri(b, [x0, y1, z0], [x0, y1, z1], [x1, y1, z1], 1.0, color, u);
  pushTri(b, [x0, y1, z0], [x1, y1, z1], [x1, y1, z0], 1.0, color, u);
  // Bottom (-Y), shade 0.7.
  pushTri(b, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], 0.7, color, u);
  pushTri(b, [x0, y0, z0], [x1, y0, z1], [x0, y0, z1], 0.7, color, u);
  // Front (+Z), shade 0.85.
  pushTri(b, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], 0.85, color, u);
  pushTri(b, [x0, y0, z1], [x1, y1, z1], [x0, y1, z1], 0.85, color, u);
  // Back (-Z), shade 0.85.
  pushTri(b, [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], 0.85, color, u);
  pushTri(b, [x0, y0, z0], [x1, y1, z0], [x1, y0, z0], 0.85, color, u);
  // Right (+X), shade 0.85.
  pushTri(b, [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], 0.85, color, u);
  pushTri(b, [x1, y0, z0], [x1, y1, z1], [x1, y0, z1], 0.85, color, u);
  // Left (-X), shade 0.85.
  pushTri(b, [x0, y0, z0], [x0, y1, z1], [x0, y1, z0], 0.85, color, u);
  pushTri(b, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], 0.85, color, u);
}

// Push a box rotated around the Y axis by `angle` (radians).
// Local +Z is the box's forward; world offset = rotate(local).
export function pushBoxRot(b, x, y, z, w, h, d, angle, color, uv) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const rot = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const hw = w / 2, hd = d / 2;
  const y0 = y, y1 = y + h;
  const corner = (lx, yy, lz) => {
    const [wx, wz] = rot(lx, lz);
    return [wx, yy, wz];
  };
  const c0 = corner(-hw, y0, -hd), c1 = corner(hw, y0, -hd);
  const c2 = corner(hw, y0, hd), c3 = corner(-hw, y0, hd);
  const c4 = corner(-hw, y1, -hd), c5 = corner(hw, y1, -hd);
  const c6 = corner(hw, y1, hd), c7 = corner(-hw, y1, hd);
  const u = uv || [0, 0, 1, 1];
  pushTri(b, c4, c7, c6, 1.0, color, u);
  pushTri(b, c4, c6, c5, 1.0, color, u);
  pushTri(b, c0, c1, c2, 0.7, color, u);
  pushTri(b, c0, c2, c3, 0.7, color, u);
  pushTri(b, c3, c2, c6, 0.85, color, u);
  pushTri(b, c3, c6, c7, 0.85, color, u);
  pushTri(b, c0, c4, c5, 0.85, color, u);
  pushTri(b, c0, c5, c1, 0.85, color, u);
  pushTri(b, c1, c5, c6, 0.85, color, u);
  pushTri(b, c1, c6, c2, 0.85, color, u);
  pushTri(b, c0, c7, c4, 0.85, color, u);
  pushTri(b, c0, c3, c7, 0.85, color, u);
}

// Frustum + distance culling. The far plane is 700 m; a box is
// visible when its centre is in front of the camera and within
// the far plane (plus its radius).
export function boxVisible(cam, x, y, z, radius) {
  const dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
  const dist = Math.hypot(dx, dy, dz);
  if (dist - radius > 700) return false;
  let fx = cam.tx - cam.x, fy = cam.ty - cam.y, fz = cam.tz - cam.z;
  const fl = Math.hypot(fx, fy, fz) || 1;
  fx /= fl; fy /= fl; fz /= fl;
  const dot = dx * fx + dy * fy + dz * fz;
  return dot > -radius;
}

// View-projection for a camera (eye + target) at a viewport.
export function computeViewProj(cam, w, h) {
  const proj = perspective((60 * Math.PI) / 180, w / h, 0.1, 1200);
  const view = cameraView(cam);
  return matMul(proj, view);
}

const VERT_SRC = `
attribute vec3 aPos; attribute vec3 aCol; attribute vec2 aUv;
uniform mat4 uVP; varying vec3 vCol; varying vec2 vUv;
void main(){ gl_Position = uVP * vec4(aPos, 1.0); vCol = aCol; vUv = aUv; }`;
const FRAG_SRC = `
precision mediump float; varying vec3 vCol; varying vec2 vUv;
uniform sampler2D uTex;
void main(){ vec4 t = texture2D(uTex, vUv); gl_FragColor = vec4(vCol * t.rgb, 1.0); }`;

export function createRenderer(canvas, atlasTex) {
  const gl = canvas ? canvas.getContext('webgl') : null;
  const renderer = {
    gl,
    canvas,
    staticBatch: BoxBatch(),
    glbBatch: BoxBatch(),
    texture: null,
    _posBuf: null, _colBuf: null, _uvBuf: null,
    _aPos: 0, _aCol: 1, _aUv: 2,

    beginFrame(clearColor) {
      if (!gl) return;
      gl.clearColor(clearColor[0], clearColor[1], clearColor[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    },

    setView(vp, camPos, fogNear, fogFar) {
      if (!gl) return;
      const uVP = gl.getUniformLocation(this._prog, 'uVP');
      gl.uniformMatrix4fv(uVP, false, new Float32Array(vp));
      const uCam = gl.getUniformLocation(this._prog, 'uCamPos');
      gl.uniform3f(uCam, camPos[0], camPos[1], camPos[2]);
      const uFog = gl.getUniformLocation(this._prog, 'uFogRange');
      gl.uniform2f(uFog, fogNear, fogFar);
    },

    drawBatch(batch) {
      if (!gl) return;
      const tris = batchTris(batch);
      if (tris === 0) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, this._posBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(batch.pos), gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(this._aPos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, this._colBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(batch.col), gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(this._aCol, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, this._uvBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(batch.uv), gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(this._aUv, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, tris * 3);
    },
  };

  if (gl) {
    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      return sh;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT_SRC));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG_SRC));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    renderer._prog = prog;
    renderer._aPos = gl.getAttribLocation(prog, 'aPos');
    renderer._aCol = gl.getAttribLocation(prog, 'aCol');
    renderer._aUv = gl.getAttribLocation(prog, 'aUv');
    gl.enableVertexAttribArray(renderer._aPos);
    gl.enableVertexAttribArray(renderer._aCol);
    gl.enableVertexAttribArray(renderer._aUv);
    gl.enable(gl.DEPTH_TEST);
    renderer._posBuf = gl.createBuffer();
    renderer._colBuf = gl.createBuffer();
    renderer._uvBuf = gl.createBuffer();
    // Texture: the atlas when one exists, else a 1x1 white fallback
    // so the fragment shader always has something to sample.
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (atlasTex) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlasTex);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    renderer.texture = tex;
    const uTex = gl.getUniformLocation(prog, 'uTex');
    gl.uniform1i(uTex, 0);
  }
  return renderer;
}
