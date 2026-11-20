// Solmar Bay — third-person camera + matrix maths (rebuild #14).
// Column-major 4x4 matrices, matching WebGL's expectations.
// The default framing (pitch 0.28, dist 14) puts the horizon in
// the upper-middle band so the city, not the sky, dominates the
// first view (play-test #4 lesson).

export const CAM_DEFAULTS = { pitch: 0.28, dist: 14 };
// The old framing that failed: steep pitch, horizon at the top,
// the view mostly empty foreground road.
export const CAM_BAD = { pitch: 0.42, dist: 11 };

export function createCamera() {
  return {
    // Eye position and look target (world space).
    x: 0, y: 4, z: 6,
    tx: 0, ty: 1, tz: 20,
    // Orbit state. yaw = PI puts the eye south of the player so the
    // camera looks north (+Z) into the city at spawn.
    yaw: Math.PI,
    pitch: CAM_DEFAULTS.pitch,
    dist: CAM_DEFAULTS.dist,
  };
}

// ---------- matrix helpers (column-major) ----------
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
      for (let k = 0; k < 4; k++) s += a[r + k * 4] * b[k + c * 4];
      out[r + c * 4] = s;
    }
  }
  return out;
}

function norm3(x, y, z) {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}
function cross3(ax, ay, az, bx, by, bz) {
  return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
}

// View matrix: eye looks at target, +Y up.
export function lookAt(ex, ey, ez, tx, ty, tz) {
  const [fx, fy, fz] = norm3(tx - ex, ty - ey, tz - ez);
  const [rx, ry, rz] = norm3(...cross3(fx, fy, fz, 0, 1, 0));
  const [ux, uy, uz] = cross3(rx, ry, rz, fx, fy, fz);
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

export function cameraView(cam) {
  return lookAt(cam.x, cam.y, cam.z, cam.tx, cam.ty, cam.tz);
}

// ---------- camera update ----------
// target: {x, y, z} world position to follow (the player).
// The look target lerps toward the player and the eye lerps
// toward its orbit slot, so the camera glides instead of snapping.
export function updateCamera(cam, target, dt, input) {
  const k = 1 - Math.exp(-5 * Math.max(0, dt));
  cam.tx += (target.x - cam.tx) * k;
  cam.ty += ((target.y || 0) + 1 - cam.ty) * k;
  cam.tz += (target.z - cam.tz) * k;
  if (input) {
    // Mouse drag rotates the camera. The input object carries the
    // per-frame delta as mouse.dx/mouse.dy (set by the mousemove
    // handler, cleared by endFrame); the old mouseDX/mouseDY
    // names never existed on it, so the camera never rotated and
    // the view felt like it drifted on its own. Read the real
    // properties, falling back to the old names if a caller set
    // those. With no mouse movement both are 0, so the camera
    // stays put (no auto-orbit).
    const mdx = (input.mouse && input.mouse.dx) || input.mouseDX || 0;
    const mdy = (input.mouse && input.mouse.dy) || input.mouseDY || 0;
    cam.yaw += mdx * 0.004;
    cam.pitch = Math.max(0.05, Math.min(0.9, cam.pitch + mdy * 0.003));
    if (input.wheel) cam.dist = Math.max(8, Math.min(26, cam.dist + input.wheel * 0.01));
  }
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  const ex = cam.tx + Math.sin(cam.yaw) * cp * cam.dist;
  const ey = cam.ty + sp * cam.dist;
  const ez = cam.tz + Math.cos(cam.yaw) * cp * cam.dist;
  // The eye sits exactly on its orbit slot around the (lerped)
  // target, so the framing matches the pitch/dist at once; the
  // glide comes from the target lerp above.
  cam.x = ex;
  cam.y = ey;
  cam.z = ez;
  return cam;
}

// ---------- projection ----------
// Project a world point to screen pixels; null when behind the camera.
export function projectPoint(cam, vp, x, y, z, w, h) {
  const px = vp[0] * x + vp[4] * y + vp[8] * z + vp[12];
  const py = vp[1] * x + vp[5] * y + vp[9] * z + vp[13];
  const pw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
  if (pw <= 0.001) return null;
  return {
    x: (px / pw * 0.5 + 0.5) * w,
    y: (0.5 - py / pw * 0.5) * h,
  };
}

// Screen Y of the horizon (a far point at eye height, straight
// ahead horizontally). With the default framing this lands near
// y=181 on a 720p screen: sky above, city below.
export function horizonScreenY(cam, w, h) {
  const view = cameraView(cam);
  const proj = perspective((60 * Math.PI) / 180, w / h, 0.1, 1200);
  const vp = matMul(proj, view);
  const fx = cam.tx - cam.x;
  const fz = cam.tz - cam.z;
  const len = Math.hypot(fx, fz) || 1;
  const s = projectPoint(cam, vp, cam.x + (fx / len) * 1000, cam.y, cam.z + (fz / len) * 1000, w, h);
  return s ? s.y : null;
}
