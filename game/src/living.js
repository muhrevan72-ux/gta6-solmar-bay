// Solmar Bay — ambient life: dogs, birds, fish, train, elevator (rebuild #13).
import { pushBox } from './render.js';
import { SPAWNS } from './config.js';
import { randomSidewalkPoint } from './world.js';

export function trainPosAt(a) {
  return { x: 300 * Math.sin(a), z: 300 * Math.cos(a) };
}

export function spawnLiving(g) {
  g.dogs = [];
  for (let i = 0; i < 6; i++) {
    const p = randomSidewalkPoint(Math.random);
    g.dogs.push({ x: p.x, z: p.z, state: 'wander', heading: Math.random() * Math.PI * 2 });
  }
  g.birds = [];
  for (let i = 0; i < 12; i++) {
    g.birds.push({ x: -330 + Math.random() * 40, z: -200 + i * 35, y: 25 + Math.random() * 15, a: (i / 12) * Math.PI * 2 });
  }
  g.fish = [];
  for (let i = 0; i < 12; i++) {
    g.fish.push({ x: -380 + Math.random() * 40, z: -200 + i * 32, a: Math.random() * Math.PI * 2 });
  }
  g.train = { a: 0, cars: 3, speed: 0.05 };
  g.elevator = { y: 0, targetY: 0 };
}

export function tryPetDog(g) {
  for (const d of g.dogs) {
    if (Math.hypot(d.x - g.player.x, d.z - g.player.z) < 3) {
      d.state = 'follow';
      return true;
    }
  }
  return false;
}

export function tryElevator(g) {
  const d = Math.hypot(g.player.x - SPAWNS.elevatorTower.x, g.player.z - SPAWNS.elevatorTower.z);
  if (d > 10) return false;
  g.elevator.targetY = 60;
  return true;
}

export function tryTrain(g) {
  const st = SPAWNS.trainStation;
  if (Math.hypot(g.player.x - st.x, g.player.z - st.z) > 10) return false;
  const tp = trainPosAt(g.train.a);
  if (Math.hypot(tp.x - st.x, tp.z - st.z) > 25) return false;
  g.player.onTrain = true;
  return true;
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
    } else {
      d.heading += (Math.random() - 0.5) * dt;
      d.x += Math.sin(d.heading) * 1.5 * dt;
      d.z += Math.cos(d.heading) * 1.5 * dt;
    }
  }
  for (const b of g.birds) {
    b.a += dt * 0.3;
    b.x = -320 + Math.cos(b.a) * 30;
    b.z += Math.sin(b.a) * dt * 5;
  }
  for (const f of g.fish) {
    f.a += dt * 0.5;
    f.x += Math.cos(f.a) * dt * 2;
    f.z += Math.sin(f.a) * dt * 2;
  }
  if (g.train) {
    g.train.a += g.train.speed * dt;
    if (g.train.a >= Math.PI * 2) g.train.a -= Math.PI * 2;
  }
  if (g.elevator) {
    const diff = g.elevator.targetY - g.elevator.y;
    if (Math.abs(diff) > 0.01) {
      g.elevator.y += Math.sign(diff) * Math.min(Math.abs(diff), 6 * dt);
    }
  }
}

export function livingBoxes(g, b, cam) {
  const plain = [0, 0, 1, 1];
  let n = 0;
  const box = (x, y, z, w, h, d, col) => { pushBox(b, x, y, z, w, h, d, col, plain); n++; };
  for (const d of g.dogs) {
    box(d.x, 0.3, d.z, 0.9, 0.5, 0.4, [0.6, 0.45, 0.3]);
    box(d.x + 0.5, 0.7, d.z, 0.35, 0.35, 0.35, [0.6, 0.45, 0.3]);
    box(d.x - 0.5, 0.5, d.z, 0.3, 0.2, 0.15, [0.6, 0.45, 0.3]);
  }
  for (const bd of g.birds) box(bd.x, bd.y, bd.z, 0.8, 0.2, 0.3, [0.9, 0.9, 0.95]);
  for (const f of g.fish) box(f.x, 0.2, f.z, 0.7, 0.2, 0.25, [0.9, 0.6, 0.3]);
  if (g.train) {
    const tp = trainPosAt(g.train.a);
    for (let i = 0; i < g.train.cars; i++) {
      const a = g.train.a - i * 0.05;
      const p = trainPosAt(a);
      box(p.x, 0.5, p.z, 3, 2.5, 6, [0.2, 0.4, 0.8]);
    }
  }
  if (g.elevator) {
    box(SPAWNS.elevatorTower.x, g.elevator.y, SPAWNS.elevatorTower.z, 3, 2.5, 3, [0.8, 0.8, 0.85]);
  }
  return n;
}
