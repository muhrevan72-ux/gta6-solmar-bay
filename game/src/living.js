// Solmar Bay — ambient life.
//
// Dogs that follow the player, birds circling the beach, fish
// under the pier, a train looping the city on its ring track,
// and the elevator in Solmar Tower. These are the systems that
// make the city feel alive when nothing else is happening.

import { makeRng, SPAWNS } from './config.js';
import { pushBox, pushBoxRot } from './render.js';
import { tileUV } from './texture.js';
import { dist } from './config.js';
import { showToast } from './state.js';

export function spawnLiving(game) {
  const rng = makeRng(99);
  game.dogs = [];
  for (let i = 0; i < 6; i++) {
    game.dogs.push({
      x: -100 + rng() * 200,
      z: -100 + rng() * 200,
      heading: rng() * Math.PI * 2,
      speed: 3,
      state: 'wander',
      target: { x: 0, z: 0 },
      wait: rng() * 3,
      colour: [[0.5, 0.35, 0.2], [0.15, 0.15, 0.15], [0.9, 0.9, 0.9]][i % 3],
      id: Math.random().toString(36).slice(2, 8),
    });
  }
  game.birds = [];
  for (let i = 0; i < 12; i++) {
    game.birds.push({
      x: -320 + rng() * 60,
      z: -200 + rng() * 400,
      y: 30 + rng() * 20,
      a: rng() * Math.PI * 2,
      r: 20 + rng() * 30,
      speed: 0.3 + rng() * 0.3,
    });
  }
  game.fish = [];
  for (let i = 0; i < 12; i++) {
    game.fish.push({
      x: -380 + rng() * 30,
      z: 0 + rng() * 200,
      y: -0.5,
      a: rng() * Math.PI * 2,
      speed: 0.5 + rng() * 0.5,
    });
  }
  game.train = { a: 0, speed: 0.08, cars: 3 };
  game.elevator = { y: 0, targetY: 0, moving: false };
}

// Train position on the ring track (±300) at angle a.
export function trainPosAt(a) {
  const r = 300;
  return { x: Math.sin(a) * r, z: Math.cos(a) * r };
}

export function stepLiving(game, dt) {
  const p = game.player;
  // Dogs: wander, or follow the player after being petted.
  for (const d of game.dogs) {
    if (d.state === 'follow') {
      const dd = dist(d.x, d.z, p.x, p.z);
      if (dd > 3) {
        const a = Math.atan2(p.x - d.x, p.z - d.z);
        d.heading = a;
        d.x += Math.sin(a) * d.speed * 2 * dt;
        d.z += Math.cos(a) * d.speed * 2 * dt;
      }
      continue;
    }
    d.wait -= dt;
    if (d.wait <= 0) {
      d.target = { x: d.x + (Math.random() - 0.5) * 40, z: d.z + (Math.random() - 0.5) * 40 };
      d.wait = 2 + Math.random() * 4;
    }
    const dd = dist(d.x, d.z, d.target.x, d.target.z);
    if (dd > 1) {
      const a = Math.atan2(d.target.x - d.x, d.target.z - d.z);
      d.heading = a;
      d.x += Math.sin(a) * d.speed * dt;
      d.z += Math.cos(a) * d.speed * dt;
    }
  }
  // Birds circle the beach.
  for (const b of game.birds) {
    b.a += b.speed * dt;
    b.x = -320 + Math.sin(b.a) * b.r;
    b.z = Math.cos(b.a) * b.r;
  }
  // Fish swim under the pier.
  for (const f of game.fish) {
    f.a += f.speed * dt * 0.2;
    f.x += Math.sin(f.a) * dt;
    f.z += Math.cos(f.a) * dt;
  }
  // Train loops the ring track.
  if (game.train) {
    game.train.a += game.train.speed * dt;
    if (game.train.a > Math.PI * 2) game.train.a -= Math.PI * 2;
  }
  // Elevator eases toward its target floor.
  if (game.elevator) {
    const e = game.elevator;
    if (Math.abs(e.y - e.targetY) > 0.1) {
      e.moving = true;
      e.y += Math.sign(e.targetY - e.y) * 8 * dt;
    } else {
      e.moving = false;
    }
  }
}

// Board the train at the station.
export function tryTrain(game) {
  const p = game.player;
  const st = SPAWNS.trainStation;
  if (dist(p.x, p.z, st.x, st.z) > 8) return false;
  const tp = trainPosAt(game.train.a);
  // The station sits 17 m inside the ring track (radius 300 vs
  // the station at radius 283), so the train can never get
  // closer than 17 m — the threshold must be 25 m, not 15.
  if (dist(tp.x, tp.z, st.x, st.z) > 25) {
    showToast(game, 'The train is not at the station yet.');
    return false;
  }
  p.onTrain = true;
  showToast(game, 'Riding the train — press E to get off at the next stop.');
  return true;
}

// Ride the elevator in Solmar Tower.
export function tryElevator(game) {
  const p = game.player;
  const t = SPAWNS.elevatorTower;
  if (dist(p.x, p.z, t.x, t.z) > 6) return false;
  p.onElevator = true;
  game.elevator.targetY = game.elevator.targetY === 0 ? 60 : 0;
  showToast(game, game.elevator.targetY > 0 ? 'Elevator going up…' : 'Elevator going down…');
  return true;
}

// Pet a nearby dog — it follows you.
export function tryPetDog(game) {
  const p = game.player;
  for (const d of game.dogs) {
    if (dist(d.x, d.z, p.x, p.z) < 3) {
      d.state = 'follow';
      showToast(game, 'The dog likes you — it follows you now.');
      return true;
    }
  }
  return false;
}

// Ambient boxes: dogs, birds, fish, train, elevator car.
export function livingBoxes(game, b, cam) {
  const uv = tileUV('plain');
  for (const d of game.dogs) {
    pushBoxRot(b, d.x, 0, d.z, 0.5, 0.5, 1.1, d.heading, d.colour, uv);
    pushBoxRot(b, d.x, 0.5, d.z - 0.5, 0.4, 0.4, 0.4, d.heading, d.colour, uv);
  }
  for (const bd of game.birds) {
    const flap = Math.sin(game.time * 6 + bd.a) * 0.3;
    pushBox(b, bd.x, bd.y, bd.z, 0.2, 0.1, 0.6, [0.9, 0.9, 0.9], uv);
    pushBox(b, bd.x - 0.5, bd.y + flap, bd.z, 0.8, 0.05, 0.3, [0.9, 0.9, 0.9], uv);
    pushBox(b, bd.x + 0.5, bd.y - flap, bd.z, 0.8, 0.05, 0.3, [0.9, 0.9, 0.9], uv);
  }
  for (const f of game.fish) {
    pushBox(b, f.x, f.y, f.z, 0.3, 0.2, 0.8, [0.4, 0.7, 0.9], uv);
  }
  if (game.train) {
    for (let i = 0; i < game.train.cars; i++) {
      const pos = trainPosAt(game.train.a - i * 0.06);
      const heading = Math.atan2(Math.cos(game.train.a - i * 0.06), -Math.sin(game.train.a - i * 0.06));
      pushBoxRot(b, pos.x, 0.5, pos.z, 3, 3, 10, heading, [0.2, 0.5, 0.8], uv);
      pushBoxRot(b, pos.x, 3.5, pos.z, 2.6, 0.5, 9, heading, [0.9, 0.9, 0.9], uv);
    }
  }
  if (game.elevator) {
    pushBox(b, SPAWNS.elevatorTower.x, game.elevator.y, SPAWNS.elevatorTower.z, 4, 3, 4, [0.8, 0.85, 0.9], uv);
  }
  return 0;
}
