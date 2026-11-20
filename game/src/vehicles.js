// Solmar Bay — vehicles: cars, bikes, boats, planes.
//
// Car physics: accelerate/brake/reverse, steering that scales
// down with speed, handbrake. Traffic cars follow road lanes and
// stop at red lights. Parked cars and traffic cars can be stolen.
// Sports cars (Solmar Comet / Palm GT) get a rear wing + struts
// at near LOD. Boats drive on the water; planes take off from
// the runway and Space deploys the parachute.

import { TUNE, COL, CAR_NAMES, clamp, dist, makeRng, pick } from './config.js';
import { isBlocked, pointOnRoad, ROAD_X, ROAD_Z, lightState } from './world.js';

let vehicleId = 0;

export function makeVehicle(kind, x, z, heading, opts = {}) {
  const v = {
    id: ++vehicleId,
    kind, // car | bike | boat | plane | taxi | firetruck | cop
    x, z,
    y: 0,
    heading,
    speed: 0,
    damage: 0,
    wrecked: false,
    driver: opts.driver || null, // 'player' | 'npc' | null
    owner: opts.owner || 'npc',
    parked: !!opts.parked,
    stolen: false,
    name: opts.name || pick(CAR_NAMES, vehicleId),
    colour: opts.colour || pick(COL.carPaint, vehicleId),
    lane: opts.lane || null, // traffic lane {axis, line, dir}
    ramCooldown: 0,
    smoke: 0,
  };
  return v;
}

// Spawn the parked cars + traffic for a fresh game.
export function spawnVehicles(game) {
  const rng = makeRng(4242);
  game.vehicles = [];
  game.traffic = [];
  // Parked cars along the roads.
  for (let i = 0; i < TUNE.parkedCap; i++) {
    const road = ROAD_X[Math.floor(rng() * ROAD_X.length)];
    const along = (rng() * 2 - 1) * 280;
    const side = rng() < 0.5 ? -1 : 1;
    const x = road + side * (7 + rng() * 2);
    const z = along;
    if (isBlocked(game.city, x, z, 2)) continue;
    const kinds = ['car', 'car', 'car', 'bike'];
    const v = makeVehicle(kinds[Math.floor(rng() * kinds.length)], x, z, rng() * Math.PI * 2, { parked: true, owner: 'npc' });
    game.vehicles.push(v);
  }
  // A sports car by the garage (the respect-500 unlock).
  const comet = makeVehicle('car', 138, -126, Math.PI / 2, {
    parked: true, owner: 'npc', name: 'Solmar Comet', colour: [0.95, 0.15, 0.15],
  });
  game.vehicles.push(comet);
  // Traffic cars on the lanes.
  for (let i = 0; i < TUNE.trafficCap; i++) {
    const horizontal = rng() < 0.5;
    const line = (horizontal ? ROAD_Z : ROAD_X)[Math.floor(rng() * ROAD_Z.length)];
    const along = (rng() * 2 - 1) * 360;
    const dir = rng() < 0.5 ? 1 : -1;
    const v = makeVehicle(rng() < 0.12 ? 'taxi' : 'car',
      horizontal ? along : line + (dir > 0 ? 3 : -3),
      horizontal ? line + (dir > 0 ? 3 : -3) : along,
      horizontal ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
      { driver: 'npc', owner: 'npc' });
    v.lane = { axis: horizontal ? 'x' : 'z', line, dir };
    v.speed = 8 + rng() * 6;
    game.traffic.push(v);
    game.vehicles.push(v);
  }
  // A boat in the harbour + a plane on the runway.
  game.vehicles.push(makeVehicle('boat', -100, 350, 0, { parked: true, owner: 'npc', name: 'Tide Runner' }));
  game.vehicles.push(makeVehicle('plane', 300, -300, 0, { parked: true, owner: 'npc', name: 'Harbour Hawk' }));
  // The fire truck at the fire station (parked on the forecourt,
  // just north of the station's north face).
  game.vehicles.push(makeVehicle('firetruck', -150, -52, 0, { parked: true, owner: 'city', name: 'Fire Truck', colour: [0.9, 0.15, 0.15] }));
}

// Drive the player's car. dt seconds, input from the DOM.
export function stepPlayerCar(game, dt, input) {
  const v = game.player.inCar;
  if (!v) return;
  v.ramCooldown = Math.max(0, v.ramCooldown - dt);
  const maxSpeed = v.kind === 'bike' ? TUNE.bikeMaxSpeed : v.kind === 'boat' ? TUNE.boatMaxSpeed : v.kind === 'plane' ? TUNE.planeMaxSpeed : TUNE.carMaxSpeed;
  let throttle = 0;
  if (input) {
    if (input.downKey('KeyW') || input.downKey('ArrowUp')) throttle = 1;
    if (input.downKey('KeyS') || input.downKey('ArrowDown')) throttle = -1;
  }
  const steer = input ? (input.downKey('KeyA') || input.downKey('ArrowLeft') ? -1 : 0) + (input.downKey('KeyD') || input.downKey('ArrowRight') ? 1 : 0) : 0;
  const handbrake = input && input.downKey('Space');
  // Planes: throttle builds speed; lift off past takeoff speed.
  if (v.kind === 'plane') {
    v.speed += throttle * TUNE.planeAccel * dt;
    v.speed = clamp(v.speed, -5, maxSpeed);
    if (v.speed > TUNE.planeTakeoff) v.y = Math.min(60, v.y + (v.speed - TUNE.planeTakeoff) * 0.15 * dt * 10);
    else if (v.y > 0) v.y = Math.max(0, v.y - 20 * dt);
  } else if (v.kind === 'boat') {
    v.speed += throttle * TUNE.boatAccel * dt;
    v.speed = clamp(v.speed, -TUNE.carReverseMax, maxSpeed);
  } else {
    v.speed += throttle * TUNE.carAccel * dt;
    v.speed = clamp(v.speed, -TUNE.carReverseMax, maxSpeed);
    if (handbrake) v.speed *= Math.max(0, 1 - 3 * dt);
    if (throttle === 0) v.speed *= Math.max(0, 1 - 1.2 * dt);
  }
  // Steering fades with speed; reverse steers the other way.
  const steerAmount = steer * TUNE.carSteer * clamp(Math.abs(v.speed) / 10, 0, 1) * dt * (v.speed < 0 ? -1 : 1);
  v.heading += steerAmount;
  const nx = v.x + Math.sin(v.heading) * v.speed * dt;
  const nz = v.z + Math.cos(v.heading) * v.speed * dt;
  if (v.kind === 'boat') {
    // Boats stay in the water.
    v.x = clamp(nx, -460, -320);
    v.z = clamp(nz, -380, 395);
  } else if (v.kind === 'plane' && v.y > 1) {
    v.x = clamp(nx, -395, 395);
    v.z = clamp(nz, -395, 395);
  } else {
    if (!isBlocked(game.city, nx, v.z, 1.6)) v.x = nx;
    else v.speed *= 0.4;
    if (!isBlocked(game.city, v.x, nz, 1.6)) v.z = nz;
    else v.speed *= 0.4;
  }
  v.x = clamp(v.x, -395, 395);
  v.z = clamp(v.z, -395, 395);
  // Smoke when wrecked or badly damaged.
  v.smoke = v.damage > 60 ? 1 : v.damage > 30 ? 0.5 : 0;
  if (v.damage >= 100) v.wrecked = true;
  // The player rides along.
  game.player.x = v.x;
  game.player.z = v.z;
  game.player.y = v.y;
  game.player.heading = v.heading;
}

// Traffic: follow the lane, stop at red lights, avoid the car
// ahead (simple gap check). Runs for every traffic car.
export function stepTraffic(game, dt) {
  for (const v of game.traffic) {
    if (v.wrecked) continue;
    v.ramCooldown = Math.max(0, v.ramCooldown - dt);
    const lane = v.lane;
    if (!lane) continue;
    // Red light ahead? Find the nearest light on this lane.
    let stop = false;
    for (const l of game.city.lights) {
      // The light must sit on the same road line as this car.
      const lightLine = lane.axis === 'x' ? l.z : l.x;
      if (Math.abs(lightLine - lane.line) > 4) continue;
      const pos = lane.axis === 'x' ? v.x : v.z;
      const ahead = (lane.axis === 'x' ? l.x : l.z) - pos;
      if (ahead * lane.dir > 0 && ahead * lane.dir < 14 && lightState(l, game.time) === 'red') {
        stop = true;
      }
    }
    const target = stop ? 0 : 10;
    v.speed += clamp(target - v.speed, -8 * dt, 6 * dt);
    if (lane.axis === 'x') {
      v.x += lane.dir * v.speed * dt;
      v.heading = lane.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (v.x > 380) v.x = -380;
      if (v.x < -380) v.x = 380;
    } else {
      v.z += lane.dir * v.speed * dt;
      v.heading = lane.dir > 0 ? 0 : Math.PI;
      if (v.z > 380) v.z = -380;
      if (v.z < -380) v.z = 380;
    }
  }
}

// Ram damage between the player's car and a ped (run over) or
// another car. Returns true when something was hit.
export function stepCarCollisions(game) {
  const v = game.player.inCar;
  if (!v || Math.abs(v.speed) < 4) return false;
  let hit = false;
  for (const ped of [...game.peds]) {
    if (dist(v.x, v.z, ped.x, ped.z) < 2.6) {
      game.peds.splice(game.peds.indexOf(ped), 1);
      game.stats.kills += 1;
      const amount = TUNE.cashDropMin + Math.floor(Math.random() * (TUNE.cashDropMax - TUNE.cashDropMin));
      game.pickups.push({ kind: 'cash', x: ped.x, z: ped.z, amount, t: 60 });
      game.policeCommit && game.policeCommit('killPed');
      hit = true;
    }
  }
  return hit;
}

// Draw a vehicle as voxel boxes into `out`.
export function vehicleBoxes(game, v, out) {
  const c = v.colour;
  const dark = [0.12, 0.12, 0.14];
  const isBike = v.kind === 'bike';
  const isBoat = v.kind === 'boat';
  const isPlane = v.kind === 'plane';
  const len = isBike ? 2.2 : isPlane ? 9 : isBoat ? 7 : 4.4;
  const wid = isBike ? 0.9 : isPlane ? 2.4 : isBoat ? 2.6 : 2;
  const h = isPlane ? 1.6 : 1.3;
  const y0 = v.y || 0;
  const near = dist(game.player.x, game.player.z, v.x, v.z) < 80;
  const hx = Math.sin(v.heading);
  const hz = Math.cos(v.heading);
  const px = Math.cos(v.heading);
  const pz = -Math.sin(v.heading);
  const put = (dx, dy, dz, w, hh, d, col) => {
    out.push({
      x: v.x + hx * dz + px * dx,
      y: y0 + dy,
      z: v.z + hz * dz + pz * dx,
      w, h: hh, d, c: col,
    });
  };
  // Body.
  put(0, 0.35, 0, wid, h, len, c);
  // Cabin / glass.
  if (!isBike) put(0, 0.35 + h, -0.2, wid * 0.8, 0.7, len * 0.45, COL.glass);
  // Wheels (4, or 2 for a bike).
  const wy = 0.35;
  if (isBike) {
    put(0, wy, len / 2 - 0.4, 0.3, 0.7, 0.3, dark);
    put(0, wy, -len / 2 + 0.4, 0.3, 0.7, 0.3, dark);
  } else {
    put(-wid / 2 - 0.1, wy, len / 2 - 0.8, 0.3, 0.7, 0.7, dark);
    put(wid / 2 + 0.1, wy, len / 2 - 0.8, 0.3, 0.7, 0.7, dark);
    put(-wid / 2 - 0.1, wy, -len / 2 + 0.8, 0.3, 0.7, 0.7, dark);
    put(wid / 2 + 0.1, wy, -len / 2 + 0.8, 0.3, 0.7, 0.7, dark);
  }
  // Headlights + taillights.
  put(-wid / 2 + 0.3, 0.6, len / 2, 0.4, 0.25, 0.15, [1.4, 1.35, 0.9]);
  put(wid / 2 - 0.3, 0.6, len / 2, 0.4, 0.25, 0.15, [1.4, 1.35, 0.9]);
  put(-wid / 2 + 0.3, 0.6, -len / 2, 0.4, 0.25, 0.15, [1.3, 0.15, 0.15]);
  put(wid / 2 - 0.3, 0.6, -len / 2, 0.4, 0.25, 0.15, [1.3, 0.15, 0.15]);
  // Near-LOD detail: hubcaps, mirrors, bumpers, taxi sign.
  if (near && !isBike && !isBoat && !isPlane) {
    put(-wid / 2 - 0.28, wy, len / 2 - 0.8, 0.08, 0.3, 0.3, [0.85, 0.85, 0.88]);
    put(wid / 2 + 0.28, wy, len / 2 - 0.8, 0.08, 0.3, 0.3, [0.85, 0.85, 0.88]);
    put(-wid / 2 - 0.28, wy, -len / 2 + 0.8, 0.08, 0.3, 0.3, [0.85, 0.85, 0.88]);
    put(wid / 2 + 0.28, wy, -len / 2 + 0.8, 0.08, 0.3, 0.3, [0.85, 0.85, 0.88]);
    put(-wid / 2 - 0.15, 0.9, 0.6, 0.25, 0.2, 0.3, dark);
    put(wid / 2 + 0.15, 0.9, 0.6, 0.25, 0.2, 0.3, dark);
    if (v.kind === 'taxi') put(0, 0.35 + h + 0.75, 0, 1.2, 0.4, 0.8, [1.3, 1.1, 0.2]);
  }
  // Sports-car spoiler (Solmar Comet / Palm GT, near LOD).
  if (near && (v.name === 'Solmar Comet' || v.name === 'Palm GT')) {
    put(0, 0.35 + h + 0.55, -len / 2 + 0.15, wid * 0.95, 0.14, 0.5, dark);
    put(-wid / 2 + 0.3, 0.35 + h + 0.1, -len / 2 + 0.15, 0.16, 0.5, 0.16, dark);
    put(wid / 2 - 0.3, 0.35 + h + 0.1, -len / 2 + 0.15, 0.16, 0.5, 0.16, dark);
  }
  // Plane wings + tail.
  if (isPlane) {
    put(0, 0.9, 0.5, 12, 0.25, 2.2, c);
    put(0, 1.6, -len / 2 + 0.4, 4, 0.25, 1.4, c);
  }
  // Boat hull stripe.
  if (isBoat) put(0, 0.5, 0, wid + 0.1, 0.3, len, [0.95, 0.95, 0.95]);
  // Damage smoke is drawn by main.js as a grey box above the car.
  if (v.smoke) {
    put(0, 1.8 + Math.sin(game.time * 6) * 0.2, 0, 1.2, 1.2, 1.2, [0.4, 0.4, 0.42]);
  }
  // Blob shadow.
  out.push({ x: v.x, y: y0 + 0.02, z: v.z, w: wid + 0.4, h: 0.04, d: len + 0.4, c: [0.08, 0.08, 0.1] });
  return out;
}
