// Solmar Bay — the living city: dogs, birds, fish, the train and
// the Solmar Tower elevator. Written fresh for rebuild #18.

import { mulberry32, SPAWNS } from './config.js';
import { randomSidewalkPoint } from './world.js';
import { pushBox, pushBoxRot } from './render.js';
import { showToast } from './state.js';

export function trainPosAt(a) {
  return { x: 300 * Math.sin(a), z: 300 * Math.cos(a) };
}

export function spawnLiving(g) {
  const rng = mulberry32(808);
  const dogs = [];
  for (let i = 0; i < 6; i++) {
    const p = randomSidewalkPoint(rng);
    dogs.push({ x: p.x, z: p.z, state: 'wander', tx: p.x, tz: p.z, speed: 1.5 + rng() });
  }
  const birds = [];
  for (let i = 0; i < 12; i++) {
    birds.push({
      x: -320 + rng() * 60, z: 40 + rng() * 120,
      y: 20 + rng() * 15, angle: rng() * Math.PI * 2, r: 20 + rng() * 30,
    });
  }
  const fish = [];
  for (let i = 0; i < 12; i++) {
    const cx = -380 + rng() * 30;
    const cz = -100 + rng() * 300;
    fish.push({
      x: cx, z: cz, cx, cz,
      y: -0.5, angle: rng() * Math.PI * 2, r: 5 + rng() * 10,
    });
  }
  g.dogs = dogs;
  g.birds = birds;
  g.fish = fish;
  g.train = { a: 0, cars: 3, speed: 0.05 };
  g.elevator = { y: 0, targetY: 0 };
  return { dogs, birds, fish };
}

export function stepLiving(g, dt) {
  for (const d of g.dogs) {
    if (d.state === 'follow') {
      const dx = g.player.x - d.x, dz = g.player.z - d.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 2) {
        d.x += (dx / dist) * 4 * dt;
        d.z += (dz / dist) * 4 * dt;
      }
      continue;
    }
    const dx = d.tx - d.x, dz = d.tz - d.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1) {
      const t = randomSidewalkPoint(Math.random);
      d.tx = t.x; d.tz = t.z;
    } else {
      d.x += (dx / dist) * d.speed * dt;
      d.z += (dz / dist) * d.speed * dt;
    }
  }
  for (const b of g.birds) {
    b.angle += dt * 0.3;
    b.x = -320 + Math.cos(b.angle) * b.r;
    b.z = 100 + Math.sin(b.angle) * b.r;
  }
  for (const f of g.fish) {
    f.angle += dt * 0.5;
    f.x = f.cx + Math.cos(f.angle) * f.r;
    f.z = f.cz + Math.sin(f.angle) * f.r;
  }
  if (g.train) {
    g.train.a += (g.train.speed || 0.05) * dt;
    if (g.train.a > Math.PI * 2) g.train.a -= Math.PI * 2;
  }
  if (g.elevator) {
    const dy = g.elevator.targetY - g.elevator.y;
    if (Math.abs(dy) > 0.05) {
      g.elevator.y += Math.sign(dy) * 5 * dt;
    } else {
      g.elevator.y = g.elevator.targetY;
    }
  }
}

export function tryPetDog(g) {
  let best = null;
  let bestD = 3;
  for (const d of g.dogs) {
    if (d.state === 'follow') continue;
    const dist = Math.hypot(d.x - g.player.x, d.z - g.player.z);
    if (dist < bestD) { best = d; bestD = dist; }
  }
  if (!best) return false;
  best.state = 'follow';
  showToast(g, 'A dog is following you now');
  return true;
}

export function tryElevator(g) {
  const door = SPAWNS.elevatorTower;
  const d = Math.hypot(g.player.x - door.x, g.player.z - door.z);
  if (d > 8) return false;
  g.elevator.targetY = 60;
  showToast(g, 'Elevator going up');
  return true;
}

export function tryTrain(g) {
  const station = SPAWNS.trainStation;
  const d = Math.hypot(g.player.x - station.x, g.player.z - station.z);
  if (d > 12) return false;
  const pos = trainPosAt(g.train.a);
  const td = Math.hypot(pos.x - station.x, pos.z - station.z);
  if (td > 30) return false;
  g.player.onTrain = true;
  showToast(g, 'You boarded the train');
  return true;
}

// Dogs + birds + fish + train + elevator, as boxes (> 50 tris).
export function livingBoxes(g, b, gl) {
  let n = 0;
  for (const d of g.dogs) {
    pushBox(b, d.x, 0.2, d.z, 0.5, 0.35, 0.8, [0.6, 0.45, 0.3], [0, 0, 1, 1]);
    pushBox(b, d.x, 0.55, d.z + 0.45, 0.3, 0.3, 0.3, [0.6, 0.45, 0.3], [0, 0, 1, 1]);
    n += 2;
  }
  for (const bd of g.birds) {
    pushBox(b, bd.x, bd.y, bd.z, 0.5, 0.1, 0.2, [0.9, 0.9, 0.95], [0, 0, 1, 1]);
    n += 1;
  }
  for (const f of g.fish) {
    pushBox(b, f.x, f.y, f.z, 0.5, 0.15, 0.2, [0.4, 0.6, 0.9], [0, 0, 1, 1]);
    n += 1;
  }
  if (g.train) {
    const pos = trainPosAt(g.train.a);
    for (let i = 0; i < g.train.cars; i++) {
      const back = i * 6;
      pushBox(b, pos.x, 0.5, pos.z - back, 3, 3, 5, [0.8, 0.2, 0.2], [0, 0, 1, 1]);
      n += 1;
    }
  }
  if (g.elevator) {
    pushBox(b, SPAWNS.elevatorTower.x, g.elevator.y, SPAWNS.elevatorTower.z, 2, 2.5, 2, [0.85, 0.85, 0.9], [0, 0, 1, 1]);
    n += 1;
  }
  return n * 12;
}
