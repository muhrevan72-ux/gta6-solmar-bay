// Solmar Bay — living city: the loop train (board and ride with E),
// fish in the harbour water, birds circling above the city, drifting
// voxel clouds, and the glass elevator on the tallest tower (ride to
// the rooftop observation deck, collect $50 once).

import { dist2 } from './config.js';
import { addCash, showToast } from './state.js';

// Train track: rectangle loop, corners at (+-320, +-320).
// Position along the loop, in metres from the station corner.
export const TRACK_PERIMETER = 4 * 640;

export function createLiving(city) {
  const track = city.trainTrack;
  return {
    trainS: 0, // metres along the loop
    trainSpeed: 14,
    fish: [],
    birds: [],
    clouds: [],
    elevator: { y: 0, moving: 0, collected: false },
    riding: false, // player is on the train
    onElevator: false,
    stationWait: 0,
    track,
  };
}

export function initLivingAmbience(living) {
  // fish in the harbour/beach water
  for (let i = 0; i < 12; i++) {
    living.fish.push({
      x: -390 + Math.random() * 50,
      z: -350 + Math.random() * 700,
      y: -0.5,
      phase: Math.random() * 6,
      speed: 1 + Math.random() * 2,
    });
  }
  // birds circling above the city
  for (let i = 0; i < 8; i++) {
    living.birds.push({
      cx: -200 + Math.random() * 400,
      cz: -200 + Math.random() * 400,
      r: 30 + Math.random() * 40,
      h: 45 + Math.random() * 25,
      angle: Math.random() * Math.PI * 2,
      speed: 0.15 + Math.random() * 0.1,
    });
  }
  // clouds drifting across the sky
  for (let i = 0; i < 7; i++) {
    living.clouds.push({
      x: -350 + Math.random() * 700,
      z: -350 + Math.random() * 700,
      y: 90 + Math.random() * 40,
      sx: 30 + Math.random() * 30,
      speed: 1.5 + Math.random(),
    });
  }
}

// Point on the rectangular track at distance s along the loop.
export function trackPoint(track, s) {
  const per = TRACK_PERIMETER;
  let d = ((s % per) + per) % per;
  const corners = track.corners;
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (d <= len) {
      const t = d / len;
      return {
        x: a.x + (b.x - a.x) * t,
        z: a.z + (b.z - a.z) * t,
        heading: Math.atan2(b.x - a.x, b.z - a.z),
      };
    }
    d -= len;
  }
  return { x: corners[0].x, z: corners[0].z, heading: 0 };
}

// Train car positions (3 cars, 12 units apart behind the engine).
export function trainCarPos(living, carIndex) {
  return trackPoint(living.track, living.trainS - carIndex * 12);
}

export function nearestTrainCar(living, x, z) {
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < 3; i++) {
    const pos = trainCarPos(living, i);
    const d = dist2(x, z, pos.x, pos.z);
    if (d < bestD) {
      bestD = d;
      best = pos;
    }
  }
  return { pos: best, dist: Math.sqrt(bestD) };
}

// Is the train at the station (west side, z near 0)?
export function trainAtStation(living) {
  const pos = trackPoint(living.track, living.trainS);
  return Math.abs(pos.x + 320) < 20 && Math.abs(pos.z) < 30;
}

export function boardTrain(game) {
  const living = game.living;
  const p = game.player;
  const near = nearestTrainCar(living, p.x, p.z);
  if (near.dist > 8) return false;
  if (!trainAtStation(living)) {
    showToast(game.state, 'The train only stops at the station.', 2);
    return false;
  }
  living.riding = true;
  p.onTrain = true;
  showToast(game.state, 'Riding the train! Press E to get off at the station.', 3);
  return true;
}

export function exitTrain(game) {
  const living = game.living;
  const p = game.player;
  if (!trainAtStation(living)) {
    showToast(game.state, 'The train only stops at the station.', 2);
    return false;
  }
  living.riding = false;
  p.onTrain = false;
  const st = living.track.station;
  p.x = st.x + 12;
  p.z = st.z;
  p.y = 0;
  return true;
}

// Glass elevator on the tallest tower (50, 50), exterior south face.
// Platform at (50, 76): press E to ride up to the rooftop deck.
export function toggleElevator(game) {
  const living = game.living;
  const p = game.player;
  const el = living.elevator;
  if (el.moving !== 0) return false;
  if (!living.onElevator) {
    // step on: must be near the platform
    if (dist2(p.x, p.z, 50, 76) > 25) return false;
    living.onElevator = true;
    p.onElevator = true;
    el.moving = 1; // going up
    showToast(game.state, 'Elevator going up...', 2);
    return true;
  }
  el.moving = -1; // going down
  return true;
}

export function updateLiving(game, dt) {
  const living = game.living;
  const p = game.player;
  // train loops the city
  living.trainS += living.trainSpeed * dt;
  if (living.riding) {
    const pos = trackPoint(living.track, living.trainS);
    p.x = pos.x;
    p.z = pos.z;
    p.y = 0;
    p.heading = pos.heading;
  }
  // fish swim
  for (const f of living.fish) {
    f.phase += dt * f.speed;
    f.x += Math.sin(f.phase * 0.5) * dt * 2;
    f.z += Math.cos(f.phase * 0.3) * dt * 1.5;
    if (f.x < -395) f.x = -340;
    if (f.x > -335) f.x = -390;
  }
  // birds circle
  for (const b of living.birds) {
    b.angle += b.speed * dt;
  }
  // clouds drift east
  for (const c of living.clouds) {
    c.x += c.speed * dt;
    if (c.x > 420) c.x = -420;
  }
  // elevator rides
  const el = living.elevator;
  if (el.moving !== 0) {
    el.y += el.moving * 12 * dt;
    if (el.moving > 0 && el.y >= 70) {
      el.y = 70;
      el.moving = 0;
      if (!el.collected) {
        el.collected = true;
        addCash(game.state, 50);
        showToast(game.state, 'Rooftop deck! Found $50. The view is unreal.', 3);
      } else {
        showToast(game.state, 'Rooftop observation deck. Press E to ride down.', 3);
      }
    } else if (el.moving < 0 && el.y <= 0) {
      el.y = 0;
      el.moving = 0;
      living.onElevator = false;
      p.onElevator = false;
      p.x = 50;
      p.z = 76;
      p.y = 0;
    }
    if (living.onElevator) {
      p.x = 50;
      p.z = 76;
      p.y = el.y;
    }
  }
}

export function livingBoxes(game) {
  const living = game.living;
  const boxes = [];
  // train: engine + 2 cars
  for (let i = 0; i < 3; i++) {
    const pos = trainCarPos(living, i);
    const c = i === 0 ? [0.2, 0.5, 0.9] : [0.75, 0.78, 0.85];
    boxes.push({ x: pos.x, y: 1.6, z: pos.z, sx: 4, sy: 3, sz: 10, c });
    boxes.push({ x: pos.x, y: 3.4, z: pos.z, sx: 3.6, sy: 0.6, sz: 9, c: [0.15, 0.15, 0.18] });
  }
  // fish (small, near the surface)
  for (const f of living.fish) {
    boxes.push({ x: f.x, y: 0.4, z: f.z, sx: 0.8, sy: 0.3, sz: 1.6, c: [1, 0.7, 0.2] });
  }
  // birds
  for (const b of living.birds) {
    const x = b.cx + Math.cos(b.angle) * b.r;
    const z = b.cz + Math.sin(b.angle) * b.r;
    boxes.push({ x, y: b.h, z, sx: 1.4, sy: 0.3, sz: 0.5, c: [0.25, 0.25, 0.3] });
  }
  // clouds
  for (const c of living.clouds) {
    boxes.push({ x: c.x, y: c.y, z: c.z, sx: c.sx, sy: 4, sz: 18, c: [1, 1, 1], a: 0.9 });
  }
  // elevator platform + shaft
  const el = living.elevator;
  boxes.push({ x: 50, y: el.y + 0.4, z: 76, sx: 6, sy: 0.8, sz: 6, c: [0.7, 0.85, 0.95], a: 0.85 });
  boxes.push({ x: 50, y: 36, z: 76, sx: 0.5, sy: 72, sz: 0.5, c: [0.6, 0.6, 0.65] });
  // animated ocean wave crests (graphics pass): pale foam boxes on
  // the water surface that drift east and bob with game.waterT, in
  // phase with the water plane's own bob (main.js shifts it by
  // sin(waterT * 0.8) * 0.15). 12 crests, cheap and capped.
  const wt = game.waterT || 0;
  for (let i = 0; i < 12; i++) {
    const baseZ = -360 + i * 62;
    const drift = ((wt * 3 + i * 37) % 60) - 30;
    const x = -362 + drift;
    const bob = Math.sin(wt * 0.8 + i * 1.3) * 0.15;
    boxes.push({ x, y: 0.5 + bob, z: baseZ, sx: 10, sy: 0.25, sz: 1.6, c: [0.85, 0.95, 1], a: 0.55 });
  }
  return boxes;
}
