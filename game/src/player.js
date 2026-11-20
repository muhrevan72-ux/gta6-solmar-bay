// Solmar Bay — the player.
//
// On-foot movement, entering/exiting cars, hair + shoes that
// follow the bought outfit, and the player's box model. Car
// driving lives in vehicles.js; this file owns the person.
//
// INPUT RULES (see input.js): cooldowns are gated with `<= 0`,
// never `!cooldown`. Cooldowns decay BEFORE the in-car/inside
// early return, or the player can never exit a car (round-8 bug:
// cooldowns decayed after the early return).

import { clamp, TUNE, SPAWNS } from './config.js';
import { pushBox } from './render.js';
import { tileUV } from './texture.js';
import { isBlocked } from './world.js';
import { axis } from './input.js';

// Hair colour + shoe colour follow the bought outfit.
export function outfitColours(game) {
  const o = game.player.outfit;
  const hair = [
    [0.1, 0.1, 0.12],
    [0.95, 0.85, 0.4],
    [0.9, 0.15, 0.15],
    [0.2, 0.4, 0.95],
  ][o.hair] || [0.1, 0.1, 0.12];
  const shirt = [
    [0.9, 0.9, 0.9],
    [0.95, 0.75, 0.15],
    [0.1, 0.7, 0.7],
    [1, 0.25, 0.6],
  ][o.shirt] || [0.9, 0.9, 0.9];
  const pants = [
    [0.25, 0.35, 0.6],
    [0.15, 0.15, 0.18],
    [0.92, 0.92, 0.9],
  ][o.pants] || [0.25, 0.35, 0.6];
  const shoes = [
    [0.9, 0.9, 0.9],
    [0.95, 0.75, 0.15],
    [0.9, 0.15, 0.2],
  ][o.shoes] || [0.9, 0.9, 0.9];
  return { hair, shirt, pants, shoes };
}

// The player's voxel body: head, hair, torso, arms, legs, shoes.
// 11 boxes, ~1.9 m tall, varied by outfit.
export function playerBoxes(game, b) {
  const p = game.player;
  const c = outfitColours(game);
  const uv = tileUV('plain');
  const skin = [0.95, 0.8, 0.65];
  const walk = Math.sin(game.time * 8) * 0.25 * (p.speed > 0.5 ? 1 : 0);
  // Legs (swing when walking).
  pushBox(b, p.x - 0.18, 0, p.z + walk * 0.3, 0.32, 0.85, 0.32, c.pants, uv);
  pushBox(b, p.x + 0.18, 0, p.z - walk * 0.3, 0.32, 0.85, 0.32, c.pants, uv);
  // Shoes.
  pushBox(b, p.x - 0.18, 0, p.z + walk * 0.3 + 0.1, 0.34, 0.15, 0.5, c.shoes, uv);
  pushBox(b, p.x + 0.18, 0, p.z - walk * 0.3 + 0.1, 0.34, 0.15, 0.5, c.shoes, uv);
  // Torso.
  pushBox(b, p.x, 0.85, p.z, 0.75, 0.7, 0.4, c.shirt, uv);
  // Arms.
  pushBox(b, p.x - 0.5, 0.9, p.z - walk * 0.3, 0.22, 0.65, 0.22, skin, uv);
  pushBox(b, p.x + 0.5, 0.9, p.z + walk * 0.3, 0.22, 0.65, 0.22, skin, uv);
  // Head + hair.
  pushBox(b, p.x, 1.55, p.z, 0.45, 0.45, 0.45, skin, uv);
  pushBox(b, p.x, 1.9, p.z, 0.48, 0.2, 0.48, c.hair, uv);
  // Eyes (near LOD only — tiny dark quads on the face).
  pushBox(b, p.x - 0.1, 1.65, p.z + 0.24, 0.07, 0.07, 0.02, [0.05, 0.05, 0.05], uv);
  pushBox(b, p.x + 0.1, 1.65, p.z + 0.24, 0.07, 0.07, 0.02, [0.05, 0.05, 0.05], uv);
  return 11;
}

// On-foot step. Cooldowns decay FIRST (see header) so the player
// can always exit a car.
export function stepPlayer(game, dt, input) {
  const p = game.player;
  p.eCooldown = Math.max(0, p.eCooldown - dt);
  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  p.bombCooldown = Math.max(0, p.bombCooldown - dt);
  p.shootCooldown = Math.max(0, p.shootCooldown - dt);
  if (p.inCar || p.inside || p.onTrain || p.onElevator) return;
  if (game.mode !== 'play' && game.mode !== 'phone') return;
  const run = input.downKey('ShiftLeft') || input.downKey('ShiftRight');
  const speed = run ? TUNE.runSpeed : TUNE.walkSpeed;
  const fwd = axis(input, 'KeyW', 'KeyS') * -1; // W = forward
  const strafe = axis(input, 'KeyA', 'KeyD');
  const cam = game.camera;
  const yaw = cam ? cam.yaw : 0;
  // Movement is camera-relative.
  const mx = Math.sin(yaw) * fwd + Math.cos(yaw) * strafe;
  const mz = Math.cos(yaw) * fwd - Math.sin(yaw) * strafe;
  const ml = Math.hypot(mx, mz) || 1;
  const tx = (mx / ml) * speed * (fwd || strafe ? 1 : 0);
  const tz = (mz / ml) * speed * (fwd || strafe ? 1 : 0);
  const k = 1 - Math.exp(-TUNE.accel * dt / speed);
  p.vx += (tx - p.vx) * k;
  p.vz += (tz - p.vz) * k;
  // Friction when no input.
  if (!fwd && !strafe) {
    const f = Math.max(0, 1 - TUNE.friction * dt / 10);
    p.vx *= f;
    p.vz *= f;
  }
  let nx = p.x + p.vx * dt;
  let nz = p.z + p.vz * dt;
  // Colliders: slide along walls (per-axis resolution).
  if (!isBlocked(game.city, nx, p.z)) p.x = nx;
  else p.vx = 0;
  if (!isBlocked(game.city, p.x, nz)) p.z = nz;
  else p.vz = 0;
  p.x = clamp(p.x, -380, 380);
  p.z = clamp(p.z, -380, 380);
  p.speed = Math.hypot(p.vx, p.vz);
  if (p.speed > 0.5) p.heading = Math.atan2(p.vx, p.vz);
  // Swimming: the sea is x < -360.
  p.swimming = p.x < -360;
  // Petting a carried cat.
  if (p.carryingCat) p.petting = Math.max(0, p.petting - dt);
}

// Enter the nearest vehicle within range. Returns the vehicle or null.
export function tryEnterVehicle(game) {
  const p = game.player;
  if (p.eCooldown > 0) return null;
  let best = null;
  let bestD = TUNE.interactRange;
  for (const v of game.vehicles) {
    const d = Math.hypot(v.x - p.x, v.z - p.z);
    if (d < bestD) {
      best = v;
      bestD = d;
    }
  }
  if (!best) return null;
  p.eCooldown = 0.4;
  p.inCar = best;
  best.driver = 'player';
  p.x = best.x;
  p.z = best.z;
  return best;
}

// Exit the car onto the nearest free sidewalk point.
export function exitVehicle(game) {
  const p = game.player;
  const v = p.inCar;
  if (!v) return;
  p.inCar = null;
  v.driver = null;
  const side = Math.cos(v.heading) > 0 ? 1 : -1;
  let x = v.x + side * 3;
  let z = v.z;
  if (isBlocked(game.city, x, z)) {
    x = v.x - side * 3;
  }
  if (isBlocked(game.city, x, z)) {
    x = v.x;
    z = v.z + 3;
  }
  p.x = x;
  p.z = z;
  p.vx = 0;
  p.vz = 0;
}
