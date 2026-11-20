// Solmar Bay — third-person camera helpers.
//
// The camera follows behind the player (or the car), the mouse
// orbits it (yaw/pitch), the wheel zooms. Defaults are pitch 0.28
// and distance 14 — the framing that survived play-test #4: the
// city dominates the first view, with a band of sky, not a wall
// of sky. The old defaults (pitch 0.42, distance 11) failed the
// horizon test and are kept here as a negative reference.

export const CAM_DEFAULTS = { pitch: 0.28, dist: 14, height: 2.2 };
export const CAM_BAD = { pitch: 0.42, dist: 11 }; // old framing, fails

export function createCamera() {
  return {
    yaw: Math.PI, // looking north (toward -z) at spawn
    pitch: CAM_DEFAULTS.pitch,
    dist: CAM_DEFAULTS.dist,
    height: CAM_DEFAULTS.height,
    x: 0,
    y: 6,
    z: 0,
    tx: 0,
    ty: 0,
    tz: 0,
  };
}

// Smooth-follow the target. Mouse drag orbits; wheel zooms.
// dt is seconds; input may be null in headless tests.
export function updateCamera(cam, target, dt, input) {
  if (input) {
    cam.yaw -= (input.mouse.dx || 0) * 0.004;
    cam.pitch += (input.mouse.dy || 0) * 0.003;
    cam.pitch = Math.max(0.05, Math.min(1.1, cam.pitch));
    if (input.wheel) {
      cam.dist = Math.max(6, Math.min(26, cam.dist + (input.wheel > 0 ? 1.2 : -1.2)));
    }
  }
  const tx = target.x;
  const ty = (target.y || 0) + cam.height;
  const tz = target.z;
  // Ease the look target toward the player (no snapping).
  const k = 1 - Math.exp(-8 * dt);
  cam.tx += (tx - cam.tx) * k;
  cam.ty += (ty - cam.ty) * k;
  cam.tz += (tz - cam.tz) * k;
  // Camera sits behind the target at yaw/pitch/dist.
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  cam.x = cam.tx + Math.sin(cam.yaw) * cp * cam.dist;
  cam.y = cam.ty + sp * cam.dist;
  cam.z = cam.tz + Math.cos(cam.yaw) * cp * cam.dist;
  return cam;
}

// Build a view matrix (lookAt) from the camera, column-major.
export function cameraView(cam) {
  const ex = cam.x;
  const ey = cam.y;
  const ez = cam.z;
  const cx = cam.tx;
  const cy = cam.ty;
  const cz = cam.tz;
  let fx = cx - ex;
  let fy = cy - ey;
  let fz = cz - ez;
  const fl = Math.hypot(fx, fy, fz) || 1;
  fx /= fl;
  fy /= fl;
  fz /= fl;
  // right = f x up(0,1,0) = (-fz, 0, fx)
  let rx = -fz;
  let ry = 0;
  let rz = fx;
  const rl = Math.hypot(rx, ry, rz) || 1;
  rx /= rl;
  ry /= rl;
  rz /= rl;
  // true up = r x f
  const ux = ry * fz - rz * fy;
  const uy = rz * fx - rx * fz;
  const uz = rx * fy - ry * fx;
  return [
    rx, ux, -fx, 0,
    ry, uy, -fy, 0,
    rz, uz, -fz, 0,
    -(rx * ex + ry * ey + rz * ez),
    -(ux * ex + uy * ey + uz * ez),
    fx * ex + fy * ey + fz * ez,
    1,
  ];
}

// Perspective projection matrix, column-major.
export function perspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2);
  const nf = 1 / (near - far);
  return [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ];
}

// Multiply two column-major 4x4 matrices.
export function matMul(a, b) {
  const out = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = s;
    }
  }
  return out;
}

// Project a world point to screen space. Returns {x, y, behind}
// in pixels, or null when the point is behind the camera.
export function projectPoint(cam, viewProj, x, y, z, w, h) {
  const px = viewProj[0] * x + viewProj[4] * y + viewProj[8] * z + viewProj[12];
  const py = viewProj[1] * x + viewProj[5] * y + viewProj[9] * z + viewProj[13];
  const pz = viewProj[2] * x + viewProj[6] * y + viewProj[10] * z + viewProj[14];
  const pw = viewProj[3] * x + viewProj[7] * y + viewProj[11] * z + viewProj[15];
  if (pw <= 0.001) return null; // behind the camera
  const nx = px / pw;
  const ny = py / pw;
  return {
    x: (nx * 0.5 + 0.5) * w,
    y: (0.5 - ny * 0.5) * h,
    depth: pz / pw,
    behind: false,
  };
}

// Framing check used by the QA suite: with the default camera the
// horizon must sit in the upper half of the screen, so the city
// (below the horizon) dominates the view.
export function horizonScreenY(cam, w, h) {
  const view = cameraView(cam);
  const proj = perspective((60 * Math.PI) / 180, w / h, 0.1, 1200);
  const vp = matMul(proj, view);
  // A far point on the horizon, straight ahead at eye height.
  const fx = cam.tx - cam.x;
  const fz = cam.tz - cam.z;
  const fl = Math.hypot(fx, fz) || 1;
  const p = projectPoint(cam, vp, cam.x + (fx / fl) * 500, cam.y, cam.z + (fz / fl) * 500, w, h);
  return p ? p.y : null;
}
