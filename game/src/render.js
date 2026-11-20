// Solmar Bay — WebGL renderer + box batches (rebuild #13).
// Triangles only. Per-face shading: top 1.0, sides 0.85, bottom
// 0.7. Fog is computed from distance in METRES (uFogRange), never
// from NDC depth.
import { createAtlasTexture } from './texture.js';
// Re-exported here because the render suites import the camera
// maths from the renderer module; the implementation lives in
// shots.js (no import cycle: shots.js does not import render.js).
export { computeViewProj } from './shots.js';

export function BoxBatch() {
  return { pos: [], col: [], uv: [], _bufs: null };
}

export function batchReset(b) {
  b.pos.length = 0;
  b.col.length = 0;
  b.uv.length = 0;
}

export function batchTris(b) {
  return b.pos.length / 9;
}

export function pushQuad(b, a, b2, c, d, col, uv) {
  const [u0, v0, u1, v1] = uv;
  const verts = [a, b2, c, a, c, d];
  const uvs = [[u0, v0], [u1, v0], [u1, v1], [u0, v0], [u1, v1], [u0, v1]];
  for (let i = 0; i < 6; i++) {
    const v = verts[i];
    b.pos.push(v[0], v[1], v[2]);
    b.col.push(col[0], col[1], col[2]);
    b.uv.push(uvs[i][0], uvs[i][1]);
  }
}

// Box centred at (x, z), sitting on y (y is the BOTTOM), size w/h/d.
// Face order: top, bottom, +Z, -Z, +X, -X — all wound CCW from outside.
export function pushBox(b, x, y, z, w, h, d, col, uv) {
  const x0 = x - w / 2, x1 = x + w / 2;
  const y0 = y, y1 = y + h;
  const z0 = z - d / 2, z1 = z + d / 2;
  const shade = (f) => [col[0] * f, col[1] * f, col[2] * f];
  // top (+Y)
  pushQuad(b, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], shade(1.0), uv);
  // bottom (-Y)
  pushQuad(b, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], shade(0.7), uv);
  // front (+Z)
  pushQuad(b, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], shade(0.85), uv);
  // back (-Z)
  pushQuad(b, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], shade(0.85), uv);
  // right (+X)
  pushQuad(b, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], shade(0.85), uv);
  // left (-X)
  pushQuad(b, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], shade(0.85), uv);
}

// Box rotated around the Y axis by `angle` radians.
export function pushBoxRot(b, x, y, z, w, h, d, angle, col, uv) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const rot = (px, pz) => {
    const dx = px - x, dz = pz - z;
    return [x + dx * cos + dz * sin, z - dx * sin + dz * cos];
  };
  const x0 = x - w / 2, x1 = x + w / 2;
  const y0 = y, y1 = y + h;
  const z0 = z - d / 2, z1 = z + d / 2;
  const [a00, a01] = rot(x0, z0); const [a10, a11] = rot(x1, z0);
  const [a01x, a01z] = rot(x0, z1); const [a11x, a11z] = rot(x1, z1);
  const shade = (f) => [col[0] * f, col[1] * f, col[2] * f];
  const top = [[a01x, y1, a01z], [a11x, y1, a11z], [a10, y1, a11], [a00, y1, a01]];
  const bot = [[a00, y0, a01], [a10, y0, a11], [a11x, y0, a11z], [a01x, y0, a01z]];
  const fr = [[a01x, y0, a01z], [a11x, y0, a11z], [a11x, y1, a11z], [a01x, y1, a01z]];
  const bk = [[a10, y0, a11], [a00, y0, a01], [a00, y1, a01], [a10, y1, a11]];
  const rt = [[a11x, y0, a11z], [a10, y0, a11], [a10, y1, a11], [a11x, y1, a11z]];
  const lf = [[a00, y0, a01], [a01x, y0, a01z], [a01x, y1, a01z], [a00, y1, a01]];
  pushQuad(b, top[0], top[1], top[2], top[3], shade(1.0), uv);
  pushQuad(b, bot[0], bot[1], bot[2], bot[3], shade(0.7), uv);
  pushQuad(b, fr[0], fr[1], fr[2], fr[3], shade(0.85), uv);
  pushQuad(b, bk[0], bk[1], bk[2], bk[3], shade(0.85), uv);
  pushQuad(b, rt[0], rt[1], rt[2], rt[3], shade(0.85), uv);
  pushQuad(b, lf[0], lf[1], lf[2], lf[3], shade(0.85), uv);
}

export function boxVisible(cam, x, y, z, r) {
  const dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
  const dist = Math.hypot(dx, dy, dz);
  if (dist > 700 + r) return false;
  const fx = cam.tx - cam.x, fy = cam.ty - cam.y, fz = cam.tz - cam.z;
  const fl = Math.hypot(fx, fy, fz) || 1;
  const dot = (dx * fx + dy * fy + dz * fz) / fl;
  return dot > -r;
}

const VERT = `
attribute vec3 aPos; attribute vec3 aCol; attribute vec2 aUV;
uniform mat4 uVP; uniform vec3 uCamPos; uniform vec2 uFogRange;
varying vec3 vCol; varying vec2 vUV; varying float vFog;
void main(){
  vec4 p = uVP * vec4(aPos, 1.0);
  gl_Position = p;
  vCol = aCol; vUV = aUV;
  float d = distance(aPos, uCamPos);
  vFog = smoothstep(uFogRange.x, uFogRange.y, d);
}`;
const FRAG = `
precision mediump float;
varying vec3 vCol; varying vec2 vUV; varying float vFog;
uniform sampler2D uTex; uniform vec3 uFogColor;
void main(){
  vec4 t = texture2D(uTex, vUV);
  vec3 c = vCol * t.rgb;
  c = mix(c, uFogColor, vFog);
  gl_FragColor = vec4(c, 1.0);
}`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  return sh;
}

export function createRenderer(canvas, doc) {
  const gl = canvas.getContext('webgl');
  if (!gl) return null;
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  if (gl.enable) {
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
  }
  gl.viewport(0, 0, canvas.width, canvas.height);
  // Texture: the atlas when the browser can build one, else a 1x1
  // white fallback so the shader still multiplies by 1.
  let texture = null;
  try {
    texture = createAtlasTexture(gl);
  } catch (e) {
    texture = null;
  }
  if (!texture) {
    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
    } catch (e) { /* mock GLs ignore pixel uploads */ }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  }
  const locs = {
    uVP: gl.getUniformLocation(prog, 'uVP'),
    uCamPos: gl.getUniformLocation(prog, 'uCamPos'),
    uFogRange: gl.getUniformLocation(prog, 'uFogRange'),
    uFogColor: gl.getUniformLocation(prog, 'uFogColor'),
    uTex: gl.getUniformLocation(prog, 'uTex'),
    aPos: gl.getAttribLocation(prog, 'aPos'),
    aCol: gl.getAttribLocation(prog, 'aCol'),
    aUV: gl.getAttribLocation(prog, 'aUV'),
  };
  const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

  function ensureBufs(batch) {
    if (!batch._bufs) {
      batch._bufs = {
        pos: gl.createBuffer(),
        col: gl.createBuffer(),
        uv: gl.createBuffer(),
      };
    }
    return batch._bufs;
  }

  const renderer = {
    gl,
    canvas,
    texture,
    program: prog,
    staticBatch: BoxBatch(),
    glbBatch: BoxBatch(),
    dynBatch: BoxBatch(),
    // Assigned by main.js (avoids a render <-> world import cycle):
    // rebuilds staticBatch + glbBatch from the game state.
    rebuildStaticBatches: null,
    beginFrame(sky) {
      gl.clearColor(sky[0], sky[1], sky[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    },
    drawBatch(batch, vp, camPos, fogRange, fogColor) {
      const bufs = ensureBufs(batch);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufs.pos);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(batch.pos), gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufs.col);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(batch.col), gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufs.uv);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(batch.uv), gl.DYNAMIC_DRAW);
      gl.useProgram(prog);
      gl.uniformMatrix4fv(locs.uVP, false, vp || IDENTITY);
      const cp = camPos || [0, 0, 0];
      gl.uniform3f(locs.uCamPos, cp[0], cp[1], cp[2]);
      const fr = fogRange || [60, 420];
      gl.uniform2f(locs.uFogRange, fr[0], fr[1]);
      const fc = fogColor || [0.6, 0.75, 0.9];
      gl.uniform3f(locs.uFogColor, fc[0], fc[1], fc[2]);
      gl.uniform1i(locs.uTex, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufs.pos);
      gl.enableVertexAttribArray(locs.aPos);
      gl.vertexAttribPointer(locs.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufs.col);
      gl.enableVertexAttribArray(locs.aCol);
      gl.vertexAttribPointer(locs.aCol, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufs.uv);
      gl.enableVertexAttribArray(locs.aUV);
      gl.vertexAttribPointer(locs.aUV, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, batchTris(batch) * 3);
    },
  };
  return renderer;
}
