// Solmar Bay — third-person follow camera with mouse orbit.
// Smooth and fluid: eased yaw/pitch/zoom, a soft spring on the eye,
// snap only on new game / continue / respawn.

import { clamp, lerp } from './config.js';

export function createCamera() {
  return {
    yaw: Math.PI, // eye offset angle (behind the player by default)
    pitch: 0.38,
    dist: 13,
    eye: [0, 12, 0],
    target: [0, 2, 0],
    lastDragT: -10,
    time: 0,
  };
}

// focus: {x, y, z} to follow. heading: the facing angle of the
// followed thing (player or vehicle). mode: 'foot' | 'drive' | 'fly'.
export function updateCamera(cam, dt, input, focus, heading, mode) {
  cam.time += dt;
  const drag = input.takeDrag();
  if (drag.x !== 0 || drag.y !== 0) {
    cam.yaw -= drag.x * 0.005;
    cam.pitch = clamp(cam.pitch + drag.y * 0.003, 0.06, 1.15);
    cam.lastDragT = cam.time;
  }
  const wheel = input.takeWheel();
  if (wheel !== 0) cam.dist = clamp(cam.dist + wheel * 0.01, 6, 26);

  // Ease the yaw behind the followed heading when the player is not
  // actively orbiting (GTA-style follow). Vehicles pull harder.
  const sinceDrag = cam.time - cam.lastDragT;
  if (sinceDrag > 0.6) {
    const want = heading + Math.PI;
    let diff = want - cam.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const rate = mode === 'foot' ? 1.4 : 2.4;
    cam.yaw += diff * Math.min(1, rate * dt);
  }
  const wantPitch = mode === 'fly' ? 0.25 : 0.38;
  cam.pitch += (wantPitch - cam.pitch) * Math.min(1, 2 * dt);
  const wantDist = mode === 'drive' ? 16 : mode === 'fly' ? 20 : 13;
  cam.dist += (wantDist - cam.dist) * Math.min(1, 2 * dt);

  const fx = focus.x, fy = (focus.y || 0) + 2, fz = focus.z;
  const cp = Math.cos(cam.pitch);
  const wantEye = [
    fx + Math.sin(cam.yaw) * cp * cam.dist,
    fy + Math.sin(cam.pitch) * cam.dist,
    fz + Math.cos(cam.yaw) * cp * cam.dist,
  ];
  // soft spring on the eye — no snapping, no stiffness
  const k = Math.min(1, 7 * dt);
  cam.eye[0] = lerp(cam.eye[0], wantEye[0], k);
  cam.eye[1] = lerp(cam.eye[1], wantEye[1], k);
  cam.eye[2] = lerp(cam.eye[2], wantEye[2], k);
  cam.target[0] = lerp(cam.target[0], fx, Math.min(1, 10 * dt));
  cam.target[1] = lerp(cam.target[1], fy, Math.min(1, 10 * dt));
  cam.target[2] = lerp(cam.target[2], fz, Math.min(1, 10 * dt));
}

// Place the camera immediately behind the focus (first frames of a
// new game / continue / respawn must not fly in from the origin).
export function snapCamera(cam, focus, heading) {
  cam.yaw = heading + Math.PI;
  cam.pitch = 0.38;
  const fx = focus.x, fy = (focus.y || 0) + 2, fz = focus.z;
  const cp = Math.cos(cam.pitch);
  cam.eye = [
    fx + Math.sin(cam.yaw) * cp * cam.dist,
    fy + Math.sin(cam.pitch) * cam.dist,
    fz + Math.cos(cam.yaw) * cp * cam.dist,
  ];
  cam.target = [fx, fy, fz];
  cam.lastDragT = -10;
}
