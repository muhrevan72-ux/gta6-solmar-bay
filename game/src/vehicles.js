// Solmar Bay — vehicles, traffic, driving.
// Written fresh for rebuild #18. The starter Comet sits at
// (-25, 20); the bike is vehicles[0] (8 boxes). Spawning is
// deterministic (fixed seeds) so respawnWorld rebuilds the exact
// boot-time world.

import { mulberry32, COL, SPAWNS, TUNE } from './config.js';
import { isBlocked, isOnRoad, ROAD_LINES, lightState } from './world.js';
import { BoxBatch, pushBox, pushBoxRot } from './render.js';

const PLAIN_UV = [0, 0, 1, 1];

export function makeVehicle(kind, x, z, heading, color, name) {
  const v = {
    kind, x, z, heading,
    color: color || [0.8, 0.2, 0.2],
    name: name || 'Car',
    condition: 100,
    driver: null,
    owned: false,
    speed: 0,
  };
  v.colour = v.color;
  return v;
}

const PARKED_NAMES = [
  'Palm GT', 'Sunset Coupe', 'Bay Cruiser', 'Neon Hatch', 'Coral Sedan',
  'Vice Van', 'Turbo GT', 'Ocean Roadster', 'Golden Hour', 'Harbor Taxi',
  'Midnight Run', 'Coral Coupe', 'Beach Buggy', 'Downtown LX', 'Neon GT',
  'Palm Cruiser', 'Sunset LX', 'Bay GT', 'Coral Run', 'Vice Coupe',
];
const PARKED_COLORS = [
  [0.9, 0.3, 0.3], [0.3, 0.5, 0.9], [0.9, 0.7, 0.2], [0.2, 0.8, 0.5],
  [0.8, 0.4, 0.8], [0.9, 0.9, 0.9], [0.2, 0.2, 0.25], [0.5, 0.7, 0.9],
  [0.9, 0.5, 0.2], [0.4, 0.6, 0.4],
];

export function spawnVehicles(g) {
  const rng = mulberry32(99);
  const vehicles = [];
  // [0] the bike — 8 boxes.
  vehicles.push(makeVehicle('bike', 30, 70, 0, [0.2, 0.6, 0.9], 'Street Bike'));
  // The starter Comet.
  vehicles.push(makeVehicle('car', -25, 20, 0, [0.85, 0.2, 0.25], 'Solmar Comet'));
  // 31 parked cars on the streets.
  let placed = 0;
  let guard = 0;
  while (placed < 31 && guard < 500) {
    guard++;
    const onXRoad = rng() > 0.5;
    const road = ROAD_LINES[1 + Math.floor(rng() * (ROAD_LINES.length - 2))];
    const along = -300 + rng() * 600;
    const side = rng() > 0.5 ? 4 : -4;
    let x, z, heading;
    if (onXRoad) { x = along; z = road + side; heading = rng() > 0.5 ? Math.PI / 2 : -Math.PI / 2; }
    else { x = road + side; z = along; heading = rng() > 0.5 ? 0 : Math.PI; }
    if (Math.hypot(x - 0, z - 20) < 15) continue;
    if (Math.hypot(x + 25, z - 20) < 15) continue;
    if (Math.hypot(x - 30, z - 70) < 10) continue;
    if (isBlocked(g.city, x, z)) continue;
    const name = PARKED_NAMES[placed % PARKED_NAMES.length];
    const color = PARKED_COLORS[Math.floor(rng() * PARKED_COLORS.length)];
    vehicles.push(makeVehicle('car', Math.round(x), Math.round(z), heading, color, name));
    placed++;
  }
  // Boat, plane, fire truck.
  vehicles.push(makeVehicle('boat', -350, 180, Math.PI / 2, [0.9, 0.9, 0.95], 'Sea Ray'));
  vehicles.push(makeVehicle('plane', 300, -260, Math.PI / 2, [0.95, 0.95, 0.95], 'Skyhawk'));
  vehicles.push(makeVehicle('truck', SPAWNS.fireStation.x + 10, SPAWNS.fireStation.z, 0, [0.9, 0.15, 0.1], 'Fire Truck'));
  g.vehicles = vehicles;

  // 32 traffic cars cruising the roads.
  const trng = mulberry32(7);
  const traffic = [];
  for (let i = 0; i < 32; i++) {
    const onXRoad = trng() > 0.5;
    const road = ROAD_LINES[1 + Math.floor(trng() * (ROAD_LINES.length - 2))];
    const along = -300 + trng() * 600;
    let x, z, heading;
    if (onXRoad) { x = along; z = road; heading = trng() > 0.5 ? Math.PI / 2 : -Math.PI / 2; }
    else { x = road; z = along; heading = trng() > 0.5 ? 0 : Math.PI; }
    const t = makeVehicle('car', Math.round(x), Math.round(z), heading,
      PARKED_COLORS[Math.floor(trng() * PARKED_COLORS.length)], 'Traffic');
    t.speed = 8 + trng() * 7;
    traffic.push(t);
  }
  g.traffic = traffic;
  return vehicles;
}

// Rotate a local (lx, lz) offset by a heading into world space.
export function rotateOffset(lx, lz, heading) {
  const c = Math.cos(heading), s = Math.sin(heading);
  return { x: lx * c + lz * s, z: -lx * s + lz * c };
}

function carDetail(g, v, b, near) {
  const c = v.color;
  const h = v.heading;
  // [0] body: 5.0 long (Z) x 2.4 wide x 0.9 tall, base y 0.35.
  pushBoxRot(b, v.x, 0.35, v.z, 2.4, 0.9, 5.0, h, c, PLAIN_UV);
  if (!near) {
    // Far LOD: cabin + wheels only.
    pushBoxRot(b, v.x, 1.25, v.z - 0.3, 2.0, 0.7, 2.6, h, COL.cabinSilver, PLAIN_UV);
    for (const [lx, lz] of [[1.15, 1.7], [-1.15, 1.7], [1.15, -1.7], [-1.15, -1.7]]) {
      const o = rotateOffset(lx, lz, h);
      pushBoxRot(b, v.x + o.x, 0, v.z + o.z, 0.4, 0.9, 0.9, h, COL.wheelBlack, PLAIN_UV);
    }
    return 6;
  }
  // [1] lower skirt.
  pushBoxRot(b, v.x, 0.2, v.z, 2.2, 0.3, 4.6, h, [0.15, 0.15, 0.15], PLAIN_UV);
  // [2] cabin: light silver, base exactly on the body top.
  pushBoxRot(b, v.x, 1.25, v.z - 0.3, 2.0, 0.7, 2.6, h, COL.cabinSilver, PLAIN_UV);
  // [3] blue glass band on the cabin front.
  pushBoxRot(b, v.x, 1.4, v.z + 1.0, 1.8, 0.4, 0.15, h, COL.carGlass, PLAIN_UV);
  // [4] spoiler (sports cars) / roof detail.
  const sports = v.name === 'Solmar Comet' || v.name === 'Palm GT';
  if (sports) {
    pushBoxRot(b, v.x, 1.9, v.z - 2.3, 2.0, 0.15, 0.5, h, [0.1, 0.1, 0.1], PLAIN_UV);
  } else {
    pushBoxRot(b, v.x, 1.95, v.z - 0.3, 1.2, 0.12, 1.4, h, [0.2, 0.2, 0.22], PLAIN_UV);
  }
  // [5-8] wheels: big, black, at the corners, on the ground.
  for (const [lx, lz] of [[1.15, 1.7], [-1.15, 1.7], [1.15, -1.7], [-1.15, -1.7]]) {
    const o = rotateOffset(lx, lz, h);
    pushBoxRot(b, v.x + o.x, 0, v.z + o.z, 0.4, 0.9, 0.9, h, COL.wheelBlack, PLAIN_UV);
  }
  return 9;
}

function bikeDetail(g, v, b, near) {
  const h = v.heading;
  // Frame.
  pushBoxRot(b, v.x, 0.5, v.z, 0.5, 0.6, 1.8, h, v.color, PLAIN_UV);
  if (!near) {
    for (const lz of [0.7, -0.7]) {
      const o = rotateOffset(0, lz, h);
      pushBoxRot(b, v.x + o.x, 0, v.z + o.z, 0.2, 0.7, 0.7, h, COL.wheelBlack, PLAIN_UV);
    }
    return 3;
  }
  pushBoxRot(b, v.x, 1.1, v.z - 0.5, 0.4, 0.15, 0.6, h, [0.1, 0.1, 0.1], PLAIN_UV); // seat
  pushBoxRot(b, v.x, 1.0, v.z + 0.8, 0.5, 0.12, 0.2, h, [0.2, 0.2, 0.2], PLAIN_UV); // handlebars
  for (const lz of [0.7, -0.7]) {
    const o = rotateOffset(0, lz, h);
    pushBoxRot(b, v.x + o.x, 0, v.z + o.z, 0.2, 0.7, 0.7, h, COL.wheelBlack, PLAIN_UV);
  }
  pushBoxRot(b, v.x, 0.8, v.z + 0.9, 0.2, 0.2, 0.2, h, [1, 0.9, 0.6], PLAIN_UV); // headlight
  pushBoxRot(b, v.x, 0.4, v.z, 0.4, 0.4, 0.6, h, [0.3, 0.3, 0.32], PLAIN_UV); // engine
  pushBoxRot(b, v.x, 0.7, v.z + 0.7, 0.55, 0.1, 0.5, h, v.color, PLAIN_UV); // fender
  return 8;
}

function boatDetail(g, v, b, near) {
  const h = v.heading;
  pushBoxRot(b, v.x, 0.3, v.z, 2.2, 0.8, 6, h, v.color, PLAIN_UV);
  pushBoxRot(b, v.x, 1.1, v.z - 0.5, 1.6, 0.8, 2.2, h, COL.cabinSilver, PLAIN_UV);
  if (!near) return 2;
  pushBoxRot(b, v.x, 1.9, v.z - 0.5, 0.2, 1.2, 0.2, h, [0.2, 0.2, 0.2], PLAIN_UV);
  pushBoxRot(b, v.x, 0.3, v.z + 2.8, 1.8, 0.3, 0.6, h, [0.3, 0.3, 0.3], PLAIN_UV);
  return 4;
}

function planeDetail(g, v, b, near) {
  const h = v.heading;
  pushBoxRot(b, v.x, 0.5, v.z, 2.5, 1.5, 9, h, v.color, PLAIN_UV);
  pushBoxRot(b, v.x, 0.8, v.z, 12, 0.3, 2.5, h, v.color, PLAIN_UV);
  if (!near) return 2;
  pushBoxRot(b, v.x, 1.6, v.z - 3.5, 4, 0.3, 1.5, h, v.color, PLAIN_UV);
  pushBoxRot(b, v.x, 2.0, v.z - 3.5, 0.3, 1.2, 1.2, h, [0.8, 0.2, 0.2], PLAIN_UV);
  pushBoxRot(b, v.x, 0.8, v.z + 4.2, 0.6, 0.4, 0.6, h, COL.carGlass, PLAIN_UV);
  return 5;
}

function truckDetail(g, v, b, near) {
  const h = v.heading;
  pushBoxRot(b, v.x, 0.35, v.z, 2.4, 1.2, 6.5, h, v.color, PLAIN_UV);
  pushBoxRot(b, v.x, 1.55, v.z + 1.8, 2.2, 1.0, 2.0, h, COL.cabinSilver, PLAIN_UV);
  pushBoxRot(b, v.x, 1.7, v.z + 2.8, 1.8, 0.5, 0.15, h, COL.carGlass, PLAIN_UV);
  if (!near) {
    for (const [lx, lz] of [[1.15, 2.2], [-1.15, 2.2], [1.15, -2.2], [-1.15, -2.2]]) {
      const o = rotateOffset(lx, lz, h);
      pushBoxRot(b, v.x + o.x, 0, v.z + o.z, 0.4, 0.9, 0.9, h, COL.wheelBlack, PLAIN_UV);
    }
    return 7;
  }
  pushBoxRot(b, v.x, 1.6, v.z - 1.0, 1.0, 0.3, 4.5, h, [0.8, 0.8, 0.8], PLAIN_UV); // ladder
  for (const [lx, lz] of [[1.15, 2.2], [-1.15, 2.2], [1.15, -2.2], [-1.15, -2.2]]) {
    const o = rotateOffset(lx, lz, h);
    pushBoxRot(b, v.x + o.x, 0, v.z + o.z, 0.4, 0.9, 0.9, h, COL.wheelBlack, PLAIN_UV);
  }
  return 8;
}

// Draw a vehicle into a batch. Returns the box count. `cam` is the
// camera (or null); the LOD reference is the camera when given,
// otherwise the player. Near = full detail, far = reduced.
export function vehicleBoxes(g, v, b, cam) {
  const ref = cam && typeof cam.x === 'number'
    ? { x: cam.x, z: cam.z }
    : { x: g.player.x, z: g.player.z };
  const dist = Math.hypot(v.x - ref.x, v.z - ref.z);
  const near = dist < 100;
  if (v.kind === 'bike') return bikeDetail(g, v, b, near);
  if (v.kind === 'boat') return boatDetail(g, v, b, near);
  if (v.kind === 'plane') return planeDetail(g, v, b, near);
  if (v.kind === 'truck') return truckDetail(g, v, b, near);
  // Taxis are cars with a roof sign.
  const n = carDetail(g, v, b, near);
  if (v.kind === 'taxi' && near) {
    pushBoxRot(b, v.x, 1.95, v.z - 0.3, 1.0, 0.35, 0.6, v.heading, COL.taxiYellow, PLAIN_UV);
    return n + 1;
  }
  return n;
}

export function tryEnterVehicle(g) {
  let best = null;
  let bestD = 6;
  for (const v of g.vehicles) {
    if (v.driver) continue;
    const d = Math.hypot(v.x - g.player.x, v.z - g.player.z);
    if (d < bestD) { best = v; bestD = d; }
  }
  if (!best) return null;
  g.player.inCar = best;
  best.driver = 'player';
  g.player.x = best.x;
  g.player.z = best.z;
  g.player.heading = best.heading;
  return best;
}

export function exitVehicle(g) {
  const v = g.player.inCar;
  if (!v) return;
  v.driver = null;
  g.player.inCar = null;
  const spots = [
    [v.x + 3, v.z], [v.x - 3, v.z], [v.x, v.z + 3], [v.x, v.z - 3],
    [v.x + 3, v.z + 3], [v.x - 3, v.z - 3],
  ];
  for (const [x, z] of spots) {
    if (!isBlocked(g.city, x, z)) {
      g.player.x = x;
      g.player.z = z;
      return;
    }
  }
  g.player.x = v.x + 3;
  g.player.z = v.z;
}

// Drive the player's car for one step.
export function stepPlayerCar(g, dt, input) {
  if (g.player.eCooldown > 0) {
    g.player.eCooldown = Math.max(0, g.player.eCooldown - dt);
    if (g.player.eCooldown < 0.01) g.player.eCooldown = 0;
  }
  const v = g.player.inCar;
  if (!v) return;
  const fwd = input.down.has('KeyW') ? 1 : 0;
  const back = input.down.has('KeyS') ? 1 : 0;
  const steer = (input.down.has('KeyA') ? 1 : 0) - (input.down.has('KeyD') ? 1 : 0);
  const maxSpeed = v.kind === 'bike' ? TUNE.bikeMaxSpeed : TUNE.carMaxSpeed;
  if (fwd) v.speed += TUNE.carAccel * dt;
  else if (back) v.speed -= TUNE.carBrake * dt * 0.6;
  else v.speed -= Math.sign(v.speed) * 6 * dt;
  if (Math.abs(v.speed) < 0.05 && !fwd && !back) v.speed = 0;
  if (v.speed > maxSpeed) v.speed = maxSpeed;
  if (v.speed < -8) v.speed = -8;
  if (input.down.has('Space')) v.speed *= Math.max(0, 1 - 4 * dt);
  if (steer && Math.abs(v.speed) > 0.5) {
    v.heading += steer * 1.4 * dt * Math.min(1, Math.abs(v.speed) / 10) * Math.sign(v.speed);
  }
  const nx = v.x + Math.sin(v.heading) * v.speed * dt;
  const nz = v.z + Math.cos(v.heading) * v.speed * dt;
  if (isBlocked(g.city, nx, nz)) {
    if (Math.abs(v.speed) > 3) {
      v.condition = Math.max(0, v.condition - 8);
      v.speed = 0;
    } else {
      v.speed = 0;
    }
    return;
  }
  v.x = nx;
  v.z = nz;
  g.player.x = v.x;
  g.player.z = v.z;
  g.player.heading = v.heading;
}

// Traffic cruises the roads and stops at red / yellow lights.
export function stepTraffic(g, dt) {
  for (const t of g.traffic) {
    if (t.cruise === undefined) t.cruise = t.speed || 10;
    // Next intersection ahead (roads every 60 m).
    let fx = Math.sin(t.heading), fz = Math.cos(t.heading);
    let stop = false;
    for (let d = 4; d <= 14; d += 2) {
      const ax = t.x + fx * d, az = t.z + fz * d;
      const nearX = ROAD_LINES.some((r) => Math.abs(ax - r) < 3);
      const nearZ = ROAD_LINES.some((r) => Math.abs(az - r) < 3);
      if (nearX && nearZ) {
        const light = { offset: (Math.round(ax / 60) + Math.round(az / 60)) * 7 };
        const st = lightState(light, g.time || 0);
        if (st !== 'green') stop = true;
        break;
      }
    }
    if (stop) {
      t.speed = 0;
      continue;
    }
    t.speed = t.cruise;
    // Occasionally turn at an intersection — snap to the road grid
    // first so the car never drifts off-road.
    const atX = ROAD_LINES.some((r) => Math.abs(t.x - r) < 2);
    const atZ = ROAD_LINES.some((r) => Math.abs(t.z - r) < 2);
    if (atX && atZ && Math.random() < 0.02) {
      t.x = ROAD_LINES.reduce((a, b) => (Math.abs(b - t.x) < Math.abs(a - t.x) ? b : a));
      t.z = ROAD_LINES.reduce((a, b) => (Math.abs(b - t.z) < Math.abs(a - t.z) ? b : a));
      t.heading += Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2;
      fx = Math.sin(t.heading);
      fz = Math.cos(t.heading);
    }
    const nx = t.x + fx * t.speed * dt;
    const nz = t.z + fz * t.speed * dt;
    if (Math.abs(nx) > 350 || Math.abs(nz) > 350 || isBlocked(g.city, nx, nz)) {
      t.heading += Math.PI;
      continue;
    }
    t.x = nx;
    t.z = nz;
  }
}

// Push overlapping cars apart (they must end up > 1 m apart).
export function stepCarCollisions(g) {
  const all = [...g.vehicles, ...g.traffic];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i], b = all[j];
      const dx = b.x - a.x, dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      if (d < 3 && d > 0.001) {
        const push = (3 - d) / 2;
        const ux = dx / d, uz = dz / d;
        a.x -= ux * push; a.z -= uz * push;
        b.x += ux * push; b.z += uz * push;
      } else if (d <= 0.001) {
        a.x -= 1.6; b.x += 1.6;
      }
    }
  }
}
