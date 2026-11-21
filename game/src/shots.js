// Solmar Bay — third-person camera + projection math.
// Written fresh for rebuild #18. The camera orbits the player:
// yaw PI looks +Z, pitch 0.28, distance 14. The view matrix is a
// lookAt from the eye to the target; the projection is a 60-degree
// perspective. All matrices are column-major (WebGL convention).

export const CAM_DEFAULTS = { pitch: 0.28, dist: 14 };
// The old, too-steep framing (round-4 regression): it pushes the
// horizon to the top of the screen.
export const CAM_BAD = { pitch: 0.42, dist: 10 };

const FOV = (60 * Math.PI) / 180;

export function createCamera() {
  return {
    yaw: Math.PI,
    pitch: CAM_DEFAULTS.pitch,
    dist: CAM_DEFAULTS.dist,
    x: 0, y: 4, z: 6,
    tx: 0, ty: 0, tz: 20,
  };
}

// Follow the target, orbit on mouse drag. Consumes the mouse
// deltas. Stable when the mouse is still.
export function updateCamera(cam, target, dt, input) {
  if (input && input.mouse) {
    const dx = input.mouse.dx || 0;
    const dy = input.mouse.dy || 0;
    if (dx) cam.yaw -= dx * 0.005;
    if (dy) cam.pitch = clamp(cam.pitch + dy * 0.005, 0.05, 1.2);
    input.mouse.dx = 0;
    input.mouse.dy = 0;
  }
  if (input && typeof input.wheel === 'number' && input.wheel) {
    cam.dist = clamp(cam.dist + input.wheel * 0.01, 6, 30);
    input.wheel = 0;
  }
  const k = Math.min(1, (dt || 0) * 8);
  cam.tx += ((target.x || 0) - cam.tx) * k;
  cam.ty += ((target.y || 0) - cam.ty) * k;
  cam.tz += ((target.z || 0) - cam.tz) * k;
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  cam.x = cam.tx + Math.sin(cam.yaw) * cp * cam.dist;
  cam.y = cam.ty + sp * cam.dist;
  cam.z = cam.tz + Math.cos(cam.yaw) * cp * cam.dist;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// The view matrix (lookAt), column-major, 16 floats.
export function cameraView(cam) {
  const eye = [cam.x, cam.y, cam.z];
  const tgt = [cam.tx, cam.ty, cam.tz];
  let fx = tgt[0] - eye[0], fy = tgt[1] - eye[1], fz = tgt[2] - eye[2];
  const fl = Math.hypot(fx, fy, fz) || 1;
  fx /= fl; fy /= fl; fz /= fl;
  // right = normalize(cross(forward, up=(0,1,0))) = (-fz, 0, fx)
  let rx = -fz, ry = 0, rz = fx;
  const rl = Math.hypot(rx, ry, rz) || 1;
  rx /= rl; ry /= rl; rz /= rl;
  // up' = cross(right, forward)
  const ux = ry * fz - rz * fy;
  const uy = rz * fx - rx * fz;
  const uz = rx * fy - ry * fx;
  // Column-major lookAt: each ROW is a basis vector, so the
  // flat array interleaves them (m[0]=rx, m[1]=ux, m[2]=-fx,
  // m[4]=ry, ...). Storing the basis vectors as columns instead
  // transposes the matrix and breaks every yaw but the default.
  const m = new Array(16).fill(0);
  m[0] = rx; m[1] = ux; m[2] = -fx; m[3] = 0;
  m[4] = ry; m[5] = uy; m[6] = -fy; m[7] = 0;
  m[8] = rz; m[9] = uz; m[10] = -fz; m[11] = 0;
  m[12] = -(rx * eye[0] + ry * eye[1] + rz * eye[2]);
  m[13] = -(ux * eye[0] + uy * eye[1] + uz * eye[2]);
  m[14] = fx * eye[0] + fy * eye[1] + fz * eye[2];
  m[15] = 1;
  return m;
}

// The camera's right vector as the first row of the view matrix
// (kept for the unit-length check in the tests).
export function rightVector(cam) {
  const v = cameraView(cam);
  return [v[0], v[4], v[8]];
}

// Perspective projection, column-major. m[0] = f/aspect,
// m[5] = f, m[15] = 0.
export function perspective(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2);
  const m = new Array(16).fill(0);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = (far + near) / (near - far);
  m[11] = -1;
  m[14] = (2 * far * near) / (near - far);
  m[15] = 0;
  return m;
}

// Column-major matrix product: out = a * b.
export function matMul(a, b) {
  const out = new Array(16).fill(0);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + row] * b[col * 4 + k];
      out[col * 4 + row] = s;
    }
  }
  return out;
}

// Project a world point to screen pixels, or null when behind the eye.
export function projectPoint(cam, vp, x, y, z, w, h) {
  const px = vp[0] * x + vp[4] * y + vp[8] * z + vp[12];
  const py = vp[1] * x + vp[5] * y + vp[9] * z + vp[13];
  const pz = vp[2] * x + vp[6] * y + vp[10] * z + vp[14];
  const pw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
  if (pw <= 0.001) return null;
  const nx = px / pw;
  const ny = py / pw;
  return { x: (nx * 0.5 + 0.5) * w, y: (0.5 - ny * 0.5) * h, z: pz / pw };
}

// Screen y of the horizon (eye level, far ahead). Returns null if
// it does not project.
export function horizonScreenY(cam, w, h) {
  const vp = computeViewProjLocal(cam, w, h);
  const fx = -Math.sin(cam.yaw);
  const fz = -Math.cos(cam.yaw);
  const p = projectPoint(cam, vp, cam.tx + fx * 1000, cam.y, cam.tz + fz * 1000, w, h);
  return p ? p.y : null;
}

function computeViewProjLocal(cam, w, h) {
  const proj = perspective(FOV, w / h, 0.1, 1200);
  return matMul(proj, cameraView(cam));
}
