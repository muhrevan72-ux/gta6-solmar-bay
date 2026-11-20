// Solmar Bay — the player on foot (rebuild #14).
// Movement is camera-relative (W walks away from the camera).
// Buildings are solid: a step that would enter a building is
// refused (the player slides along the wall instead of clipping
// through it). Cooldowns decay BEFORE the in-car early return,
// so a cooldown set while driving still ticks down.

import { TUNE, OUTFIT } from './config.js';
import { isBlocked } from './world.js';
import { axis } from './input.js';
import { pushBox, pushBoxRot } from './render.js';

export function outfitColours(g) {
  const o = g.player.outfit || { hair: 0, shirt: 0, pants: 0, shoes: 0 };
  const pick = (list, i) => (list[i] || list[0]).colour || (list[i] || list[0]).col;
  return {
    hair: pick(OUTFIT.hair, o.hair),
    shirt: pick(OUTFIT.shirt, o.shirt),
    pants: pick(OUTFIT.pants, o.pants),
    shoes: pick(OUTFIT.shoes, o.shoes),
  };
}

export function stepPlayer(g, dt, input) {
  const p = g.player;
  // Cooldowns decay first — even when the player is in a car.
  p.eCooldown = Math.max(0, (p.eCooldown || 0) - dt);
  p.shootCooldown = Math.max(0, (p.shootCooldown || 0) - dt);
  p.punchCooldown = Math.max(0, (p.punchCooldown || 0) - dt);
  p.damageCooldown = Math.max(0, (p.damageCooldown || 0) - dt);
  p.graceTimer = Math.max(0, (p.graceTimer || 0) - dt);
  if (p.inCar) return;
  if (!input) return;
  const cam = g.camera || { yaw: Math.PI };
  const fwd = axis(input, 'KeyW', 'KeyS');
  const strafe = axis(input, 'KeyA', 'KeyD');
  const running = input.down.has('ShiftLeft') || input.down.has('ShiftRight');
  const speed = running ? TUNE.runSpeed : TUNE.walkSpeed;
  // Camera-relative move: forward is (-sin yaw, -cos yaw).
  const fx = -Math.sin(cam.yaw);
  const fz = -Math.cos(cam.yaw);
  // Right vector (90 deg clockwise from forward, so D strafes
  // right when facing the camera's view direction).
  const rx = fz;
  const rz = -fx;
  let mx = fx * -fwd + rx * strafe;
  let mz = fz * -fwd + rz * strafe;
  const len = Math.hypot(mx, mz);
  if (len > 0) {
    mx /= len;
    mz /= len;
    p.speed = speed;
    p.heading = Math.atan2(mx, mz);
  } else {
    p.speed = 0;
  }
  if (p.speed > 0) {
    const nx = p.x + mx * p.speed * dt;
    const nz = p.z + mz * p.speed * dt;
    // Solid buildings: try the full step, then slide on each axis.
    if (!isBlocked(g.city, nx, nz)) {
      p.x = nx;
      p.z = nz;
    } else if (!isBlocked(g.city, nx, p.z)) {
      p.x = nx;
    } else if (!isBlocked(g.city, p.x, nz)) {
      p.z = nz;
    }
    // If the player somehow ended up inside a building (e.g. a
    // spawn overlap), push them back out toward open ground.
    if (isBlocked(g.city, p.x, p.z)) {
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
        if (!isBlocked(g.city, p.x + dx, p.z + dz)) {
          p.x += dx;
          p.z += dz;
          break;
        }
      }
    }
  }
  // Carrying a cat: it rides along.
  if (p.carryingCat) {
    p.carryingCat.x = p.x;
    p.carryingCat.z = p.z;
  }
}

export function tryEnterVehicle(g) {
  const p = g.player;
  if (p.inCar) return null;
  let best = null;
  let bestD = 4.5;
  for (const v of g.vehicles) {
    if (v.driver) continue;
    const d = Math.hypot(v.x - p.x, v.z - p.z);
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  if (!best) return null;
  p.inCar = best;
  best.driver = 'player';
  return best;
}

export function exitVehicle(g) {
  const p = g.player;
  const v = p.inCar;
  if (!v) return;
  p.inCar = null;
  v.driver = null;
  // Step out to the first free spot beside the car.
  for (const [dx, dz] of [[2.5, 0], [-2.5, 0], [0, 2.5], [0, -2.5], [3.5, 0], [0, 3.5]]) {
    const nx = v.x + dx;
    const nz = v.z + dz;
    if (!isBlocked(g.city, nx, nz)) {
      p.x = nx;
      p.z = nz;
      return;
    }
  }
  p.x = v.x + 2.5;
  p.z = v.z;
}

// The player model: 11 boxes (head, hair, torso, 2 arms, 2 legs,
// 2 shoes, gun, belt) = 132 tris. Colours follow the outfit.
export function playerBoxes(g, b, camera) {
  const p = g.player;
  const c = outfitColours(g);
  const skin = [0.85, 0.65, 0.5];
  const yaw = p.heading || 0;
  const x = p.x;
  const z = p.z;
  // Legs (pants) and shoes.
  pushBoxRot(b, x - 0.14, 0, z, 0.26, 0.85, 0.26, yaw, c.pants);
  pushBoxRot(b, x + 0.14, 0, z, 0.26, 0.85, 0.26, yaw, c.pants);
  pushBoxRot(b, x - 0.14, 0, z + 0.08, 0.28, 0.14, 0.4, yaw, c.shoes);
  pushBoxRot(b, x + 0.14, 0, z + 0.08, 0.28, 0.14, 0.4, yaw, c.shoes);
  // Torso (shirt) and belt.
  pushBoxRot(b, x, 0.85, z, 0.62, 0.65, 0.34, yaw, c.shirt);
  pushBoxRot(b, x, 0.82, z, 0.64, 0.1, 0.36, yaw, [0.15, 0.12, 0.1]);
  // Arms (shirt sleeves + skin hands are one box each).
  pushBoxRot(b, x - 0.42, 0.9, z, 0.2, 0.6, 0.2, yaw, c.shirt);
  pushBoxRot(b, x + 0.42, 0.9, z, 0.2, 0.6, 0.2, yaw, c.shirt);
  // Head and hair.
  pushBoxRot(b, x, 1.5, z, 0.42, 0.42, 0.42, yaw, skin);
  pushBoxRot(b, x, 1.86, z, 0.44, 0.16, 0.44, yaw, c.hair);
  // Gun in the right hand.
  pushBoxRot(b, x + 0.42, 0.75, z + 0.15, 0.08, 0.08, 0.4, yaw, [0.12, 0.12, 0.14]);
  return 11;
}
