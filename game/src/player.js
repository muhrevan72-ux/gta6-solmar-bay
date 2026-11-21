// Solmar Bay — the player on foot.
//
// Walking is relative to the camera: W goes where the camera looks,
// A/D strafe, Shift runs. Buildings block movement (axis-separated, so
// the player slides along walls). Cooldowns decay first, before the
// in-car early return, so timers never freeze while driving. Entering
// a car is a separate step (vehicles.js owns the car itself).

import { TUNE, OUTFIT } from './config.js';
import { isBlocked } from './world.js';
import { pushBox, pushBoxRot } from './render.js';
import { nearestEnterableVehicle } from './vehicles.js';
import { trainPosAt } from './living.js';

export function outfitColours(g) {
  const o = g.player.outfit;
  return {
    hair: OUTFIT.hair[o.hair] ? OUTFIT.hair[o.hair].colour : [0.1, 0.1, 0.1],
    shirt: OUTFIT.shirt[o.shirt] ? OUTFIT.shirt[o.shirt].colour : [0.9, 0.9, 0.9],
    pants: OUTFIT.pants[o.pants] ? OUTFIT.pants[o.pants].colour : [0.2, 0.25, 0.5],
    shoes: OUTFIT.shoes[o.shoes] ? OUTFIT.shoes[o.shoes].colour : [0.9, 0.9, 0.9],
  };
}

export function stepPlayer(g, dt, input) {
  const p = g.player;
  // Cooldowns decay first — even while driving.
  p.shootCooldown = Math.max(0, p.shootCooldown - dt);
  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  p.bombCooldown = Math.max(0, p.bombCooldown - dt);
  p.eCooldown = Math.max(0, p.eCooldown - dt);
  if (p.petting > 0) p.petting = Math.max(0, p.petting - dt);
  if (p.inCar) return;
  if (p.onTrain && g.train) {
    const pos = trainPosAt(g.train.a);
    p.x = pos.x;
    p.z = pos.z;
    return;
  }

  const cam = g.camera;
  const yaw = cam ? cam.yaw : Math.PI;
  // Camera forward on the ground plane; right is 90 degrees clockwise.
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);

  let mx = 0;
  let mz = 0;
  if (input) {
    if (input.down.has('KeyW')) { mx += fx; mz += fz; }
    if (input.down.has('KeyS')) { mx -= fx; mz -= fz; }
    if (input.down.has('KeyA')) { mx -= rx; mz -= rz; }
    if (input.down.has('KeyD')) { mx += rx; mz += rz; }
  }
  const moving = mx !== 0 || mz !== 0;
  if (!moving) {
    p.speed = 0;
    return;
  }
  const len = Math.hypot(mx, mz);
  mx /= len;
  mz /= len;
  const run = input && input.down.has('ShiftLeft') || input && input.down.has('ShiftRight');
  const speed = run ? TUNE.runSpeed : TUNE.walkSpeed;
  p.speed = speed;
  p.heading = Math.atan2(mx, mz);

  const nx = p.x + mx * speed * dt;
  const nz = p.z + mz * speed * dt;
  const city = g.city;
  // Axis-separated collision so the player slides along walls.
  if (!city || !isBlocked(city, nx, p.z)) p.x = nx;
  if (!city || !isBlocked(city, p.x, nz)) p.z = nz;
  p.x = Math.max(-398, Math.min(398, p.x));
  p.z = Math.max(-398, Math.min(398, p.z));
}

export function tryEnterVehicle(g) {
  const p = g.player;
  if (p.inCar) return null;
  const v = nearestEnterableVehicle(g);
  if (!v) return null;
  p.inCar = v;
  v.driver = 'player';
  p.x = v.x;
  p.z = v.z;
  return v;
}

export function exitVehicle(g) {
  const p = g.player;
  const v = p.inCar;
  if (!v) return false;
  v.driver = null;
  p.inCar = null;
  // Step out to the side; pick the first free spot.
  const city = g.city;
  const offsets = [[2.5, 0], [-2.5, 0], [0, 2.5], [0, -2.5], [3.5, 0], [-3.5, 0]];
  for (const [dx, dz] of offsets) {
    const x = v.x + dx;
    const z = v.z + dz;
    if (!city || !isBlocked(city, x, z)) {
      p.x = x;
      p.z = z;
      return true;
    }
  }
  p.x = v.x + 2.5;
  p.z = v.z;
  return true;
}

// The player model: head, hair, torso, arms, legs, shoes, belt, gun —
// 11 boxes, rotated to face the player's heading.
export function playerBoxes(g, b, cam) {
  const p = g.player;
  if (p.inCar) return 0;
  const c = outfitColours(g);
  const skin = [0.85, 0.65, 0.5];
  const h = p.heading || 0;
  const plain = [0, 0, 1, 1];
  const parts = [
    // [dx, dy, dz, w, hh, d, colour] — offsets are local, rotated by heading.
    [0, 0, 0, 0.34, 0.8, 0.2, c.pants], // left leg
    [0, 0, 0, 0.34, 0.8, 0.2, c.pants], // right leg
    [0, 0.8, 0, 0.55, 0.55, 0.3, c.shirt], // torso
    [0, 1.35, 0, 0.34, 0.3, 0.3, skin], // head
    [0, 1.62, 0, 0.36, 0.18, 0.32, c.hair], // hair
    [0, 0.85, 0, 0.16, 0.5, 0.16, c.shirt], // left arm
    [0, 0.85, 0, 0.16, 0.5, 0.16, c.shirt], // right arm
    [0, 0, 0, 0.36, 0.12, 0.3, c.shoes], // left shoe
    [0, 0, 0, 0.36, 0.12, 0.3, c.shoes], // right shoe
    [0, 0.78, 0, 0.57, 0.08, 0.32, [0.2, 0.15, 0.1]], // belt
    [0, 0.9, 0, 0.1, 0.1, 0.4, [0.15, 0.15, 0.18]], // gun
  ];
  // Local offsets: legs and shoes split left/right, arms split too.
  const sides = [
    [-0.11, 0], [0.11, 0], [0, 0], [0, 0], [0, 0],
    [-0.36, 0], [0.36, 0], [-0.11, 0], [0.11, 0], [0, 0], [0.3, 0.15],
  ];
  let count = 0;
  for (let i = 0; i < parts.length; i++) {
    const [dx, dy, dz, w, hh, d, colour] = parts[i];
    const [sx, sz] = sides[i];
    // Rotate the local offset by the heading.
    const cos = Math.cos(h);
    const sin = Math.sin(h);
    const lx = dx + sx;
    const lz = dz + sz;
    const wx = p.x + lx * cos + lz * sin;
    const wz = p.z - lx * sin + lz * cos;
    pushBoxRot(b, wx, dy, wz, w, hh, d, h, colour, plain);
    count++;
  }
  return count;
}
