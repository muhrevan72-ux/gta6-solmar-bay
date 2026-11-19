// Solmar Bay — on-foot player: movement, swimming, interaction,
// entering/exiting vehicles. Smooth and fluid: eased acceleration,
// eased turns, body lean, walk bob. No stiffness.

import { TUNE, OUTFIT, clamp, dist } from './config.js';
import { moveWithCollision, inWater } from './world.js';
import { nearestVehicle } from './vehicles.js';

export function createPlayer(spawn) {
  return {
    x: spawn.x, z: spawn.z, y: 0,
    heading: 0, speed: 0, targetSpeed: 0,
    lean: 0, bob: 0, bobPhase: 0,
    inVehicle: null,
    onTrain: null,
    onElevator: false,
    parachuting: false,
    parachuteY: 0,
    swimming: false,
    carryingCat: null, // cat object riding on the shoulder
  };
}

export function updatePlayer(dt, game) {
  const p = game.player;
  const state = game.state;
  const input = game.input;

  // Riding something else — the vehicle/train/elevator owns the position.
  if (p.inVehicle) {
    const v = p.inVehicle;
    p.x = v.x; p.z = v.z; p.y = v.y;
    p.heading = v.heading;
    return;
  }
  if (p.onTrain) {
    p.x = p.onTrain.x; p.z = p.onTrain.z; p.y = p.onTrain.y;
    return;
  }
  if (p.onElevator) return; // elevator module moves the player

  // Parachuting: slow fall, steerable.
  if (p.parachuting) {
    p.parachuteY -= 4 * dt;
    const steer = (input.down('KeyA') ? 1 : 0) - (input.down('KeyD') ? 1 : 0);
    p.heading += steer * 1.5 * dt;
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    p.x += fx * 6 * dt;
    p.z += fz * 6 * dt;
    if (p.parachuteY <= 0) {
      p.parachuting = false;
      p.y = 0;
    } else {
      p.y = p.parachuteY;
    }
    return;
  }

  // Wish direction from WASD/arrows, relative to the camera.
  const cam = game.camera;
  const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
  const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
  let wx = 0, wz = 0;
  if (input.down('KeyW') || input.down('ArrowUp')) { wx += fx; wz += fz; }
  if (input.down('KeyS') || input.down('ArrowDown')) { wx -= fx; wz -= fz; }
  if (input.down('KeyD') || input.down('ArrowRight')) { wx += rx; wz += rz; }
  if (input.down('KeyA') || input.down('ArrowLeft')) { wx -= rx; wz -= rz; }
  const wl = Math.hypot(wx, wz);
  if (wl > 0) { wx /= wl; wz /= wl; }

  const swimming = inWater(game.city, p.x, p.z);
  p.swimming = swimming;
  const run = input.down('ShiftLeft') || input.down('ShiftRight');
  p.targetSpeed = swimming ? TUNE.swimSpeed : wl > 0 ? (run ? TUNE.runSpeed : TUNE.walkSpeed) : 0;
  // eased acceleration — no speed snap, no dead stop
  p.speed += (p.targetSpeed - p.speed) * Math.min(1, TUNE.playerAccel * dt);
  if (p.speed < 0.01 && p.targetSpeed === 0) p.speed = 0;

  if (wl > 0 && p.speed > 0.2) {
    const wantHeading = Math.atan2(wx, wz);
    let diff = wantHeading - p.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    p.heading += diff * Math.min(1, 10 * dt);
    p.lean = clamp(diff * 0.9, -0.2, 0.2);
    const mx = Math.sin(p.heading) * p.speed * dt;
    const mz = Math.cos(p.heading) * p.speed * dt;
    moveWithCollision(game.city, p, mx, mz, TUNE.playerRadius);
    p.bobPhase += p.speed * dt * 1.7;
    p.bob = Math.sin(p.bobPhase) * 0.1;
  } else {
    p.lean += (0 - p.lean) * Math.min(1, 6 * dt);
    p.bob += (0 - p.bob) * Math.min(1, 6 * dt);
  }
  p.y = swimming ? -0.55 : 0;
}

// E: enter the nearest enterable vehicle. Cooldown gated with `<= 0`.
export function tryEnterVehicle(game) {
  const state = game.state;
  if (state.eCooldown > 0) return false;
  const p = game.player;
  if (p.inVehicle || p.onTrain || p.parachuting) return false;
  const v = nearestVehicle(game, p.x, p.z, TUNE.enterRadius);
  if (!v) return false;
  if (v.damage >= 100) return false; // wrecked
  if (v.kind === 'plane' && v.y > 4) return false; // flying away
  if (v.kind === 'boat' && !inWater(game.city, v.x, v.z)) return false;
  // A traffic car with a driver: the driver flees, it counts as theft.
  if (v.driver === 'traffic') {
    if (game.peds && game.peds.fleeFrom) game.peds.fleeFrom(v.x, v.z, 30);
    if (game.police && game.police.commitCrime) game.police.commitCrime(game, 'stealCar');
    state.stats.carsStolen += 1;
  }
  v.driver = 'player';
  v.parked = false;
  v.traffic = false;
  p.inVehicle = v;
  state.eCooldown = 0.35;
  if (game.audio) game.audio.blip(660, 0.08);
  return true;
}

export function exitVehicle(game) {
  const state = game.state;
  if (state.eCooldown > 0) return false;
  const p = game.player;
  const v = p.inVehicle;
  if (!v) return false;
  // step out to the side of the car
  const side = Math.PI / 2;
  p.x = v.x + Math.sin(v.heading + side) * 2.4;
  p.z = v.z + Math.cos(v.heading + side) * 2.4;
  p.y = 0;
  p.heading = v.heading;
  v.driver = null;
  v.parked = true;
  v.speed = 0;
  p.inVehicle = null;
  state.eCooldown = 0.35;
  return true;
}

// Outfit colours for the player's voxel body.
export function outfitColors(state) {
  return {
    hair: OUTFIT.hair[state.outfit.hair].color,
    shirt: OUTFIT.shirt[state.outfit.shirt].color,
    pants: OUTFIT.pants[state.outfit.pants].color,
    shoes: OUTFIT.shoes[state.outfit.shoes].color,
    skin: [0.92, 0.75, 0.6],
  };
}

export function drawPlayer(renderer, game) {
  const p = game.player;
  if (p.inVehicle || p.onTrain) return; // hidden inside the vehicle
  const c = outfitColors(game.state);
  const bobY = p.bob;
  const lean = p.lean;
  const yaw = p.heading;
  const swim = p.swimming;
  const y0 = p.y;
  // legs (alternate with the walk cycle)
  const legSwing = Math.sin(p.bobPhase) * 0.25;
  renderer.box(p.x, y0 + 0.4 + bobY * 0.4, p.z, 0.42, 0.8, 0.42, c.pants, 1, yaw, lean, swim ? 0 : legSwing);
  renderer.box(p.x, y0 + 0.4 - bobY * 0.4, p.z, 0.42, 0.8, 0.42, c.pants, 1, yaw, lean, swim ? 0 : -legSwing);
  // shoes
  renderer.box(p.x, y0 + 0.1, p.z, 0.46, 0.22, 0.6, c.shoes, 1, yaw, lean);
  // torso
  renderer.box(p.x, y0 + 1.15 + bobY, p.z, 0.95, 0.75, 0.55, c.shirt, 1, yaw, lean, swim ? 1.1 : 0);
  // arms
  renderer.box(p.x - 0.62, y0 + 1.15 + bobY, p.z, 0.3, 0.7, 0.3, c.shirt, 1, yaw, lean, swim ? 0 : -legSwing);
  renderer.box(p.x + 0.62, y0 + 1.15 + bobY, p.z, 0.3, 0.7, 0.3, c.shirt, 1, yaw, lean, swim ? 0 : legSwing);
  // head + hair
  renderer.box(p.x, y0 + 1.85 + bobY, p.z, 0.62, 0.6, 0.6, c.skin, 1, yaw, lean);
  renderer.box(p.x, y0 + 2.2 + bobY, p.z, 0.66, 0.28, 0.66, c.hair, 1, yaw, lean);
  // carried cat rides on the shoulder
  if (p.carryingCat) {
    renderer.box(p.x + 0.5, y0 + 2.35 + bobY, p.z, 0.45, 0.4, 0.7, p.carryingCat.color, 1, yaw, lean);
  }
  // parachute canopy
  if (p.parachuting) {
    renderer.box(p.x, y0 + 3.4, p.z, 3.4, 0.25, 2.2, [0.95, 0.4, 0.3], 1, yaw, 0);
  }
}

export { dist };
