// Solmar Bay — the player on foot.
//
// WASD moves relative to the camera yaw, Shift runs, the walk cycle
// (bob) drives the leg/arm swing in playerBoxes. Movement reads HELD
// keys (input.down); all tap actions (E/F/G/...) use pressedKey in
// main.js, never here. Collision uses the city's bbox collider —
// the player is a circle of radius TUNE.playerRadius.

import { TUNE, COL } from './config.js';
import { isDown } from './input.js';
import { isWaterAt } from './world.js';
import { addCash, showToast } from './state.js';

export function createPlayer(spawn) {
  return {
    x: spawn.x, z: spawn.z, heading: 0,
    vx: 0, vz: 0, speed: 0, bob: 0, lean: 0,
    inCar: null,
    swimming: false,
    carryingCat: null,
    onTrain: false,
    onElevator: false,
    alt: 0, // height above the ground (parachute)
    parachute: false,
    nearCar: null, // nearest car within interact range (HUD hint)
  };
}

export function stepPlayer(game, dt) {
  const s = game.state;
  const p = s.player;
  if (p.inCar) return; // vehicles.js drives the car instead
  // Parachute: a slow descent after jumping out of a plane.
  if (p.alt > 0) {
    p.alt = Math.max(0, p.alt - (p.parachute ? 3 : 9) * dt);
    if (p.alt === 0) {
      p.parachute = false;
      showToast(s, 'You landed safely.', 3);
    }
  }
  const inp = game.input;
  const cam = game.camera;
  // Camera-relative movement: forward is the camera yaw.
  const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
  const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
  let mx = 0, mz = 0;
  if (isDown(inp, 'KeyW')) { mx += fx; mz += fz; }
  if (isDown(inp, 'KeyS')) { mx -= fx; mz -= fz; }
  if (isDown(inp, 'KeyD')) { mx += rx; mz += rz; }
  if (isDown(inp, 'KeyA')) { mx -= rx; mz -= rz; }
  const len = Math.hypot(mx, mz);
  const maxSpeed = isDown(inp, 'ShiftLeft') || isDown(inp, 'ShiftRight')
    ? TUNE.runSpeed : TUNE.walkSpeed;
  if (len > 0) {
    mx /= len; mz /= len;
    p.vx += mx * TUNE.accel * dt;
    p.vz += mz * TUNE.accel * dt;
    p.heading = Math.atan2(mx, mz);
  }
  // Friction + speed cap.
  const sp = Math.hypot(p.vx, p.vz);
  const cap = p.swimming ? TUNE.swimSpeed : maxSpeed;
  if (sp > cap) { p.vx *= cap / sp; p.vz *= cap / sp; }
  const fr = Math.max(0, 1 - TUNE.friction * dt / Math.max(sp, 0.001));
  if (len === 0) { p.vx *= fr; p.vz *= fr; }
  // Move with collision (slide along walls).
  const nx = p.x + p.vx * dt;
  const nz = p.z + p.vz * dt;
  if (!game.city.collidesCircle(nx, p.z, TUNE.playerRadius)) p.x = nx;
  if (!game.city.collidesCircle(p.x, nz, TUNE.playerRadius)) p.z = nz;
  p.speed = Math.hypot(p.vx, p.vz);
  p.bob += p.speed * dt * 1.6;
  // Lean into turns.
  const targetLean = len > 0 ? Math.sin(p.bob) * 0.08 : 0;
  p.lean += (targetLean - p.lean) * Math.min(1, dt * 8);
  // Swimming: the harbour basin is water.
  p.swimming = isWaterAt(game.city, p.x, p.z);
  if (p.swimming) p.bob += dt * 2;
  // Nearest car (for the HUD "E — Enter car" hint).
  p.nearCar = null;
  let best = TUNE.interactRange;
  for (const c of game.vehicles.traffic) {
    const d = Math.hypot(c.x - p.x, c.z - p.z);
    if (d < best) { best = d; p.nearCar = c; }
  }
  for (const c of game.vehicles.parked) {
    const d = Math.hypot(c.x - p.x, c.z - p.z);
    if (d < best) { best = d; p.nearCar = c; }
  }
}

export function enterCar(game, car) {
  const s = game.state;
  s.player.inCar = car;
  car.driver = 'player';
  car.speed = 0;
  s.player.vx = 0;
  s.player.vz = 0;
}

export function exitCar(game) {
  const s = game.state;
  const car = s.player.inCar;
  if (!car) return;
  car.driver = null;
  s.player.inCar = null;
  // Step out to the side of the car, clear of its collider.
  const side = 2.5;
  const sx = Math.cos(car.heading), sz = -Math.sin(car.heading);
  s.player.x = car.x + sx * side;
  s.player.z = car.z + sz * side;
  s.player.heading = car.heading;
}

// The player as a humanoid: legs + arms swing with the walk cycle,
// torso + head, a different shirt from the outfit. Near LOD: eyes.
export function playerBoxes(game, out) {
  const s = game.state;
  const p = s.player;
  if (p.inCar) return;
  const y0 = p.alt || 0; // parachute altitude
  const h = 1.9;
  const swing = p.speed > 0.5 ? Math.sin(p.bob) * 0.5 : 0;
  const shirt = COL.shirt[s.outfit.shirt % COL.shirt.length];
  const pants = COL.pants[s.outfit.pants % COL.pants.length];
  const skin = COL.skin[0];
  const hair = COL.hair[s.outfit.hair % COL.hair.length];
  const legSwing = swing * 0.35;
  out.pushBoxRot(p.x - 0.11, 0.45 + y0, p.z, 0.18, 0.9, 0.18, pants, p.heading + legSwing * 0.3);
  out.pushBoxRot(p.x + 0.11, 0.45 + y0, p.z, 0.18, 0.9, 0.18, pants, p.heading - legSwing * 0.3);
  out.pushBoxRot(p.x, 1.25 + y0, p.z, 0.5, 0.7, 0.28, shirt, p.heading);
  out.pushBoxRot(p.x - 0.32, 1.25 + y0, p.z, 0.14, 0.65, 0.14, skin, p.heading + swing * 0.4);
  out.pushBoxRot(p.x + 0.32, 1.25 + y0, p.z, 0.14, 0.65, 0.14, skin, p.heading - swing * 0.4);
  out.pushBoxRot(p.x, 1.82 + y0, p.z, 0.34, 0.36, 0.32, skin, p.heading);
  out.pushBoxRot(p.x, 2.02 + y0, p.z, 0.36, 0.12, 0.34, hair, p.heading);
  // Eyes (near LOD only — the dynamic batch is culled at range anyway).
  out.pushBoxRot(p.x - 0.08, 1.84 + y0, p.z + 0.17, 0.05, 0.05, 0.02, [0.1, 0.1, 0.1], p.heading);
  out.pushBoxRot(p.x + 0.08, 1.84 + y0, p.z + 0.17, 0.05, 0.05, 0.02, [0.1, 0.1, 0.1], p.heading);
  if (p.parachute) {
    // Parachute canopy above the player.
    out.pushBoxRot(p.x, 3.2 + y0, p.z, 1.8, 0.15, 1.8, [1, 0.4, 0.2], p.heading);
  }
  if (p.carryingCat) {
    out.pushBoxRot(p.x, 1.5 + y0, p.z + 0.2, 0.25, 0.2, 0.35, [0.9, 0.85, 0.7], p.heading);
  }
}

// Picking up a cash drop: walk over it and it is collected with a
// toast (never silently — the round-4 "cash anomaly" was silent
// auto-collect, so every income path must show a toast).
export function collectPickups(game) {
  const s = game.state;
  const p = s.player;
  if (p.inCar) return;
  const left = [];
  for (const pk of game.pickups) {
    const d = Math.hypot(pk.x - p.x, pk.z - p.z);
    if (d < TUNE.pickupRadius) {
      addCash(s, pk.amount);
      showToast(s, '+$' + pk.amount + (pk.label ? ' — ' + pk.label : ''), 3);
    } else {
      left.push(pk);
    }
  }
  game.pickups = left;
}
