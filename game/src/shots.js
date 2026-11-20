// Solmar Bay — third-person camera (rebuild #13).
// Column-major matrices (OpenGL convention). Default framing
// pitch 0.28 / dist 14 puts the horizon in the upper-middle band
// so the city dominates the view (play-test #4 fix).

export const CAM_DEFAULTS = { pitch: 0.28, dist: 14 };
export const CAM_BAD = { pitch: 0.45, dist: 18 };

export function createCamera() {
  return {
    x: 0, y: 6, z: 0,
    tx: 0, ty: 2, tz: 20,
    yaw: 0,
    pitch: CAM_DEFAULTS.pitch,
    dist: CAM_DEFAULTS.dist,
  };
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

export function cameraView(cam) {
  const ex = cam.x, ey = cam.y, ez = cam.z;
  let zx = ex - cam.tx, zy = ey - cam.ty, zz = ez - cam.tz;
  const zl = Math.hypot(zx, zy, zz) || 1;
  zx /= zl; zy /= zl; zz /= zl;
  // xaxis = normalize(cross(up, zaxis)) with up=(0,1,0):
  // (zz, 0, -zx)
  let xx = zz;
  let xy = 0;
  let xz = -zx;
  const xl = Math.hypot(xx, xy, xz) || 1;
  xx /= xl; xy /= xl; xz /= xl;
  // yaxis = cross(zaxis, xaxis)
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

export function computeViewProj(cam, w, h) {
  const proj = perspective((60 * Math.PI) / 180, w / h, 0.1, 1200);
  return matMul(proj, cameraView(cam));
}

export function updateCamera(cam, target, dt, input) {
  const k = Math.min(1, (dt || 0.016) * 8);
  cam.tx += (target.x - cam.tx) * k;
  cam.ty += ((target.y || 0) + 2 - cam.ty) * k;
  cam.tz += (target.z - cam.tz) * k;
  if (input && input.down) {
    if (input.down.has('ArrowLeft')) cam.yaw += 1.5 * (dt || 0.016);
    if (input.down.has('ArrowRight')) cam.yaw -= 1.5 * (dt || 0.016);
  }
  const cp = Math.cos(cam.pitch);
  cam.x = cam.tx - Math.sin(cam.yaw) * cp * cam.dist;
  cam.y = cam.ty + Math.sin(cam.pitch) * cam.dist;
  cam.z = cam.tz - Math.cos(cam.yaw) * cp * cam.dist;
}

export function projectPoint(cam, vp, x, y, z, w, h) {
  const px = vp[0] * x + vp[4] * y + vp[8] * z + vp[12];
  const py = vp[1] * x + vp[5] * y + vp[9] * z + vp[13];
  const pz = vp[2] * x + vp[6] * y + vp[10] * z + vp[14];
  const pw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
  if (pw <= 0.001) return null;
  const nx = px / pw, ny = py / pw;
  return { x: (nx * 0.5 + 0.5) * w, y: (0.5 - ny * 0.5) * h, z: pz / pw };
}

// Screen Y of the horizon line (a point at eye height, far ahead
// along the horizontal forward direction).
export function horizonScreenY(cam, w, h) {
  const vp = computeViewProj(cam, w, h);
  const fx = cam.tx - cam.x, fz = cam.tz - cam.z;
  const fl = Math.hypot(fx, fz) || 1;
  const qx = cam.x + (fx / fl) * 500;
  const qz = cam.z + (fz / fl) * 500;
  const p = projectPoint(cam, vp, qx, cam.y, qz, w, h);
  return p ? p.y : null;
}
