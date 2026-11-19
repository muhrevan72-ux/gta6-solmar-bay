// Solmar Bay — third-person camera helpers. The camera follows behind
// the player or the driven vehicle; mouse drag orbits it (yaw/pitch),
// the wheel zooms. Yaw is measured so that yaw=0 looks toward -z.

export function createCamera() {
  return {
    yaw: Math.PI,       // behind the player at spawn (player faces -z... see note)
    pitch: 0.32,        // radians above horizontal
    dist: 8.5,
    eye: [0, 6, 12],
    target: [0, 1.6, 0],
    // smooth-follow state
    smoothEye: [0, 6, 12],
  };
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// Apply mouse orbit + wheel to the camera, then place it behind the
// focus point. mode: 'foot' | 'drive' | 'fly'. heading is the focus
// object's facing (radians) — in drive/fly the camera eases behind it.
export function updateCamera(cam, dt, input, focus, heading, mode) {
  cam.yaw += input.orbitX * 0.005;
  cam.pitch = clamp(cam.pitch + input.orbitY * 0.004, 0.05, 1.15);
  cam.dist = clamp(cam.dist + input.wheel * 0.01, 5, 16);

  if (mode === 'drive' || mode === 'fly') {
    // ease the camera behind the vehicle unless the player is orbiting
    if (Math.abs(input.orbitX) < 0.5) {
      cam.yaw = lerpAngle(cam.yaw, heading + Math.PI, Math.min(1, dt * 1.6));
    }
    if (mode === 'fly') cam.dist = Math.max(cam.dist, 13);
  }

  const d = mode === 'fly' ? Math.max(cam.dist, 13) : (mode === 'drive' ? cam.dist + 2.5 : cam.dist);
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const eye = [
    focus.x + Math.sin(cam.yaw) * cp * d,
    focus.y + 1.6 + sp * d,
    focus.z + Math.cos(cam.yaw) * cp * d,
  ];
  // keep the camera out of the ground
  if (eye[1] < 0.6) eye[1] = 0.6;
  // smooth the eye so it doesn't snap
  const k = Math.min(1, dt * 10);
  cam.smoothEye[0] += (eye[0] - cam.smoothEye[0]) * k;
  cam.smoothEye[1] += (eye[1] - cam.smoothEye[1]) * k;
  cam.smoothEye[2] += (eye[2] - cam.smoothEye[2]) * k;
  cam.eye = cam.smoothEye;
  cam.target = [focus.x, focus.y + 1.6, focus.z];
  return cam;
}

// Forward direction on the ground from the camera yaw (for WASD).
export function cameraForward(cam) {
  return [-Math.sin(cam.yaw), -Math.cos(cam.yaw)];
}
export function cameraRight(cam) {
  return [-Math.cos(cam.yaw), Math.sin(cam.yaw)];
}
