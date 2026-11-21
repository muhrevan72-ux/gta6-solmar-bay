// Solmar Bay — the player on foot.
// Movement is camera-relative (W walks into the screen). The
// player slides along building walls instead of clipping through
// them. Cooldowns always decay first — even while driving —
// because a cooldown gated on a falsy check would freeze.

import { TUNE, OUTFIT } from './config.js';
import { axis } from './input.js';
import { isBlocked } from './world.js';
import { pushBox } from './render.js';

// Entering / exiting a car lives in vehicles.js; re-exported here
// because the player module is the natural import point for it.
export { tryEnterVehicle, exitVehicle } from './vehicles.js';

export function outfitColours(g) {
  const o = g.player.outfit;
  return {
    hair: (OUTFIT.hair[o.hair] && OUTFIT.hair[o.hair].colour) || [0.12, 0.1, 0.08],
    shirt: (OUTFIT.shirt[o.shirt] && OUTFIT.shirt[o.shirt].colour) || [0.9, 0.9, 0.9],
    pants: (OUTFIT.pants[o.pants] && OUTFIT.pants[o.pants].colour) || [0.2, 0.3, 0.6],
    shoes: (OUTFIT.shoes[o.shoes] && OUTFIT.shoes[o.shoes].colour) || [0.8, 0.8, 0.8],
  };
}

export function stepPlayer(g, dt, input) {
  const p = g.player;
  // Cooldowns decay BEFORE any early return (they must also tick
  // while the player is in a car). Clamped at 0.
  if (p.eCooldown > 0) p.eCooldown = Math.max(0, p.eCooldown - dt);
  if (p.shootCooldown > 0) p.shootCooldown = Math.max(0, p.shootCooldown - dt);
  if (p.punchCooldown > 0) p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  if (p.bombCooldown > 0) p.bombCooldown = Math.max(0, p.bombCooldown - dt);
  if (p.petting > 0) p.petting = Math.max(0, p.petting - dt);
  if (p.inCar) return;
  if (!input || g.mode !== 'play' && g.mode !== 'phone') return;

  const cam = g.camera;
  const yaw = cam ? cam.yaw : 0;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const fwd = axis(input, 'KeyS', 'KeyW');
  const strafe = axis(input, 'KeyA', 'KeyD');
  let mx = fx * fwd + rx * strafe;
  let mz = fz * fwd + rz * strafe;
  const len = Math.hypot(mx, mz);
  if (len > 0.001) {
    mx /= len; mz /= len;
    const run = input.down.has('ShiftLeft') || input.down.has('ShiftRight');
    const speed = run ? TUNE.runSpeed : TUNE.walkSpeed;
    const step = speed * dt;
    const nx = p.x + mx * step;
    const nz = p.z + mz * step;
    // Slide along walls: try X and Z separately.
    if (!isBlocked(g.city, nx, p.z)) p.x = nx;
    if (!isBlocked(g.city, p.x, nz)) p.z = nz;
    p.heading = Math.atan2(mx, mz);
    p.speed = speed;
    p.bob += dt * speed * 1.6;
  } else {
    p.speed = 0;
  }
  // Keep the player inside the map.
  if (p.x < -395) p.x = -395;
  if (p.x > 395) p.x = 395;
  if (p.z < -395) p.z = -395;
  if (p.z > 395) p.z = 395;
}

// Draw the player as a voxel figure (11 boxes).
export function playerBoxes(g, batch) {
  const p = g.player;
  const cols = outfitColours(g);
  const bob = Math.sin(p.bob || 0) * 0.05;
  let n = 0;
  const px = p.x, pz = p.z;
  const sinH = Math.sin(p.heading), cosH = Math.cos(p.heading);
  const lx = (ox, oz) => px + ox * cosH + oz * sinH;
  const lz = (ox, oz) => pz - ox * sinH + oz * cosH;
  // Legs.
  pushBox(batch, lx(-0.14, 0), 0, lz(-0.14, 0), 0.24, 0.85, 0.24, cols.pants); n++;
  pushBox(batch, lx(0.14, 0), 0, lz(0.14, 0), 0.24, 0.85, 0.24, cols.pants); n++;
  // Shoes.
  pushBox(batch, lx(-0.14, 0.08), 0, lz(-0.14, 0.08), 0.26, 0.14, 0.4, cols.shoes); n++;
  pushBox(batch, lx(0.14, 0.08), 0, lz(0.14, 0.08), 0.26, 0.14, 0.4, cols.shoes); n++;
  // Torso.
  pushBox(batch, px, 0.85, pz, 0.62, 0.65, 0.36, cols.shirt); n++;
  // Arms.
  pushBox(batch, lx(-0.4, 0), 0.9 + bob, lz(-0.4, 0), 0.2, 0.6, 0.2, cols.shirt); n++;
  pushBox(batch, lx(0.4, 0), 0.9 - bob, lz(0.4, 0), 0.2, 0.6, 0.2, cols.shirt); n++;
  // Head + hair.
  pushBox(batch, px, 1.5, pz, 0.42, 0.42, 0.42, [0.9, 0.75, 0.6]); n++;
  pushBox(batch, px, 1.86, pz, 0.44, 0.16, 0.44, cols.hair); n++;
  // Weapon in the right hand.
  pushBox(batch, lx(0.4, 0.25), 1.0, lz(0.4, 0.25), 0.12, 0.12, 0.45, [0.15, 0.15, 0.18]); n++;
  // Belt.
  pushBox(batch, px, 0.8, pz, 0.64, 0.08, 0.38, [0.1, 0.1, 0.12]); n++;
  return n;
}
