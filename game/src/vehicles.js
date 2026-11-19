// Solmar Bay — vehicles: traffic AI, parked cars, bikes, boats,
// planes, the player's car, and the E-to-enter flow.
//
// Cars drive along the road grid, stop at red traffic lights, and
// despawn far from the player. Parked cars sit at curbs. The player
// enters a car with E (tryEnterCar) — the REQUIRED input rule
// applies: the gate is `pressedKey('KeyE') && eCooldown <= 0`,
// NEVER `!eCooldown` (a negative cooldown is truthy-false forever).
//
// Taxi rule (play-test #4 fix): a taxi the player called drives to
// him, parks with driver=null, and E enters it WITHOUT a steal
// crime; it also un-sticks itself (teleports beside the player)
// if it has been parked 30 s without being entered.

import { TUNE, COL, CAR_NAMES, clamp, pick } from './config.js';
import { isWaterAt } from './world.js';
import { pressedKey } from './input.js';
import { commitCrime } from './police.js';
import { showToast, addCash } from './state.js';

const CAR_COLORS = COL.carPaint;

export function createVehicles(city) {
  const v = { traffic: [], parked: [], spawned: 0 };
  // Parked cars at curbs (deterministic-ish spread).
  for (let i = 0; i < TUNE.parkedCap; i++) {
    const road = pick(city.roads, i);
    const along = (i * 137) % 500 - 250;
    const side = i % 2 === 0 ? 1 : -1;
    const x = road.vertical ? road.coord + side * 9 : along;
    const z = road.vertical ? along : road.coord + side * 9;
    v.parked.push(makeCar(x, z, road.vertical ? 0 : Math.PI / 2, 'car', i));
  }
  // Bikes (2, downtown), a boat in the harbour basin, and a plane on
  // the airport runway — all enterable with E like any car.
  v.parked.push(makeCar(-20, 30, 0, 'bike', 31));
  v.parked.push(makeCar(30, -30, Math.PI / 2, 'bike', 32));
  v.parked.push(makeCar(370, -100, 0, 'boat', 33));
  v.parked.push(makeCar(200, -320, Math.PI / 2, 'plane', 34));
  return v;
}

function makeCar(x, z, heading, kind, seed) {
  const color = CAR_COLORS[(seed || 0) % CAR_COLORS.length];
  const car = {
    kind, // car | bike | boat | plane | taxi
    x, z, heading,
    speed: 0,
    color,
    name: CAR_NAMES[(seed || 0) % CAR_NAMES.length],
    condition: 100,
    driver: null, // 'player' | 'npc' | null
    route: null, // traffic: {road, dir, target}
    stuckT: 0,
    calledTaxi: false,
    parkedT: 0,
    wheelSpin: 0,
    alt: 0, // plane altitude (0 = on the ground)
  };
  return car;
}

export function spawnTraffic(game) {
  const v = game.vehicles;
  const p = game.state.player;
  while (v.traffic.length < TUNE.trafficCap) {
    const road = pick(game.city.roads, v.spawned);
    const along = (v.spawned * 91) % 600 - 300;
    const x = road.vertical ? road.coord : along;
    const z = road.vertical ? along : road.coord;
    const dir = v.spawned % 2 === 0 ? 1 : -1;
    const car = makeCar(x, z, road.vertical ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2), 'car', v.spawned);
    car.driver = 'npc';
    car.speed = 8 + (v.spawned % 7);
    car.route = { road, dir };
    v.traffic.push(car);
    v.spawned++;
  }
}

// Traffic lights: a car approaching a red light on its road stops.
// The lights cycle green 6 s / red 6 s (their `t` timer counts down
// in stepVehicles).
function lightIsRed(game, car) {
  const lights = game.city.lights;
  for (const L of lights) {
    const d = Math.hypot(L.x - car.x, L.z - car.z);
    if (d < 12) return L.state === 'red';
  }
  return false;
}

export function stepVehicles(game, dt) {
  const v = game.vehicles;
  const s = game.state;
  const p = s.player;
  // Cycle the traffic lights (green 6 s, red 6 s).
  for (const L of game.city.lights) {
    L.t -= dt;
    if (L.t <= 0) {
      L.t = 6;
      L.state = L.state === 'green' ? 'red' : 'green';
    }
  }
  // Traffic.
  const kept = [];
  for (const c of v.traffic) {
    if (c.driver === 'player') { kept.push(c); continue; }
    if (c.calledTaxi) { kept.push(c); continue; } // taxi.js drives it
    // Drive along its road; stop at red lights.
    const stopped = lightIsRed(game, c);
    const targetSpeed = stopped ? 0 : 10 + (c.speed % 5);
    c.speed += clamp(targetSpeed - c.speed, -TUNE.carBrake * dt, TUNE.carAccel * dt);
    c.x += Math.sin(c.heading) * c.speed * dt;
    c.z += Math.cos(c.heading) * c.speed * dt;
    c.wheelSpin += c.speed * dt * 2;
    // Off the grid edge: turn around.
    if (Math.abs(c.x) > 380 || Math.abs(c.z) > 380) {
      c.heading += Math.PI;
      c.x = clamp(c.x, -380, 380);
      c.z = clamp(c.z, -380, 380);
    }
    // Despawn far from the player; respawn keeps the count.
    if (Math.hypot(c.x - p.x, c.z - p.z) < 450) kept.push(c);
  }
  v.traffic = kept;
  spawnTraffic(game);
  // Parked cars: nothing to step, but a called taxi that has waited
  // 30 s un-sticks (teleports beside the player).
  for (const c of v.traffic) {
    if (c.calledTaxi && c.driver !== 'player') {
      c.parkedT += dt;
      if (c.parkedT > 30) {
        c.x = p.x + 3;
        c.z = p.z + 3;
        c.parkedT = 0;
        showToast(s, 'Your cab is waiting beside you.', 3);
      }
    }
  }
  // The player's car.
  const car = p.inCar;
  if (!car) return;
  const inp = game.input;
  const cam = game.camera;
  // Kind-specific handling: bike (fast, narrow), boat (water only),
  // plane (takes off above 45 u/s, Space = parachute out).
  const kindAccel = car.kind === 'bike' ? TUNE.bikeAccel : car.kind === 'boat' ? TUNE.boatAccel : car.kind === 'plane' ? TUNE.planeAccel : TUNE.carAccel;
  const kindMax = car.kind === 'bike' ? TUNE.bikeMaxSpeed : car.kind === 'boat' ? TUNE.boatMaxSpeed : car.kind === 'plane' ? TUNE.planeMaxSpeed : TUNE.carMaxSpeed;
  const radius = car.kind === 'bike' ? 1.0 : 1.6;
  // Parachute: Space while flying a plane above 10 m.
  if (car.kind === 'plane' && car.alt > 10 && inp.down.has('Space')) {
    p.inCar = null;
    car.driver = null;
    p.alt = car.alt;
    p.parachute = true;
    p.x = car.x;
    p.z = car.z;
    showToast(s, 'Parachute out!', 3);
    return;
  }
  const accelIn = (inp.down.has('KeyW') ? 1 : 0) - (inp.down.has('KeyS') ? 0.7 : 0);
  const steerIn = (inp.down.has('KeyA') ? 1 : 0) - (inp.down.has('KeyD') ? 1 : 0);
  const handbrake = inp.down.has('Space');
  const dir = car.speed >= 0 ? 1 : -1;
  car.speed += accelIn * kindAccel * dt;
  car.speed -= car.speed * (handbrake ? 3 : 0.35) * dt;
  car.speed = clamp(car.speed, -TUNE.carReverseMax, kindMax);
  if (Math.abs(car.speed) > 0.5) {
    car.heading += steerIn * TUNE.carSteer * dt * dir * clamp(Math.abs(car.speed) / 10, 0.2, 1);
  }
  car.wheelSpin += car.speed * dt * 2;
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  // Boats only move on water; on land they beach (speed dies).
  if (car.kind === 'boat') {
    if (!isWaterAt(game.city, nx, nz)) { car.speed *= 0.5; }
    else { car.x = nx; car.z = nz; }
  } else if (car.alt > 0 || car.kind === 'plane') {
    // A plane in the air ignores ground colliders.
    car.x = nx;
    car.z = nz;
  } else {
    if (!game.city.collidesCircle(nx, car.z, radius)) car.x = nx; else car.speed *= 0.4;
    if (!game.city.collidesCircle(car.x, nz, radius)) car.z = nz; else car.speed *= 0.4;
  }
  // Plane altitude: climbs above takeoff speed, descends below it.
  if (car.kind === 'plane') {
    if (car.speed > TUNE.planeTakeoff) car.alt = Math.min(120, car.alt + (car.speed - TUNE.planeTakeoff) * 0.15 * dt);
    else if (car.alt > 0) car.alt = Math.max(0, car.alt - 5 * dt);
  }
  p.x = car.x;
  p.z = car.z;
  p.heading = car.heading;
  p.alt = car.alt;
  // Roadblocks: ramming one at speed damages the car.
  for (const rb of game.police.roadblocks) {
    const d = Math.hypot(rb.x - car.x, rb.z - car.z);
    if (d < 3 && Math.abs(car.speed) > 8) {
      car.condition -= 15;
      car.speed *= 0.3;
      showToast(s, 'You rammed a roadblock! Car condition ' + Math.max(0, Math.round(car.condition)) + '%', 3);
    }
  }
  if (car.condition <= 0) {
    car.condition = 0;
    car.speed = 0;
    showToast(s, 'Your car is wrecked. Press E to get out.', 4);
  }
}

// E to enter: the nearest car within interact range. The gate is
// `pressedKey('KeyE') && eCooldown <= 0` — never `!eCooldown`.
// A called taxi (driver null, calledTaxi true) enters free; a parked
// or traffic car is a steal (wanted +1) unless it is the player's
// own garage car.
export function tryEnterCar(game) {
  const s = game.state;
  const p = s.player;
  const inp = game.input;
  if (p.inCar) return false;
  if (!pressedKey(inp, 'KeyE') || inp.eCooldown > 0) return false;
  inp.eCooldown = 0.5;
  let best = null;
  let bestD = TUNE.interactRange;
  const consider = (c) => {
    const d = Math.hypot(c.x - p.x, c.z - p.z);
    if (d < bestD) { bestD = d; best = c; }
  };
  for (const c of game.vehicles.traffic) consider(c);
  for (const c of game.vehicles.parked) consider(c);
  if (!best) return false;
  const isCalledTaxi = best.calledTaxi && best.driver === null;
  const isOwn = game.garage && game.garage.owned.includes(best);
  if (!isCalledTaxi && !isOwn) {
    commitCrime(game, 'stealCar');
    showToast(s, 'Nice wheels. Now drive to the garage.', 4);
  } else if (isCalledTaxi) {
    showToast(s, 'You hop in the taxi.', 3);
  }
  // Steal the car out of traffic/parked into the player's hands.
  if (best.driver === 'npc') {
    const i = game.vehicles.traffic.indexOf(best);
    if (i >= 0) game.vehicles.traffic.splice(i, 1);
  }
  const pi = game.vehicles.parked.indexOf(best);
  if (pi >= 0) game.vehicles.parked.splice(pi, 1);
  best.driver = 'player';
  best.calledTaxi = false;
  best.parkedT = 0;
  s.player.inCar = best;
  game.vehicles.playerCar = best;
  return true;
}

export function exitVehicle(game) {
  const s = game.state;
  const car = s.player.inCar;
  if (!car) return;
  car.driver = null;
  s.player.inCar = null;
  const side = 2.5;
  s.player.x = car.x + Math.cos(car.heading) * side;
  s.player.z = car.z - Math.sin(car.heading) * side;
  s.player.heading = car.heading;
  // The car becomes a parked car again.
  if (!game.vehicles.parked.includes(car) && !game.vehicles.traffic.includes(car)) {
    game.vehicles.parked.push(car);
  }
}

// Vehicles as detailed boxes: body + cabin + glass + wheels (with
// spin stripes), headlights, taillights, door panels, blob shadow.
// Near LOD (<= 80 m): extra detail; far: 13 boxes instead of 24.
export function vehicleBoxes(game, out, near) {
  const p = game.state.player;
  const all = [...game.vehicles.traffic, ...game.vehicles.parked];
  if (p.inCar) all.push(p.inCar);
  for (const c of all) {
    const d = Math.hypot(c.x - p.x, c.z - p.z);
    const detailed = near && d <= 80;
    const h = c.heading;
    const y0 = c.alt || 0; // planes fly above the ground
    if (c.kind === 'plane') {
      // Fuselage + wings + tail + prop.
      out.pushBoxRot(c.x, 1 + y0, c.z, 1.6, 1.2, 8, c.color, h);
      out.pushBoxRot(c.x, 1.1 + y0, c.z, 12, 0.25, 2, c.color, h);
      out.pushBoxRot(c.x, 1.4 + y0, c.z - 3.6, 5, 0.2, 1, c.color, h);
      out.pushBoxRot(c.x, 1 + y0, c.z + 4.2, 0.2, 1.2, 0.2, [0.2, 0.2, 0.2], h);
      out.pushBoxRot(c.x, 1 + y0, c.z + 4.2, 1.4, 0.3, 0.1, COL.glass, h);
      out.pushFlat(c.x, 0.06, c.z, 3, 9, [0, 0, 0], h);
      continue;
    }
    if (c.kind === 'boat') {
      // Hull + cabin + outboard motor.
      out.pushBoxRot(c.x, 0.5 + y0, c.z, 2, 0.9, 5, c.color, h);
      out.pushBoxRot(c.x, 1.2 + y0, c.z - 0.5, 1.6, 0.7, 2, [0.9, 0.9, 0.9], h);
      out.pushBoxRot(c.x, 0.6 + y0, c.z - 2.6, 0.5, 0.8, 0.4, [0.2, 0.2, 0.2], h);
      continue;
    }
    if (c.kind === 'bike') {
      // Frame + two wheels + handlebar.
      out.pushBoxRot(c.x, 0.7 + y0, c.z, 0.25, 0.25, 1.8, c.color, h);
      out.pushBoxRot(c.x, 0.45 + y0, c.z + 0.8, 0.2, 0.9, 0.2, [0.1, 0.1, 0.1], h);
      out.pushBoxRot(c.x, 0.45 + y0, c.z - 0.8, 0.2, 0.9, 0.2, [0.1, 0.1, 0.1], h);
      out.pushBoxRot(c.x, 1.0 + y0, c.z + 0.7, 0.7, 0.1, 0.1, [0.2, 0.2, 0.2], h);
      out.pushFlat(c.x, 0.06, c.z, 0.6, 2.0, [0, 0, 0], h);
      continue;
    }
    // Body + cabin.
    out.pushBoxRot(c.x, 0.55 + y0, c.z, 1.8, 0.7, 4.2, c.color, h);
    out.pushBoxRot(c.x, 1.15 + y0, c.z - 0.3, 1.6, 0.6, 2.2, c.color, h);
    // Glass: windshield + side windows.
    out.pushBoxRot(c.x, 1.2 + y0, c.z + 0.85, 1.5, 0.5, 0.1, COL.glass, h);
    if (detailed) {
      out.pushBoxRot(c.x - 0.82, 1.2 + y0, c.z - 0.3, 0.05, 0.45, 2.0, COL.glass, h);
      out.pushBoxRot(c.x + 0.82, 1.2 + y0, c.z - 0.3, 0.05, 0.45, 2.0, COL.glass, h);
    }
    // Wheels with spin stripes.
    const spin = c.wheelSpin || 0;
    for (const [wx, wz] of [[-0.85, 1.3], [0.85, 1.3], [-0.85, -1.3], [0.85, -1.3]]) {
      out.pushBoxRot(c.x + wx, 0.35 + y0, c.z + wz, 0.25, 0.7, 0.7, [0.1, 0.1, 0.1], h + spin * 0.3);
      if (detailed) out.pushBoxRot(c.x + wx, 0.35 + y0, c.z + wz, 0.26, 0.2, 0.72, [0.8, 0.8, 0.8], h);
    }
    // Headlights + taillights.
    out.pushBoxRot(c.x - 0.6, 0.6 + y0, c.z + 2.12, 0.3, 0.15, 0.05, [1, 0.95, 0.7], h);
    out.pushBoxRot(c.x + 0.6, 0.6 + y0, c.z + 2.12, 0.3, 0.15, 0.05, [1, 0.95, 0.7], h);
    out.pushBoxRot(c.x - 0.6, 0.6 + y0, c.z - 2.12, 0.3, 0.15, 0.05, [0.9, 0.1, 0.1], h);
    out.pushBoxRot(c.x + 0.6, 0.6 + y0, c.z - 2.12, 0.3, 0.15, 0.05, [0.9, 0.1, 0.1], h);
    if (detailed) {
      // Bumpers, mirrors, door panels.
      out.pushBoxRot(c.x, 0.35 + y0, c.z + 2.15, 1.8, 0.25, 0.15, [0.2, 0.2, 0.2], h);
      out.pushBoxRot(c.x, 0.35 + y0, c.z - 2.15, 1.8, 0.25, 0.15, [0.2, 0.2, 0.2], h);
      out.pushBoxRot(c.x - 0.95, 1.1 + y0, c.z + 0.6, 0.12, 0.12, 0.2, [0.2, 0.2, 0.2], h);
      out.pushBoxRot(c.x + 0.95, 1.1 + y0, c.z + 0.6, 0.12, 0.12, 0.2, [0.2, 0.2, 0.2], h);
      out.pushBoxRot(c.x - 0.91, 0.75 + y0, c.z - 0.3, 0.05, 0.5, 1.8, [0.5, 0.5, 0.5], h);
      out.pushBoxRot(c.x + 0.91, 0.75 + y0, c.z - 0.3, 0.05, 0.5, 1.8, [0.5, 0.5, 0.5], h);
      if (c.kind === 'taxi' || c.calledTaxi) {
        out.pushBoxRot(c.x, 1.65 + y0, c.z - 0.3, 0.7, 0.2, 0.3, [1, 0.85, 0.1], h);
      }
    }
    // Blob shadow under the car.
    out.pushFlat(c.x, 0.06, c.z, 2.2, 4.6, [0, 0, 0], h);
  }
}
