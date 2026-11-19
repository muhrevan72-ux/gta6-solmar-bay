// Solmar Bay — third-person camera helpers (pure maths).
// The camera follows behind the player (or the car), the mouse drag
// orbits it (yaw/pitch), the wheel zooms. Movement is smooth: the
// camera lerps toward its target instead of snapping, and the player
// leans into turns.
//
// Default framing (fixed by play-test #4): the old pitch (0.42) and
// distance (11) put the camera too close and too steep, so the empty
// foreground road filled 50-70% of the screen, the buildings only
// the top 30-40% and the sky 0-5% — and on a portrait phone the
// peach sky filled the whole view. The new defaults look more level
// and pull back, so the city (buildings + street + a band of sky)
// fills the frame in both orientations. The headless framing test
// proves it with render.js's own camera code, not a re-implementation.

import { clamp, lerp, wrapAngle } from './config.js';

export function createCamera() {
  return {
    x: 0, y: 8, z: 0, // actual camera position (lerped)
    yaw: 0, // orbit yaw (radians)
    pitch: 0.28, // orbit pitch (radians, looking down)
    dist: 14, // orbit distance
    targetYaw: 0,
    targetPitch: 0.28,
    targetDist: 14,
  };
}

// Mouse drag orbits; wheel zooms. Called from stepGame with the
// frame's mouse deltas.
export function orbitCamera(cam, input) {
  if (input.mouse.dragging) {
    cam.targetYaw -= input.mouse.dx * 0.004;
    cam.targetPitch = clamp(cam.targetPitch + input.mouse.dy * 0.003, 0.08, 1.1);
  }
  if (input.mouse.wheel !== 0) {
    cam.targetDist = clamp(cam.targetDist + input.mouse.wheel * 0.01, 5, 22);
  }
}

// The camera's goal position for a focus point (extracted so tests
// can compute the default framing without running the lerp).
export function cameraGoal(cam, focus, driving) {
  const d = driving ? cam.dist + 4 : cam.dist;
  return {
    x: focus.x - Math.sin(cam.yaw) * Math.cos(cam.pitch) * d,
    y: focus.y + Math.sin(cam.pitch) * d + 1.5,
    z: focus.z - Math.cos(cam.yaw) * Math.cos(cam.pitch) * d,
  };
}

// Follow the focus point (player, or car when driving). The camera
// eases toward its goal position so it never snaps.
export function followCamera(cam, focus, dt, driving) {
  cam.yaw = lerp(cam.yaw, cam.targetYaw, Math.min(1, dt * 6));
  cam.pitch = lerp(cam.pitch, cam.targetPitch, Math.min(1, dt * 6));
  cam.dist = lerp(cam.dist, cam.targetDist, Math.min(1, dt * 6));
  const g = cameraGoal(cam, focus, driving);
  const k = Math.min(1, dt * 8);
  cam.x = lerp(cam.x, g.x, k);
  cam.y = lerp(cam.y, g.y, k);
  cam.z = lerp(cam.z, g.z, k);
}

// Where the camera looks: the focus point, slightly above the ground.
export function cameraTarget(cam, focus) {
  return [focus.x, focus.y + 1.6, focus.z];
}

// Forward vector on the ground plane, from the camera yaw.
export function cameraForward(cam) {
  return { x: Math.sin(cam.yaw), z: Math.cos(cam.yaw) };
}

export { wrapAngle };
