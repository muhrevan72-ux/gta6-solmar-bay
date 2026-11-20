// Solmar Bay — vehicles and traffic.
//
// The starter is a Solmar Comet; the fleet also holds a bike, a boat,
// a plane and the fire truck. Traffic drives the road grid and stops
// at red lights. vehicleBoxes always returns 8 (the base boxes);
// near LOD (< 80 m) adds flat quads for hubcaps, glass, bumpers and
// mirrors, so a near car has more triangles than a far one.

import { TUNE, COL, SPAWNS } from './config.js';
import { isBlocked, isOnRoad, ROAD_LINES, lightState } from './world.js';
import { axis } from './input.js';
import { pushBox, pushBoxRot, pushQuad } from './render.js';

const DIMS = {
  car: { w: 1.9, l: 4.4, h: 1.4 },
  sports: { w: 1.9, l: 4.2, h: 1.2 },
  bike: { w: 0.8, l: 2.0, h: 1.1 },
  boat: { w: 2.2, l: 6.0, h: 1.5 },
  plane: { w: 8.0, l: 10.0, h: 2.5 },
  truck: { w: 2.5, l: 7.0, h: 3.0 },
  taxi: { w: 1.9, l: 4.4, h: 1.4 },
};

export function makeVehicle(kind, x, z, heading, color, name) {
  const d = DIMS[kind] || DIMS.car;
  return {
    kind, x, z, y: 0, heading: heading || 0,
    color: color || [0.5, 0.5, 0.5],
    name: name || 'Car',
    speed: 0,
    maxSpeed: kind === 'bike' ? TUNE.bikeMaxSpeed : TUNE.carMaxSpeed,
    condition: 100,
    driver: null,
    owned: false,
    w: d.w, l: d.l, h: d.h,
  };
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PARKED_NAMES = [
  'Palm GT', 'Bay Cruiser', 'Neon Runner', 'Coral Coupe', 'Sunset Sedan',
  'Harbour Van', 'Downtown Taxi', 'Beach Buggy', 'Airport Shuttle', 'Vice Van',
  'Solmar Comet', 'Palm GT', 'Bay Cruiser', 'Neon Runner', 'Coral Coupe',
];
const PARKED_COLOURS = [
  [0.8, 0.2, 0.2], [0.2, 0.4, 0.8], [0.9, 0.8, 0.2], [0.3, 0.7, 0.4],
  [0.7, 0.3, 0.8], [0.85, 0.5, 0.2], [0.6, 0.6, 0.65], [0.2, 0.8, 0.8],
];

export function spawnVehicles(g) {
  const rng = mulberry32(20261120);
  const list = [];
  // The starter, right by the player spawn.
  list.push(makeVehicle('sports', 0, 24, 0, [0.9, 0.2, 0.2], 'Solmar Comet'));
  list.push(makeVehicle('bike', 10, 24, 0, [0.2, 0.5, 0.9], 'Palm Bike'));
  list.push(makeVehicle('boat', -360, 60, Math.PI / 2, [0.9, 0.9, 0.95], 'Bay Boat'));
  list.push(makeVehicle('plane', 300, -240, 0, [0.85, 0.85, 0.9], 'Solmar Jet'));
  list.push(makeVehicle('truck', SPAWNS.fireStation.x + 10, SPAWNS.fireStation.z, 0, [0.85, 0.2, 0.15], 'Fire Truck'));
  // 31 parked cars along the roads (off the asphalt, clear of walls).
  let parked = 0;
  let guard = 0;
  while (parked < 31 && guard++ < 500) {
    const line = ROAD_LINES[Math.floor(rng() * ROAD_LINES.length)];
    const along = -280 + rng() * 560;
    const side = rng() < 0.5 ? -8 : 8;
    const onX = rng() < 0.5;
    const x = onX ? line + side : along;
    const z = onX ? along : line + side;
    if (g.city && isBlocked(g.city, x, z)) continue;
    if (Math.hypot(x, z - 20) < 8) continue; // keep the spawn clear
    const kind = rng() < 0.15 ? 'sports' : 'car';
    const name = PARKED_NAMES[parked % PARKED_NAMES.length];
    list.push(makeVehicle(kind, x, z, rng() * Math.PI * 2, PARKED_COLOURS[Math.floor(rng() * PARKED_COLOURS.length)], name));
    parked++;
  }
  g.vehicles = list;
  // 32 traffic cars, spread over the road grid.
  const traffic = [];
  for (let i = 0; i < 32; i++) {
    const onX = i % 2 === 0;
    const line = ROAD_LINES[Math.floor(rng() * ROAD_LINES.length)];
    const along = -280 + rng() * 560;
    const dir = rng() < 0.5 ? 1 : -1;
    let v;
    if (onX) {
      v = makeVehicle('car', line, along, dir > 0 ? 0 : Math.PI, PARKED_COLOURS[i % PARKED_COLOURS.length], 'Traffic');
      v.road = { axis: 'x', line };
    } else {
      v = makeVehicle('car', along, line, dir > 0 ? Math.PI / 2 : -Math.PI / 2, PARKED_COLOURS[i % PARKED_COLOURS.length], 'Traffic');
      v.road = { axis: 'z', line };
    }
    v.dir = dir;
    v.speed = 6 + rng() * 4;
    v.driver = 'npc';
    traffic.push(v);
  }
  g.traffic = traffic;
}

// Drive the car the player is in. W accelerates, S brakes and then
// reverses, A/D steer. A wall stops the car and dents it.
export function stepPlayerCar(g, dt, input) {
  const v = g.player.inCar;
  if (!v) return;
  const fwd = -axis(input, 'KeyW', 'KeyS'); // W -> +1
  const steer = axis(input, 'KeyA', 'KeyD'); // D -> +1
  const max = v.maxSpeed || TUNE.carMaxSpeed;
  if (fwd > 0) v.speed = Math.min(max, v.speed + 14 * dt);
  else if (fwd < 0) v.speed = Math.max(-8, v.speed - 18 * dt);
  else v.speed *= Math.max(0, 1 - dt * 0.8);
  if (Math.abs(v.speed) > 0.5) v.heading += steer * 1.6 * dt * Math.sign(v.speed);
  const nx = v.x + Math.sin(v.heading) * v.speed * dt;
  const nz = v.z + Math.cos(v.heading) * v.speed * dt;
  if (g.city && isBlocked(g.city, nx, nz)) {
    v.condition = Math.max(0, v.condition - 10);
    v.speed *= 0.3;
  } else {
    v.x = nx; v.z = nz;
  }
  // The player rides along.
  g.player.x = v.x;
  g.player.z = v.z;
  g.player.heading = v.heading;
  g.player.speed = Math.abs(v.speed);
}

// Traffic: keep to the road, stop at a red light ahead, U-turn at
// the edge of the map. A car with no road yet infers one from its
// position and heading (a hand-built test car has none).
export function stepTraffic(g, dt) {
  for (const v of g.traffic) {
    if (!v.road) {
      const nearX = Math.abs(v.x - Math.round(v.x / 60) * 60) <= 6;
      const nearZ = Math.abs(v.z - Math.round(v.z / 60) * 60) <= 6;
      if (nearX) {
        v.road = { axis: 'x', line: Math.round(v.x / 60) * 60 };
        v.dir = Math.cos(v.heading || 0) >= 0 ? 1 : -1;
      } else if (nearZ) {
        v.road = { axis: 'z', line: Math.round(v.z / 60) * 60 };
        v.dir = Math.sin(v.heading || 0) >= 0 ? 1 : -1;
      } else {
        continue;
      }
    }
    const ahead = v.dir > 0 ? 1 : -1;
    // Is there a red light ahead on this road?
    let stop = false;
    if (g.city && g.city.lights) {
      for (const light of g.city.lights) {
        let d = 0;
        if (v.road.axis === 'x') {
          if (Math.abs(light.x - v.x) > 3) continue;
          d = (light.z - v.z) * ahead;
        } else {
          if (Math.abs(light.z - v.z) > 3) continue;
          d = (light.x - v.x) * ahead;
        }
        if (d > 0 && d < 15 && lightState(light, g.time) === 'red') { stop = true; break; }
      }
    }
    // Ease toward the cruising speed, or toward 0 at a red light.
    const target = stop ? 0 : 8;
    if (v.speed < target) v.speed = Math.min(target, v.speed + 4 * dt);
    else if (v.speed > target) v.speed = Math.max(target, v.speed - 10 * dt);
    if (stop && v.speed < 0.5) v.speed = 0;
    const step = v.speed * dt;
    if (v.road.axis === 'x') {
      v.z += (v.dir > 0 ? 1 : -1) * step;
      v.x = v.road.line;
      if (v.z > 300) { v.z = 300; v.dir = -1; v.heading = Math.PI; }
      if (v.z < -300) { v.z = -300; v.dir = 1; v.heading = 0; }
    } else {
      v.x += (v.dir > 0 ? 1 : -1) * step;
      v.z = v.road.line;
      if (v.x > 300) { v.x = 300; v.dir = -1; v.heading = -Math.PI / 2; }
      if (v.x < -300) { v.x = -300; v.dir = 1; v.heading = Math.PI / 2; }
    }
  }
}

// Push overlapping cars apart so none end up inside another.
export function stepCarCollisions(g, dt) {
  const all = [...(g.vehicles || []), ...(g.traffic || []), ...(g.copCars || [])];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i];
      const b = all[j];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      const min = 3;
      if (d < min) {
        let ux = 1;
        let uz = 0;
        if (d > 0.001) { ux = dx / d; uz = dz / d; }
        const push = (min - d) / 2;
        a.x -= ux * push; a.z -= uz * push;
        b.x += ux * push; b.z += uz * push;
      }
    }
  }
}

// The vehicle model: 8 boxes (body, cabin, hood, trunk, two bumpers,
// two mirrors). Near LOD adds flat quads — hubcaps, glass, bumper
// and mirror detail — plus a spoiler on sports cars and a roof sign
// on taxis. The return value is always the 8 base boxes.
export function vehicleBoxes(g, v, b, camera) {
  const ref = camera || g.player;
  const d = ref ? Math.hypot(v.x - (ref.x || 0), v.z - (ref.z || 0)) : 0;
  const near = d < 80;
  const y = v.y || 0;
  const body = v.color;
  const glass = COL.glass;
  const dark = [0.12, 0.12, 0.14];
  let n = 0;
  const put = (x, yy, z, w, h, dd, col) => { pushBoxRot(b, x, yy, z, w, h, dd, v.heading, col); n++; };
  const hw = v.w / 2;
  const hl = v.l / 2;
  put(v.x, y + 0.35, v.z, v.w, 0.7, v.l, body); // body
  put(v.x, y + 0.9, v.z - v.l * 0.05, v.w * 0.85, 0.6, v.l * 0.5, body); // cabin
  put(v.x, y + 0.55, v.z + hl * 0.8, v.w * 0.9, 0.35, 0.5, body); // hood
  put(v.x, y + 0.55, v.z - hl * 0.8, v.w * 0.9, 0.35, 0.5, body); // trunk
  put(v.x, y + 0.3, v.z + hl, v.w, 0.3, 0.25, dark); // front bumper
  put(v.x, y + 0.3, v.z - hl, v.w, 0.3, 0.25, dark); // rear bumper
  put(v.x - hw, y + 0.95, v.z + v.l * 0.1, 0.15, 0.15, 0.3, dark); // left mirror
  put(v.x + hw, y + 0.95, v.z + v.l * 0.1, 0.15, 0.15, 0.3, dark); // right mirror
  if (near) {
    const fx = Math.sin(v.heading);
    const fz = Math.cos(v.heading);
    const rx = Math.cos(v.heading);
    const rz = -Math.sin(v.heading);
    // Hubcaps: a bright quad on each wheel.
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const wx = v.x + rx * sx * hw + fx * sz * hl * 0.6;
      const wz = v.z + rz * sx * hw + fz * sz * hl * 0.6;
      pushQuad(b,
        [wx - 0.25, y + 0.35, wz - 0.25], [wx + 0.25, y + 0.35, wz - 0.25],
        [wx + 0.25, y + 0.35, wz + 0.25], [wx - 0.25, y + 0.35, wz + 0.25],
        [0.85, 0.85, 0.9]);
    }
    // Windshield + rear glass, and bumper highlights.
    const wf = { x: v.x + fx * hl * 0.35, z: v.z + fz * hl * 0.35 };
    pushQuad(b,
      [wf.x - hw * 0.8, y + 1.05, wf.z - 0.1], [wf.x + hw * 0.8, y + 1.05, wf.z - 0.1],
      [wf.x + hw * 0.8, y + 1.25, wf.z + 0.1], [wf.x - hw * 0.8, y + 1.25, wf.z + 0.1],
      glass);
    const wb = { x: v.x - fx * hl * 0.35, z: v.z - fz * hl * 0.35 };
    pushQuad(b,
      [wb.x - hw * 0.8, y + 1.05, wb.z + 0.1], [wb.x + hw * 0.8, y + 1.05, wb.z + 0.1],
      [wb.x + hw * 0.8, y + 1.25, wb.z - 0.1], [wb.x - hw * 0.8, y + 1.25, wb.z - 0.1],
      glass);
    // Spoiler on sports cars, roof sign on taxis.
    if (v.name === 'Solmar Comet' || v.name === 'Palm GT') {
      pushQuad(b,
        [v.x - hw, y + 1.25, v.z - hl], [v.x + hw, y + 1.25, v.z - hl],
        [v.x + hw, y + 1.35, v.z - hl - 0.4], [v.x - hw, y + 1.35, v.z - hl - 0.4],
        dark);
    }
    if (v.kind === 'taxi') {
      pushQuad(b,
        [v.x - 0.5, y + 1.5, v.z - 0.2], [v.x + 0.5, y + 1.5, v.z - 0.2],
        [v.x + 0.5, y + 1.8, v.z + 0.2], [v.x - 0.5, y + 1.8, v.z + 0.2],
        [1, 0.85, 0.1]);
    }
  }
  return n;
}
