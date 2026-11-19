// Solmar Bay — third-person follow camera. Eased yaw/pitch/zoom and
// a spring-smoothed eye so movement never snaps (user: jangan kaku).

import { angleLerp, clamp, lerp } from './config.js';

export function createCamera() {
  return {
    yaw: 0, // orbit around the target
    pitch: 0.42,
    dist: 13,
    close: false, // close mode: interiors keep the camera in the room
    eye: [0, 8, 14],
    center: [0, 2, 0],
    targetYaw: 0,
    snap: false,
  };
}

// Snap the camera behind a heading instantly (spawns, teleports).
export function snapCamera(camera, target, heading) {
  camera.yaw = heading;
  camera.targetYaw = heading;
  camera.pitch = 0.42;
  camera.dist = camera.close ? 4.5 : 13;
  const ex = target.x - Math.sin(heading) * camera.dist;
  const ez = target.z - Math.cos(heading) * camera.dist;
  camera.eye = [ex, 6, ez];
  camera.center = [target.x, 2, target.z];
  camera.snap = true;
}

// Per-frame update: mouse orbit (dx/dy in pixels), wheel zoom, and a
// spring follow of the target. `follow` is {x, y, z, heading, speed}.
export function updateCamera(camera, follow, mouse, dt) {
  if (mouse) {
    camera.targetYaw -= (mouse.dx || 0) * 0.004;
    camera.pitch = clamp(camera.pitch + (mouse.dy || 0) * 0.003, 0.08, 1.1);
    const minDist = camera.close ? 3 : 7;
    camera.dist = clamp(camera.dist + (mouse.wheel || 0) * 0.01, minDist, 26);
  }
  // ease the actual yaw toward the target yaw
  camera.yaw = angleLerp(camera.yaw, camera.targetYaw, 1 - Math.pow(0.0001, dt));
  const dist = camera.dist + (follow.speed || 0) * 0.12;
  const eyeX = follow.x - Math.sin(camera.yaw) * dist * Math.cos(camera.pitch);
  const eyeZ = follow.z - Math.cos(camera.yaw) * dist * Math.cos(camera.pitch);
  const eyeY = follow.y + 2 + Math.sin(camera.pitch) * dist;
  const k = 1 - Math.pow(0.000001, dt); // spring factor
  if (camera.snap) {
    camera.eye = [eyeX, eyeY, eyeZ];
    camera.snap = false;
  } else {
    camera.eye[0] = lerp(camera.eye[0], eyeX, k);
    camera.eye[1] = lerp(camera.eye[1], eyeY, k);
    camera.eye[2] = lerp(camera.eye[2], eyeZ, k);
  }
  camera.center = [follow.x, follow.y + 2, follow.z];
}

// View for the renderer: { eye, center, fov }.
export function cameraView(camera) {
  return {
    eye: camera.eye,
    center: camera.center,
    fov: 1.05,
  };
}
