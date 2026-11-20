// Solmar Bay — vehicles + traffic (rebuild #13).
import { isBlocked, isOnRoad, lightState } from './world.js';
import { axis } from './input.js';
import { pushBox, pushBoxRot } from './render.js';
import { TUNE, SPAWNS, COL } from './config.js';

export function makeVehicle(kind, x, z, heading, colour, name) {
  return {
    kind, x, z, heading, colour, name,
    speed: 0, condition: 100, driver: null, owned: false,
    road: null, line: 0,
  };
}

export function spawnVehicles(g) {
  const vs = [];
  // 31 parked cars (vehicles[0] is far from the spawn on purpose:
  // the vehicleBoxes suite expects the base 8-box LOD there).
  for (let i = 0; i < 31; i++) {
    const x = -300 + (i % 10) * 60;
    const z = -240 + Math.floor(i / 10) * 120 + 4;
    const cols = [[0.8, 0.2, 0.2], [0.2, 0.4, 0.8], [0.9, 0.85, 0.3], [0.3, 0.7, 0.4], [0.7, 0.7, 0.75]];
    vs.push(makeVehicle('car', x, z, (i % 4) * Math.PI / 2, cols[i % cols.length], 'Parked Car'));
  }
  // Starter sports car, bike, boat, plane, fire truck.
  vs.push(makeVehicle('sports', 10, 26, 0, [0.9, 0.15, 0.15], 'Solmar Comet'));
  vs.push(makeVehicle('bike', -12, 30, Math.PI / 2, [0.2, 0.6, 0.9], 'Solmar Bike'));
  vs.push(makeVehicle('boat', -340, 60, 0, [0.9, 0.9, 0.95], 'Solmar Boat'));
  vs.push(makeVehicle('plane', 300, -260, 0, [0.85, 0.85, 0.9], 'Solmar Jet'));
  vs.push(makeVehicle('truck', SPAWNS.fireStation.x + 10, SPAWNS.fireStation.z, 0, [0.85, 0.15, 0.1], 'Fire Truck'));
  g.vehicles = vs;
  // 32 traffic cars on the road grid.
  const tr = [];
  const lines = [-300, -180, -60, 60, 180, 300];
  for (let i = 0; i < 32; i++) {
    const line = lines[i % lines.length];
    const along = -300 + ((i * 37) % 600);
    const heading = i % 2 === 0 ? 0 : Math.PI;
    const v = makeVehicle('car', i % 2 === 0 ? line : along, i % 2 === 0 ? along : line, heading,
      [[0.6, 0.6, 0.65], [0.4, 0.4, 0.45], [0.8, 0.6, 0.3]][i % 3], 'Traffic');
    v.driver = 'npc';
    v.speed = 6 + (i % 4);
    v.road = i % 2 === 0 ? 'z' : 'x';
    v.line = line;
    tr.push(v);
  }
  g.traffic = tr;
}

export function stepPlayerCar(g, dt, input) {
  const v = g.player.inCar;
  if (!v) return;
  const maxSpeed = v.kind === 'bike' ? TUNE.bikeMaxSpeed : TUNE.carMaxSpeed;
  if (input.down.has('KeyW')) v.speed += TUNE.carAccel * dt;
  if (input.down.has('KeyS')) v.speed -= TUNE.carBrake * dt;
  if (v.speed > maxSpeed) v.speed = maxSpeed;
  if (v.speed < -8) v.speed = -8;
  const steer = axis(input, 'KeyA', 'KeyD');
  if (steer !== 0 && Math.abs(v.speed) > 0.5) {
    v.heading += steer * 0.9 * dt * Math.sign(v.speed);
  }
  const nx = v.x + Math.sin(v.heading) * v.speed * dt;
  const nz = v.z + Math.cos(v.heading) * v.speed * dt;
  if (g.city && isBlocked(g.city, nx, nz)) {
    v.condition = Math.max(0, v.condition - Math.abs(v.speed) * 0.5);
    v.speed = 0;
  } else {
    v.x = nx;
    v.z = nz;
  }
  if (Math.abs(v.speed) < 0.05 && !input.down.has('KeyW')) v.speed *= 0.9;
  g.player.x = v.x;
  g.player.z = v.z;
}

function nearestLightAhead(g, v) {
  let best = null;
  let bestD = 15;
  for (const l of g.city.lights) {
    let d;
    if (v.road === 'z') {
      if (Math.abs(l.x - v.x) > 8) continue;
      d = (l.z - v.z) * Math.cos(v.heading);
      if (d < 0 || d > bestD) continue;
    } else {
      if (Math.abs(l.z - v.z) > 8) continue;
      d = (l.x - v.x) * Math.sin(v.heading);
      if (d < 0 || d > bestD) continue;
    }
    bestD = d;
    best = l;
  }
  return best;
}

export function stepTraffic(g, dt) {
  for (const v of g.traffic) {
    // Infer the road from position + heading when unset.
    if (!v.road) {
      if (Math.abs(Math.sin(v.heading)) > Math.abs(Math.cos(v.heading))) {
        v.road = 'x';
        v.line = Math.round(v.z / 60) * 60;
      } else {
        v.road = 'z';
        v.line = Math.round(v.x / 60) * 60;
      }
    }
    // Red light ahead: stop.
    const light = g.city ? nearestLightAhead(g, v) : null;
    if (light && lightState(light, g.time) === 'red') {
      v.speed = Math.max(0, v.speed - 12 * dt);
    } else if (v.speed < 8) {
      v.speed = Math.min(8, v.speed + 4 * dt);
    }
    // Move along the road.
    if (v.road === 'z') {
      v.z += Math.cos(v.heading) * v.speed * dt;
      v.x = v.line;
    } else {
      v.x += Math.sin(v.heading) * v.speed * dt;
      v.z = v.line;
    }
    // Turn at an intersection, or wrap at the city edge.
    const along = v.road === 'z' ? v.z : v.x;
    if (Math.abs(along) > 360) {
      if (v.road === 'z') v.z = -Math.sign(along) * 360;
      else v.x = -Math.sign(along) * 360;
    } else if (Math.abs(along - Math.round(along / 60) * 60) < 1 && Math.random() < 0.08) {
      if (v.road === 'z') {
        v.road = 'x';
        v.line = Math.round(v.z / 60) * 60;
        v.heading = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        v.road = 'z';
        v.line = Math.round(v.x / 60) * 60;
        v.heading = Math.random() < 0.5 ? 0 : Math.PI;
      }
    }
  }
}

export function stepCarCollisions(g, dt) {
  const all = [...g.vehicles, ...g.traffic, ...(g.copCars || [])];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i], b = all[j];
      const dx = b.x - a.x, dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      if (d < 3.5 && d > 0.001) {
        const push = (3.5 - d) / 2;
        const nx = dx / d, nz = dz / d;
        a.x -= nx * push; a.z -= nz * push;
        b.x += nx * push; b.z += nz * push;
      }
    }
  }
}

// 8 base boxes: body, cabin, 4 wheels, bumper, glass.
// Near LOD (<40 m from the player): hubcaps, mirrors, roof sign / spoiler.
export function vehicleBoxes(g, v, b, cam) {
  const plain = [0, 0, 1, 1];
  const d = Math.hypot(v.x - g.player.x, v.z - g.player.z);
  const near = d < 40;
  let n = 0;
  const box = (x, y, z, w, h, dep, col, rot) => {
    if (rot) pushBoxRot(b, x, y, z, w, h, dep, rot, col, plain);
    else pushBox(b, x, y, z, w, h, dep, col, plain);
    n++;
  };
  const long = v.kind === 'truck' ? 6 : v.kind === 'boat' ? 6 : v.kind === 'plane' ? 8 : v.kind === 'bike' ? 2.2 : 4.4;
  const wide = v.kind === 'bike' ? 0.8 : 2;
  box(v.x, 0.4, v.z, wide, 0.9, long, v.colour, v.heading); // body
  box(v.x, 1.1, v.z, wide * 0.85, 0.7, long * 0.55, v.kind === 'truck' ? v.colour : COL.glass, v.heading); // cabin/glass
  const wy = 0.35;
  box(v.x - wide / 2, wy, v.z - long / 2 + 0.6, 0.3, 0.7, 0.7, [0.1, 0.1, 0.1], v.heading);
  box(v.x + wide / 2, wy, v.z - long / 2 + 0.6, 0.3, 0.7, 0.7, [0.1, 0.1, 0.1], v.heading);
  box(v.x - wide / 2, wy, v.z + long / 2 - 0.6, 0.3, 0.7, 0.7, [0.1, 0.1, 0.1], v.heading);
  box(v.x + wide / 2, wy, v.z + long / 2 - 0.6, 0.3, 0.7, 0.7, [0.1, 0.1, 0.1], v.heading);
  box(v.x, 0.5, v.z + long / 2, wide, 0.4, 0.3, [0.2, 0.2, 0.2], v.heading); // bumper
  box(v.x, 1.15, v.z, wide * 0.8, 0.5, long * 0.5, COL.glass, v.heading); // glass
  if (near) {
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      box(v.x + sx * wide / 2, 0.35, v.z + sz * (long / 2 - 0.6), 0.32, 0.3, 0.32, [0.8, 0.8, 0.85], v.heading);
    }
    box(v.x - wide / 2 - 0.2, 1.2, v.z, 0.2, 0.2, 0.4, [0.1, 0.1, 0.1], v.heading);
    box(v.x + wide / 2 + 0.2, 1.2, v.z, 0.2, 0.2, 0.4, [0.1, 0.1, 0.1], v.heading);
    if (v.kind === 'taxi') box(v.x, 1.9, v.z, 0.9, 0.3, 0.4, COL.taxiYellow, v.heading);
    if (v.kind === 'sports' || v.name === 'Solmar Comet') box(v.x, 1.3, v.z - long / 2, wide, 0.15, 0.5, [0.1, 0.1, 0.1], v.heading);
  }
  return n;
}
