// Solmar Bay — vehicles: cars, motorbikes, boats, the airplane, plus
// traffic AI and stealing. Physics live on the XZ plane (y for the
// plane); collisions slide along building AABBs.

import { CAR, BIKE, BOAT, PLANE, COL, WANTED } from './config.js';
import { resolveCollision, inWater, pointInBuilding } from './world.js';

let nextId = 1;

function makeVehicle(kind, x, z, color, extra = {}) {
  const base = {
    id: nextId++,
    kind, x, y: 0, z,
    heading: Math.random() * Math.PI * 2,
    speed: 0,
    color,
    health: 100,
    driver: null,       // null | 'player' | 'npc' | 'cop'
    traffic: null,      // {node, prev} for NPC cars
    throttle: 0,
    pitch: 0,
    airborne: false,
    wrecked: false,
    smokeT: 0,
    ...extra,
  };
  if (kind === 'bike') base.health = BIKE.health;
  if (kind === 'boat') base.health = BOAT.health;
  if (kind === 'plane') base.health = PLANE.health;
  return base;
}

export function createVehicles(city) {
  const list = [];
  const rng = Math.random;
  // parked cars on roads and the airport apron (heading along the road)
  const spots = [
    [0, 30, 0], [0, -30, Math.PI], [44, 60, 0], [-44, -60, Math.PI],
    [88, 10, 0], [-88, -10, Math.PI], [0, 100, 0], [132, 30, 0],
    [-132, -30, Math.PI], [60, -270, Math.PI / 2], [-120, -320, Math.PI / 2],
    [180, -365, -Math.PI / 2], [0, 70, 0], [-200, 210, 0], [200, -210, Math.PI],
    [260, 240, 0], [340, -120, Math.PI / 2],
  ];
  for (const [x, z, heading] of spots) {
    const v = makeVehicle('car', x + rng() * 2 - 1, z + rng() * 2 - 1,
      COL.carBody[Math.floor(rng() * COL.carBody.length)]);
    v.heading = heading;
    list.push(v);
  }
  // motorbikes: beach road + downtown
  list.push(makeVehicle('bike', -284, 60, COL.bikeBody[0]));
  list.push(makeVehicle('bike', -284, -140, COL.bikeBody[1]));
  list.push(makeVehicle('bike', 44, 44, COL.bikeBody[2]));
  // boats: beach water + harbour bay, facing along open water
  const boat1 = makeVehicle('boat', -360, 60, COL.boatBody);
  boat1.heading = 0;
  list.push(boat1);
  const boat2 = makeVehicle('boat', -355, -100, COL.boatBody);
  boat2.heading = 0;
  list.push(boat2);
  const boat3 = makeVehicle('boat', 360, 330, COL.boatBody);
  boat3.heading = 0;
  list.push(boat3);
  // the airplane, parked ON the runway facing down it (-z)
  const plane = makeVehicle('plane', city.spawns.plane.x, city.spawns.plane.z, COL.planeBody);
  plane.heading = Math.PI;
  list.push(plane);
  // traffic cars on the road graph
  for (let i = 0; i < 12; i++) {
    const node = Math.floor(rng() * city.nodes.length);
    const n = city.nodes[node];
    const v = makeVehicle('car', n.x, n.z, COL.carBody[Math.floor(rng() * COL.carBody.length)],
      { driver: 'npc', traffic: { node, prev: -1 } });
    list.push(v);
  }
  return { list };
}

export function nearestVehicle(game, x, z, maxDist) {
  let best = null, bestD = maxDist;
  for (const v of game.vehicles.list) {
    if (v.wrecked || v.driver === 'player') continue;
    const d = Math.hypot(v.x - x, v.z - z);
    if (d < bestD) { bestD = d; best = v; }
  }
  return best;
}

export function enterVehicle(game, v) {
  const p = game.player;
  const state = game.state;
  p.inVehicle = v;
  p.y = 0; p.falling = false; p.parachute = false;
  if (v.driver === 'npc') {
    // the owner flees on foot
    game.peds.fleeFrom(v.x, v.z, 14);
    v.driver = 'player';
    state.wanted = Math.min(WANTED.maxStars, state.wanted + WANTED.stealStars);
    state.stats.carsStolen++;
    game.toast('Car stolen! Wanted level up.');
    game.audio.sirenBlip();
  } else if (v.driver === 'cop') {
    v.driver = 'player';
    state.wanted = Math.min(WANTED.maxStars, state.wanted + WANTED.stealStars);
    state.stats.carsStolen++;
    game.toast('You stole a police car!');
  } else {
    v.driver = 'player';
  }
  if (v.kind === 'boat') game.toast('Boat — W/S throttle, A/D steer.');
  if (v.kind === 'plane') game.toast('Plane — W/S throttle, arrows pitch, A/D turn.');
  if (v.kind === 'bike') game.toast('Bike — fast but twitchy!');
  game.audio.engineStart();
}

export function exitVehicle(game) {
  const p = game.player;
  const v = p.inVehicle;
  if (!v) return;
  v.driver = null;
  v.speed = 0;
  if (v.kind === 'plane' && v.airborne) {
    // bail out mid-air: the player falls, Space opens the chute
    p.x = v.x; p.z = v.z; p.y = v.y;
    p.falling = true;
    p.vy = -2;
    p.inVehicle = null;
    game.toast('You bailed out! Press SPACE for the parachute.');
    return;
  }
  // step out to the side
  const sx = v.x + Math.cos(v.heading) * 2.2;
  const sz = v.z - Math.sin(v.heading) * 2.2;
  const fixed = resolveCollision(sx, sz, 0.6, game.city.buildings);
  p.x = fixed.x; p.z = fixed.z; p.y = 0;
  p.heading = v.heading;
  p.inVehicle = null;
}

// ---- player driving ----

function drivePlayer(dt, game, v) {
  const input = game.input;
  const axes = input.moveAxes();
  const handbrake = input.down('Space');
  const tune = v.kind === 'bike' ? BIKE : v.kind === 'boat' ? BOAT : v.kind === 'plane' ? PLANE : CAR;

  if (v.kind === 'plane') {
    // throttle with W/S, pitch with arrows, yaw with A/D
    if (axes.y > 0) v.throttle = Math.min(1, v.throttle + dt * 0.5);
    if (axes.y < 0) v.throttle = Math.max(0, v.throttle - dt * 0.7);
    if (input.down('ArrowUp')) v.pitch = Math.min(0.5, v.pitch + dt * 0.6);
    if (input.down('ArrowDown')) v.pitch = Math.max(-0.45, v.pitch - dt * 0.6);
    if (!input.down('ArrowUp') && !input.down('ArrowDown')) v.pitch *= (1 - dt * 1.5);
    const targetSpeed = v.throttle * PLANE.maxSpeed;
    v.speed += (targetSpeed - v.speed) * Math.min(1, dt * 0.8);
    v.heading += axes.x * PLANE.steer * dt * (0.4 + v.speed / PLANE.maxSpeed);
    if (!v.airborne && v.speed > PLANE.takeoffSpeed && v.pitch > 0.06) {
      v.airborne = true;
      game.toast('Airborne!');
      game.audio.blip(660, 0.2);
    }
    if (v.airborne) {
      v.y += Math.sin(v.pitch) * v.speed * dt;
      if (v.speed < 18) { v.pitch = Math.max(v.pitch - dt * 0.8, -0.4); } // stall: nose drops
      if (v.y <= 0) {
        v.y = 0;
        if (Math.abs(Math.sin(v.pitch) * v.speed) > 9) {
          damageVehicle(game, v, 35, 'crash landing');
          game.toast('Hard landing!');
        }
        v.airborne = false;
        v.pitch = 0;
      }
      if (v.y > 120) v.y = 120;
    }
    // building collision while low
    const b = pointInBuilding(v.x, v.z, game.city.buildings);
    if (b && v.y < b.h) {
      damageVehicle(game, v, 30, 'building');
      const fixed = resolveCollision(v.x, v.z, PLANE.radius, game.city.buildings);
      v.x = fixed.x; v.z = fixed.z;
      v.speed *= 0.5;
    }
  } else if (v.kind === 'boat') {
    if (axes.y > 0) v.speed += BOAT.accel * dt;
    if (axes.y < 0) v.speed -= BOAT.brake * dt;
    v.speed *= (1 - 0.5 * dt);
    v.speed = Math.max(-8, Math.min(BOAT.maxSpeed, v.speed));
    v.heading += axes.x * BOAT.steer * dt * (0.3 + Math.abs(v.speed) / BOAT.maxSpeed);
    v.y = -0.1;
    if (!inWater(v.x, v.z, game.city.water)) {
      // beached: heavy drag, cannot move on land
      v.speed *= (1 - 4 * dt);
    }
  } else {
    // car / bike
    if (axes.y > 0) v.speed += tune.accel * dt;
    else if (axes.y < 0) v.speed -= tune.brake * dt;
    else v.speed *= (1 - 0.5 * dt);
    if (handbrake) {
      v.speed *= (1 - 3.2 * dt);
    }
    const max = tune.maxSpeed, rev = tune.reverseSpeed;
    v.speed = Math.max(-rev, Math.min(max, v.speed));
    const steerFactor = Math.min(1, Math.abs(v.speed) / 10);
    const steer = tune.steer * (handbrake ? 1.5 : 1) * steerFactor * (v.speed >= 0 ? 1 : -1);
    v.heading += axes.x * steer * dt;
    if (v.kind === 'bike') {
      // wobble at speed — less stable
      v.heading += Math.sin(game.time * 9) * BIKE.wobble * (Math.abs(v.speed) / BIKE.maxSpeed) * dt;
    }
  }

  if (v.kind !== 'plane' || !v.airborne) {
    const nx = v.x + Math.sin(v.heading) * v.speed * dt;
    const nz = v.z + Math.cos(v.heading) * v.speed * dt;
    const before = { x: v.x, z: v.z };
    const fixed = resolveCollision(nx, nz, tune.radius, game.city.buildings);
    v.x = fixed.x; v.z = fixed.z;
    const hitWall = (fixed.x !== nx || fixed.z !== nz);
    if (hitWall && Math.abs(v.speed) > 8) {
      damageVehicle(game, v, Math.round(Math.abs(v.speed) * 0.9), 'wall');
      game.audio.thud();
      v.speed *= -0.25;
    }
    if (v.kind !== 'boat') {
      game.state.stats.distanceDriven += Math.hypot(v.x - before.x, v.z - before.z);
    }
  } else {
    v.x += Math.sin(v.heading) * v.speed * dt;
    v.z += Math.cos(v.heading) * v.speed * dt;
    v.x = Math.max(-395, Math.min(395, v.x));
    v.z = Math.max(-395, Math.min(395, v.z));
    game.state.stats.distanceDriven += v.speed * dt;
  }
}

// ---- traffic AI ----

function driveTraffic(dt, game, v) {
  const city = game.city;
  const t = v.traffic;
  if (!t || !city.adj[t.node]) return;
  const target = city.nodes[t.node];
  const dx = target.x - v.x, dz = target.z - v.z;
  const dist = Math.hypot(dx, dz);
  const wantHeading = Math.atan2(dx, dz);
  let d = (wantHeading - v.heading) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  v.heading += d * Math.min(1, dt * 3);
  const cruise = 11 + (v.id % 4);
  // slow down if the player is right ahead
  const p = game.player;
  const ahead = (p.x - v.x) * Math.sin(v.heading) + (p.z - v.z) * Math.cos(v.heading);
  const side = Math.abs((p.x - v.x) * Math.cos(v.heading) - (p.z - v.z) * Math.sin(v.heading));
  const blocked = ahead > 0 && ahead < 9 && side < 2.5;
  const targetSpeed = blocked ? 0 : cruise;
  v.speed += (targetSpeed - v.speed) * Math.min(1, dt * 1.2);
  v.x += Math.sin(v.heading) * v.speed * dt;
  v.z += Math.cos(v.heading) * v.speed * dt;
  const fixed = resolveCollision(v.x, v.z, CAR.radius, city.buildings);
  v.x = fixed.x; v.z = fixed.z;
  if (dist < 3.5) {
    const options = (city.adj[t.node] || []).filter((n) => n !== t.prev);
    const next = options.length ? options[Math.floor(Math.random() * options.length)]
      : (city.adj[t.node][0] ?? t.node);
    t.prev = t.node;
    t.node = next;
  }
}

export function damageVehicle(game, v, amount, cause) {
  if (v.wrecked) return;
  v.health -= amount;
  if (v.health <= 0) {
    v.health = 0;
    v.wrecked = true;
    v.speed = 0;
    if (v.driver === 'player') {
      game.toast('Your vehicle is wrecked!');
    }
  }
}

export function updateVehicles(dt, game) {
  const p = game.player;
  // enter / exit with E (edge-triggered via keys set + a cooldown on the player)
  if (game.input.down('KeyE') && !game.eCooldown) {
    game.eCooldown = 0.35;
    if (p.inVehicle) exitVehicle(game);
    else {
      const v = nearestVehicle(game, p.x, p.z, 4.5);
      if (v) enterVehicle(game, v);
    }
  }
  if (game.eCooldown > 0) game.eCooldown -= dt;

  for (const v of game.vehicles.list) {
    if (v.wrecked) {
      v.speed *= (1 - 2 * dt);
      v.x += Math.sin(v.heading) * v.speed * dt;
      v.z += Math.cos(v.heading) * v.speed * dt;
      continue;
    }
    if (v.ramCd > 0) v.ramCd -= dt;
    if (v.driver === 'player') {
      drivePlayer(dt, game, v);
    } else if (v.driver === 'npc' && v.kind === 'car') {
      driveTraffic(dt, game, v);
    } else if (v.driver === 'cop') {
      // police driving is handled by the police module
    }
    // smoke timer for damaged vehicles
    if (v.health < CAR.damageSmoke) v.smokeT += dt;
    // boat drifts back to water level
    if (v.kind === 'boat' && v.driver !== 'player') v.y = -0.1;
  }

  // vehicle-vehicle shoves (cheap: player vehicle vs others)
  const pv = p.inVehicle;
  if (pv) {
    for (const v of game.vehicles.list) {
      if (v === pv || v.wrecked) continue;
      const d = Math.hypot(v.x - pv.x, v.z - pv.z);
      if (d < 3.2 && d > 0.01) {
        const push = (3.2 - d) * 0.5;
        const nx = (v.x - pv.x) / d, nz = (v.z - pv.z) / d;
        v.x += nx * push; v.z += nz * push;
        if (Math.abs(pv.speed) > 6 && (!v.ramCd || v.ramCd <= 0) && (!pv.ramCd || pv.ramCd <= 0)) {
          damageVehicle(game, v, Math.round(Math.abs(pv.speed) * 0.7), 'ram');
          damageVehicle(game, pv, Math.round(Math.abs(pv.speed) * 0.3), 'ram');
          v.ramCd = 0.7; pv.ramCd = 0.7;
          if (v.driver === 'npc') {
            game.peds.fleeFrom(v.x, v.z, 12);
            v.driver = null; v.traffic = null;
          }
          game.audio.thud();
        }
      }
    }
  }
}

// ---- drawing ----

function drawCarShape(renderer, v, bodyColor, isPolice) {
  const y = v.y;
  const h = v.heading;
  const fx = Math.sin(h), fz = Math.cos(h);
  // body + cabin + windows + wheels
  renderer.box(v.x, y + 0.55, v.z, 1.9, 0.75, 3.7, h, bodyColor, bodyColor);
  renderer.box(v.x - fx * 0.3, y + 1.15, v.z - fz * 0.3, 1.65, 0.6, 1.9, h, COL.towerGlass, COL.towerGlass);
  if (isPolice) {
    renderer.box(v.x, y + 0.62, v.z, 1.94, 0.22, 3.72, h, COL.policeStripe, COL.policeStripe);
    const flash = (Math.floor(performance.now() / 280) % 2 === 0) ? [1, 0.15, 0.15] : [0.15, 0.3, 1];
    renderer.box(v.x - fx * 0.3, y + 1.55, v.z - fz * 0.3, 0.9, 0.18, 0.4, h, flash, flash);
  }
  // wheels
  const rx = Math.cos(h), rz = -Math.sin(h);
  for (const s of [-1, 1]) {
    for (const f of [1.15, -1.15]) {
      renderer.box(v.x + rx * s * 0.95 + fx * f, y + 0.3, v.z + rz * s * 0.95 + fz * f,
        0.32, 0.55, 0.6, h, COL.weapon, COL.weapon);
    }
  }
  if (v.health < CAR.damageSmoke && Math.random() < 0.5) {
    renderer.box(v.x - fx * 1.2, y + 1.4, v.z - fz * 1.2, 0.8, 0.8, 0.8, h, COL.smoke, COL.smoke);
  }
}

export function drawVehicles(renderer, game) {
  for (const v of game.vehicles.list) {
    if (v.kind === 'car') {
      drawCarShape(renderer, v, v.police ? COL.policeCar : v.color, !!v.police);
    } else if (v.kind === 'bike') {
      const h = v.heading;
      const fx = Math.sin(h), fz = Math.cos(h);
      renderer.box(v.x, v.y + 0.55, v.z, 0.55, 0.5, 2.3, h, v.color, v.color);
      renderer.box(v.x - fx * 0.4, v.y + 0.95, v.z - fz * 0.4, 0.5, 0.35, 0.6, h, COL.weapon, COL.weapon);
      renderer.box(v.x + fx * 1.0, v.y + 0.4, v.z + fz * 1.0, 0.4, 0.7, 0.4, h, COL.weapon, COL.weapon);
      renderer.box(v.x - fx * 1.0, v.y + 0.4, v.z - fz * 1.0, 0.4, 0.7, 0.4, h, COL.weapon, COL.weapon);
      // rider (player or nobody)
      if (v.driver) {
        renderer.box(v.x, v.y + 1.15, v.z, 0.55, 0.6, 0.4, h, COL.playerShirt, COL.playerShirt);
        renderer.box(v.x, v.y + 1.6, v.z, 0.42, 0.4, 0.42, h, COL.playerSkin, COL.playerSkin);
      }
    } else if (v.kind === 'boat') {
      const h = v.heading;
      renderer.box(v.x, v.y + 0.5, v.z, 2.1, 0.8, 4.6, h, v.color, v.color);
      renderer.box(v.x, v.y + 1.1, v.z - Math.cos(h) * 0.6, 1.6, 0.7, 1.8, h, COL.towerGlass, COL.towerGlass);
    } else if (v.kind === 'plane') {
      const h = v.heading;
      const fx = Math.sin(h), fz = Math.cos(h);
      const y = v.y + 1.2;
      renderer.box(v.x, y, v.z, 1.7, 1.5, 7.2, h, v.color, v.color, v.pitch);
      renderer.box(v.x, y + 0.1, v.z, 8.5, 0.28, 1.7, h, v.color, v.color, v.pitch);
      renderer.box(v.x - fx * 3.2, y + 0.9, v.z - fz * 3.2, 3.2, 0.22, 1.2, h, v.color, v.color, v.pitch);
      renderer.box(v.x + fx * 2.6, y + 0.55, v.z + fz * 2.6, 1.4, 0.7, 1.4, h, COL.planeStripe, COL.planeStripe, v.pitch);
      renderer.box(v.x, y + 1.15, v.z - fz * 2.2, 0.25, 1.1, 0.9, h, COL.planeStripe, COL.planeStripe, v.pitch);
    }
  }
}
