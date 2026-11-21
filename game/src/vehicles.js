// Solmar Bay — vehicles: the starter Comet, parked cars, the
// bike/boat/plane, the fire truck, taxis, and traffic.
// A car reads as a car: a long low body (5.0 x 0.9), a light
// silver cabin with blue glass, and four big black wheels at
// the corners that sit on the ground (minY 0) and protrude past
// the body sides and below it.

import { TUNE, COL, SPAWNS } from './config.js';
import { axis } from './input.js';
import { isBlocked, isOnRoad, ROAD_LINES, lightState } from './world.js';
import { pushBox, pushBoxRot } from './render.js';
import { showToast } from './state.js';

export function makeVehicle(kind, x, z, heading, color, name) {
  return {
    kind, x, z, heading,
    color: color || [0.8, 0.2, 0.2],
    name: name || 'Car',
    condition: 100,
    driver: null,
    owned: false,
    speed: 0,
    cruise: 8,
  };
}

const PARKED_NAMES = ['Palm GT', 'Sunset Cruiser', 'Bay Runner', 'Coral Coupe', 'Neon Hatch', 'Dune Buggy', 'Harbor Van', 'Vice Sedan'];
const PARKED_COLOURS = [
  [0.9, 0.2, 0.2], [0.2, 0.4, 0.9], [0.9, 0.7, 0.2], [0.2, 0.8, 0.4],
  [0.8, 0.3, 0.7], [0.3, 0.8, 0.9], [0.95, 0.95, 0.95], [0.15, 0.15, 0.2],
];

export function spawnVehicles(g) {
  g.vehicles = [];
  // The starter car — first in the list.
  g.vehicles.push(makeVehicle('car', -25, 20, 0, [0.9, 0.2, 0.2], 'Solmar Comet'));
  // Parked cars along the roads (31 total parked, incl. 2 taxis).
  let placed = 0;
  let seed = 42;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  while (placed < 31) {
    const road = ROAD_LINES[Math.floor(rnd() * ROAD_LINES.length)];
    const along = -380 + rnd() * 760;
    const vertical = rnd() < 0.5;
    const x = vertical ? road + (rnd() < 0.5 ? 9 : -9) : along;
    const z = vertical ? along : road + (rnd() < 0.5 ? 9 : -9);
    if (isBlocked(g.city, x, z)) continue;
    if (Math.abs(x + 25) < 4 && Math.abs(z - 20) < 4) continue;
    const isTaxi = placed === 5 || placed === 17;
    const kind = isTaxi ? 'taxi' : 'car';
    const name = isTaxi ? 'Solmar Cab' : PARKED_NAMES[placed % PARKED_NAMES.length];
    const color = isTaxi ? COL.taxiYellow : PARKED_COLOURS[placed % PARKED_COLOURS.length];
    g.vehicles.push(makeVehicle(kind, x, z, vertical ? 0 : Math.PI / 2, color, name));
    placed++;
  }
  // Bike, boat, plane, fire truck.
  g.vehicles.push(makeVehicle('bike', 40, 20, 0, [0.2, 0.8, 0.4], 'Street Bike'));
  g.vehicles.push(makeVehicle('boat', -360, 120, 0, [0.9, 0.9, 0.95], 'Bay Boat'));
  g.vehicles.push(makeVehicle('plane', 300, -260, 0, [0.9, 0.9, 0.9], 'Sky Plane'));
  g.vehicles.push(makeVehicle('car', SPAWNS.fireStation.x + 10, SPAWNS.fireStation.z, 0, [0.9, 0.1, 0.1], 'Fire Truck'));
  // Traffic: 32 cars driving on the road grid.
  g.traffic = [];
  for (let i = 0; i < 32; i++) {
    const road = ROAD_LINES[Math.floor(rnd() * ROAD_LINES.length)];
    const vertical = i % 2 === 0;
    const along = -380 + rnd() * 760;
    const x = vertical ? road : along;
    const z = vertical ? along : road;
    g.traffic.push(makeVehicle('car', x, z, vertical ? (rnd() < 0.5 ? 0 : Math.PI) : (rnd() < 0.5 ? Math.PI / 2 : -Math.PI / 2), PARKED_COLOURS[i % PARKED_COLOURS.length], 'Traffic'));
    g.traffic[i].cruise = 7 + rnd() * 4;
    g.traffic[i].vertical = vertical;
    g.traffic[i].dir = rnd() < 0.5 ? 1 : -1;
  }
}

// Rotate a local offset (lx, lz) by the car's heading into world space.
export function rotOffset(lx, lz, heading) {
  const c = Math.cos(heading), s = Math.sin(heading);
  return [lx * c + lz * s, -lx * s + lz * c];
}

export function tryEnterVehicle(g) {
  const p = g.player;
  let best = null, bestD = TUNE.interactRange;
  for (const v of g.vehicles) {
    if (v.driver) continue;
    const d = Math.hypot(v.x - p.x, v.z - p.z);
    if (d < bestD) { bestD = d; best = v; }
  }
  if (!best) return null;
  p.inCar = best;
  best.driver = 'player';
  p.x = best.x; p.z = best.z;
  showToast(g, `Driving the ${best.name}`);
  return best;
}

export function exitVehicle(g) {
  const p = g.player;
  const car = p.inCar;
  if (!car) return false;
  car.driver = null;
  p.inCar = null;
  // Step out to the side of the car (a clear spot).
  const [ox, oz] = rotOffset(2.5, 0, car.heading);
  let ex = car.x + ox, ez = car.z + oz;
  if (isBlocked(g.city, ex, ez)) { ex = car.x - ox; ez = car.z - oz; }
  p.x = ex; p.z = ez;
  return true;
}

// Drive the car the player is in. W accelerates, S brakes or
// reverses, A/D steer. A building stop damages the condition.
export function stepPlayerCar(g, dt, input) {
  const p = g.player;
  const car = p.inCar;
  if (!car) return;
  const maxSpeed = car.kind === 'bike' ? TUNE.bikeMaxSpeed : (car.kind === 'boat' ? TUNE.boatMaxSpeed : (car.kind === 'plane' ? TUNE.planeMaxSpeed : TUNE.carMaxSpeed));
  const accel = axis(input, 'KeyS', 'KeyW');
  if (accel > 0) car.speed += TUNE.carAccel * dt;
  else if (accel < 0) car.speed -= TUNE.carBrake * dt;
  else {
    // Gentle rolling friction (the car coasts).
    car.speed -= car.speed * 0.3 * dt;
    if (Math.abs(car.speed) < 0.1) car.speed = 0;
  }
  if (car.speed > maxSpeed) car.speed = maxSpeed;
  if (car.speed < -maxSpeed * 0.4) car.speed = -maxSpeed * 0.4;
  const steer = axis(input, 'KeyA', 'KeyD');
  if (steer !== 0 && Math.abs(car.speed) > 0.5) {
    car.heading += steer * TUNE.carSteer * dt * Math.sign(car.speed) * Math.min(1, Math.abs(car.speed) / 10);
  }
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  if (isBlocked(g.city, nx, nz)) {
    if (Math.abs(car.speed) > 3) {
      car.condition = Math.max(0, car.condition - 5);
      showToast(g, 'Crash! Condition -5');
    }
    car.speed = 0;
  } else {
    car.x = nx; car.z = nz;
  }
  p.x = car.x; p.z = car.z;
  p.heading = car.heading;
}

// Traffic: cars drive along their road and stop at red lights.
// The axis and direction come from the car's heading (a car
// created with makeVehicle has no `vertical` flag): heading ~0
// or ~PI moves along z (a vertical road, x is the road line);
// heading ~±PI/2 moves along x (a horizontal road).
export function stepTraffic(g, dt) {
  for (const car of g.traffic) {
    const h = car.heading || 0;
    // Which axis does this car travel on?
    const alongZ = Math.abs(Math.cos(h)) > Math.abs(Math.sin(h));
    const dir = alongZ ? Math.sign(Math.cos(h)) || 1 : Math.sign(Math.sin(h)) || 1;
    // The next intersection ahead (the next road line on this axis).
    const pos = alongZ ? car.z : car.x;
    let nextLine = null;
    for (const r of ROAD_LINES) {
      if (dir > 0 && r > pos + 1) { nextLine = r; break; }
      if (dir < 0 && r < pos - 1) nextLine = r; // keeps the largest one below pos
    }
    let stop = false;
    if (nextLine !== null) {
      const distTo = Math.abs(nextLine - pos);
      if (distTo < 14) {
        // Find the light at this intersection (snap the cross axis).
        for (const tl of g.city.trafficLights) {
          const cross = alongZ ? tl.x : tl.z;
          const along = alongZ ? tl.z : tl.x;
          if (Math.abs(cross - (alongZ ? car.x : car.z)) < 7 && Math.abs(along - nextLine) < 7) {
            if (lightState(tl, g.time) === 'red') { stop = true; break; }
          }
        }
      }
    }
    if (stop) { car.speed = 0; continue; }
    car.speed = car.cruise || 8;
    const step = car.speed * dt * dir;
    if (alongZ) {
      car.z += step;
      if (car.z > 390) car.z = -390;
      if (car.z < -390) car.z = 390;
      car.x = nearestRoad(car.x);
    } else {
      car.x += step;
      if (car.x > 390) car.x = -390;
      if (car.x < -390) car.x = 390;
      car.z = nearestRoad(car.z);
    }
  }
}

function nearestRoad(v) {
  let best = ROAD_LINES[0], bd = Infinity;
  for (const r of ROAD_LINES) {
    const d = Math.abs(r - v);
    if (d < bd) { bd = d; best = r; }
  }
  return best;
}

// Push overlapping cars apart.
export function stepCarCollisions(g, dt) {
  const cars = g.vehicles.concat(g.traffic);
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      const dx = b.x - a.x, dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      if (d < 3 && d > 0.001) {
        const push = (3 - d) / 2;
        const nx = dx / d, nz = dz / d;
        a.x -= nx * push; a.z -= nz * push;
        b.x += nx * push; b.z += nz * push;
      }
    }
  }
}

// Draw a car. Returns 8 (the base part count); the batch gets 9
// base boxes (body, skirt, cabin, glass, detail, 4 wheels) plus
// near-LOD extras (hubcaps, bumpers, mirrors, lights).
export function vehicleBoxes(g, car, batch, camera) {
  const h = car.heading || 0;
  const cx = car.x, cz = car.z;
  const isSports = car.name === 'Solmar Comet' || car.name === 'Palm GT';
  const isTaxi = car.kind === 'taxi';
  // LOD is by distance from the viewpoint: the camera target when a
  // camera is given, otherwise the player (a null camera is NOT
  // automatically near — a car 300 m from the player is far).
  const refX = camera ? (camera.tx ?? camera.x ?? 0) : (g.player ? g.player.x : 0);
  const refZ = camera ? (camera.tz ?? camera.z ?? 0) : (g.player ? g.player.z : 0);
  const near = Math.hypot(refX - cx, refZ - cz) < 40;
  const bodyCol = car.color;
  const plain = [0, 0, 1, 1];
  // 0 — body: 5.0 long (local Z) x 2.4 wide x 0.9 tall, base 0.55.
  pushBoxRot(batch, cx, 0.55, cz, 2.4, 0.9, 5.0, h, bodyCol, plain);
  // 1 — skirt (lower trim).
  pushBoxRot(batch, cx, 0.35, cz, 2.2, 0.3, 4.6, h, [0.12, 0.12, 0.14], plain);
  // 2 — cabin: light silver, base exactly on the body top (1.45).
  pushBoxRot(batch, cx, 1.45, cz, 2.0, 0.7, 3.0, h, [0.88, 0.89, 0.92], plain);
  // 3 — glass band on the cabin.
  pushBoxRot(batch, cx, 1.55, cz, 2.05, 0.5, 3.05, h, [0.35, 0.6, 0.9], plain);
  // 4 — detail: spoiler (sports) / roof sign (taxi) / antenna.
  // Exactly ONE box here, so the wheels land at indices 5-8.
  if (isSports) {
    const [rx, rz] = rotOffset(0, -2.2, h);
    pushBoxRot(batch, cx + rx, 2.0, cz + rz, 2.0, 0.15, 0.5, h, [0.1, 0.1, 0.12], plain);
  } else if (isTaxi) {
    pushBoxRot(batch, cx, 2.2, cz, 1.2, 0.35, 0.5, h, [1, 0.95, 0.3], plain);
  } else {
    pushBoxRot(batch, cx, 2.2, cz, 0.3, 0.3, 0.3, h, [0.2, 0.2, 0.25], plain);
  }
  // 5-8 — wheels: black, minY 0, at the four corners.
  const wheelSpots = [[-1.15, 1.7], [1.15, 1.7], [-1.15, -1.7], [1.15, -1.7]];
  for (const [lx, lz] of wheelSpots) {
    const [wx, wz] = rotOffset(lx, lz, h);
    pushBoxRot(batch, cx + wx, 0, cz + wz, 0.35, 0.9, 0.9, h, [0.08, 0.08, 0.1], plain);
  }
  if (near) {
    // Hubcaps (light) on each wheel's outer face.
    for (const [lx, lz] of wheelSpots) {
      const [wx, wz] = rotOffset(lx * 1.05, lz, h);
      pushBoxRot(batch, cx + wx, 0.3, cz + wz, 0.1, 0.3, 0.3, h, [0.85, 0.85, 0.9], plain);
    }
    // Bumpers.
    const [fx, fz] = rotOffset(0, 2.55, h);
    const [bx, bz] = rotOffset(0, -2.55, h);
    pushBoxRot(batch, cx + fx, 0.4, cz + fz, 2.3, 0.35, 0.3, h, [0.75, 0.75, 0.8], plain);
    pushBoxRot(batch, cx + bx, 0.4, cz + bz, 2.3, 0.35, 0.3, h, [0.75, 0.75, 0.8], plain);
    // Mirrors.
    const [m1x, m1z] = rotOffset(-1.25, 1.0, h);
    const [m2x, m2z] = rotOffset(1.25, 1.0, h);
    pushBoxRot(batch, cx + m1x, 1.5, cz + m1z, 0.2, 0.2, 0.3, h, bodyCol, plain);
    pushBoxRot(batch, cx + m2x, 1.5, cz + m2z, 0.2, 0.2, 0.3, h, bodyCol, plain);
    // Headlights + taillights.
    const [h1x, h1z] = rotOffset(-0.8, 2.5, h);
    const [h2x, h2z] = rotOffset(0.8, 2.5, h);
    pushBoxRot(batch, cx + h1x, 0.9, cz + h1z, 0.4, 0.25, 0.15, h, [1, 0.95, 0.7], plain);
    pushBoxRot(batch, cx + h2x, 0.9, cz + h2z, 0.4, 0.25, 0.15, h, [1, 0.95, 0.7], plain);
    const [t1x, t1z] = rotOffset(-0.8, -2.5, h);
    const [t2x, t2z] = rotOffset(0.8, -2.5, h);
    pushBoxRot(batch, cx + t1x, 0.9, cz + t1z, 0.4, 0.25, 0.15, h, [0.9, 0.1, 0.1], plain);
    pushBoxRot(batch, cx + t2x, 0.9, cz + t2z, 0.4, 0.25, 0.15, h, [0.9, 0.1, 0.1], plain);
  }
  return 8;
}
