// Solmar Bay — the living city: dogs, birds, fish, the ring train,
// and the elevator up the Solmar Tower.
//
// Dogs wander until petted, then follow. Birds circle the beach, fish
// swim the sea, and the train runs a 300 m ring around the city.

import { mulberry32 } from './state.js';
import { pushBox } from './render.js';
import { SPAWNS } from './config.js';

const RING_R = 300;

export function trainPosAt(t) {
  return { x: RING_R * Math.sin(t), z: RING_R * Math.cos(t) };
}

export function spawnLiving(g) {
  const rng = mulberry32(44);
  const dogSpots = [
    { x: 5, z: 30 }, { x: -25, z: 50 }, { x: 40, z: -40 },
    { x: -120, z: 80 }, { x: 90, z: 60 }, { x: -200, z: -100 },
  ];
  g.dogs = dogSpots.map((spot) => ({
    x: spot.x,
    z: spot.z,
    state: 'wander',
    heading: rng() * Math.PI * 2,
    speed: 1 + rng(),
    coat: [0.5 + rng() * 0.4, 0.35 + rng() * 0.2, 0.2],
  }));
  g.birds = [];
  for (let i = 0; i < 12; i++) {
    const angle = rng() * Math.PI * 2;
    const radius = 10 + rng() * 40;
    g.birds.push({
      angle,
      radius,
      height: 20 + rng() * 25,
      speed: 0.1 + rng() * 0.15,
      x: -330 + Math.cos(angle) * radius,
      z: 60 + Math.sin(angle) * radius,
    });
  }
  g.fish = [];
  for (let i = 0; i < 12; i++) {
    g.fish.push({
      x: -380 + rng() * 70,
      z: -150 + rng() * 350,
      angle: rng() * Math.PI * 2,
      speed: 0.5 + rng(),
    });
  }
  g.train = { angle: 0, a: 0, cars: 3, speed: 0.05 };
  g.elevator = { y: 0, targetY: 0 };
  g.player.onTrain = false;
  return g;
}

export function stepLiving(g, dt) {
  const p = g.player;
  for (const dog of g.dogs) {
    if (dog.state === 'follow') {
      const d = Math.hypot(p.x - dog.x, p.z - dog.z);
      if (d > 2) {
        dog.x += ((p.x - dog.x) / d) * dog.speed * dt;
        dog.z += ((p.z - dog.z) / d) * dog.speed * dt;
        dog.heading = Math.atan2(p.x - dog.x, p.z - dog.z);
      }
    } else {
      dog.heading += (Math.random() - 0.5) * dt;
      dog.x += Math.sin(dog.heading) * dog.speed * 0.5 * dt;
      dog.z += Math.cos(dog.heading) * dog.speed * 0.5 * dt;
    }
  }
  for (const bird of g.birds) {
    bird.angle += bird.speed * dt;
    bird.x = -330 + Math.cos(bird.angle) * bird.radius;
    bird.z = 60 + Math.sin(bird.angle) * bird.radius;
  }
  for (const fish of g.fish) {
    fish.angle += (Math.random() - 0.5) * dt;
    fish.x += Math.sin(fish.angle) * fish.speed * dt;
    fish.z += Math.cos(fish.angle) * fish.speed * dt;
    fish.x = Math.max(-395, Math.min(-305, fish.x));
    fish.z = Math.max(-395, Math.min(395, fish.z));
  }
  // The train runs its ring and wraps at a full circle. `a` is the
  // canonical angle (player.js reads it); `angle` is kept in sync.
  const nextAngle = ((g.train.a ?? g.train.angle ?? 0) + g.train.speed * dt) % (Math.PI * 2);
  g.train.a = nextAngle;
  g.train.angle = nextAngle;
  // The elevator glides toward its target floor.
  if (g.elevator.y < g.elevator.targetY) {
    g.elevator.y = Math.min(g.elevator.targetY, g.elevator.y + 5 * dt);
  } else if (g.elevator.y > g.elevator.targetY) {
    g.elevator.y = Math.max(g.elevator.targetY, g.elevator.y - 5 * dt);
  }
  // Riding the train carries the player around the ring.
  if (p.onTrain) {
    const pos = trainPosAt(g.train.a ?? g.train.angle ?? 0);
    p.x = pos.x;
    p.z = pos.z;
  }
}

export function tryPetDog(g) {
  const p = g.player;
  let best = null;
  let bestD = 3;
  for (const dog of g.dogs) {
    const d = Math.hypot(p.x - dog.x, p.z - dog.z);
    if (d < bestD) {
      bestD = d;
      best = dog;
    }
  }
  if (!best) return false;
  best.state = 'follow';
  return true;
}

export function tryElevator(g) {
  const p = g.player;
  const t = SPAWNS.elevatorTower;
  if (Math.hypot(p.x - t.x, p.z - t.z) > 6) return false;
  g.elevator.targetY = 60;
  return true;
}

export function tryTrain(g) {
  const p = g.player;
  const pos = trainPosAt(g.train.a ?? g.train.angle ?? 0);
  if (Math.hypot(p.x - pos.x, p.z - pos.z) > 8) return false;
  p.onTrain = true;
  return true;
}

// Dogs, birds, fish, the three-car train and the elevator car.
export function livingBoxes(g, b, cam) {
  const plain = [0, 0, 1, 1];
  let count = 0;
  for (const dog of g.dogs) {
    pushBox(b, dog.x, 0.25, dog.z, 0.6, 0.35, 0.28, dog.coat, plain);
    pushBox(b, dog.x, 0.55, dog.z + 0.32, 0.22, 0.2, 0.2, dog.coat, plain);
    pushBox(b, dog.x - 0.2, 0, dog.z, 0.1, 0.25, 0.1, dog.coat, plain);
    pushBox(b, dog.x + 0.2, 0, dog.z, 0.1, 0.25, 0.1, dog.coat, plain);
    count += 4;
  }
  for (const bird of g.birds) {
    const bx = -330 + Math.cos(bird.angle) * bird.radius;
    const bz = 60 + Math.sin(bird.angle) * bird.radius;
    pushBox(b, bx, bird.height, bz, 0.4, 0.12, 0.3, [0.95, 0.95, 0.9], plain);
    count += 1;
  }
  for (const fish of g.fish) {
    pushBox(b, fish.x, 0.55, fish.z, 0.3, 0.1, 0.5, [0.4, 0.7, 0.9], plain);
    count += 1;
  }
  const tPos = trainPosAt(g.train.a ?? g.train.angle ?? 0);
  for (let i = 0; i < g.train.cars; i++) {
    const a = (g.train.a ?? g.train.angle ?? 0) - i * 0.04;
    const pos = trainPosAt(a);
    pushBox(b, pos.x, 0.4, pos.z, 2.6, 2.4, 6, [0.9, 0.25, 0.2], plain);
    pushBox(b, pos.x, 2.8, pos.z, 2.4, 0.5, 5.6, [0.8, 0.85, 0.9], plain);
    count += 2;
  }
  pushBox(b, SPAWNS.elevatorTower.x, g.elevator.y, SPAWNS.elevatorTower.z, 2, 2.4, 2, [0.9, 0.85, 0.4], plain);
  count += 1;
  return count;
}
