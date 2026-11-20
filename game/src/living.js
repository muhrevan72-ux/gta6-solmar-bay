// Solmar Bay — living city: dogs, birds, fish, the ring train and
// the Solmar Tower elevator.

import { SPAWNS } from './config.js';
import { pushBox } from './render.js';

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function spawnLiving(g) {
  const rng = mulberry32(99);
  g.dogs = [];
  for (let i = 0; i < 6; i++) {
    const p = { x: -100 + rng() * 300, z: -100 + rng() * 300, state: 'wander', heading: rng() * Math.PI * 2 };
    g.dogs.push(p);
  }
  g.birds = [];
  for (let i = 0; i < 12; i++) {
    const angle = rng() * Math.PI * 2;
    const radius = 20 + rng() * 30;
    g.birds.push({
      angle, radius, height: 25 + rng() * 15, speed: 0.3 + rng() * 0.4,
      x: -320 + Math.cos(angle) * radius,
      z: 60 + Math.sin(angle) * radius,
    });
  }
  g.fish = [];
  for (let i = 0; i < 12; i++) {
    g.fish.push({ x: -380 + rng() * 25, z: -280 + rng() * 560, depth: 0.2 + rng() * 0.2, speed: 0.5 + rng() });
  }
  // The train runs on a ring of radius 300 around the city centre.
  // The angle field is `a` (trainPosAt reads it).
  g.train = { a: 0, cars: 3 };
  g.elevator = { y: 0, targetY: 0 };
}

// A point on the train ring at the given angle.
export function trainPosAt(angle) {
  return { x: 300 * Math.sin(angle), z: 300 * Math.cos(angle) };
}

export function stepLiving(g, dt) {
  for (const dog of g.dogs) {
    if (dog.state === 'follow') {
      const dx = g.player.x - dog.x;
      const dz = g.player.z - dog.z;
      const d = Math.hypot(dx, dz) || 1;
      if (d > 2) {
        dog.x += (dx / d) * 4 * dt;
        dog.z += (dz / d) * 4 * dt;
      }
    } else {
      dog.x += Math.sin(dog.heading) * 1.5 * dt;
      dog.z += Math.cos(dog.heading) * 1.5 * dt;
      if (Math.random() < 0.005) dog.heading += (Math.random() - 0.5) * 3;
      if (Math.abs(dog.x) > 320 || Math.abs(dog.z) > 320) dog.heading += Math.PI;
    }
  }
  for (const bird of g.birds) {
    bird.angle += bird.speed * dt * 0.1;
    bird.x = -320 + Math.cos(bird.angle) * bird.radius;
    bird.z = 60 + Math.sin(bird.angle) * bird.radius;
  }
  for (const fish of g.fish) {
    fish.x += fish.speed * dt * 0.5;
    if (fish.x > -355) fish.x = -395;
  }
  g.train.a = (g.train.a + dt * 0.02) % (Math.PI * 2);
  // The elevator rises toward its target.
  const e = g.elevator;
  if (e.y < e.targetY) e.y = Math.min(e.targetY, e.y + 6 * dt);
  if (e.y > e.targetY) e.y = Math.max(e.targetY, e.y - 6 * dt);
  if (e.y >= e.targetY && e.targetY > 0) g.player.y = e.y;
}

// Pet a nearby dog (it follows you) or pet the one you carry.
export function tryPetDog(g) {
  for (const dog of g.dogs) {
    const d = Math.hypot(dog.x - g.player.x, dog.z - g.player.z);
    if (d < 3) {
      dog.state = 'follow';
      g.toast = 'The dog follows you now!';
      g.toastTimer = 3;
      return true;
    }
  }
  return false;
}

// Ride the elevator from the Solmar Tower door up to the roof (60 m).
export function tryElevator(g) {
  const d = Math.hypot(g.player.x - SPAWNS.elevatorTower.x, g.player.z - SPAWNS.elevatorTower.z);
  if (d > 8) return false;
  g.elevator.targetY = 60;
  g.toast = 'Elevator going up…';
  g.toastTimer = 3;
  return true;
}

// Board the train at the station when it is there.
export function tryTrain(g) {
  const station = SPAWNS.trainStation;
  const dStation = Math.hypot(g.player.x - station.x, g.player.z - station.z);
  if (dStation > 25) return false;
  const pos = trainPosAt(g.train.a);
  const dTrain = Math.hypot(pos.x - station.x, pos.z - station.z);
  if (dTrain > 25) return false;
  g.player.onTrain = true;
  g.toast = 'You boarded the train';
  g.toastTimer = 3;
  return true;
}

// Dogs, birds, fish, the train and the elevator, as boxes.
// Returns the triangle count.
export function livingBoxes(g, batch, cam) {
  let tris = 0;
  for (const dog of g.dogs) {
    const before = batch.pos.length;
    pushBox(batch, dog.x, 0, dog.z, 0.8, 0.5, 0.4, [0.6, 0.45, 0.3]);
    pushBox(batch, dog.x, 0.5, dog.z + 0.4, 0.35, 0.35, 0.35, [0.6, 0.45, 0.3]);
    tris += (batch.pos.length - before) / 9;
  }
  for (const bird of g.birds) {
    const before = batch.pos.length;
    pushBox(batch, bird.x, bird.height, bird.z, 0.6, 0.1, 0.2, [0.9, 0.9, 0.9]);
    tris += (batch.pos.length - before) / 9;
  }
  for (const fish of g.fish) {
    const before = batch.pos.length;
    pushBox(batch, fish.x, 0.5 - fish.depth, fish.z, 0.5, 0.15, 0.2, [0.9, 0.6, 0.3]);
    tris += (batch.pos.length - before) / 9;
  }
  for (let i = 0; i < g.train.cars; i++) {
    const pos = trainPosAt(g.train.a - i * 0.04);
    const before = batch.pos.length;
    pushBox(batch, pos.x, 0.4, pos.z, 3, 3, 8, [0.85, 0.2, 0.2]);
    tris += (batch.pos.length - before) / 9;
  }
  const e = g.elevator;
  const before = batch.pos.length;
  pushBox(batch, SPAWNS.elevatorTower.x, e.y, SPAWNS.elevatorTower.z, 3, 3, 3, [0.7, 0.7, 0.75]);
  tris += (batch.pos.length - before) / 9;
  return tris;
}
