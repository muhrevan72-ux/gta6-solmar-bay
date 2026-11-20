// Solmar Bay — vehicles and traffic (rebuild #14).
// 36 player-usable vehicles (31 parked + starter Comet + bike +
// boat + plane + fire truck) and 32 NPC traffic cars that stay on
// the road grid and stop at red lights.

import { TUNE, SPAWNS } from './config.js';
import { isBlocked, isOnRoad, lightState } from './world.js';
import { axis } from './input.js';
import { pushBox, pushBoxRot } from './render.js';
import { mulberry32 } from './state.js';

export function makeVehicle(kind, x, z, heading, color, name) {
  const maxSpeed = kind === 'bike' ? TUNE.bikeMaxSpeed : kind === 'boat' ? 22 : kind === 'plane' ? 45 : TUNE.carMaxSpeed;
  return {
    kind, x, z, heading: heading || 0, color, name: name || 'Car',
    speed: 0, condition: 100, driver: null, owned: false,
    maxSpeed, axis: 'z', road: x,
  };
}

const CAR_NAMES = ['Palm GT', 'Sunset Sedan', 'Coral Coupe', 'Bay Cruiser', 'Neon Hatch', 'Vice Van', 'Solmar Comet', 'Turbo Taxi', 'Harbor Hauler', 'Street Shark'];
const CAR_COLS = [
  [0.85, 0.2, 0.25], [0.2, 0.5, 0.9], [0.95, 0.8, 0.2], [0.3, 0.8, 0.4],
  [0.9, 0.5, 0.8], [0.5, 0.5, 0.55], [0.95, 0.6, 0.2], [0.2, 0.8, 0.8],
];

export function spawnVehicles(g) {
  const rng = mulberry32(2026);
  const vehicles = [];
  // The starter car: a Solmar Comet just west of the spawn, on
  // open ground in the spawn plaza (fix (g): reachable on foot).
  const starter = makeVehicle('car', -25, 20, 0, [0.85, 0.2, 0.25], 'Solmar Comet');
  vehicles.push(starter);
  // 31 parked cars on the roads and sidewalks.
  for (let i = 0; i < 31; i++) {
    const onXRoad = rng() < 0.5;
    const line = (Math.floor(rng() * 13) - 6) * 60;
    const along = -330 + rng() * 660;
    const x = onXRoad ? line + (rng() < 0.5 ? -8 : 8) : along;
    const z = onXRoad ? along : line + (rng() < 0.5 ? -8 : 8);
    if (Math.hypot(x - 0, z - 20) < 8) continue; // keep the spawn clear
    const col = CAR_COLS[Math.floor(rng() * CAR_COLS.length)];
    const name = CAR_NAMES[Math.floor(rng() * CAR_NAMES.length)];
    vehicles.push(makeVehicle('car', x, z, (rng() < 0.5 ? 0 : Math.PI / 2), col, name));
  }
  // Bike, boat, plane, fire truck.
  vehicles.push(makeVehicle('bike', 40, 20, 0, [0.2, 0.8, 0.3], 'Street Bike'));
  vehicles.push(makeVehicle('boat', -360, 60, 0, [0.9, 0.9, 0.95], 'Bay Boat'));
  vehicles.push(makeVehicle('plane', 300, -200, 0, [0.85, 0.85, 0.9], 'Sky Plane'));
  const ft = makeVehicle('car', SPAWNS.fireStation.x + 10, SPAWNS.fireStation.z, 0, [0.85, 0.15, 0.1], 'Fire Truck');
  vehicles.push(ft);
  g.vehicles = vehicles;
  // 32 traffic cars, each on a road line, driving along it.
  const traffic = [];
  for (let i = 0; i < 32; i++) {
    const onXRoad = rng() < 0.5;
    const line = (Math.floor(rng() * 13) - 6) * 60;
    const along = -330 + rng() * 660;
    const v = makeVehicle('car', onXRoad ? line : along, onXRoad ? along : line, rng() < 0.5 ? 0 : Math.PI, CAR_COLS[Math.floor(rng() * CAR_COLS.length)], 'Traffic');
    v.driver = 'npc';
    v.speed = 6 + rng() * 6;
    v.axis = onXRoad ? 'z' : 'x';
    v.road = line;
    // Heading: along the road. For a z-road (x=line), the car
    // drives in +-z; for an x-road (z=line), in +-x.
    v.heading = v.axis === 'z' ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    traffic.push(v);
  }
  g.traffic = traffic;
  if (!g.copCars) g.copCars = [];
  return vehicles;
}

export function stepPlayerCar(g, dt, input) {
  const p = g.player;
  const v = p.inCar;
  if (!v) return;
  const fwd = axis(input, 'KeyW', 'KeyS');
  if (fwd < 0) {
    v.speed = Math.min(v.maxSpeed, v.speed + 12 * dt);
  } else if (fwd > 0) {
    v.speed = Math.max(-8, v.speed - 15 * dt);
  } else {
    v.speed *= Math.max(0, 1 - 1.5 * dt);
    if (Math.abs(v.speed) < 0.1) v.speed = 0;
  }
  // Steering with A/D.
  const steer = axis(input, 'KeyA', 'KeyD');
  if (Math.abs(v.speed) > 0.5) {
    v.heading += steer * 1.6 * dt * Math.sign(v.speed);
  }
  const nx = v.x + Math.sin(v.heading) * v.speed * dt;
  const nz = v.z + Math.cos(v.heading) * v.speed * dt;
  if (isBlocked(g.city, nx, nz)) {
    // Hit a building: stop and take damage.
    v.condition = Math.max(0, v.condition - 10);
    v.speed = 0;
    return;
  }
  v.x = nx;
  v.z = nz;
  p.x = v.x;
  p.z = v.z;
  p.heading = v.heading;
}

// Find the traffic light ahead of a car (within 20 m, on its road).
function lightAhead(g, v) {
  if (!g.city || !g.city.lights) return null;
  const fx = Math.sin(v.heading);
  const fz = Math.cos(v.heading);
  let best = null;
  let bestD = 20;
  for (const l of g.city.lights) {
    const dx = l.x - v.x;
    const dz = l.z - v.z;
    const along = dx * fx + dz * fz;
    if (along < 0 || along > bestD) continue;
    const perp = Math.abs(dx * fz - dz * fx);
    if (perp > 8) continue;
    bestD = along;
    best = l;
  }
  return best;
}

export function stepTraffic(g, dt) {
  if (!g.traffic) return;
  for (const v of g.traffic) {
    // Red light ahead: brake hard.
    const light = lightAhead(g, v);
    if (light && lightState(light, g.time) === 'red') {
      v.speed = Math.max(0, v.speed - 12 * dt);
    } else if (v.speed < 10) {
      v.speed = Math.min(10, v.speed + 4 * dt);
    }
    const nx = v.x + Math.sin(v.heading) * v.speed * dt;
    const nz = v.z + Math.cos(v.heading) * v.speed * dt;
    // Turn around at the city edge.
    if (Math.abs(nx) > 370 || Math.abs(nz) > 370) {
      v.heading += Math.PI;
      continue;
    }
    // At an intersection, sometimes turn onto the cross road.
    const nearX = Math.abs(((nx % 60) + 60) % 60) < 3 || Math.abs(((nx % 60) + 60) % 60 - 60) < 3;
    const nearZ = Math.abs(((nz % 60) + 60) % 60) < 3 || Math.abs(((nz % 60) + 60) % 60 - 60) < 3;
    if (nearX && nearZ && g.rng && g.rng() < 0.02) {
      // Turn 90 degrees onto the cross road (still on a road).
      // The new road line is the coordinate along the new axis.
      v.heading += (g.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
      if (v.axis === 'z') {
        v.axis = 'x';
        v.road = Math.round(nz / 60) * 60;
      } else {
        v.axis = 'z';
        v.road = Math.round(nx / 60) * 60;
      }
    }
    v.x = nx;
    v.z = nz;
    // Snap the perpendicular coordinate to the road line so the
    // car never drifts off the road.
    if (v.axis === 'z') v.x = v.road;
    else v.z = v.road;
  }
}

export function stepCarCollisions(g, dt) {
  const all = [...(g.vehicles || []), ...(g.traffic || []), ...(g.copCars || [])];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i];
      const b = all[j];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      if (d < 3 && d > 0.001) {
        const push = (3 - d) / 2;
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

// A car is 8 base boxes. Near the camera it gains hubcaps,
// mirrors, headlights and (for sports cars) a spoiler.
export function vehicleBoxes(g, v, b, camera) {
  const near = !camera || Math.hypot((camera.x || 0) - v.x, (camera.z || 0) - v.z) < 40
    || Math.hypot(g.player.x - v.x, g.player.z - v.z) < 40;
  const yaw = v.heading || 0;
  const col = v.color || [0.5, 0.5, 0.5];
  const dark = [col[0] * 0.6, col[1] * 0.6, col[2] * 0.6];
  // Body and cabin.
  pushBoxRot(b, v.x, 0.35, v.z, 2, 0.7, 4.4, yaw, col);
  pushBoxRot(b, v.x, 1.05, v.z - 0.3, 1.7, 0.6, 2.2, yaw, dark);
  // Windshield (glass).
  pushBoxRot(b, v.x, 1.0, v.z + 0.9, 1.6, 0.5, 0.15, yaw, [0.4, 0.65, 0.85]);
  // Four wheels.
  for (const [sx, sz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    pushBoxRot(b, v.x + sx, 0.05, v.z + sz, 0.3, 0.7, 0.7, yaw, [0.1, 0.1, 0.1]);
  }
  // Bumper.
  pushBoxRot(b, v.x, 0.3, v.z + 2.2, 1.9, 0.3, 0.2, yaw, [0.7, 0.7, 0.72]);
  if (near) {
    // Hubcaps, mirrors, headlights.
    for (const [sx, sz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
      pushBoxRot(b, v.x + sx, 0.3, v.z + sz, 0.32, 0.3, 0.32, yaw, [0.85, 0.85, 0.88]);
    }
    pushBoxRot(b, v.x - 1.05, 1.1, v.z + 0.5, 0.15, 0.15, 0.3, yaw, [0.15, 0.15, 0.16]);
    pushBoxRot(b, v.x + 1.05, 1.1, v.z + 0.5, 0.15, 0.15, 0.3, yaw, [0.15, 0.15, 0.16]);
    pushBoxRot(b, v.x - 0.6, 0.6, v.z + 2.25, 0.4, 0.2, 0.1, yaw, [1, 0.95, 0.6]);
    pushBoxRot(b, v.x + 0.6, 0.6, v.z + 2.25, 0.4, 0.2, 0.1, yaw, [1, 0.95, 0.6]);
    if (v.name === 'Solmar Comet' || v.name === 'Palm GT') {
      pushBoxRot(b, v.x, 1.15, v.z - 2.1, 1.8, 0.12, 0.4, yaw, dark);
    }
  }
  return 8;
}
