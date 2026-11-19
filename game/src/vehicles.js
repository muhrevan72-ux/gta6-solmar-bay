// Solmar Bay — vehicles: player driving, traffic AI, stealing,
// traffic lights, cars, bikes, boats, planes, taxis, fire trucks.
// Smooth and fluid: eased throttle and steering, body roll and
// pitch, momentum — never snappy.

import { TUNE, COL, clamp, lerp, dist, mulberry32 } from './config.js';
import { collides, inWater, moveWithCollision } from './world.js';

export const CAR_COLORS = [
  [0.9, 0.2, 0.2], [0.2, 0.4, 0.9], [0.7, 0.3, 0.85], [0.2, 0.8, 0.3],
  [0.95, 0.6, 0.15], [0.9, 0.9, 0.9], [0.2, 0.2, 0.25], [0.95, 0.85, 0.2],
  [0.3, 0.75, 0.8], [0.85, 0.45, 0.6],
];

// ---- traffic lights ----
export function createLights() {
  const lights = [];
  for (const x of [-150, -50, 50, 150]) {
    for (const z of [-150, -50, 50, 150]) {
      lights.push({ x, z, phase: ((x + z) / 100) % 3, t: 0 });
    }
  }
  for (const z of [-200, 200]) {
    lights.push({ x: -300, z, phase: 1, t: 0 });
    lights.push({ x: 200, z, phase: 2, t: 0 });
  }
  for (const x of [-200, 200]) {
    lights.push({ x, z: -350, phase: 0, t: 0 });
    lights.push({ x, z: 350, phase: 1, t: 0 });
  }
  return lights; // 24 lights
}

// green 8s, yellow 2s, red 8s — 18s cycle
export function lightCycle(t) {
  const c = ((t % 18) + 18) % 18;
  if (c < 8) return 'green';
  if (c < 10) return 'yellow';
  return 'red';
}

export function updateLights(lights, dt) {
  for (const l of lights) l.t += dt;
}

// State of the nearest light within 14 units, or null.
export function lightStateAt(lights, x, z) {
  let best = null, bd = Infinity;
  for (const l of lights) {
    const d = dist(x, z, l.x, l.z);
    if (d < bd) { bd = d; best = l; }
  }
  if (!best || bd > 14) return null;
  return lightCycle(best.t + best.phase * 6);
}

function makeVehicle(kind, x, z, heading, color) {
  return {
    kind, x, z, y: 0,
    heading, speed: 0, steer: 0, throttle: 0,
    color, damage: 0,
    driver: null, traffic: false, parked: false,
    lane: -1, wp: 0, dir: 1,
    pitch: 0, roll: 0, airborne: false, climb: 0,
    spray: 0, // fire truck water spray timer
  };
}

export function createVehicles(city) {
  const rng = mulberry32(777);
  const list = [];
  // traffic cars on random lanes
  for (let i = 0; i < 32; i++) {
    const lane = Math.floor(rng() * city.lanes.length);
    const pts = city.lanes[lane].points;
    const wp = Math.floor(rng() * pts.length);
    const v = makeVehicle('car', pts[wp][0], pts[wp][1], rng() * Math.PI * 2,
      CAR_COLORS[i % CAR_COLORS.length]);
    v.traffic = true;
    v.driver = 'traffic';
    v.lane = lane;
    v.wp = wp;
    list.push(v);
  }
  // parked cars
  for (let i = 0; i < city.parkedSpots.length; i++) {
    const s = city.parkedSpots[i];
    const v = makeVehicle('car', s.x, s.z, rng() * Math.PI * 2,
      CAR_COLORS[(i + 3) % CAR_COLORS.length]);
    v.parked = true;
    list.push(v);
  }
  // motorbikes near downtown
  for (const [x, z] of [[-44, -60], [56, 60], [-140, -60], [140, 140]]) {
    const v = makeVehicle('bike', x, z, rng() * Math.PI * 2, [0.85, 0.15, 0.3]);
    v.parked = true;
    list.push(v);
  }
  // boats at the harbour and beach
  for (const [x, z] of [[-380, 200], [-380, -100], [-380, 320]]) {
    const v = makeVehicle('boat', x, z, rng() * Math.PI * 2, [0.9, 0.9, 0.95]);
    v.parked = true;
    v.y = 0.4;
    list.push(v);
  }
  // airplane on the runway — clear of the hangar at (140,330), facing
  // east down the runway so it has room to build takeoff speed
  const plane = makeVehicle('plane', 170, 330, Math.PI / 2, [0.95, 0.95, 0.95]);
  plane.parked = true;
  list.push(plane);
  // taxis near the taxi stand
  for (const [x, z] of [[-6, 160], [6, 166]]) {
    const v = makeVehicle('taxi', x, z, 0, COL.taxi);
    v.parked = true;
    list.push(v);
  }
  // fire truck at the fire station
  const fire = makeVehicle('fire', -100, 210, Math.PI, COL.fire);
  fire.parked = true;
  list.push(fire);
  return { list, lights: createLights() };
}

export function nearestVehicle(game, x, z, maxDist) {
  let best = null, bd = maxDist;
  for (const v of game.vehicles.list) {
    if (v.damage >= 100) continue;
    const d = dist(x, z, v.x, v.z);
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}

function kindTune(kind) {
  if (kind === 'bike') return { accel: TUNE.bikeAccel, max: TUNE.bikeMaxSpeed, rev: 12, turn: TUNE.bikeTurn };
  if (kind === 'boat') return { accel: TUNE.boatAccel, max: TUNE.boatMaxSpeed, rev: 8, turn: TUNE.boatTurn };
  if (kind === 'plane') return { accel: TUNE.planeAccel, max: TUNE.planeMaxSpeed, rev: 6, turn: TUNE.planeTurn };
  if (kind === 'fire') return { accel: 13, max: 30, rev: 10, turn: 1.6 };
  return { accel: TUNE.carAccel, max: TUNE.carMaxSpeed, rev: TUNE.carMaxReverse, turn: TUNE.carTurn };
}

// ---- player driving ----
function updatePlayerVehicle(dt, game, v) {
  const input = game.input;
  const state = game.state;
  const kt = kindTune(v.kind);
  const wantThrottle = (input.down('KeyW') || input.down('ArrowUp')) ? 1
    : (input.down('KeyS') || input.down('ArrowDown')) ? -0.6 : 0;
  const wantSteer = (input.down('KeyA') || input.down('ArrowLeft')) ? 1
    : (input.down('KeyD') || input.down('ArrowRight')) ? -1 : 0;
  // eased throttle + steering (glide toward the key state)
  v.throttle += (wantThrottle - v.throttle) * Math.min(1, 3 * dt);
  v.steer += (wantSteer - v.steer) * Math.min(1, 4.5 * dt);

  const handbrake = input.down('Space') && v.kind !== 'plane';
  let accel = v.throttle * kt.accel * (1 + (state.handlingBonus || 0));
  v.speed += accel * dt;
  v.speed -= v.speed * 0.35 * dt; // drag
  if (handbrake) v.speed *= Math.max(0, 1 - 3 * dt);
  if (v.speed > kt.max) v.speed = kt.max;
  if (v.speed < -kt.rev) v.speed = -kt.rev;

  const turnRate = kt.turn * (handbrake ? 1.6 : 1) * clamp(Math.abs(v.speed) / 12, 0, 1);
  v.heading += v.steer * turnRate * dt * (v.speed >= 0 ? 1 : -1);
  // body roll + pitch from the smoothed inputs
  const targetRoll = v.kind === 'bike'
    ? clamp(-v.steer * Math.abs(v.speed) / 48, -0.38, 0.38)
    : clamp(-v.steer * Math.abs(v.speed) / 120, -0.12, 0.12);
  v.roll += (targetRoll - v.roll) * Math.min(1, 5 * dt);
  v.pitch += (clamp(v.throttle * 0.05, -0.05, 0.05) - v.pitch) * Math.min(1, 4 * dt);

  const nx = v.x + Math.sin(v.heading) * v.speed * dt;
  const nz = v.z + Math.cos(v.heading) * v.speed * dt;

  // planes: take off, fly, land
  if (v.kind === 'plane') {
    if (v.speed > 45 && !v.airborne) v.airborne = true;
    if (v.airborne) {
      const climbInput = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
      v.climb += (climbInput * 6 - v.climb) * Math.min(1, 2 * dt);
      v.y += (v.climb + 2) * dt;
      if (v.y > 120) v.y = 120;
      if (v.speed < 30) { v.y -= 6 * dt; if (v.y <= 0) { v.y = 0; v.airborne = false; } }
    }
  }
  // boats only move on water; land vehicles cannot enter water
  if (v.kind === 'boat') {
    if (!inWater(game.city, nx, nz)) {
      v.speed *= 0.5;
      return;
    }
    v.y = 0.4 + Math.sin(game.time * 1.5) * 0.1;
  } else if (v.kind !== 'plane' || !v.airborne) {
    if (inWater(game.city, nx, nz)) {
      v.speed = 0;
      return;
    }
  }
  if (v.kind === 'plane' && v.airborne) {
    v.x = nx; v.z = nz;
  } else if (collides(game.city, nx, nz, 1.7)) {
    // crash: bounce back, take damage
    const impact = Math.abs(v.speed);
    v.speed *= -0.25;
    v.damage += impact * 0.9;
    if (impact > 8 && game.audio) game.audio.thud();
  } else {
    v.x = nx; v.z = nz;
  }
  if (v.damage >= 100) { v.damage = 100; v.speed = 0; }
  if (v.driver === 'player') state.stats.distanceDriven += Math.abs(v.speed) * dt;
}

// ---- traffic AI ----
function updateTraffic(dt, game, v) {
  const lanes = game.city.lanes;
  const lane = lanes[v.lane];
  if (!lane) return;
  const pts = lane.points;
  let target = pts[v.wp];
  // reached the waypoint?
  if (dist(v.x, v.z, target[0], target[1]) < 6) {
    v.wp += v.dir;
    if (v.wp >= pts.length || v.wp < 0) {
      if (lane.loop) {
        v.wp = v.dir > 0 ? 0 : pts.length - 1;
      } else {
        // find another lane starting near here
        let next = -1;
        const cands = [];
        for (let i = 0; i < lanes.length; i++) {
          if (i === v.lane) continue;
          const s = lanes[i].points[0];
          if (dist(v.x, v.z, s[0], s[1]) < 30) cands.push(i);
        }
        if (cands.length > 0) next = cands[Math.floor(Math.random() * cands.length)];
        if (next >= 0) {
          v.lane = next;
          v.wp = 0;
          v.dir = 1;
        } else {
          // turn around and drive back along the same lane
          v.dir = -v.dir;
          v.wp += v.dir * 2;
        }
      }
    }
    target = pts[Math.max(0, Math.min(pts.length - 1, v.wp))];
  }
  const wantHeading = Math.atan2(target[0] - v.x, target[1] - v.z);
  let diff = wantHeading - v.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  v.heading += clamp(diff, -1.6 * dt, 1.6 * dt);

  // stop at red/yellow lights, for the player in front, and for cars ahead
  let wantSpeed = TUNE.trafficSpeed;
  const light = lightStateAt(game.vehicles.lights, v.x + Math.sin(v.heading) * 8, v.z + Math.cos(v.heading) * 8);
  if (light === 'red' || light === 'yellow') wantSpeed = 0;
  const p = game.player;
  if (!p.inVehicle) {
    const pdx = p.x - v.x, pdz = p.z - v.z;
    const ahead = (pdx * Math.sin(v.heading) + pdz * Math.cos(v.heading)) / (Math.hypot(pdx, pdz) || 1);
    if (Math.hypot(pdx, pdz) < 7 && ahead > 0.6) wantSpeed = 0;
  } else if (p.inVehicle && p.inVehicle !== v) {
    const pv = p.inVehicle;
    const pdx = pv.x - v.x, pdz = pv.z - v.z;
    const ahead = (pdx * Math.sin(v.heading) + pdz * Math.cos(v.heading)) / (Math.hypot(pdx, pdz) || 1);
    if (Math.hypot(pdx, pdz) < 6 && ahead > 0.6) wantSpeed = 0;
  }
  v.speed += (wantSpeed - v.speed) * Math.min(1, 2.5 * dt);
  const nx = v.x + Math.sin(v.heading) * v.speed * dt;
  const nz = v.z + Math.cos(v.heading) * v.speed * dt;
  if (!collides(game.city, nx, nz, 1.7) && !inWater(game.city, nx, nz)) {
    v.x = nx; v.z = nz;
  } else {
    v.speed = 0;
  }
}

export function updateVehicles(dt, game) {
  updateLights(game.vehicles.lights, dt);
  for (const v of game.vehicles.list) {
    if (v.damage >= 100) continue; // wrecked
    if (v.driver === 'player') updatePlayerVehicle(dt, game, v);
    else if (v.traffic) updateTraffic(dt, game, v);
    else if (v.kind === 'plane' && v.airborne) {
      // driverless plane (pilot bailed with a parachute): it glides
      // down and crashes
      v.y -= 4 * dt;
      v.x += Math.sin(v.heading) * v.speed * 0.5 * dt;
      v.z += Math.cos(v.heading) * v.speed * 0.5 * dt;
      if (v.y <= 0) { v.y = 0; v.airborne = false; v.damage = 100; }
    }
  }
}

// ---- drawing ----
function drawCar(renderer, game, v) {
  const t = game.time;
  const body = v.color;
  const dark = [0.12, 0.12, 0.14];
  const top = v.kind === 'cop' ? [0.95, 0.95, 0.95] : body;
  renderer.box(v.x, v.y + 0.7, v.z, 2.2, 0.9, 4.4, body, 1, v.heading, v.roll, v.pitch);
  renderer.box(v.x, v.y + 1.45, v.z - 0.2, 1.9, 0.75, 2.4, top, 1, v.heading, v.roll, v.pitch);
  // wheels (local offsets rotated by the heading)
  const ch = Math.cos(v.heading), sh = Math.sin(v.heading);
  for (const [sx, sz] of [[-1.05, 1.4], [1.05, 1.4], [-1.05, -1.4], [1.05, -1.4]]) {
    renderer.box(v.x + sx * ch + sz * sh, v.y + 0.35, v.z - sx * sh + sz * ch,
      0.4, 0.7, 0.7, dark, 1, v.heading, 0, 0);
  }
  if (v.kind === 'taxi') {
    renderer.box(v.x, v.y + 2.05, v.z - 0.2, 0.9, 0.35, 0.9, [1, 0.9, 0.2], 1, v.heading, 0, 0);
  }
  if (v.kind === 'cop') {
    renderer.box(v.x - 0.5, v.y + 2.0, v.z - 0.2, 0.7, 0.3, 0.6, [1, 0.1, 0.1], 1, v.heading, 0, 0);
    renderer.box(v.x + 0.5, v.y + 2.0, v.z - 0.2, 0.7, 0.3, 0.6, [0.1, 0.3, 1], 1, v.heading, 0, 0);
  }
  if (v.kind === 'fire') {
    renderer.box(v.x, v.y + 1.6, v.z - 0.6, 1.6, 0.5, 3.4, [0.8, 0.8, 0.85], 1, v.heading, 0, 0);
  }
  if (v.damage > 60) {
    const s = Math.sin(t * 9 + v.x) * 0.4;
    renderer.box(v.x + s, v.y + 2.6, v.z, 1.2, 1.2, 1.2, [0.35, 0.35, 0.35], 0.6, v.heading, 0, 0);
  }
}

export function drawVehicles(renderer, game) {
  for (const v of game.vehicles.list) {
    if (v.kind === 'bike') {
      renderer.box(v.x, v.y + 0.7, v.z, 0.6, 0.7, 2.2, v.color, 1, v.heading, v.roll, 0);
      renderer.box(v.x, v.y + 1.15, v.z - 0.2, 0.5, 0.4, 0.8, [0.15, 0.15, 0.15], 1, v.heading, v.roll, 0);
      renderer.box(v.x, v.y + 0.35, v.z + 1.0, 0.5, 0.7, 0.25, [0.1, 0.1, 0.1], 1, v.heading, 0, 0);
      renderer.box(v.x, v.y + 0.35, v.z - 1.0, 0.5, 0.7, 0.25, [0.1, 0.1, 0.1], 1, v.heading, 0, 0);
    } else if (v.kind === 'boat') {
      renderer.box(v.x, v.y + 0.5, v.z, 2.6, 0.9, 5.2, v.color, 1, v.heading, v.roll, 0);
      renderer.box(v.x, v.y + 1.3, v.z - 0.6, 2.0, 0.8, 2.0, [0.25, 0.35, 0.5], 1, v.heading, 0, 0);
    } else if (v.kind === 'plane') {
      renderer.box(v.x, v.y + 0.8, v.z, 2.2, 1.2, 9, v.color, 1, v.heading, v.roll, v.pitch);
      renderer.box(v.x, v.y + 0.9, v.z, 11, 0.3, 2.2, v.color, 1, v.heading, v.roll, v.pitch);
      renderer.box(v.x, v.y + 1.6, v.z - 4.2, 0.4, 1.4, 1.6, v.color, 1, v.heading, 0, 0);
    } else {
      drawCar(renderer, game, v);
    }
  }
  drawLights(renderer, game);
}

export function drawLights(renderer, game) {
  for (const l of game.vehicles.lights) {
    const state = lightCycle(l.t + l.phase * 6);
    const col = state === 'green' ? [0.2, 0.9, 0.3] : state === 'yellow' ? [1, 0.8, 0.1] : [1, 0.15, 0.15];
    renderer.box(l.x + 7, 3, l.z, 0.5, 6, 0.5, COL.lampPole);
    renderer.box(l.x + 7, 6.2, l.z, 1.2, 1.8, 1.2, [0.2, 0.2, 0.22]);
    renderer.box(l.x + 7, 6.4, l.z + 0.7, 0.8, 0.8, 0.3, col);
  }
}

export { moveWithCollision };
