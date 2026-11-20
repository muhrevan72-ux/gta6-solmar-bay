// Solmar Bay — ambient life.
//
// Dogs that wander and follow when petted, birds circling the
// beach, fish in the shallows, a train looping the city on a 300 m
// circle, and the Solmar Tower elevator. trainPosAt(a) puts the
// train at (300·sin a, 300·cos a): angle 0 is south, PI/2 is east.

import { SPAWNS } from './config.js';
import { pushBox } from './render.js';

export function trainPosAt(a) {
  return { x: 300 * Math.sin(a), z: 300 * Math.cos(a) };
}

export function spawnLiving(g) {
  const dogs = [];
  for (let i = 0; i < 6; i++) {
    dogs.push({
      x: -20 + i * 8, z: 40 + (i % 3) * 10,
      heading: Math.random() * Math.PI * 2,
      state: 'wander', wanderA: Math.random() * Math.PI * 2,
    });
  }
  const birds = [];
  for (let i = 0; i < 12; i++) {
    birds.push({ a: (i / 12) * Math.PI * 2, x: -340, z: 0, y: 25 + (i % 3) * 5 });
  }
  const fish = [];
  for (let i = 0; i < 12; i++) {
    fish.push({ x: -380 + i * 4, z: -100 + i * 18, a: Math.random() * Math.PI * 2 });
  }
  g.dogs = dogs;
  g.birds = birds;
  g.fish = fish;
  g.train = { a: 0, cars: 3 };
  g.elevator = { y: 0, targetY: 0 };
}

export function stepLiving(g, dt) {
  // Dogs: wander, or follow the player when petted.
  for (const d of g.dogs) {
    if (d.state === 'follow') {
      const dx = g.player.x - d.x;
      const dz = g.player.z - d.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 2) {
        const step = Math.min(dist - 1, 4 * dt);
        d.x += (dx / dist) * step;
        d.z += (dz / dist) * step;
      }
    } else {
      if (Math.random() < 0.02) d.wanderA = Math.random() * Math.PI * 2;
      d.x += Math.sin(d.wanderA) * 1.5 * dt;
      d.z += Math.cos(d.wanderA) * 1.5 * dt;
    }
  }
  // Birds circle the beach; fish swim in the shallows.
  for (const b of g.birds) {
    b.a += dt * 0.3;
    b.x = -340 + Math.cos(b.a) * 30;
    b.z = Math.sin(b.a) * 60;
  }
  for (const f of g.fish) {
    f.a += dt * 0.5;
    f.x += Math.sin(f.a) * 1.2 * dt;
    f.z += Math.cos(f.a) * 1.2 * dt;
    if (f.x < -420) f.x = -340;
    if (f.x > -340) f.x = -420;
  }
  // The train loops; its angle wraps at 2 PI.
  if (g.train) {
    g.train.a += dt * 0.05;
    if (g.train.a >= Math.PI * 2) g.train.a -= Math.PI * 2;
    if (g.player.onTrain) {
      const pos = trainPosAt(g.train.a);
      g.player.x = pos.x;
      g.player.z = pos.z;
    }
  }
  // The elevator rises toward its target floor.
  if (g.elevator) {
    const dy = g.elevator.targetY - g.elevator.y;
    if (Math.abs(dy) > 0.01) {
      const step = Math.sign(dy) * Math.min(Math.abs(dy), 6 * dt);
      g.elevator.y += step;
      if (g.player.inside === 'elevator') g.player.y = g.elevator.y;
    }
  }
}

// Pet a nearby dog (within ~3 m) — it follows the player.
export function tryPetDog(g) {
  for (const d of g.dogs) {
    if (Math.hypot(d.x - g.player.x, d.z - g.player.z) < 3) {
      d.state = 'follow';
      g.player.petting = 2;
      return true;
    }
  }
  return false;
}

// Board the train: the player must be at the station and the train
// must be near it too.
export function tryTrain(g) {
  const st = SPAWNS.trainStation;
  if (Math.hypot(g.player.x - st.x, g.player.z - st.z) > 6) return false;
  if (!g.train) return false;
  const pos = trainPosAt(g.train.a);
  if (Math.hypot(pos.x - st.x, pos.z - st.z) > 30) return false;
  g.player.onTrain = true;
  return true;
}

// Call the elevator at the Solmar Tower door.
export function tryElevator(g) {
  const t = SPAWNS.elevatorTower;
  if (Math.hypot(g.player.x - t.x, g.player.z - t.z) > 6) return false;
  if (!g.elevator) return false;
  g.elevator.targetY = 60;
  g.player.inside = 'elevator';
  return true;
}

// Dogs, birds, fish, the train and the elevator — over 50 tris.
export function livingBoxes(g, b, camera) {
  let n = 0;
  const put = (x, y, z, w, h, d, col) => { pushBox(b, x, y, z, w, h, d, col); n++; };
  for (const dog of g.dogs || []) {
    put(dog.x, 0.3, dog.z, 0.9, 0.5, 0.4, [0.6, 0.45, 0.3]); // body
    put(dog.x, 0.7, dog.z + 0.45, 0.35, 0.35, 0.35, [0.6, 0.45, 0.3]); // head
  }
  for (const bird of g.birds || []) {
    put(bird.x, bird.y, bird.z, 0.8, 0.15, 0.3, [0.95, 0.95, 0.95]); // body
    put(bird.x, bird.y + 0.1, bird.z, 1.4, 0.08, 0.3, [0.9, 0.9, 0.92]); // wings
  }
  for (const f of g.fish || []) {
    put(f.x, -0.3, f.z, 0.5, 0.2, 0.25, [0.9, 0.6, 0.2]); // fish
  }
  if (g.train) {
    const pos = trainPosAt(g.train.a);
    for (let i = 0; i < (g.train.cars || 3); i++) {
      const back = i * 8;
      put(pos.x - Math.sin(g.train.a) * back, 1, pos.z - Math.cos(g.train.a) * back, 3, 2.5, 7, [0.8, 0.2, 0.2]);
    }
  }
  if (g.elevator) {
    put(SPAWNS.elevatorTower.x, g.elevator.y, SPAWNS.elevatorTower.z, 3, 3, 3, [0.7, 0.75, 0.8]);
  }
  return n;
}
