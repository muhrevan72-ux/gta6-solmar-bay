// Solmar Bay — vehicles: parked cars, traffic, the player's car,
// the boat, the plane, the fire truck.

import { TUNE, SPAWNS, COL } from './config.js';
import { isBlocked, isOnRoad, ROAD_LINES, lightState } from './world.js';
import { pushBox } from './render.js';

const CAR_NAMES = [
  'Palm GT', 'Bay Cruiser', 'Sunset Sedan', 'Vice V8', 'Coral Coupe',
  'Harbour Hatch', 'Neon Runner', 'Tide Taxi', 'Palm Pickup', 'Solmar Comet',
  'Beach Buggy', 'Ocean GT', 'Downtown Duster', 'Sunset Sport', 'Coral Cab',
];

function nearestRoadLine(v) {
  let best = ROAD_LINES[0];
  let bd = Infinity;
  for (const l of ROAD_LINES) {
    const d = Math.abs(v - l);
    if (d < bd) {
      bd = d;
      best = l;
    }
  }
  return best;
}

export function makeVehicle(kind, x, z, heading, colour, name) {
  return {
    kind, x, z, heading, colour, name,
    speed: 0, condition: 100, driver: null, owned: false,
  };
}

export function spawnVehicles(g) {
  g.vehicles = [];
  g.traffic = [];
  // The starter car: a sports car parked near the player.
  const starter = makeVehicle('sports', 8, 20, Math.PI / 2, [0.9, 0.2, 0.2], 'Solmar Comet');
  starter.owned = true;
  g.vehicles.push(starter);
  // 31 parked cars along the road grid.
  for (let i = 0; i < 31; i++) {
    const line = ROAD_LINES[i % ROAD_LINES.length];
    const along = -270 + ((i * 37) % 540);
    const horizontal = i % 2 === 0;
    const x = horizontal ? along : line + 4;
    const z = horizontal ? line + 4 : along;
    const heading = horizontal ? (i % 4 === 0 ? Math.PI / 2 : -Math.PI / 2) : (i % 4 === 1 ? 0 : Math.PI);
    const name = CAR_NAMES[i % CAR_NAMES.length];
    const colour = COL.cars[i % COL.cars.length];
    g.vehicles.push(makeVehicle('car', x, z, heading, colour, name));
  }
  // The bike, the boat, the plane, the fire truck.
  g.vehicles.push(makeVehicle('bike', 12, 26, 0, [0.2, 0.6, 0.9], 'Palm Bike'));
  g.vehicles.push(makeVehicle('boat', -360, 120, Math.PI / 2, [0.9, 0.9, 0.95], 'Bay Runner'));
  g.vehicles.push(makeVehicle('plane', 300, -260, 0, [0.85, 0.85, 0.9], 'Solmar Jet'));
  const fireTruck = makeVehicle('truck', SPAWNS.fireStation.x + 10, SPAWNS.fireStation.z, 0, [0.9, 0.15, 0.15], 'Fire Truck');
  g.vehicles.push(fireTruck);
  // 32 traffic cars driving on the road grid.
  for (let i = 0; i < 32; i++) {
    const line = ROAD_LINES[i % ROAD_LINES.length];
    const along = -280 + ((i * 53) % 560);
    const horizontal = i % 2 === 0;
    const x = horizontal ? along : line;
    const z = horizontal ? line : along;
    const heading = horizontal ? (i % 4 < 2 ? Math.PI / 2 : -Math.PI / 2) : (i % 4 < 2 ? 0 : Math.PI);
    const car = makeVehicle('car', x, z, heading, COL.cars[i % COL.cars.length], CAR_NAMES[(i + 3) % CAR_NAMES.length]);
    car.speed = 6 + (i % 5);
    car.road = { axis: horizontal ? 'z' : 'x', line };
    g.traffic.push(car);
  }
}

// The player's car: W accelerates, S brakes/reverses, A/D steer,
// Space is the handbrake. A building stops the car and damages it.
export function stepPlayerCar(g, dt, input) {
  const car = g.player.inCar;
  if (!car) return;
  const maxSpeed = car.kind === 'bike' ? TUNE.bikeMaxSpeed : TUNE.carMaxSpeed;
  if (input.downKey('KeyW')) car.speed = Math.min(maxSpeed, car.speed + TUNE.carAccel * dt);
  if (input.downKey('KeyS')) car.speed = Math.max(-maxSpeed * 0.4, car.speed - TUNE.carAccel * dt);
  if (input.downKey('Space')) car.speed *= Math.max(0, 1 - dt * 3);
  if (!input.downKey('KeyW') && !input.downKey('KeyS')) car.speed *= Math.max(0, 1 - dt * 0.5);
  const turnDir = car.speed >= 0 ? 1 : -1;
  if (input.downKey('KeyA')) car.heading += TUNE.carTurn * dt * turnDir;
  if (input.downKey('KeyD')) car.heading -= TUNE.carTurn * dt * turnDir;
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  if (isBlocked(g.city, nx, nz)) {
    if (Math.abs(car.speed) > 5) {
      car.condition = Math.max(0, car.condition - 10);
      if (g.audio) g.audio.sfx('crash');
    }
    car.speed = 0;
  } else {
    car.x = nx;
    car.z = nz;
  }
  g.player.x = car.x;
  g.player.z = car.z;
  g.player.heading = car.heading;
  g.player.speed = Math.abs(car.speed);
  if (g.audio) g.audio.engine(car.speed);
}

// Traffic: each car follows its road line and stops at red lights.
// Cars without a `road` field get their road inferred from position
// + heading (round-10 bug: never skip a car for missing `road`).
export function stepTraffic(g, dt) {
  for (const car of g.traffic) {
    let axis;
    let line;
    if (car.road) {
      axis = car.road.axis;
      line = car.road.line;
    } else {
      const sh = Math.abs(Math.sin(car.heading));
      if (sh > 0.7) {
        axis = 'z';
        line = nearestRoadLine(car.z);
      } else {
        axis = 'x';
        line = nearestRoadLine(car.x);
      }
    }
    // Stop at a red light ahead (within 25 m, within 12 m lateral).
    let targetSpeed = 8;
    const t = g.time || 0;
    for (const light of g.city.lights) {
      if (lightState(light, t) !== 'red') continue;
      const dx = light.x - car.x;
      const dz = light.z - car.z;
      const fwd = Math.sin(car.heading) * dx + Math.cos(car.heading) * dz;
      const lat = Math.abs(Math.cos(car.heading) * dx - Math.sin(car.heading) * dz);
      if (fwd > 0 && fwd < 35 && lat < 12) {
        targetSpeed = 0;
        break;
      }
    }
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 2);
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    if (axis === 'x') car.x = line;
    else car.z = line;
    if (car.x > 310) car.x = -310;
    if (car.x < -310) car.x = 310;
    if (car.z > 310) car.z = -310;
    if (car.z < -310) car.z = 310;
  }
}

// Push overlapping cars apart so traffic never stacks.
// Includes cop cars (a collision with one shoves it too).
export function stepCarCollisions(g, dt) {
  const all = [...(g.vehicles || []), ...(g.traffic || []), ...(g.copCars || [])];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i];
      const b = all[j];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.01 && d < 4) {
        const push = (4 - d) / 2;
        const nx = dx / d;
        const nz = dz / d;
        a.x -= nx * push;
        a.z -= nz * push;
        b.x += nx * push;
        b.z += nz * push;
      }
    }
  }
}

// A car is 8 boxes at base LOD (body, cabin, 4 wheels, windshield,
// bumper). Near the camera/player it gains hubcaps, mirrors, lights
// and — for sports cars — a spoiler; taxis gain a roof sign.
export function vehicleBoxes(g, vehicle, batch, cam) {
  const px = cam ? cam.x : (g.player ? g.player.x : 0);
  const pz = cam ? cam.z : (g.player ? g.player.z : 0);
  const dist = Math.hypot(vehicle.x - px, vehicle.z - pz);
  // Near LOD is inside 6 m: the starter car (8 m from the player)
  // is base LOD (8 boxes), a car 5 m away gets the full detail.
  const near = dist < 6;
  const v = vehicle;
  const col = v.colour;
  let n = 0;
  const box = (x, y, z, w, h, d, c) => { pushBox(batch, x, y, z, w, h, d, c); n++; };
  const cos = Math.cos(v.heading);
  const sin = Math.sin(v.heading);
  // Local (dx right, dz forward) -> world. At heading 0 the car
  // faces +z, so local +z must map to world +z.
  const fwd = (dx, dz) => [v.x + dx * cos + dz * sin, v.z - dx * sin + dz * cos];
  // Body and cabin.
  const [bx, bz] = [v.x, v.z];
  box(bx, 0.3, bz, 2, 0.7, 4.4, col);
  box(bx, 0.9, bz - 0.3, 1.7, 0.6, 2.2, [0.2, 0.25, 0.35]);
  // 4 wheels.
  for (const [wx, wz] of [[-0.9, 1.4], [0.9, 1.4], [-0.9, -1.4], [0.9, -1.4]]) {
    const [px2, pz2] = fwd(wx, wz);
    box(px2, 0.1, pz2, 0.35, 0.6, 0.6, [0.1, 0.1, 0.1]);
  }
  // Windshield and bumper.
  const [wx1, wz1] = fwd(0, 1.1);
  box(wx1, 0.9, wz1, 1.6, 0.5, 0.15, [0.5, 0.7, 0.85]);
  const [wx2, wz2] = fwd(0, 2.2);
  box(wx2, 0.25, wz2, 2, 0.3, 0.2, [0.2, 0.2, 0.2]);
  if (near) {
    for (const [wx, wz] of [[-0.9, 1.4], [0.9, 1.4], [-0.9, -1.4], [0.9, -1.4]]) {
      const [px2, pz2] = fwd(wx, wz);
      box(px2, 0.15, pz2, 0.4, 0.4, 0.15, [0.8, 0.8, 0.8]);
    }
    for (const side of [-1, 1]) {
      const [mx, mz] = fwd(side * 1.1, 0.8);
      box(mx, 1.0, mz, 0.15, 0.2, 0.3, [0.15, 0.15, 0.15]);
      const [hx, hz] = fwd(side * 0.7, 2.25);
      box(hx, 0.55, hz, 0.3, 0.2, 0.1, [1, 0.95, 0.7]);
      const [tx, tz] = fwd(side * 0.7, -2.25);
      box(tx, 0.55, tz, 0.3, 0.2, 0.1, [0.9, 0.1, 0.1]);
    }
    if (v.kind === 'sports') {
      const [sx2, sz2] = fwd(0, -2.1);
      box(sx2, 1.1, sz2, 1.8, 0.1, 0.4, [0.1, 0.1, 0.1]);
    }
    if (v.kind === 'taxi') {
      box(v.x, 1.55, v.z, 0.9, 0.3, 0.5, [1, 0.85, 0.1]);
    }
  }
  return n;
}
