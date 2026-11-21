// Solmar Bay — vehicles.
//
// 36 vehicles on the street (31 parked, the starter Comet, a bike, a
// boat, a plane, the fire truck) plus 32 traffic cars that follow the
// road grid and stop at red lights. A car reads as a car: a long low
// body, a light silver cabin with a blue glass band, and four big
// black wheels at the corners, protruding past the body sides.

import { TUNE, SPAWNS } from './config.js';
import { isBlocked, lightAt, lightState, ROAD_LINES } from './world.js';
import { mulberry32 } from './state.js';
import { pushBox, pushBoxRot } from './render.js';

export function makeVehicle(kind, x, z, heading, color, name) {
  return {
    kind,
    x,
    z,
    heading,
    color,
    name,
    condition: 100,
    driver: null,
    owned: false,
    speed: 0,
  };
}

const PARKED_COLOURS = [
  [0.85, 0.2, 0.25],
  [0.2, 0.4, 0.85],
  [0.9, 0.75, 0.2],
  [0.3, 0.7, 0.4],
  [0.9, 0.9, 0.9],
  [0.2, 0.2, 0.25],
  [0.85, 0.5, 0.7],
  [0.5, 0.8, 0.85],
];

export function spawnVehicles(g) {
  g.vehicles = [];
  g.traffic = [];
  const rng = mulberry32(99);

  // 31 parked cars along the roads. The first one is far from the
  // player spawn so vehicleBoxes' far-LOD test has a far car to use.
  const first = makeVehicle('car', 300, 300, 0, PARKED_COLOURS[0], 'Parked Car');
  g.vehicles.push(first);
  for (let i = 1; i < 31; i++) {
    const vertical = rng() < 0.5;
    const line = ROAD_LINES[1 + Math.floor(rng() * (ROAD_LINES.length - 2))];
    const along = -330 + rng() * 660;
    const side = (rng() < 0.5 ? -1 : 1) * 9;
    const x = vertical ? line + side : along;
    const z = vertical ? along : line + side;
    const heading = vertical ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    g.vehicles.push(makeVehicle(
      'car', x, z, heading,
      PARKED_COLOURS[i % PARKED_COLOURS.length],
      'Parked Car',
    ));
  }

  // The starter car: parked in the plaza just west of the spawn (13 m,
  // visible on load), facing down the avenue, ready to steal.
  const comet = makeVehicle('car', -13, 20, 0, [0.85, 0.2, 0.25], 'Solmar Comet');
  g.vehicles.push(comet);
  g.vehicles.push(makeVehicle('bike', 60, -40, Math.PI / 2, [0.2, 0.7, 0.9], 'Solmar Bike'));
  g.vehicles.push(makeVehicle('boat', -350, 150, 0, [0.9, 0.9, 0.9], 'Speedboat'));
  g.vehicles.push(makeVehicle('plane', 300, -260, Math.PI / 2, [0.9, 0.9, 0.92], 'Solmar Jet'));
  const truck = makeVehicle('truck', SPAWNS.fireStation.x + 10, SPAWNS.fireStation.z, 0, [0.9, 0.15, 0.15], 'Fire Truck');
  g.vehicles.push(truck);

  // 32 traffic cars cruising the grid.
  for (let i = 0; i < 32; i++) {
    const vertical = rng() < 0.5;
    const line = ROAD_LINES[1 + Math.floor(rng() * (ROAD_LINES.length - 2))];
    const along = -330 + rng() * 660;
    const heading = vertical
      ? (rng() < 0.5 ? 0 : Math.PI)
      : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const car = makeVehicle(
      'car',
      vertical ? line : along,
      vertical ? along : line,
      heading,
      PARKED_COLOURS[i % PARKED_COLOURS.length],
      'Traffic',
    );
    car.driver = 'traffic';
    car.speed = 6 + rng() * 4;
    car.targetSpeed = car.speed;
    g.traffic.push(car);
  }
  return g.vehicles;
}

export function nearestEnterableVehicle(g) {
  const p = g.player;
  let best = null;
  let bestD = 6;
  for (const v of g.vehicles) {
    if (v.driver) continue;
    const d = Math.hypot(v.x - p.x, v.z - p.z);
    if (d <= bestD) {
      best = v;
      bestD = d;
    }
  }
  return best;
}

// Drive the car the player is sitting in. A fresh W tap gives an
// immediate speed impulse (see TUNE.carTapImpulse) so the car moves on
// a tap, not only on a held key; holding W keeps accelerating.
export function stepPlayerCar(g, dt, input) {
  const p = g.player;
  const v = p.inCar;
  if (!v) return;
  const maxSpeed = v.kind === 'bike' ? TUNE.bikeMaxSpeed : TUNE.carMaxSpeed;

  if (input) {
    if (input.pressed && input.pressed.has('KeyW')) {
      v.speed += TUNE.carTapImpulse;
    }
    if (input.down.has('KeyW')) v.speed += TUNE.carAccel * dt;
    if (input.down.has('KeyS')) {
      if (v.speed > 0.5) v.speed -= TUNE.carBrake * dt;
      else v.speed -= TUNE.carAccel * 0.5 * dt;
    }
    if (!input.down.has('KeyW') && !input.down.has('KeyS')) {
      // Coast down.
      const decay = 3 * dt;
      if (Math.abs(v.speed) <= decay) v.speed = 0;
      else v.speed -= Math.sign(v.speed) * decay;
    }
    // Steering, stronger the faster the car goes.
    const steer = (input.down.has('KeyD') ? 1 : 0) - (input.down.has('KeyA') ? 1 : 0);
    if (steer !== 0 && v.speed !== 0) {
      v.heading += steer * 1.6 * dt * (v.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(v.speed) / 6);
    }
  }
  if (v.speed > maxSpeed) v.speed = maxSpeed;
  if (v.speed < -10) v.speed = -10;

  const nx = v.x + Math.sin(v.heading) * v.speed * dt;
  const nz = v.z + Math.cos(v.heading) * v.speed * dt;
  const city = g.city;
  if (city && isBlocked(city, nx, nz)) {
    // Hit a building: lose condition, stop dead.
    v.condition = Math.max(0, v.condition - (5 + Math.abs(v.speed) * 0.3));
    v.speed = 0;
    if (g.audio) g.audio.sfx('crash');
  } else {
    v.x = nx;
    v.z = nz;
    v.x = Math.max(-398, Math.min(398, v.x));
    v.z = Math.max(-398, Math.min(398, v.z));
  }
  p.x = v.x;
  p.z = v.z;
  p.heading = v.heading;
  if (g.audio) g.audio.engine(Math.abs(v.speed));
}

// Traffic follows the grid and stops at red lights.
export function stepTraffic(g, dt) {
  const city = g.city;
  for (const car of g.traffic) {
    // The next intersection ahead, along the car's heading.
    const h = car.heading;
    const sin = Math.sin(h);
    const cos = Math.cos(h);
    let stop = false;
    if (city) {
      // Find the road line the car is on and the next crossing.
      const movingZ = Math.abs(cos) > 0.5;
      if (movingZ) {
        const line = Math.round(car.x / 60) * 60;
        const next = cos > 0
          ? Math.ceil((car.z + 1) / 60) * 60
          : Math.floor((car.z - 1) / 60) * 60;
        const dist = Math.abs(next - car.z);
        if (dist > 0 && dist < 18) {
          const light = lightAt(city, line, next);
          if (light && lightState(light, g.time) === 'red') stop = true;
        }
      } else {
        const line = Math.round(car.z / 60) * 60;
        const next = sin > 0
          ? Math.ceil((car.x + 1) / 60) * 60
          : Math.floor((car.x - 1) / 60) * 60;
        const dist = Math.abs(next - car.x);
        if (dist > 0 && dist < 18) {
          const light = lightAt(city, next, line);
          if (light && lightState(light, g.time) === 'red') stop = true;
        }
      }
    }
    if (stop) {
      car.speed = 0;
      continue;
    }
    car.speed = car.targetSpeed || 8;
    const nx = car.x + sin * car.speed * dt;
    const nz = car.z + cos * car.speed * dt;
    // Never drive into the sea or off the map: turn around instead.
    if (nx < -330 || nx > 390 || nz < -390 || nz > 390) {
      car.heading += Math.PI;
      continue;
    }
    car.x = nx;
    car.z = nz;
  }
}

export function stepCarCollisions(g, dt) {
  const all = [...g.vehicles, ...g.traffic];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i];
      const b = all[j];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.01 && d < 2.5) {
        const push = (2.5 - d) / 2;
        const ux = dx / d;
        const uz = dz / d;
        a.x -= ux * push;
        a.z -= uz * push;
        b.x += ux * push;
        b.z += uz * push;
      }
    }
  }
}

// The car model. Box 0 is the body, 1 the underbody skirt, 2 the
// silver cabin (base exactly at the body top), 3 the blue glass band,
// 4 the headlight bar, 5-8 the four wheels. Near the player the model
// gains hubcaps, mirrors and bumpers; far away the headlight bar is
// skipped, so far cars draw exactly 8 boxes.
export function vehicleBoxes(g, v, b, cam) {
  const p = g.player;
  // Level of detail is the distance to the viewer: the camera when one
  // is given, otherwise the player. A null camera is NOT automatically
  // near — a car 300 m away is far even with no camera.
  const vx = cam ? (cam.x ?? cam.tx ?? p.x) : p.x;
  const vz = cam ? (cam.z ?? cam.tz ?? p.z) : p.z;
  const dist = Math.hypot(v.x - vx, v.z - vz);
  const near = dist < 40;
  const plain = [0, 0, 1, 1];
  const h = v.heading;
  let count = 0;
  const rot = (lx, lz) => {
    const cos = Math.cos(h);
    const sin = Math.sin(h);
    return [v.x + lx * cos + lz * sin, v.z - lx * sin + lz * cos];
  };

  if (v.kind === 'bike') {
    pushBoxRot(b, v.x, 0.35, v.z, 0.5, 0.5, 1.9, h, v.color, plain);
    pushBoxRot(b, v.x, 0.85, v.z, 0.4, 0.3, 0.5, h, [0.15, 0.15, 0.18], plain);
    for (const [lx, lz] of [[0, 0.7], [0, -0.7]]) {
      const [wx, wz] = rot(lx, lz);
      pushBox(b, wx, 0, wz, 0.25, 0.9, 0.25, [0.08, 0.08, 0.1], plain);
    }
    return 4;
  }
  if (v.kind === 'boat') {
    pushBoxRot(b, v.x, 0.3, v.z, 2.2, 0.8, 6, h, v.color, plain);
    let [bx, bz] = rot(0, -0.5);
    pushBoxRot(b, bx, 1.1, bz, 1.6, 0.7, 2.2, h, [0.88, 0.89, 0.92], plain);
    [bx, bz] = rot(0, -0.5);
    pushBoxRot(b, bx, 1.15, bz, 1.7, 0.4, 2.3, h, [0.35, 0.6, 0.9], plain);
    return 3;
  }
  if (v.kind === 'plane') {
    pushBoxRot(b, v.x, 1, v.z, 2.4, 1.6, 9, h, v.color, plain);
    pushBoxRot(b, v.x, 1.2, v.z, 12, 0.3, 2.2, h, [0.85, 0.85, 0.88], plain);
    let [px, pz] = rot(0, -4);
    pushBoxRot(b, px, 1.8, pz, 3, 1.2, 0.4, h, [0.85, 0.85, 0.88], plain);
    pushBoxRot(b, v.x, 2.6, v.z, 1.8, 0.6, 1.2, h, [0.88, 0.89, 0.92], plain);
    return 4;
  }

  // Body: 5.0 long, 2.4 wide, 0.9 tall, base at y=0.35.
  pushBoxRot(b, v.x, 0.35, v.z, 2.4, 0.9, 5.0, h, v.color, plain);
  count++;
  // Underbody skirt.
  pushBoxRot(b, v.x, 0.35, v.z, 2.0, 0.2, 4.6, h, [0.15, 0.15, 0.18], plain);
  count++;
  // Cabin: light silver roof, base exactly at the body top (1.25).
  // The cabin sits slightly back, so its centre is rotated with the car.
  let [cx, cz] = rot(0, -0.3);
  pushBoxRot(b, cx, 1.25, cz, 2.0, 0.55, 2.6, h, [0.88, 0.89, 0.92], plain);
  count++;
  // Blue glass band around the cabin, just above the body top.
  [cx, cz] = rot(0, -0.3);
  pushBoxRot(b, cx, 1.32, cz, 2.04, 0.35, 2.65, h, [0.35, 0.6, 0.9], plain);
  count++;
  // Headlight bar (skipped at far LOD).
  if (near) {
    [cx, cz] = rot(0, 2.4);
    pushBoxRot(b, cx, 0.9, cz, 2.2, 0.25, 0.3, h, [0.9, 0.9, 0.85], plain);
    count++;
  }
  // Four big wheels at the corners: black, y=0, protruding past the
  // body sides and below it. Local offsets (+-1.15, +-1.7) rotate with
  // the car's heading.
  for (const [lx, lz] of [[-1.15, 1.7], [1.15, 1.7], [-1.15, -1.7], [1.15, -1.7]]) {
    const [wx, wz] = rot(lx, lz);
    pushBox(b, wx, 0, wz, 0.4, 0.95, 0.95, [0.08, 0.08, 0.1], plain);
    count++;
  }

  if (near) {
    // Hubcaps, mirrors and bumpers.
    for (const [lx, lz] of [[-1.15, 1.7], [1.15, 1.7], [-1.15, -1.7], [1.15, -1.7]]) {
      const [wx, wz] = rot(lx, lz);
      pushBox(b, wx, 0.25, wz, 0.44, 0.5, 0.5, [0.85, 0.85, 0.88], plain);
      count++;
    }
    for (const sx of [-1, 1]) {
      const [wx, wz] = rot(sx * 1.15, 0.9);
      pushBox(b, wx, 1.3, wz, 0.25, 0.2, 0.35, [0.2, 0.2, 0.22], plain);
      count++;
    }
    for (const lz of [2.55, -2.55]) {
      [cx, cz] = rot(0, lz);
      pushBoxRot(b, cx, 0.4, cz, 2.3, 0.25, 0.3, h, [0.8, 0.8, 0.82], plain);
      count++;
    }
    if (v.kind === 'sports') {
      [cx, cz] = rot(0, -2.4);
      pushBoxRot(b, cx, 1.3, cz, 2.0, 0.12, 0.5, h, v.color, plain);
      count++;
    }
  }
  return count;
}
