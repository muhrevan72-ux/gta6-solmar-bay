// Solmar Bay — the player on foot.
//
// WASD moves relative to the camera, Shift runs, E interacts,
// F punches, Space swims/handbrakes, mouse click shoots. The
// player's voxel body follows the chosen outfit: hair style and
// colour come from the outfit's OWN colour (the round-7 bug where
// a bought "Red mohawk" rendered brown read COL.hair by index
// instead), shoes use the outfit shoe colour.

import { TUNE, COL, OUTFIT, clamp, dist } from './config.js';
import { isBlocked } from './world.js';
import { hairBox } from './pedestrians.js';

// Hair style by outfit name: crop/buzz are flat, mohawk/spikes
// stand up as a ridge. The colour ALWAYS comes from the outfit
// entry itself — never from an index into COL.hair.
export function outfitHairStyle(game) {
  const name = OUTFIT.hair[game.player.outfit.hair].name;
  if (name.includes('mohawk') || name.includes('spikes')) return 'ridge';
  return 'flat';
}

export function outfitHairColour(game) {
  return OUTFIT.hair[game.player.outfit.hair].colour;
}

export function outfitShoeColour(game) {
  return OUTFIT.shoes[game.player.outfit.shoes].colour;
}

export function outfitShirtColour(game) {
  return OUTFIT.shirt[game.player.outfit.shirt].colour;
}

export function outfitPantsColour(game) {
  return OUTFIT.pants[game.player.outfit.pants].colour;
}

// Draw the player as voxel boxes into a batch. out is an array
// of box specs {x,y,z,w,h,d,c,tile}; the caller pushes them.
// y0 is the ground height under the player.
export function playerBoxes(game, out, y0 = 0) {
  const p = game.player;
  const skin = COL.skin[0];
  const shirt = outfitShirtColour(game);
  const pants = outfitPantsColour(game);
  const shoes = outfitShoeColour(game);
  const bob = p.moving ? Math.sin(game.time * 10) * 0.12 : 0;
  const legSwing = p.moving ? Math.sin(game.time * 10) * 0.35 : 0;
  // Legs (swing when walking), torso, arms, head.
  out.push({ x: p.x - 0.22, y: y0 + 0.15 + Math.max(0, legSwing) * 0.4, z: p.z, w: 0.36, h: 0.75, d: 0.36, c: pants });
  out.push({ x: p.x + 0.22, y: y0 + 0.15 + Math.max(0, -legSwing) * 0.4, z: p.z, w: 0.36, h: 0.75, d: 0.36, c: pants });
  out.push({ x: p.x - 0.22, y: y0, z: p.z, w: 0.4, h: 0.18, d: 0.55, c: shoes });
  out.push({ x: p.x + 0.22, y: y0, z: p.z, w: 0.4, h: 0.18, d: 0.55, c: shoes });
  out.push({ x: p.x, y: y0 + 0.9 + bob, z: p.z, w: 0.85, h: 0.85, d: 0.5, c: shirt });
  out.push({ x: p.x - 0.55, y: y0 + 0.9 + bob, z: p.z, w: 0.28, h: 0.8, d: 0.32, c: shirt });
  out.push({ x: p.x + 0.55, y: y0 + 0.9 + bob, z: p.z, w: 0.28, h: 0.8, d: 0.32, c: shirt });
  out.push({ x: p.x, y: y0 + 1.75 + bob, z: p.z, w: 0.62, h: 0.6, d: 0.55, c: skin });
  // Hair follows the outfit (style + its own colour).
  hairBox(out, { x: p.x, z: p.z, hairStyle: outfitHairStyle(game), hair: outfitHairColour(game) }, y0 + 2.02 + bob, p.heading);
  // Carried cat rides on the shoulder.
  if (p.carryingCat) {
    out.push({ x: p.x + 0.45, y: y0 + 2.2 + bob, z: p.z, w: 0.4, h: 0.3, d: 0.5, c: [0.85, 0.7, 0.5] });
  }
  // Blob shadow.
  out.push({ x: p.x, y: y0 + 0.02, z: p.z, w: 1.1, h: 0.04, d: 1.1, c: [0.08, 0.08, 0.1] });
  return out;
}

// Move the player on foot. Returns nothing; mutates p.
export function stepPlayer(game, dt, input) {
  const p = game.player;
  // Cooldowns decay FIRST, before any early return: while the
  // player is in a car, inside, on the train or on the elevator
  // stepPlayer returns below — and a frozen eCooldown meant the
  // player could enter a car but never get out (round-8 probe:
  // exitVehicle always returned false while driving).
  // The gate is always `<= 0`, never `!x`.
  p.eCooldown = Math.max(0, p.eCooldown - dt);
  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  p.bombCooldown = Math.max(0, p.bombCooldown - dt);
  p.shootCooldown = Math.max(0, p.shootCooldown - dt);
  if (p.inCar || p.inside || p.onTrain || p.onElevator) return;
  const cam = game.camera;
  // Movement relative to the camera yaw.
  let fx = 0;
  let fz = 0;
  if (input) {
    if (input.downKey('KeyW') || input.downKey('ArrowUp')) { fx -= Math.sin(cam.yaw); fz -= Math.cos(cam.yaw); }
    if (input.downKey('KeyS') || input.downKey('ArrowDown')) { fx += Math.sin(cam.yaw); fz += Math.cos(cam.yaw); }
    if (input.downKey('KeyA') || input.downKey('ArrowLeft')) { fx -= Math.cos(cam.yaw); fz += Math.sin(cam.yaw); }
    if (input.downKey('KeyD') || input.downKey('ArrowRight')) { fx += Math.cos(cam.yaw); fz -= Math.sin(cam.yaw); }
  }
  const len = Math.hypot(fx, fz);
  const running = input && (input.downKey('ShiftLeft') || input.downKey('ShiftRight'));
  const speed = running ? TUNE.runSpeed : TUNE.walkSpeed;
  p.moving = len > 0.01;
  if (p.moving) {
    fx /= len;
    fz /= len;
    const target = Math.atan2(fx, fz);
    // Smooth turn toward the move direction.
    let diff = target - p.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    p.heading += clamp(diff, -6 * dt, 6 * dt);
    const nx = p.x + fx * speed * dt;
    const nz = p.z + fz * speed * dt;
    // Slide along walls: try x and z separately.
    if (!isBlocked(game.city, nx, p.z, TUNE.playerRadius)) p.x = nx;
    if (!isBlocked(game.city, p.x, nz, TUNE.playerRadius)) p.z = nz;
    p.speed = speed;
  } else {
    p.speed = 0;
  }
  // Swimming: in the water plane (west of x=-320 or harbour basin).
  const inWater = (p.x < -320 && p.x > -460) || (p.z > 320 && p.z < 400 && Math.abs(p.x) < 250);
  p.swimming = inWater && !p.inCar;
  if (p.swimming && p.moving) {
    p.x += fx * TUNE.swimSpeed * dt * 0.4;
    p.z += fz * TUNE.swimSpeed * dt * 0.4;
  }
  // World bounds.
  p.x = clamp(p.x, -395, 395);
  p.z = clamp(p.z, -395, 395);
}

// Try to enter the nearest vehicle (E). Returns the vehicle or null.
export function tryEnterVehicle(game) {
  const p = game.player;
  if (p.eCooldown > 0 || p.inCar) return null;
  let best = null;
  let bestD = TUNE.interactRange;
  for (const v of game.vehicles) {
    if (v.wrecked) continue;
    const d = dist(p.x, p.z, v.x, v.z);
    if (d < bestD) {
      best = v;
      bestD = d;
    }
  }
  if (!best) return null;
  p.eCooldown = 0.4;
  p.inCar = best;
  best.driver = 'player';
  if (best.stolen === false && best.kind !== 'taxiCalled') {
    // Stealing a parked or traffic car is a crime — unless it is
    // the taxi the player called (driver=null, free ride).
    if (best.owner === 'npc' || best.parked) {
      game.policeCommit && game.policeCommit('stealCar');
      game.stats.stolen += 1;
    }
  }
  return best;
}

// Step out of the car (E again).
export function exitVehicle(game) {
  const p = game.player;
  if (!p.inCar || p.eCooldown > 0) return false;
  const v = p.inCar;
  p.eCooldown = 0.4;
  p.inCar = null;
  v.driver = v.kind === 'taxi' ? 'npc' : null;
  // Step out to the side of the car, clear of its collider.
  const sx = v.x + Math.cos(v.heading) * 2.5;
  const sz = v.z - Math.sin(v.heading) * 2.5;
  if (!isBlocked(game.city, sx, sz, TUNE.playerRadius)) {
    p.x = sx;
    p.z = sz;
  } else {
    p.x = v.x - Math.cos(v.heading) * 2.5;
    p.z = v.z + Math.sin(v.heading) * 2.5;
  }
  return true;
}
