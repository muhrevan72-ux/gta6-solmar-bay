// Solmar Bay — living city: dogs, birds, fish, the train, and
// the Solmar Tower elevator. The train loops a 300 m ring;
// trainPosAt(0) is the station (0,300).

import { SPAWNS } from './config.js';
import { pushBox } from './render.js';
import { showToast } from './state.js';

export function trainPosAt(a) {
  return { x: 300 * Math.sin(a), z: 300 * Math.cos(a) };
}

export function spawnLiving(g) {
  let seed = 99;
  const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  g.dogs = [];
  for (let i = 0; i < 6; i++) {
    g.dogs.push({ x: -280 + rng() * 600, z: -300 + rng() * 600, state: 'idle', type: 'dog' });
  }
  g.birds = [];
  for (let i = 0; i < 12; i++) {
    g.birds.push({ x: -300 + rng() * 700, y: 20 + rng() * 15, z: -350 + rng() * 700, a: rng() * Math.PI * 2 });
  }
  g.fish = [];
  for (let i = 0; i < 12; i++) {
    g.fish.push({ x: -390 + rng() * 40, y: -0.5, z: -300 + rng() * 600, a: rng() * Math.PI * 2 });
  }
  g.train = { a: 0, cars: 3, speed: 0.05 };
  g.elevator = { x: SPAWNS.elevatorTower.x, z: SPAWNS.elevatorTower.z, y: 0, targetY: 0 };
  return g;
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
    }
  }
  for (const b of g.birds) {
    b.a += dt * 0.3;
    b.x += Math.cos(b.a) * 6 * dt;
    b.z += Math.sin(b.a) * 6 * dt;
    if (b.x > 400) b.x = -350;
    if (b.x < -380) b.x = 380;
    if (b.z > 400) b.z = -350;
    if (b.z < -380) b.z = 380;
  }
  for (const f of g.fish) {
    f.a += dt * 0.5;
    f.x += Math.cos(f.a) * 1.5 * dt;
    f.z += Math.sin(f.a) * 1.5 * dt;
  }
  if (g.train) {
    g.train.a = (g.train.a + g.train.speed * dt) % (Math.PI * 2);
  }
  if (g.elevator && g.elevator.y !== g.elevator.targetY) {
    const step = 6 * dt; // 60 m in 10 s
    if (g.elevator.y < g.elevator.targetY) g.elevator.y = Math.min(g.elevator.targetY, g.elevator.y + step);
    else g.elevator.y = Math.max(g.elevator.targetY, g.elevator.y - step);
  }
}

export function tryPetDog(g) {
  let best = null, bestD = 3;
  for (const d of g.dogs) {
    const dist = Math.hypot(d.x - g.player.x, d.z - g.player.z);
    if (dist < bestD) { bestD = dist; best = d; }
  }
  if (!best) return false;
  best.state = 'follow';
  showToast(g, 'The dog follows you now');
  return true;
}

export function tryTrain(g) {
  const st = SPAWNS.trainStation;
  const nearStation = Math.hypot(g.player.x - st.x, g.player.z - st.z) < 6;
  if (!nearStation || !g.train) return false;
  const tp = trainPosAt(g.train.a);
  if (Math.hypot(tp.x - st.x, tp.z - st.z) > 12) return false;
  g.player.onTrain = true;
  showToast(g, 'You boarded the train');
  return true;
}

export function tryElevator(g) {
  const t = SPAWNS.elevatorTower;
  if (Math.hypot(g.player.x - t.x, g.player.z - t.z) > 6) return false;
  g.elevator.targetY = 60;
  showToast(g, 'Elevator rising to the rooftop');
  return true;
}

// Dogs, birds, fish, train, elevator — well over 50 triangles.
export function livingBoxes(g, batch) {
  let tris = 0;
  const plain = [0, 0, 1, 1];
  for (const d of g.dogs) {
    pushBox(batch, d.x, 0, d.z, 0.8, 0.4, 0.4, [0.6, 0.4, 0.2], plain);
    pushBox(batch, d.x + 0.5, 0.3, d.z, 0.35, 0.35, 0.35, [0.6, 0.4, 0.2], plain);
    pushBox(batch, d.x - 0.45, 0.3, d.z, 0.3, 0.2, 0.2, [0.4, 0.25, 0.1], plain);
    tris += 36;
  }
  for (const b of g.birds) {
    pushBox(batch, b.x, b.y, b.z, 0.5, 0.2, 0.3, [0.2, 0.2, 0.25], plain);
    pushBox(batch, b.x, b.y + 0.1, b.z, 0.9, 0.05, 0.4, [0.9, 0.9, 0.95], plain);
    tris += 24;
  }
  for (const f of g.fish) {
    pushBox(batch, f.x, f.y, f.z, 0.5, 0.2, 0.2, [0.9, 0.6, 0.2], plain);
    tris += 12;
  }
  if (g.train) {
    for (let i = 0; i < g.train.cars; i++) {
      const p = trainPosAt(g.train.a - i * 0.05);
      pushBox(batch, p.x, 0.5, p.z, 3, 3, 8, [0.8, 0.2, 0.2], plain);
      pushBox(batch, p.x, 3.5, p.z, 2.6, 0.5, 7.5, [0.9, 0.9, 0.9], plain);
      tris += 24;
    }
  }
  if (g.elevator) {
    pushBox(batch, g.elevator.x, g.elevator.y, g.elevator.z, 3, 3, 3, [0.85, 0.85, 0.9], plain);
    tris += 12;
  }
  return tris;
}
