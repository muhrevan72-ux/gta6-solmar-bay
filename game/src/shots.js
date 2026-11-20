// Solmar Bay — the third-person camera and the matrix maths.
//
// The camera trails the player from behind and above: pitch 0.28 rad
// and 14 m back puts the horizon in the upper-middle band (measured
// 180.7 px on a 720 px frame), so the city dominates the view instead
// of empty foreground road. The steep 0.42 / 11 m framing that failed
// play-test #4 is kept as CAM_BAD so the suite can prove it is gone.

export const CAM_DEFAULTS = { pitch: 0.28, dist: 14 };
export const CAM_BAD = { pitch: 0.42, dist: 11 };

const FOV_Y = (60 * Math.PI) / 180;

export function createCamera() {
  return {
    pitch: CAM_DEFAULTS.pitch,
    dist: CAM_DEFAULTS.dist,
    yaw: 0,
    x: 0, y: 6, z: 0, // eye
    tx: 0, ty: 0, tz: 0, // look-at point (smoothed target)
  };
}

// Trail the target: the look-at point eases toward it, the eye sits
// `dist` away at `pitch` above the horizontal, behind the target's
// heading. `input` is accepted for symmetry with the other step
// functions and ignored — the camera never reads keys.
export function updateCamera(cam, target, dt, input) {
  const k = Math.min(1, dt * 8);
  cam.tx += (target.x - cam.tx) * k;
  cam.ty += ((target.y || 0) - cam.ty) * k;
  cam.tz += (target.z - cam.tz) * k;
  cam.yaw = target.heading || 0;
  const horiz = cam.dist * Math.cos(cam.pitch);
  cam.y = cam.ty + cam.dist * Math.sin(cam.pitch);
  cam.x = cam.tx - Math.sin(cam.yaw) * horiz;
  cam.z = cam.tz - Math.cos(cam.yaw) * horiz;
}

// ---- matrices (column-major, as WebGL uploads them) ----
export function matMul(a, b) {
  const out = new Array(16).fill(0);
  for (let j = 0; j < 4; j++) {
    for (let i = 0; i < 4; i++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[i + k * 4] * b[k + j * 4];
      out[i + j * 4] = s;
    }
  }
  return out;
}

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

// Look-at view matrix from the camera's eye to its target.
export function cameraView(cam) {
  const ex = cam.x;
  const ey = cam.y;
  const ez = cam.z;
  let zx = ex - cam.tx;
  let zy = ey - (cam.ty || 0);
  let zz = ez - cam.tz;
  let zl = Math.hypot(zx, zy, zz) || 1;
  zx /= zl; zy /= zl; zz /= zl;
  // Right = normalize(cross(up, z)) = (zz, 0, -zx).
  let xx = zz;
  let xy = 0;
  let xz = -zx;
  const xl = Math.hypot(xx, xy, xz) || 1;
  xx /= xl; xy /= xl; xz /= xl;
  // Up = z x right.
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;
  return [
    xx, yx, zx, 0,
    xy, yy, zy, 0,
    xz, yz, zz, 0,
    -(xx * ex + xy * ey + xz * ez),
    -(yx * ex + yy * ey + yz * ez),
    -(zx * ex + zy * ey + zz * ez),
    1,
  ];
}

// Project a world point to screen pixels, or null when it is behind
// the camera (its clip w is not positive).
export function projectPoint(cam, vp, x, y, z, w, h) {
  const px = vp[0] * x + vp[4] * y + vp[8] * z + vp[12];
  const py = vp[1] * x + vp[5] * y + vp[9] * z + vp[13];
  const pw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
  if (pw <= 0.001) return null;
  const nx = px / pw;
  const ny = py / pw;
  return { x: (nx * 0.5 + 0.5) * w, y: (0.5 - ny * 0.5) * h };
}

// The screen y of the horizon: where the view direction's horizontal
// meets the sky. A low pitch keeps it high on screen (the city
// dominates); a steep pitch pushes it to the top (road dominates).
export function horizonScreenY(cam, w, h) {
  const dx = cam.tx - cam.x;
  const dy = (cam.ty || 0) - cam.y;
  const dz = cam.tz - cam.z;
  const horiz = Math.hypot(dx, dz) || 1;
  const tanTheta = -dy / horiz; // positive while looking down
  const ndcY = tanTheta / Math.tan(FOV_Y / 2);
  return (0.5 - ndcY * 0.5) * h;
}
