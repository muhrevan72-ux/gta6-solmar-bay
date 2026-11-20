// Solmar Bay — third-person camera helpers.
// Column-major mat4, the same layout WebGL expects.

export const CAM_DEFAULTS = { pitch: 0.28, dist: 14 };
// The old framing (steep pitch, far back) pushed the horizon to the
// top of the screen so the view was mostly empty foreground road.
export const CAM_BAD = { pitch: 0.55, dist: 22 };

export function createCamera() {
  return {
    x: 0, y: 6, z: 6,
    tx: 0, ty: 2, tz: 20,
    yaw: 0, pitch: CAM_DEFAULTS.pitch, dist: CAM_DEFAULTS.dist,
  };
}

// Follow the target smoothly. dt is seconds; a large dt snaps.
// input is the game's input (mouse drag orbits yaw/pitch, wheel zooms)
// or null in headless tests.
export function updateCamera(cam, target, dt, input) {
  const k = dt >= 1 ? 1 : Math.min(1, dt * 6);
  cam.tx += (target.x - cam.tx) * k;
  cam.tz += (target.z - cam.tz) * k;
  cam.ty += ((target.y || 0) + 2 - cam.ty) * k;
  if (input) {
    const drag = input.consumeDrag ? input.consumeDrag() : { dx: 0, dy: 0 };
    cam.yaw -= drag.dx * 0.005;
    cam.pitch = Math.max(0.08, Math.min(0.9, cam.pitch + drag.dy * 0.003));
    if (input.wheel) cam.dist = Math.max(8, Math.min(26, cam.dist + input.wheel * 0.01));
  }
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  cam.x = cam.tx - Math.sin(cam.yaw) * cam.dist * cp;
  cam.z = cam.tz - Math.cos(cam.yaw) * cam.dist * cp;
  cam.y = cam.ty + cam.dist * sp;
  if (cam.y < 1.2) cam.y = 1.2;
}

export function perspective(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2);
  const nf = 1 / (near - far);
  return [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ];
}

export function lookAt(eye, target, up) {
  let zx = eye[0] - target[0];
  let zy = eye[1] - target[1];
  let zz = eye[2] - target[2];
  let zl = Math.hypot(zx, zy, zz) || 1;
  zx /= zl; zy /= zl; zz /= zl;
  let xx = up[1] * zz - up[2] * zy;
  let xy = up[2] * zx - up[0] * zz;
  let xz = up[0] * zy - up[1] * zx;
  const xl = Math.hypot(xx, xy, xz) || 1;
  xx /= xl; xy /= xl; xz /= xl;
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

export function cameraView(cam) {
  return lookAt([cam.x, cam.y, cam.z], [cam.tx, cam.ty, cam.tz], [0, 1, 0]);
}

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

export function computeViewProj(cam, w, h) {
  const proj = perspective((60 * Math.PI) / 180, w / h, 0.1, 1200);
  return matMul(proj, cameraView(cam));
}

// Project a world point to screen pixels. Returns null when behind
// the camera.
export function projectPoint(cam, vp, x, y, z, w, h) {
  const px = vp[0] * x + vp[4] * y + vp[8] * z + vp[12];
  const py = vp[1] * x + vp[5] * y + vp[9] * z + vp[13];
  const pz = vp[2] * x + vp[6] * y + vp[10] * z + vp[14];
  const pw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
  if (pw <= 0.001) return null;
  const ndcX = px / pw;
  const ndcY = py / pw;
  if (ndcX < -1.2 || ndcX > 1.2 || ndcY < -1.2 || ndcY > 1.2) return null;
  return { x: (ndcX * 0.5 + 0.5) * w, y: (0.5 - ndcY * 0.5) * h, d: pz / pw };
}

// Screen Y of the horizon (a far point at eye height, straight ahead
// in the camera's horizontal direction). With the default framing the
// horizon sits in the upper-middle band so the city dominates.
export function horizonScreenY(cam, w, h) {
  const vp = computeViewProj(cam, w, h);
  const fx = cam.tx - cam.x;
  const fz = cam.tz - cam.z;
  const fl = Math.hypot(fx, fz) || 1;
  const px = cam.x + (fx / fl) * 500;
  const pz = cam.z + (fz / fl) * 500;
  const p = projectPoint(cam, vp, px, cam.y, pz, w, h);
  return p ? p.y : null;
}
