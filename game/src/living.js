// Solmar Bay — the living city (rebuild #14).
// Dogs, birds, fish, a train on a ring, and the elevator up the
// Solmar Tower. The train loops a 300 m ring around the city.

import { SPAWNS } from './config.js';
import { mulberry32 } from './state.js';
import { pushBox, pushBoxRot } from './render.js';
import { randomSidewalkPoint } from './world.js';

export function trainPosAt(a) {
  return { x: 300 * Math.sin(a), z: 300 * Math.cos(a) };
}

export function spawnLiving(g) {
  const rng = mulberry32(7);
  const dogs = [];
  const cols = [[0.6, 0.45, 0.3], [0.2, 0.2, 0.2], [0.9, 0.85, 0.7], [0.8, 0.6, 0.4], [0.5, 0.35, 0.2], [0.95, 0.95, 0.95]];
  for (let i = 0; i < 6; i++) {
    const p = randomSidewalkPoint(rng);
    dogs.push({ x: p.x, z: p.z, col: cols[i], state: 'wander', heading: rng() * Math.PI * 2, target: null });
  }
  const birds = [];
  for (let i = 0; i < 12; i++) {
    const a = rng() * Math.PI * 2;
    birds.push({ a, r: 30 + rng() * 40, h: 30 + rng() * 20, x: -330 + Math.cos(a) * 40, z: 40 + Math.sin(a) * 40 });
  }
  const fish = [];
  for (let i = 0; i < 12; i++) {
    fish.push({ x: -380 + rng() * 40, z: -100 + rng() * 200, a: rng() * Math.PI * 2 });
  }
  g.dogs = dogs;
  g.birds = birds;
  g.fish = fish;
  if (!g.train) g.train = { cars: 3, a: 0, angle: 0 };
  if (!g.elevator) g.elevator = { y: 0, targetY: 0 };
  return { dogs, birds, fish };
}

export function tryPetDog(g) {
  let best = null;
  let bestD = 4;
  for (const d of g.dogs || []) {
    const dist = Math.hypot(d.x - g.player.x, d.z - g.player.z);
    if (dist < bestD) {
      bestD = dist;
      best = d;
    }
  }
  if (!best) return false;
  best.state = 'follow';
  return true;
}

export function tryElevator(g) {
  const d = Math.hypot(g.player.x - SPAWNS.elevatorTower.x, g.player.z - SPAWNS.elevatorTower.z);
  if (d > 8) return false;
  g.elevator.targetY = 60;
  return true;
}

export function tryTrain(g) {
  const st = SPAWNS.trainStation;
  const d = Math.hypot(g.player.x - st.x, g.player.z - st.z);
  if (d > 10) return false;
  const tp = trainPosAt(g.train.a);
  const td = Math.hypot(tp.x - st.x, tp.z - st.z);
  if (td > 20) return false;
  g.player.onTrain = true;
  return true;
}

export function stepLiving(g, dt) {
  // Train loops the ring.
  if (g.train) {
    g.train.a = (g.train.a + 0.02 * dt) % (Math.PI * 2);
    g.train.angle = g.train.a;
  }
  // Elevator rises toward its target floor.
  if (g.elevator && g.elevator.targetY > g.elevator.y) {
    g.elevator.y = Math.min(g.elevator.targetY, g.elevator.y + 3 * dt);
  }
  // Birds circle the beach.
  for (const b of g.birds || []) {
    b.a += 0.3 * dt;
    b.x = -330 + Math.cos(b.a) * b.r;
    b.z = 40 + Math.sin(b.a) * b.r;
  }
  // Fish swim.
  for (const f of g.fish || []) {
    f.a += 0.2 * dt;
    f.x += Math.cos(f.a) * 1.5 * dt;
    f.z += Math.sin(f.a) * 1.5 * dt;
    if (f.x > -340) f.x = -380;
    if (f.x < -390) f.x = -350;
  }
  // Dogs wander, or follow the player once petted.
  for (const d of g.dogs || []) {
    if (d.state === 'follow') {
      const dx = g.player.x - d.x;
      const dz = g.player.z - d.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 2) {
        d.x += (dx / dist) * 3 * dt;
        d.z += (dz / dist) * 3 * dt;
      }
      continue;
    }
    if (!d.target) {
      const t = randomSidewalkPoint(g.rng);
      d.target = { x: t.x, z: t.z };
    }
    const dx = d.target.x - d.x;
    const dz = d.target.z - d.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1) {
      d.target = null;
    } else {
      d.x += (dx / dist) * 1.5 * dt;
      d.z += (dz / dist) * 1.5 * dt;
      d.heading = Math.atan2(dx / dist, dz / dist);
    }
  }
}

// Dogs, birds, fish, the train and the elevator.
export function livingBoxes(g, b, camera) {
  let n = 0;
  for (const d of g.dogs || []) {
    pushBoxRot(b, d.x, 0.3, d.z, 0.7, 0.4, 0.3, d.heading || 0, d.col || [0.6, 0.45, 0.3]);
    pushBoxRot(b, d.x + 0.4, 0.35, d.z, 0.25, 0.25, 0.25, d.heading || 0, d.col || [0.6, 0.45, 0.3]);
    n += 2;
  }
  for (const bird of g.birds || []) {
    pushBox(b, bird.x, bird.h, bird.z, 0.3, 0.15, 0.3, [0.2, 0.2, 0.2]);
    n += 1;
  }
  for (const f of g.fish || []) {
    pushBox(b, f.x, 0.2, f.z, 0.5, 0.15, 0.2, [0.9, 0.6, 0.3]);
    n += 1;
  }
  // The train: 3 cars on the ring.
  if (g.train) {
    for (let i = 0; i < 3; i++) {
      const p = trainPosAt(g.train.a - i * 0.03);
      pushBoxRot(b, p.x, 1, p.z, 4, 3, 2.5, g.train.a, [0.9, 0.2, 0.2]);
      pushBoxRot(b, p.x, 4, p.z, 3.6, 0.5, 2.2, g.train.a, [0.2, 0.2, 0.25]);
      n += 2;
    }
  }
  // The elevator car.
  if (g.elevator) {
    pushBox(b, SPAWNS.elevatorTower.x, g.elevator.y, SPAWNS.elevatorTower.z, 2, 2.5, 2, [0.8, 0.8, 0.85]);
    n += 1;
  }
  return n;
}
