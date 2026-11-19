// Solmar Bay — vehicles: car physics, traffic AI, stealing, boats,
// bikes, the plane and the parachute.
//
// Cars: W/S accelerate / brake-reverse, A/D steer, Space handbrake.
// Eased acceleration and momentum (no stiff movement). Cars have
// speed, handling, damage and smoke when wrecked. Traffic cars follow
// road lanes and stop at red lights. Stealing a car is a crime
// (commitCrime 'stealCar', 1 star).

import { TUNE, CAR_NAMES, COL, clamp, dist2 } from './config.js';
import { collideCircle, isOnRoad } from './world.js';
import { commitCrime } from './police.js';
import { isDown } from './input.js';

let carSeq = 0;

export function makeVehicle(type, x, z, heading, rng) {
  const r = rng || Math.random;
  const name = type === 'taxi' ? 'Bay Taxi'
    : type === 'fire' ? 'Fire Truck'
    : type === 'police' ? 'Police Cruiser'
    : type === 'bike' ? 'Street Bike'
    : type === 'boat' ? 'Harbour Skiff'
    : type === 'plane' ? 'Bayliner Cessna'
    : CAR_NAMES[Math.floor(r() * CAR_NAMES.length)];
  const colour = type === 'taxi' ? [0.95, 0.8, 0.1]
    : type === 'fire' ? [0.9, 0.15, 0.15]
    : type === 'police' ? [0.1, 0.15, 0.25]
    : COL.carPaint[Math.floor(r() * COL.carPaint.length)];
  return {
    id: ++carSeq,
    type, // car | taxi | fire | police | bike | boat | plane
    name,
    x, z, heading: heading || 0,
    speed: 0, // signed, units/sec (forward positive)
    steer: 0,
    colour: [...colour],
    damage: 0, // 0..100, smoke above 60, wrecked at 100
    wheelSpin: 0,
    driver: null, // 'player' | 'traffic' | null (parked)
    lane: null, // traffic lane target {x, z} or null
    waitT: 0, // stopped at a red light
    flying: false,
    altitude: 0,
    parachute: false,
    ramT: 0, // police ram cooldown (seconds)
    reverseT: 0, // police back-off timer after a ram
  };
}

export function createVehicles(city, rng) {
  const list = [];
  const r = rng || Math.random;
  // Parked cars on streets (standable spots near roads).
  for (let i = 0; i < TUNE.parkedCap; i++) {
    const x = -350 + r() * 700;
    const z = -350 + r() * 700;
    if (!isOnRoad(x, z)) continue;
    if (collideCircle(city, x, z, 3)) continue;
    const v = makeVehicle('car', x, z, (r() * Math.PI * 2), r);
    v.driver = null;
    list.push(v);
  }
  // Traffic cars, driving the grid.
  for (let i = 0; i < TUNE.trafficCap; i++) {
    const line = [-300, -200, -100, 0, 100, 200, 300][Math.floor(r() * 7)];
    const along = -300 + r() * 600;
    const horiz = r() < 0.5;
    const v = makeVehicle('car', horiz ? along : line, horiz ? line : along, horiz ? (r() < 0.5 ? 0 : Math.PI) : (r() < 0.5 ? Math.PI / 2 : -Math.PI / 2), r);
    v.driver = 'traffic';
    v.speed = 8 + r() * 6;
    v.lane = { horiz, line, dir: r() < 0.5 ? 1 : -1 };
    list.push(v);
  }
  // Specials: taxi at the stand, fire truck at the station, a bike,
  // a boat in the harbour basin, the plane at the airport.
  const taxi = makeVehicle('taxi', 12, 56, 0, r);
  taxi.driver = null;
  list.push(taxi);
  const fire = makeVehicle('fire', 150, 112, 0, r);
  fire.driver = null;
  list.push(fire);
  const bike = makeVehicle('bike', -40, -106, Math.PI / 2, r);
  bike.driver = null;
  list.push(bike);
  const boat = makeVehicle('boat', 370, -100, 0, r);
  boat.driver = null;
  list.push(boat);
  const plane = makeVehicle('plane', 200, -320, Math.PI / 2, r);
  plane.driver = null;
  list.push(plane);
  return { list, trafficLights: null };
}

export function nearestVehicle(game, x, z, range) {
  let best = null;
  let bestD = range * range;
  for (const v of game.vehicles.list) {
    if (v.driver === 'player') continue;
    const d = dist2(x, z, v.x, v.z);
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  return best;
}

// Player enters a vehicle. Stealing a parked or NPC car is a crime;
// taking your own stored car (or the taxi/fire truck for a job) is
// still theft in the eyes of the law — the game charges it the same
// way, except vehicles the player already owns.
export function enterVehicle(game, v) {
  const s = game.state;
  if (!v || v.driver === 'player') return false;
  const wasParked = v.driver === null;
  const wasTraffic = v.driver === 'traffic';
  const owned = s.ownedCars.some((c) => c.id === v.id);
  // The cab dispatched to the player is not a steal: the player
  // called it, so getting in is the job starting.
  const dispatched = game.taxi && (game.taxi.arrived === v || game.taxi.dispatched === v);
  v.driver = 'player';
  s.player.inCar = v;
  if (!owned && !dispatched && (wasParked || wasTraffic)) commitCrime(game, 'stealCar');
  return true;
}

export function exitVehicle(game) {
  const s = game.state;
  const v = s.player.inCar;
  if (!v) return false;
  v.driver = null;
  v.speed = 0;
  s.player.inCar = null;
  // Step out beside the car.
  s.player.x = v.x - Math.sin(v.heading) * 3;
  s.player.z = v.z - Math.cos(v.heading) * 3;
  s.player.heading = v.heading;
  return true;
}

function carMaxSpeed(v) {
  if (v.type === 'bike') return TUNE.bikeMaxSpeed;
  if (v.type === 'boat') return TUNE.boatMaxSpeed;
  if (v.type === 'plane') return TUNE.planeMaxSpeed;
  return TUNE.carMaxSpeed;
}
function carAccel(v) {
  if (v.type === 'bike') return TUNE.bikeAccel;
  if (v.type === 'boat') return TUNE.boatAccel;
  if (v.type === 'plane') return TUNE.planeAccel;
  return TUNE.carAccel;
}

export function stepVehicles(game, dt) {
  const s = game.state;
  const city = game.city;
  const input = game.input;
  for (const v of game.vehicles.list) {
    if (v.driver === 'player') {
      stepPlayerCar(game, v, dt);
    } else if (v.driver === 'traffic') {
      stepTrafficCar(game, v, dt);
    }
    // Collision with buildings: slide along walls, take damage on a
    // hard hit.
    if (v.type !== 'boat' && v.type !== 'plane') {
      const hit = collideCircle(city, v.x, v.z, 2.2);
      if (hit) {
        if (Math.abs(v.speed) > 12) {
          v.damage = Math.min(100, v.damage + 8);
        }
        v.x = hit.x;
        v.z = hit.z;
        v.speed *= 0.5;
      }
    }
    v.wheelSpin += v.speed * dt * 2;
  }
  // Engine hum follows the driven car.
  if (s.player.inCar && game.audio) {
    const v = s.player.inCar;
    const norm = Math.abs(v.speed) / carMaxSpeed(v);
    if (game.audio.engineHum) game.audio.engineHum(game.audio, norm);
  }
}

function stepPlayerCar(game, v, dt) {
  const input = game.input;
  const accel = carAccel(v);
  const max = carMaxSpeed(v);
  if (isDown(input, 'KeyW') || isDown(input, 'ArrowUp')) {
    v.speed += accel * dt;
  } else if (isDown(input, 'KeyS') || isDown(input, 'ArrowDown')) {
    v.speed -= TUNE.carBrake * dt;
  } else {
    // Coast down gently.
    v.speed -= v.speed * 1.2 * dt;
  }
  if (isDown(input, 'Space')) v.speed -= v.speed * 4 * dt; // handbrake
  v.speed = clamp(v.speed, -TUNE.carReverseMax, max);
  const steerInput = (isDown(input, 'KeyA') || isDown(input, 'ArrowLeft') ? 1 : 0)
    - (isDown(input, 'KeyD') || isDown(input, 'ArrowRight') ? 1 : 0);
  const dir = v.speed >= 0 ? 1 : -1;
  v.heading += steerInput * TUNE.carSteer * dt * dir * clamp(Math.abs(v.speed) / 8, 0, 1);
  v.x += Math.sin(v.heading) * v.speed * dt;
  v.z += Math.cos(v.heading) * v.speed * dt;
  // Plane: take off past takeoff speed, pitch with W/S.
  if (v.type === 'plane') {
    if (Math.abs(v.speed) > TUNE.planeTakeoff && !v.flying) v.flying = true;
    if (v.flying) {
      v.altitude = clamp(v.altitude + (isDown(input, 'KeyW') ? 8 : isDown(input, 'KeyS') ? -8 : 0) * dt, 0, 120);
      if (v.altitude <= 0 && Math.abs(v.speed) < TUNE.planeTakeoff) v.flying = false;
    }
  }
  // Boat stays in the water: the harbour basin (x 340..400,
  // z -160..-40) or the beach water (x <= -330). The old clamp
  // (`x > -330 -> x = -330`) teleported a harbour boat to the beach
  // the moment the player drove it.
  if (v.type === 'boat') {
    if (v.x > 300) {
      v.x = clamp(v.x, 340, 400);
      v.z = clamp(v.z, -160, -40);
    } else if (v.x > -330) {
      v.x = -330;
    }
  }
  const s = game.state;
  s.player.x = v.x;
  s.player.z = v.z;
  s.player.heading = v.heading;
  s.player.speed = v.speed;
}

function stepTrafficCar(game, v, dt) {
  const city = game.city;
  // Red light ahead? Stop.
  if (v.lane) {
    const aheadX = v.x + Math.sin(v.heading) * 12;
    const aheadZ = v.z + Math.cos(v.heading) * 12;
    for (const tl of city.lights) {
      if (dist2(aheadX, aheadZ, tl.x, tl.z) < 100 && tl.state === 'red') {
        v.waitT = 0.5;
      }
    }
  }
  if (v.waitT > 0) {
    v.waitT -= dt;
    v.speed = Math.max(0, v.speed - 20 * dt);
  } else {
    v.speed += (10 - v.speed) * dt * 0.5;
  }
  v.x += Math.sin(v.heading) * v.speed * dt;
  v.z += Math.cos(v.heading) * v.speed * dt;
  // Wrap around the city edges so traffic never runs out.
  if (v.x > 380) v.x = -380;
  if (v.x < -380) v.x = 380;
  if (v.z > 380) v.z = -380;
  if (v.z < -380) v.z = 380;
}

// Damage a car (ramming, bombs, bullets). Wrecked cars smoke.
export function damageCar(game, v, n) {
  v.damage = Math.min(100, v.damage + n);
  if (v.damage >= 100 && v.driver === 'player') {
    // Wrecked under the player: force them out.
    exitVehicle(game);
  }
}

// Voxel boxes for one vehicle: body, cabin, 4 wheels with spin
// markers, headlights, taillights, door panels, blob shadow.
// `detail` (near vehicles only — the caller passes false past 80 m)
// adds hubcaps + orbiting wheel bolts, glass, bumpers and mirrors;
// far vehicles keep the cheap silhouette so the dynamic batch stays
// under its cap.
export function vehicleBoxes(v, out, detail) {
  const c = v.colour;
  const y = v.flying ? v.altitude : 0;
  const isBike = v.type === 'bike';
  const isBoat = v.type === 'boat';
  const isPlane = v.type === 'plane';
  const len = isBike ? 2.6 : isBoat ? 5 : isPlane ? 8 : 4.6;
  const wid = isBike ? 0.8 : isBoat ? 2.2 : isPlane ? 2 : 2;
  const h = isPlane ? 1.6 : 1.1;
  const near = detail !== false;
  const fx = Math.sin(v.heading);
  const fz = Math.cos(v.heading);
  const rx = Math.cos(v.heading);
  const rz = -Math.sin(v.heading);
  out.pushBoxRot(v.x, y + 0.7, v.z, wid, h, len, c, v.heading);
  // Cabin / cockpit.
  if (!isBike) {
    out.pushBoxRot(v.x, y + 1.5, v.z - (isPlane ? 1 : 0.4), wid * 0.8, 0.8, len * 0.45, [0.4, 0.65, 0.85], v.heading);
  }
  // Plane wings + tail fin (always — there is only one plane).
  if (isPlane) {
    out.pushBoxRot(v.x, y + 0.9, v.z, 9, 0.2, 2, c, v.heading);
    out.pushBoxRot(v.x - fx * 3.6, y + 1.6, v.z - fz * 3.6, 0.25, 1.4, 1.6, c, v.heading);
    out.pushBoxRot(v.x - fx * 3.8, y + 1.0, v.z - fz * 3.8, 4, 0.15, 1.2, c, v.heading);
  }
  // Boat outboard motor (always).
  if (isBoat) {
    out.pushBoxRot(v.x - fx * 2.4, y + 0.8, v.z - fz * 2.4, 0.6, 0.8, 0.5, [0.2, 0.2, 0.22], v.heading);
  }
  // Bike handlebar (always).
  if (isBike) {
    out.pushBoxRot(v.x + fx * 1.0, y + 1.15, v.z + fz * 1.0, 0.9, 0.15, 0.15, [0.15, 0.15, 0.18], v.heading);
  }
  // Wheels with hubcaps + orbiting bolts (near) or plain (far).
  if (!isBoat && !isPlane) {
    const wy = y + 0.45;
    const wx = wid / 2 + 0.15;
    const wz = len / 2 - 0.9;
    for (const [sx, sz] of [[-wx, wz], [wx, wz], [-wx, -wz], [wx, -wz]]) {
      const lx = v.x + sx * Math.cos(v.heading) - sz * Math.sin(v.heading);
      const lz = v.z + sx * Math.sin(v.heading) + sz * Math.cos(v.heading);
      out.pushBox(lx, wy, lz, 0.3, 0.9, 0.9, [0.1, 0.1, 0.1]);
      if (near) {
        // Hubcap band + a bolt that orbits the wheel face with
        // wheelSpin (the wheel boxes are axis-aligned, so the orbit
        // runs in the world YZ plane, matching the drawn wheel).
        out.pushBox(lx, wy, lz, 0.36, 0.55, 0.55, [0.75, 0.75, 0.78]);
        out.pushBox(lx, wy + Math.sin(v.wheelSpin) * 0.26, lz + Math.cos(v.wheelSpin) * 0.26, 0.38, 0.28, 0.28, [0.3, 0.3, 0.32]);
      } else {
        // Spin stripe: a small light box on the wheel face, bobbing
        // with wheelSpin (cheap, reads as motion from far away).
        const sa = Math.sin(v.wheelSpin) * 0.3;
        out.pushBox(lx, wy + sa, lz, 0.32, 0.2, 0.92, [0.8, 0.8, 0.8]);
      }
    }
  }
  // Glass (near only): windshield + side windows on the cabin.
  if (near && !isBike) {
    const cx = v.x;
    const cz = v.z - (isPlane ? 1 : 0.4);
    const half = len * 0.45 / 2;
    out.pushBoxRot(cx + fx * half, y + 1.55, cz + fz * half, wid * 0.7, 0.6, 0.12, [0.65, 0.85, 1.0], v.heading);
    out.pushBoxRot(cx + rx * (wid * 0.4 + 0.05), y + 1.55, cz + rz * (wid * 0.4 + 0.05), 0.1, 0.5, len * 0.35, [0.6, 0.8, 0.95], v.heading);
    out.pushBoxRot(cx - rx * (wid * 0.4 + 0.05), y + 1.55, cz - rz * (wid * 0.4 + 0.05), 0.1, 0.5, len * 0.35, [0.6, 0.8, 0.95], v.heading);
  }
  // Bumpers + mirrors (near only, cars and taxis).
  if (near && !isBike && !isBoat && !isPlane) {
    out.pushBoxRot(v.x + fx * (len / 2 + 0.1), y + 0.5, v.z + fz * (len / 2 + 0.1), wid * 0.9, 0.3, 0.25, [0.2, 0.2, 0.22], v.heading);
    out.pushBoxRot(v.x - fx * (len / 2 + 0.1), y + 0.5, v.z - fz * (len / 2 + 0.1), wid * 0.9, 0.3, 0.25, [0.2, 0.2, 0.22], v.heading);
    const my = y + 1.5;
    out.pushBoxRot(v.x + rx * (wid * 0.5 + 0.1), my, v.z + rz * (wid * 0.5 + 0.1), 0.15, 0.2, 0.3, c, v.heading);
    out.pushBoxRot(v.x - rx * (wid * 0.5 + 0.1), my, v.z - rz * (wid * 0.5 + 0.1), 0.15, 0.2, 0.3, c, v.heading);
  }
  // Spoiler on the sports cars, taxi sign, fire-truck ladder.
  if (near && (v.name === 'Solmar Comet' || v.name === 'Palm GT')) {
    out.pushBoxRot(v.x - fx * (len / 2), y + 1.35, v.z - fz * (len / 2), wid * 0.9, 0.15, 0.5, [0.15, 0.15, 0.18], v.heading);
  }
  if (near && v.type === 'taxi') {
    out.pushBoxRot(v.x, y + 2.05, v.z - 0.4, 0.8, 0.25, 0.4, [0.15, 0.15, 0.15], v.heading);
  }
  if (near && v.type === 'fire') {
    out.pushBoxRot(v.x, y + 1.5, v.z, 0.5, 0.25, len * 0.9, [0.8, 0.8, 0.85], v.heading);
  }
  // Headlights + taillights.
  const hx = v.x + Math.sin(v.heading) * (len / 2);
  const hz = v.z + Math.cos(v.heading) * (len / 2);
  const tx = v.x - Math.sin(v.heading) * (len / 2);
  const tz = v.z - Math.cos(v.heading) * (len / 2);
  out.pushBox(hx, y + 0.7, hz, wid * 0.7, 0.3, 0.2, [1.0, 0.95, 0.7]);
  out.pushBox(tx, y + 0.7, tz, wid * 0.7, 0.3, 0.2, [0.9, 0.15, 0.15]);
  // Blob shadow under the vehicle.
  out.pushBox(v.x, 0.06, v.z, wid + 0.4, 0.08, len + 0.4, [0.05, 0.05, 0.06]);
  // Police light bar.
  if (v.type === 'police') {
    out.pushBox(v.x, y + 2.0, v.z, 1.2, 0.3, 0.5, [0.9, 0.15, 0.2]);
    out.pushBox(v.x, y + 2.0, v.z, 0.5, 0.32, 0.55, [0.15, 0.3, 0.95]);
  }
  // Smoke when wrecked.
  if (v.damage > 60) {
    out.pushBox(v.x, y + 2.2, v.z, 1.2, 1.2, 1.2, [0.4, 0.4, 0.42]);
  }
}
