// Solmar Bay — the player on foot, outfit colours, enter/exit.
// Written fresh for rebuild #18.

import { COL, OUTFIT, TUNE } from './config.js';
import { isBlocked } from './world.js';
import { pushBox, pushBoxRot } from './render.js';
import { tryEnterVehicle as enterVehicle, exitVehicle as exitCar } from './vehicles.js';

export function tryEnterVehicle(g) {
  return enterVehicle(g);
}

export function exitVehicle(g) {
  return exitCar(g);
}

export function outfitColours(g) {
  const o = g.player.outfit || { hair: 0, shirt: 0, pants: 0, shoes: 0 };
  return {
    hair: OUTFIT.hair[o.hair] ? OUTFIT.hair[o.hair].color : [0.1, 0.1, 0.1],
    shirt: OUTFIT.shirt[o.shirt] ? OUTFIT.shirt[o.shirt].color : [0.9, 0.9, 0.9],
    pants: OUTFIT.pants[o.pants] ? OUTFIT.pants[o.pants].color : [0.2, 0.3, 0.6],
    shoes: OUTFIT.shoes[o.shoes] ? OUTFIT.shoes[o.shoes].color : [0.9, 0.9, 0.9],
  };
}

export function stepPlayer(g, dt, input) {
  // The cooldown decays first — even when the player is in a car.
  // Snap to 0 below epsilon (0.5 - 5*0.1 leaves a float residue).
  if (g.player.eCooldown > 0) {
    g.player.eCooldown = Math.max(0, g.player.eCooldown - dt);
    if (g.player.eCooldown < 0.01) g.player.eCooldown = 0;
  }
  if (g.player.inCar) return;
  const run = input.down.has('ShiftLeft') || input.down.has('ShiftRight');
  const speed = run ? TUNE.runSpeed : TUNE.walkSpeed;
  // Movement follows the camera yaw: W is "away from the camera".
  const yaw = g.camera ? g.camera.yaw : Math.PI;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);
  let mx = 0, mz = 0;
  if (input.down.has('KeyW')) { mx += fx; mz += fz; }
  if (input.down.has('KeyS')) { mx -= fx; mz -= fz; }
  if (input.down.has('KeyA')) { mx -= rx; mz -= rz; }
  if (input.down.has('KeyD')) { mx += rx; mz += rz; }
  const len = Math.hypot(mx, mz);
  if (len < 0.001) {
    g.player.speed = 0;
    return;
  }
  mx /= len; mz /= len;
  g.player.speed = speed;
  // Face the movement direction.
  g.player.heading = Math.atan2(mx, mz);
  const nx = g.player.x + mx * speed * dt;
  const nz = g.player.z + mz * speed * dt;
  // Buildings block movement (axis-separated so the player slides).
  if (!isBlocked(g.city, nx, g.player.z)) g.player.x = nx;
  if (!isBlocked(g.city, g.player.x, nz)) g.player.z = nz;
}

// 11 boxes: legs, torso, arms, head, hair, eyes, shoes, weapon.
export function playerBoxes(g, b, gl) {
  const p = g.player;
  const c = outfitColours(g);
  const h = p.heading || 0;
  const skin = [0.85, 0.65, 0.5];
  // Legs (pants).
  pushBoxRot(b, p.x - 0.15, 0, p.z, 0.28, 0.9, 0.28, h, c.pants, [0, 0, 1, 1]);
  pushBoxRot(b, p.x + 0.15, 0, p.z, 0.28, 0.9, 0.28, h, c.pants, [0, 0, 1, 1]);
  // Shoes.
  pushBoxRot(b, p.x - 0.15, 0, p.z + 0.12, 0.3, 0.12, 0.4, h, c.shoes, [0, 0, 1, 1]);
  pushBoxRot(b, p.x + 0.15, 0, p.z + 0.12, 0.3, 0.12, 0.4, h, c.shoes, [0, 0, 1, 1]);
  // Torso (shirt).
  pushBoxRot(b, p.x, 0.9, p.z, 0.7, 0.7, 0.35, h, c.shirt, [0, 0, 1, 1]);
  // Arms (shirt sleeves).
  pushBoxRot(b, p.x - 0.45, 0.95, p.z, 0.2, 0.6, 0.2, h, c.shirt, [0, 0, 1, 1]);
  pushBoxRot(b, p.x + 0.45, 0.95, p.z, 0.2, 0.6, 0.2, h, c.shirt, [0, 0, 1, 1]);
  // Head (skin).
  pushBoxRot(b, p.x, 1.6, p.z, 0.35, 0.35, 0.35, h, skin, [0, 0, 1, 1]);
  // Hair.
  pushBoxRot(b, p.x, 1.92, p.z, 0.38, 0.12, 0.38, h, c.hair, [0, 0, 1, 1]);
  // Eyes (two tiny dark boxes on the face, offset along the right vector).
  const fwd = { x: Math.sin(h), z: Math.cos(h) };
  const right = { x: Math.cos(h), z: -Math.sin(h) };
  const ex = p.x + fwd.x * 0.18, ez = p.z + fwd.z * 0.18;
  pushBoxRot(b, ex - right.x * 0.08, 1.68, ez - right.z * 0.08, 0.05, 0.05, 0.05, h, [0.05, 0.05, 0.05], [0, 0, 1, 1]);
  pushBoxRot(b, ex + right.x * 0.08, 1.68, ez + right.z * 0.08, 0.05, 0.05, 0.05, h, [0.05, 0.05, 0.05], [0, 0, 1, 1]);
  return 11;
}
