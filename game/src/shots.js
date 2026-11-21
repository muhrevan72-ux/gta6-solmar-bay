// Solmar Bay — third-person camera + matrix maths.
// The camera follows behind the player; mouse drag orbits it.
// Forward on the ground is (-sin(yaw), -cos(yaw)): yaw PI looks
// +Z into the city, yaw PI/2 looks -X (west).

export const CAM_DEFAULTS = { pitch: 0.28, dist: 14, fov: 60 };
export const CAM_BAD = { pitch: 0.42, dist: 18, fov: 60 };

export function createCamera() {
  return {
    x: 0, y: 8, z: 6,
    tx: 0, ty: 2, tz: 20,
    yaw: Math.PI,
    pitch: CAM_DEFAULTS.pitch,
    dist: CAM_DEFAULTS.dist,
    fov: CAM_DEFAULTS.fov,
  };
}

// Column-major 4x4 matrix multiply: out = a * b.
export function matMul(a, b) {
  const out = new Array(16).fill(0);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[row + k * 4] * b[k + col * 4];
      out[row + col * 4] = s;
    }
  }
  return out;
}

// OpenGL-style perspective projection (column-major).
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

// View matrix for a camera (eye + target), column-major.
// The first row (elements 0, 4, 8) is the right vector (unit).
export function cameraView(cam) {
  const ex = cam.x, ey = cam.y, ez = cam.z;
  let fx = cam.tx - ex, fy = cam.ty - ey, fz = cam.tz - ez;
  const fl = Math.hypot(fx, fy, fz) || 1;
  fx /= fl; fy /= fl; fz /= fl;
  // right = normalize(cross(forward, up)). Straight down (or up),
  // forward is parallel to (0,1,0), so use (0,0,1) as the up
  // instead — otherwise right collapses to zero and the view
  // matrix is degenerate (the top-down map shot).
  const up = Math.abs(fy) > 0.999 ? [0, 0, 1] : [0, 1, 0];
  let rx = fy * up[2] - fz * up[1];
  let ry = fz * up[0] - fx * up[2];
  let rz = fx * up[1] - fy * up[0];
  const rl = Math.hypot(rx, ry, rz) || 1;
  rx /= rl; ry /= rl; rz /= rl;
  // true up = cross(right, forward)
  const ux = ry * fz - rz * fy;
  const uy = rz * fx - rx * fz;
  const uz = rx * fy - ry * fx;
  const dr = -(rx * ex + ry * ey + rz * ez);
  const du = -(ux * ex + uy * ey + uz * ez);
  const df = fx * ex + fy * ey + fz * ez;
  return [
    rx, ux, -fx, 0,
    ry, uy, -fy, 0,
    rz, uz, -fz, 0,
    dr, du, df, 1,
  ];
}

// Follow the target (lerp), orbit with the mouse, and place the
// eye behind/above the target. Mouse deltas come from
// input.mouse.dx/dy — never from a stale field — so the camera
// stays put when the mouse does not move.
export function updateCamera(cam, target, dt, input) {
  const k = 1 - Math.exp(-dt * 8);
  cam.tx += (target.x - cam.tx) * k;
  cam.ty += ((target.y || 0) + 1.5 - cam.ty) * k;
  cam.tz += (target.z - cam.tz) * k;
  if (input && input.mouse) {
    if (input.mouse.dx) cam.yaw -= input.mouse.dx * 0.004;
    if (input.mouse.dy) {
      cam.pitch += input.mouse.dy * 0.004;
      if (cam.pitch < -0.05) cam.pitch = -0.05;
      if (cam.pitch > 1.1) cam.pitch = 1.1;
    }
    if (input.wheel) {
      cam.dist += Math.sign(input.wheel) * 1.5;
      if (cam.dist < 6) cam.dist = 6;
      if (cam.dist > 30) cam.dist = 30;
    }
  }
  // Forward on the ground for this yaw.
  const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  cam.x = cam.tx - fx * cam.dist * cp;
  cam.z = cam.tz - fz * cam.dist * cp;
  cam.y = cam.ty + cam.dist * sp + 1.2;
  if (cam.y < 1.5) cam.y = 1.5;
}

// Project a world point to screen pixels; null when behind the eye.
export function projectPoint(cam, vp, x, y, z, w, h) {
  const px = vp[0] * x + vp[4] * y + vp[8] * z + vp[12];
  const py = vp[1] * x + vp[5] * y + vp[9] * z + vp[13];
  const pz = vp[2] * x + vp[6] * y + vp[10] * z + vp[14];
  const pw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
  if (pw <= 0.001) return null;
  const nx = px / pw, ny = py / pw;
  return { x: (nx * 0.5 + 0.5) * w, y: (0.5 - ny * 0.5) * h, d: pz / pw };
}

// Screen Y of the horizon line for this camera's pitch.
// The horizon sits pitch radians above the look direction.
export function horizonScreenY(cam, w, h) {
  const fov = ((cam.fov || 60) * Math.PI) / 180;
  const ndcY = Math.tan(cam.pitch) / Math.tan(fov / 2);
  return (0.5 - ndcY / 2) * h;
}
