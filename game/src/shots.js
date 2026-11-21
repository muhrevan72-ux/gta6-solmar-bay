// Solmar Bay — the third-person camera and the projection maths.
//
// The camera orbits the player: yaw spins around them, pitch tilts the
// view down, dist sets how far back it sits. The view matrix is a
// GLM-style lookAt in column-major order; the projection is a standard
// OpenGL perspective with a 60-degree field of view.

export const CAM_DEFAULTS = { pitch: 0.28, dist: 14 };
export const CAM_BAD = { pitch: 0.42, dist: 20 };

export function createCamera() {
  return {
    yaw: Math.PI,
    pitch: CAM_DEFAULTS.pitch,
    dist: CAM_DEFAULTS.dist,
    x: 0,
    y: 4,
    z: 6,
    tx: 0,
    ty: 1.5,
    tz: 20,
  };
}

// Follow the target and let the mouse orbit the camera. The mouse delta
// is consumed here, so the camera stays still when the mouse is still.
export function updateCamera(cam, target, dt, input) {
  const k = Math.min(1, dt * 8);
  cam.tx += (target.x - cam.tx) * k;
  cam.tz += (target.z - cam.tz) * k;
  if (typeof target.y === 'number') {
    cam.ty += (target.y - cam.ty) * k;
  }
  if (input && input.mouse) {
    const dx = input.mouse.dx || 0;
    const dy = input.mouse.dy || 0;
    if (dx !== 0 || dy !== 0) {
      cam.yaw += dx * 0.005;
      cam.pitch += dy * 0.003;
      if (cam.pitch < 0.05) cam.pitch = 0.05;
      if (cam.pitch > 1.2) cam.pitch = 1.2;
    }
    input.mouse.dx = 0;
    input.mouse.dy = 0;
  }
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  // The eye sits behind the target, opposite the facing direction
  // (-sin yaw, -cos yaw): at yaw PI the player faces +Z, so the eye is
  // at the smaller Z and the camera looks into the city.
  cam.x = cam.tx + Math.sin(cam.yaw) * cp * cam.dist;
  cam.y = cam.ty + sp * cam.dist;
  cam.z = cam.tz + Math.cos(cam.yaw) * cp * cam.dist;
  return cam;
}

function norm3(x, y, z) {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

function cross3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

// GLM-style lookAt, column-major. The first row (v[0], v[4], v[8]) is
// the right vector, unit length. Handles a straight-down camera, where
// the forward direction is parallel to world up, by falling back to a
// different up vector.
export function cameraView(cam) {
  const eye = [cam.x, cam.y, cam.z];
  const center = [cam.tx, cam.ty, cam.tz];
  let f = norm3(center[0] - eye[0], center[1] - eye[1], center[2] - eye[2]);
  let up = [0, 1, 0];
  if (Math.abs(f[1]) > 0.999) up = [0, 0, -1];
  const s = norm3(...cross3(f, up));
  const u = cross3(s, f);
  const dotS = s[0] * eye[0] + s[1] * eye[1] + s[2] * eye[2];
  const dotU = u[0] * eye[0] + u[1] * eye[1] + u[2] * eye[2];
  const dotF = f[0] * eye[0] + f[1] * eye[1] + f[2] * eye[2];
  return [
    s[0], u[0], -f[0], 0,
    s[1], u[1], -f[1], 0,
    s[2], u[2], -f[2], 0,
    -dotS, -dotU, dotF, 1,
  ];
}

export function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  return [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ];
}

// Column-major 4x4 multiply: out = a * b.
export function matMul(a, b) {
  const out = new Array(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[k * 4 + row] * b[col * 4 + k];
      }
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

export function computeViewProj(cam, w, h) {
  const aspect = w / h;
  const proj = perspective((60 * Math.PI) / 180, aspect, 0.1, 1200);
  return matMul(proj, cameraView(cam));
}

// Project a world point to screen pixels, or null when it is behind
// the camera.
export function projectPoint(cam, vp, x, y, z, w, h) {
  const cx = vp[0] * x + vp[4] * y + vp[8] * z + vp[12];
  const cy = vp[1] * x + vp[5] * y + vp[9] * z + vp[13];
  const cz = vp[2] * x + vp[6] * y + vp[10] * z + vp[14];
  const cw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
  if (cw <= 0.001) return null;
  const nx = cx / cw;
  const ny = cy / cw;
  return {
    x: (nx * 0.5 + 0.5) * w,
    y: (0.5 - ny * 0.5) * h,
    z: cz / cw,
  };
}

// Screen Y of the horizon line: a point far away at eye height in the
// direction the camera faces, projected through the view-projection.
export function horizonScreenY(cam, w, h) {
  const vp = computeViewProj(cam, w, h);
  const fx = cam.tx - cam.x;
  const fz = cam.tz - cam.z;
  const len = Math.hypot(fx, fz) || 1;
  const px = cam.x + (fx / len) * 5000;
  const pz = cam.z + (fz / len) * 5000;
  const p = projectPoint(cam, vp, px, cam.y, pz, w, h);
  return p ? p.y : null;
}
