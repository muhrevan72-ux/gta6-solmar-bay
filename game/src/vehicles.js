// Solmar Bay — vehicles.
//
// Cars, bikes, a boat, a plane: spawning, player driving,
// traffic that stops at red lights, and collisions. The player
// drives with W/S (throttle/reverse) and A/D (steer); Space is
// the handbrake (and the parachute from a plane). A car stolen
// while the player is on foot is grand theft auto (1 star) —
// unless it is the player's own car from the garage.

import { clamp, TUNE, CAR_NAMES, SPAWNS } from './config.js';
import { pushBox, pushBoxRot } from './render.js';
import { tileUV } from './texture.js';
import { isBlocked, isOnRoad, randomRoadPoint, lightState } from './world.js';
import { makeRng } from './config.js';
import { commitCrime } from './police.js';
import { addCash, showToast } from './state.js';

export function makeVehicle(kind, x, z, heading, colour, name) {
  return {
    kind, // car | bike | boat | plane | taxi
    x,
    z,
    y: 0,
    heading: heading || 0,
    speed: 0,
    colour: colour || [0.85, 0.15, 0.15],
    name: name || 'Car',
    driver: null, // 'player' | 'npc' | null (parked)
    condition: 100,
    owned: false,
    taxiFare: null,
    id: Math.random().toString(36).slice(2, 8),
  };
}

export function spawnVehicles(game) {
  const rng = makeRng(20261120);
  game.vehicles = [];
  // Parked cars around the city.
  for (let i = 0; i < 31; i++) {
    const p = randomRoadPoint(rng);
    const v = makeVehicle('car', p.x + (rng() - 0.5) * 4, p.z + (rng() - 0.5) * 4, p.dir, [0.2 + rng() * 0.7, 0.2 + rng() * 0.7, 0.2 + rng() * 0.7], CAR_NAMES[i % CAR_NAMES.length]);
    game.vehicles.push(v);
  }
  // The starter car near spawn (the Chapter 1 target).
  const starter = makeVehicle('car', 6, 26, 0, [0.85, 0.15, 0.15], 'Solmar Comet');
  game.vehicles.push(starter);
  // Bikes, boat, plane.
  game.vehicles.push(makeVehicle('bike', 12, 30, 0, [0.2, 0.6, 0.9], 'Vice Sprint'));
  game.vehicles.push(makeVehicle('boat', -345, 120, Math.PI / 2, [0.9, 0.9, 0.9], 'Tide Runner'));
  game.vehicles.push(makeVehicle('plane', 300, -260, 0, [0.9, 0.9, 0.9], 'Harbour Hawk'));
  // Traffic: 32 cars that drive the grid.
  game.traffic = [];
  for (let i = 0; i < TUNE.trafficCap; i++) {
    const p = randomRoadPoint(rng);
    const v = makeVehicle('car', p.x, p.z, p.dir, [0.2 + rng() * 0.7, 0.2 + rng() * 0.7, 0.2 + rng() * 0.7], CAR_NAMES[(i + 5) % CAR_NAMES.length]);
    v.driver = 'npc';
    v.speed = 8 + rng() * 6;
    game.traffic.push(v);
  }
}

// Player driving. W/S throttle, A/D steer, Space handbrake.
export function stepPlayerCar(game, dt, input) {
  const p = game.player;
  const v = p.inCar;
  if (!v) return;
  const max = v.kind === 'bike' ? TUNE.bikeMaxSpeed : v.kind === 'boat' ? TUNE.boatMaxSpeed : v.kind === 'plane' ? TUNE.planeMaxSpeed : TUNE.carMaxSpeed;
  const accel = v.kind === 'bike' ? TUNE.bikeAccel : v.kind === 'boat' ? TUNE.boatAccel : v.kind === 'plane' ? TUNE.planeAccel : TUNE.carAccel;
  const fwd = input.downKey('KeyW') ? 1 : input.downKey('KeyS') ? -0.6 : 0;
  const steer = (input.downKey('KeyA') ? 1 : 0) - (input.downKey('KeyD') ? 1 : 0);
  const handbrake = input.downKey('Space');
  if (fwd > 0) v.speed += accel * dt;
  else if (fwd < 0) v.speed -= TUNE.carBrake * dt * 0.6;
  else v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 8 * dt);
  if (handbrake) v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 30 * dt);
  v.speed = clamp(v.speed, -TUNE.carReverseMax, max);
  v.heading += steer * TUNE.carSteer * dt * (v.speed / max) * (v.speed >= 0 ? 1 : -1);
  const nx = v.x + Math.sin(v.heading) * v.speed * dt;
  const nz = v.z + Math.cos(v.heading) * v.speed * dt;
  if (!isBlocked(game.city, nx, nz)) {
    v.x = nx;
    v.z = nz;
  } else {
    // Hit a building: stop, lose condition, small bounce.
    v.speed *= -0.2;
    v.condition = Math.max(0, v.condition - 2);
  }
  v.x = clamp(v.x, -380, 380);
  v.z = clamp(v.z, -380, 380);
  p.x = v.x;
  p.z = v.z;
  p.heading = v.heading;
  p.speed = Math.abs(v.speed);
  // Parachute from a plane: Space at speed while airborne.
  if (v.kind === 'plane' && v.speed > TUNE.planeTakeoff && handbrake) {
    v.y += 2 * dt;
  }
  // Engine hum follows speed.
  if (game.audio) game.audio.engine(v.speed);
}

// Traffic: drive along roads, stop at red lights, slow for the
// player. Traffic cars never leave the road grid.
export function stepTraffic(game, dt) {
  for (const v of game.traffic) {
    // Red light ahead? Stop.
    let stopped = false;
    const aheadX = v.x + Math.sin(v.heading) * 10;
    const aheadZ = v.z + Math.cos(v.heading) * 10;
    for (const l of game.city.lights) {
      if (Math.hypot(l.x - aheadX, l.z - aheadZ) < 8) {
        if (lightState(l, game.time) === 'red') stopped = true;
      }
    }
    // Player car ahead? Slow down.
    const p = game.player;
    if (p.inCar) {
      const d = Math.hypot(p.x - aheadX, p.z - aheadZ);
      if (d < 8) stopped = true;
    }
    const target = stopped ? 0 : 10;
    v.speed += (target - v.speed) * Math.min(1, dt * 0.8);
    const nx = v.x + Math.sin(v.heading) * v.speed * dt;
    const nz = v.z + Math.cos(v.heading) * v.speed * dt;
    if (isOnRoad(nx, nz) || Math.abs(v.speed) < 0.1) {
      v.x = nx;
      v.z = nz;
    } else {
      // Turn at the next intersection instead of leaving the road.
      v.heading += (Math.PI / 2) * dt;
    }
    v.x = clamp(v.x, -360, 360);
    v.z = clamp(v.z, -360, 360);
  }
}

// Car-car collisions: slow both, damage both. The ram cooldown is
// per car (2.5 s) so a single touch cannot drain condition.
export function stepCarCollisions(game, dt) {
  const all = [...game.vehicles, ...game.traffic, ...game.copCars];
  for (let i = 0; i < all.length; i++) {
    const a = all[i];
    a._ramCd = Math.max(0, (a._ramCd || 0) - dt);
    for (let j = i + 1; j < all.length; j++) {
      const b = all[j];
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      if (d < 3.5 && d > 0.01) {
        const push = (3.5 - d) / 2;
        const nx = (a.x - b.x) / d;
        const nz = (a.z - b.z) / d;
        a.x += nx * push;
        a.z += nz * push;
        b.x -= nx * push;
        b.z -= nz * push;
        if (a._ramCd <= 0 && (Math.abs(a.speed) > 5 || Math.abs(b.speed) > 5)) {
          a._ramCd = 2.5;
          a.condition = Math.max(0, a.condition - 3);
          b.condition = Math.max(0, b.condition - 3);
          const rel = Math.abs(a.speed) + Math.abs(b.speed);
          a.speed *= 0.6;
          b.speed *= 0.6;
          // Ramming a cop car is a crime.
          if (a.driver === 'player' && b.kind === 'car' && game.copCars.includes(b)) {
            commitCrime(game, 'punchPed');
          }
          if (rel > 25 && a.driver === 'player') {
            showToast(game, 'Crash! Condition -3');
          }
        }
      }
    }
  }
}

// Draw one vehicle: body, cabin, wheels, headlights, details.
// Near LOD gets hubcaps, glass, bumpers, mirrors and a spoiler.
export function vehicleBoxes(game, v, b, cam) {
  const uv = tileUV('plain');
  const near = !cam || Math.hypot(v.x - cam.x, v.z - cam.z) < 60;
  const w = v.kind === 'bike' ? 1 : v.kind === 'boat' ? 3 : v.kind === 'plane' ? 3 : 2;
  const len = v.kind === 'bike' ? 2.4 : v.kind === 'boat' ? 7 : v.kind === 'plane' ? 9 : 4.6;
  const h = v.kind === 'plane' ? 1.4 : 1.1;
  const y = v.y || 0;
  // Body.
  pushBoxRot(b, v.x, y + 0.4, v.z, w, h, len, v.heading, v.colour, uv);
  // Cabin / cockpit.
  if (v.kind === 'car' || v.kind === 'taxi') {
    pushBoxRot(b, v.x, y + 1.3, v.z - 0.3, w - 0.4, 0.8, 2.2, v.heading, [0.4, 0.65, 0.85], uv);
  }
  // Wheels.
  const wheelCol = [0.08, 0.08, 0.1];
  const wy = y + 0.4;
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    pushBoxRot(b, v.x + sx * (w / 2 + 0.15) * Math.cos(v.heading) - sz * (len / 2 - 0.8) * Math.sin(v.heading), wy, v.z + sx * (w / 2 + 0.15) * Math.sin(v.heading) + sz * (len / 2 - 0.8) * Math.cos(v.heading), 0.3, 0.7, 0.7, v.heading, wheelCol, uv);
  }
  if (near) {
    // Headlights.
    const hx = Math.sin(v.heading);
    const hz = Math.cos(v.heading);
    pushBoxRot(b, v.x + hx * (len / 2) - hz * 0.7, y + 0.7, v.z + hz * (len / 2) + hx * 0.7, 0.4, 0.3, 0.2, v.heading, [1, 0.95, 0.6], uv);
    pushBoxRot(b, v.x + hx * (len / 2) + hz * 0.7, y + 0.7, v.z + hz * (len / 2) - hx * 0.7, 0.4, 0.3, 0.2, v.heading, [1, 0.95, 0.6], uv);
    // Bumpers + mirrors.
    pushBoxRot(b, v.x + hx * (len / 2 + 0.1), y + 0.4, v.z + hz * (len / 2 + 0.1), w, 0.3, 0.3, v.heading, [0.2, 0.2, 0.22], uv);
    pushBoxRot(b, v.x - hx * (len / 2 + 0.1), y + 0.4, v.z - hz * (len / 2 + 0.1), w, 0.3, 0.3, v.heading, [0.2, 0.2, 0.22], uv);
    // Spoiler on sports cars.
    if (v.name === 'Solmar Comet' || v.name === 'Palm GT') {
      pushBoxRot(b, v.x - hx * (len / 2 - 0.2), y + 1.3, v.z - hz * (len / 2 - 0.2), w, 0.15, 0.6, v.heading, [0.1, 0.1, 0.12], uv);
    }
    // Taxi sign.
    if (v.kind === 'taxi') {
      pushBoxRot(b, v.x, y + 2.1, v.z, 1.2, 0.4, 0.5, v.heading, [1, 0.85, 0.1], uv);
    }
  }
  return 8;
}
