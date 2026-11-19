// Solmar Bay — vehicles: cars, motorbikes, boats, the airplane,
// taxi + fire truck + police cars. Traffic AI follows the road graph
// and stops at red lights; the player drives with eased throttle and
// steering, body roll included. Stealing wires through the crime
// table via game.police.commitCrime.

import { TUNE, COL, clamp, lerp, angleLerp, dist2 } from './config.js';
import { collideCircle, inWater, lightState } from './world.js';

let nextId = 1;

export function makeVehicle(type, x, z, heading, colour) {
  return {
    id: nextId++,
    type, // car | bike | boat | plane | taxi | fire | police
    x, z, y: 0,
    heading: heading || 0,
    speed: 0,
    steer: 0,
    colour: colour || COL.carPaint[Math.floor(Math.random() * COL.carPaint.length)],
    driver: null, // 'traffic' | 'parked' | 'player' | null
    damage: 0,
    wrecked: false,
    // traffic AI
    node: null,
    nextNode: null,
    edgeT: 0,
    cruise: 9 + Math.random() * 4,
    waitT: 0,
    // flight
    altitude: 0,
    pitch: 0,
  };
}

export function createVehicles(city) {
  const v = {
    list: [],
    byId: new Map(),
  };
  const add = (veh) => {
    v.list.push(veh);
    v.byId.set(veh.id, veh);
    return veh;
  };

  // parked cars near the player spawn + around downtown
  const parkedSpots = [
    [-44, -60, 0.4], [-38, 30, -0.2], [-60, 90, 1.2], [30, -80, 0.6],
    [90, 40, -1.1], [-120, -30, 0.9], [60, 140, 0.2], [-160, 60, -0.7],
    [140, -60, 1.5], [20, 180, 0.1], [-200, 120, -0.4], [220, 80, 0.8],
    [-80, -140, 1.0], [120, 200, -0.9], [-240, -80, 0.3], [180, 160, 1.3],
    [40, -200, -0.5], [-100, 240, 0.7], [260, -40, 1.1], [-40, -240, -0.2],
    [80, -160, 0.5], [-180, 200, 1.4], [200, -180, -0.6], [-260, 40, 0.9],
    [100, 100, 0.0], [-120, -180, 1.2], [160, 20, -0.8], [-60, -100, 0.4],
    [240, 120, 1.0], [-200, -200, -1.3], [0, 220, 0.6],
  ];
  for (const [x, z, h] of parkedSpots) {
    const car = makeVehicle('car', x, z, h, COL.carPaint[Math.floor(Math.random() * COL.carPaint.length)]);
    car.driver = 'parked';
    add(car);
  }
  // a parked motorbike near the player spawn (chapter 1 alternative)
  const bike = makeVehicle('bike', -44, -60, 0.4, [0.9, 0.2, 0.2]);
  bike.driver = 'parked';
  add(bike);

  // traffic cars on the road graph
  const nodes = city.roadNodes;
  for (let i = 0; i < TUNE.trafficCap; i++) {
    const n = nodes[Math.floor(Math.random() * nodes.length)];
    const car = makeVehicle('car', n.x + (Math.random() * 6 - 3), n.z + (Math.random() * 6 - 3), Math.random() * Math.PI * 2);
    car.driver = 'traffic';
    car.node = n;
    car.nextNode = pickNextNode(city, n, null);
    add(car);
  }

  // taxi + fire truck parked at their stations (the taxi sits clear
  // of the taxi-stand marker so E enters the cab, not the side job)
  const taxi = makeVehicle('taxi', 12, 56, 0, [0.95, 0.8, 0.1]);
  taxi.driver = 'parked';
  add(taxi);
  const fireTruck = makeVehicle('fire', 150, 118, 0, [0.9, 0.15, 0.1]);
  fireTruck.driver = 'parked';
  add(fireTruck);

  // boats in the harbour + beach water
  const boat1 = makeVehicle('boat', -360, -80, 0.5, [0.9, 0.9, 0.9]);
  boat1.driver = 'parked';
  add(boat1);
  const boat2 = makeVehicle('boat', -360, 140, -0.4, [0.2, 0.6, 0.9]);
  boat2.driver = 'parked';
  add(boat2);

  // the airplane on the airport runway, clear of the hangar
  const plane = makeVehicle('plane', 170, -320, Math.PI / 2, [0.9, 0.9, 0.92]);
  plane.driver = 'parked';
  add(plane);

  return v;
}

export function spawnVehicle(vehicles, type, x, z, heading, colour) {
  const veh = makeVehicle(type, x, z, heading, colour);
  vehicles.list.push(veh);
  vehicles.byId.set(veh.id, veh);
  return veh;
}

function pickNextNode(city, from, cameFrom) {
  const options = [];
  for (const n of city.roadNodes) {
    if (n === from) continue;
    const dx = Math.abs(n.x - from.x);
    const dz = Math.abs(n.z - from.z);
    const adjacent = (dx === 100 && dz === 0) || (dx === 0 && dz === 100);
    if (!adjacent) continue;
    if (cameFrom && n.x === cameFrom.x && n.z === cameFrom.z && options.length > 0) continue;
    options.push(n);
  }
  if (!options.length) return from;
  return options[Math.floor(Math.random() * options.length)];
}

function lightAtNode(city, node) {
  for (const l of city.lights) {
    if (Math.abs(l.x - 9 - node.x) < 1 && Math.abs(l.z - 9 - node.z) < 1) return l;
  }
  return null;
}

// Nearest drivable vehicle to a point (for E interaction).
export function nearestVehicle(vehicles, x, z, maxDist) {
  let best = null;
  let bestD = maxDist * maxDist;
  for (const v of vehicles.list) {
    if (v.wrecked) continue;
    const d = dist2(x, z, v.x, v.z);
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  return best;
}

// E pressed on foot: enter the nearest vehicle in range.
// Returns the vehicle entered, or null.
export function tryEnterVehicle(game) {
  const p = game.player;
  if (p.inVehicle || p.eCooldown > 0) return null;
  const veh = nearestVehicle(game.vehicles, p.x, p.z, TUNE.interactRange);
  if (!veh) return null;
  const occupied = veh.driver === 'traffic';
  if (occupied) {
    // carjacking: the driver flees, the player takes the car
    veh.driver = 'player';
    if (game.police && game.police.commitCrime) {
      game.police.commitCrime(game, 'armedRobbery');
    }
    if (game.state) game.state.stats.carsStolen += 1;
    if (game.audio) game.audio.play('steal');
  } else {
    veh.driver = 'player';
    if (game.police && game.police.commitCrime) {
      game.police.commitCrime(game, 'stealCar');
    }
    if (game.state) game.state.stats.carsStolen += 1;
  }
  p.inVehicle = veh;
  p.eCooldown = 0.25;
  p.x = veh.x;
  p.z = veh.z;
  p.y = veh.y || 0;
  return veh;
}

// E pressed while driving: get out next to the vehicle.
export function exitVehicle(game) {
  const p = game.player;
  const veh = p.inVehicle;
  if (!veh || p.eCooldown > 0) return false;
  veh.driver = 'parked';
  veh.speed = 0;
  const side = veh.heading + Math.PI / 2;
  const px = veh.x + Math.sin(side) * 3;
  const pz = veh.z + Math.cos(side) * 3;
  const fixed = collideCircle(game.city, px, pz, TUNE.playerRadius);
  p.x = fixed.x;
  p.z = fixed.z;
  p.y = 0;
  p.inVehicle = null;
  p.parachute = false;
  p.falling = 0;
  p.eCooldown = 0.25;
  return true;
}

// Drive the player's vehicle for one frame.
export function updateDriven(game, dt) {
  const p = game.player;
  const veh = p.inVehicle;
  if (!veh) return;
  const input = game.input;
  const city = game.city;

  const isBike = veh.type === 'bike';
  const isBoat = veh.type === 'boat';
  const isPlane = veh.type === 'plane';
  const maxSpeed = isBike ? TUNE.bikeMaxSpeed : isBoat ? TUNE.boatMaxSpeed : isPlane ? TUNE.planeMaxSpeed : TUNE.carMaxSpeed;
  const accel = isBike ? TUNE.bikeAccel : isBoat ? TUNE.boatAccel : isPlane ? TUNE.planeAccel : TUNE.carAccel;

  // throttle: eased
  let target = 0;
  if (input.down('KeyW') || input.down('ArrowUp')) target = maxSpeed;
  if (input.down('KeyS') || input.down('ArrowDown')) {
    target = veh.speed > 1 ? 0 : -TUNE.carReverseMax; // brake, then reverse
  }
  const handbrake = input.down('Space');
  const rate = handbrake ? TUNE.carBrake * 1.6 : accel;
  if (target > veh.speed) veh.speed = Math.min(target, veh.speed + rate * dt);
  else if (target < veh.speed) veh.speed = Math.max(target, veh.speed - rate * dt);
  else veh.speed = approachZero(veh.speed, TUNE.carBrake * dt);

  // steering: eased, scales with speed, stronger at low speed
  let steerInput = 0;
  if (input.down('KeyA') || input.down('ArrowLeft')) steerInput -= 1;
  if (input.down('KeyD') || input.down('ArrowRight')) steerInput += 1;
  const steerTarget = steerInput * (handbrake ? 1.4 : 1);
  veh.steer = lerp(veh.steer, steerTarget, 1 - Math.pow(0.001, dt));
  const dir = veh.speed >= 0 ? 1 : -1;
  veh.heading += veh.steer * TUNE.carSteer * clamp(Math.abs(veh.speed) / 12, 0, 1) * dir * dt;

  // move
  const nx = veh.x + Math.sin(veh.heading) * veh.speed * dt;
  const nz = veh.z + Math.cos(veh.heading) * veh.speed * dt;
  if (isBoat) {
    // boats move on water, blocked on land
    if (inWater(nx, nz)) {
      veh.x = nx;
      veh.z = nz;
    } else {
      veh.speed = 0;
    }
  } else if (isPlane) {
    // runway roll, then flight
    if (veh.altitude > 0 || veh.speed >= TUNE.planeTakeoff) {
      veh.altitude = clamp(veh.altitude + (input.down('KeyW') ? 6 : input.down('KeyS') ? -8 : 0) * dt, 0, 120);
      veh.pitch = lerp(veh.pitch, input.down('KeyW') ? -0.25 : input.down('KeyS') ? 0.2 : 0, 0.1);
      if (veh.altitude <= 0 && veh.speed < TUNE.planeTakeoff) veh.altitude = 0;
    }
    const fixed = collideCircle(city, nx, nz, 2.4);
    veh.x = fixed.x;
    veh.z = fixed.z;
  } else {
    const fixed = collideCircle(city, nx, nz, 2.2);
    veh.x = fixed.x;
    veh.z = fixed.z;
  }
  veh.y = isPlane ? veh.altitude : 0;

  // body roll: lean into turns, proportional to steer * speed
  veh.roll = clamp(-veh.steer * clamp(Math.abs(veh.speed) / 20, 0, 1) * 0.18, -0.2, 0.2);

  // player rides along
  p.x = veh.x;
  p.z = veh.z;
  p.y = veh.y;
  p.heading = veh.heading;
  p.speed = Math.abs(veh.speed);
  if (game.state) game.state.stats.distanceDriven += Math.abs(veh.speed) * dt;

  // damage smoke flag
  if (veh.damage > 60) veh.smoking = true;
}

function approachZero(v, step) {
  if (v > 0) return Math.max(0, v - step);
  if (v < 0) return Math.min(0, v + step);
  return 0;
}

// Traffic AI + parked-vehicle idle update.
export function updateVehicles(game, dt) {
  const city = game.city;
  const t = game.state.time;
  for (const veh of game.vehicles.list) {
    if (veh.driver !== 'traffic') continue;
    if (veh.wrecked) continue;
    if (!veh.nextNode) {
      veh.nextNode = pickNextNode(city, veh.node, null);
      continue;
    }
    // red light: stop before the next intersection
    const light = lightAtNode(city, veh.nextNode);
    const distToNode = Math.hypot(veh.nextNode.x - veh.x, veh.nextNode.z - veh.z);
    let targetSpeed = veh.cruise;
    if (light && lightState(light, t) === 'red' && distToNode < 16) {
      targetSpeed = 0;
    }
    if (veh.waitT > 0) {
      veh.waitT -= dt;
      veh.speed = approachZero(veh.speed, 20 * dt);
    } else {
      veh.speed = lerp(veh.speed, targetSpeed, 1 - Math.pow(0.01, dt));
    }
    // steer toward the next node, eased
    const desired = Math.atan2(veh.nextNode.x - veh.x, veh.nextNode.z - veh.z);
    veh.heading = angleLerp(veh.heading, desired, 1 - Math.pow(0.001, dt));
    const nx = veh.x + Math.sin(veh.heading) * veh.speed * dt;
    const nz = veh.z + Math.cos(veh.heading) * veh.speed * dt;
    const fixed = collideCircle(city, nx, nz, 2.2);
    veh.x = fixed.x;
    veh.z = fixed.z;
    if (distToNode < 3) {
      const came = veh.node;
      veh.node = veh.nextNode;
      veh.nextNode = pickNextNode(city, veh.node, came);
    }
  }
}

export function damageVehicle(veh, amount) {
  veh.damage += amount;
  if (veh.damage >= 100) {
    veh.wrecked = true;
    veh.speed = 0;
  }
}

// Voxel boxes for one vehicle, in world space.
export function vehicleBoxes(veh) {
  const boxes = [];
  const c = veh.colour;
  const dark = [0.12, 0.12, 0.14];
  const glass = [0.5, 0.75, 0.9];
  if (veh.type === 'bike') {
    boxes.push({ x: veh.x, y: 0.7, z: veh.z, sx: 0.7, sy: 0.7, sz: 2.4, c });
    boxes.push({ x: veh.x, y: 1.25, z: veh.z - 0.3, sx: 0.6, sy: 0.5, sz: 0.8, c: dark });
    boxes.push({ x: veh.x, y: 0.45, z: veh.z + 1.0, sx: 0.5, sy: 0.9, sz: 0.3, c: dark });
    boxes.push({ x: veh.x, y: 0.45, z: veh.z - 1.0, sx: 0.5, sy: 0.9, sz: 0.3, c: dark });
    return boxes;
  }
  if (veh.type === 'boat') {
    boxes.push({ x: veh.x, y: 0.6, z: veh.z, sx: 2.6, sy: 1.0, sz: 6, c });
    boxes.push({ x: veh.x, y: 1.4, z: veh.z - 1, sx: 2.0, sy: 0.9, sz: 2.4, c: [0.9, 0.9, 0.92] });
    return boxes;
  }
  if (veh.type === 'plane') {
    boxes.push({ x: veh.x, y: 1.0 + veh.y, z: veh.z, sx: 2.2, sy: 1.6, sz: 12, c });
    boxes.push({ x: veh.x, y: 1.0 + veh.y, z: veh.z, sx: 16, sy: 0.4, sz: 2.4, c });
    boxes.push({ x: veh.x, y: 1.6 + veh.y, z: veh.z - 4.5, sx: 4, sy: 1.2, sz: 1.6, c: [0.9, 0.3, 0.2] });
    boxes.push({ x: veh.x, y: 0.8 + veh.y, z: veh.z + 5, sx: 1.2, sy: 1.0, sz: 1.4, c: glass });
    return boxes;
  }
  // cars / taxi / fire / police share the car body
  const body = veh.type === 'fire' ? [0.9, 0.15, 0.1] : veh.type === 'police' ? [0.1, 0.15, 0.25] : veh.type === 'taxi' ? [0.95, 0.8, 0.1] : c;
  const y = veh.y || 0;
  boxes.push({ x: veh.x, y: y + 0.7, z: veh.z, sx: 2.4, sy: 1.1, sz: 4.6, c: body });
  boxes.push({ x: veh.x, y: y + 1.6, z: veh.z - 0.3, sx: 2.0, sy: 0.9, sz: 2.4, c: glass });
  boxes.push({ x: veh.x, y: y + 0.4, z: veh.z + 1.9, sx: 0.7, sy: 0.8, sz: 0.7, c: dark });
  boxes.push({ x: veh.x, y: y + 0.4, z: veh.z - 1.9, sx: 0.7, sy: 0.8, sz: 0.7, c: dark });
  if (veh.type === 'police') {
    boxes.push({ x: veh.x, y: y + 2.3, z: veh.z - 0.3, sx: 1.2, sy: 0.35, sz: 0.8, c: [0.9, 0.1, 0.1] });
    boxes.push({ x: veh.x, y: y + 2.3, z: veh.z + 0.6, sx: 1.2, sy: 0.35, sz: 0.8, c: [0.1, 0.3, 0.9] });
  }
  if (veh.type === 'taxi') {
    boxes.push({ x: veh.x, y: y + 2.3, z: veh.z - 0.3, sx: 1.0, sy: 0.4, sz: 1.0, c: [1, 0.9, 0.2] });
  }
  if (veh.type === 'fire') {
    boxes.push({ x: veh.x, y: y + 1.4, z: veh.z + 1.2, sx: 2.2, sy: 1.2, sz: 1.6, c: [0.8, 0.8, 0.85] });
    boxes.push({ x: veh.x, y: y + 2.3, z: veh.z, sx: 1.6, sy: 0.35, sz: 1.2, c: [0.9, 0.1, 0.1] });
  }
  if (veh.smoking) {
    boxes.push({ x: veh.x, y: y + 2.6, z: veh.z, sx: 1.2, sy: 1.0, sz: 1.2, c: [0.5, 0.5, 0.5], a: 0.7 });
  }
  return boxes;
}
