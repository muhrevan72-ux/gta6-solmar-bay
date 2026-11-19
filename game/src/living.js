// Solmar Bay — living city: ambient life that makes the city feel
// like a real human city.
//
// - Train: a loop track around the city (rectangle at +-320), a voxel
//   train (3 cars) moving along it, a station platform on the west
//   side. Press E near the train at the station to board and ride;
//   press E to get off at the station.
// - Fish: small voxel fish swimming in the harbour/beach water,
//   visible near the surface.
// - Dogs: dog NPCs wandering the city; press E near one to pet it
//   (it jumps/wags). Pure fun.
// - Birds: voxel birds flying in circles above the city.
// - Clouds: white voxel clouds drifting slowly across the sky.
// (Trees, flowers and pots live in world.js; the elevator rides the
// tallest downtown tower.)

import { dist2 } from './config.js';
import { showToast } from './state.js';
import { randomSidewalkPoint, collideCircle } from './world.js';

export function createLiving(city, rng) {
  const r = rng || Math.random;
  const dogs = [];
  for (let i = 0; i < 5; i++) {
    const spot = randomSidewalkPoint(city, r);
    dogs.push({
      x: spot.x, z: spot.z, heading: r() * Math.PI * 2,
      target: null, bob: r() * 6, wag: 0, happy: 0,
      colour: [[0.6, 0.45, 0.3], [0.2, 0.2, 0.22], [0.85, 0.75, 0.6]][i % 3],
    });
  }
  const fish = [];
  for (let i = 0; i < 12; i++) {
    fish.push({
      x: -370 + r() * 25, z: -280 + r() * 560,
      depth: 0.3 + r() * 0.4, phase: r() * Math.PI * 2,
      speed: 1 + r() * 2,
      colour: [[0.95, 0.6, 0.2], [0.3, 0.7, 0.9], [0.95, 0.85, 0.4]][i % 3],
    });
  }
  const birds = [];
  for (let i = 0; i < 8; i++) {
    birds.push({
      cx: -200 + r() * 400, cz: -200 + r() * 400,
      r: 20 + r() * 30, h: 30 + r() * 25,
      angle: r() * Math.PI * 2, speed: 0.2 + r() * 0.2,
    });
  }
  return {
    train: { s: 0, speed: 12, cars: 3 }, // s = distance along the loop
    dogs,
    fish,
    birds,
    elevator: { y: 0, dir: 0, riding: false }, // platform height
  };
}

// Train loop: rectangle at +-320, perimeter 2560. s = distance along
// it, starting at the station (-320, 0) heading north.
export function trainPosition(s) {
  const P = 2560;
  let d = ((s % P) + P) % P;
  // Sides: west going north (0..640), north going east (640..1280),
  // east going south (1280..1920), south going west (1920..2560).
  if (d < 640) return { x: -320, z: -320 + d, heading: 0 };
  if (d < 1280) return { x: -320 + (d - 640), z: 320, heading: Math.PI / 2 };
  if (d < 1920) return { x: 320, z: 320 - (d - 1280), heading: Math.PI };
  return { x: 320 - (d - 1920), z: -320, heading: -Math.PI / 2 };
}

export function stepLiving(game, dt) {
  const lv = game.living;
  // Train moves along the loop.
  lv.train.s += lv.train.speed * dt;
  // Dogs wander; a petted dog jumps and wags.
  for (const dog of lv.dogs) {
    if (dog.happy > 0) {
      dog.happy -= dt;
      dog.wag += dt * 12;
      continue;
    }
    if (!dog.target || dist2(dog.x, dog.z, dog.target.x, dog.target.z) < 2) {
      dog.target = randomSidewalkPoint(game.city, Math.random);
    }
    const d = Math.sqrt(dist2(dog.x, dog.z, dog.target.x, dog.target.z)) || 1;
    const nx = dog.x + ((dog.target.x - dog.x) / d) * 2.2 * dt;
    const nz = dog.z + ((dog.target.z - dog.z) / d) * 2.2 * dt;
    if (!collideCircle(game.city, nx, nz, 0.5)) {
      dog.x = nx;
      dog.z = nz;
    }
    dog.heading = Math.atan2(dog.target.x - dog.x, dog.target.z - dog.z);
    dog.bob += dt * 3;
  }
  // Fish swim back and forth near the surface.
  for (const f of lv.fish) {
    f.phase += dt * f.speed * 0.3;
    f.x += Math.sin(f.phase) * dt * 2;
  }
  // Birds circle.
  for (const b of lv.birds) {
    b.angle += b.speed * dt;
  }
  // Clouds drift (positions live in the city; drift here).
  for (const c of game.city.clouds) {
    c.x += dt * 1.5;
    if (c.x > 420) c.x = -420;
  }
  // Elevator: the player rides the platform up/down the tallest tower.
  const el = lv.elevator;
  const tower = game.city.elevator;
  if (el.riding && tower) {
    el.y += el.dir * 8 * dt;
    if (el.y >= tower.towerH) {
      el.y = tower.towerH;
      el.dir = 0;
      showToast(game.state, 'Rooftop observation deck! The whole bay is below you.', 3);
    } else if (el.y <= 0) {
      el.y = 0;
      el.dir = 0;
      el.riding = false;
      game.state.player.onElevator = false;
    }
    game.state.player.x = tower.x;
    game.state.player.z = tower.z;
  }
}

export function nearestDog(game, x, z, range) {
  let best = null;
  let bestD = range * range;
  for (const dog of game.living.dogs) {
    const d = dist2(x, z, dog.x, dog.z);
    if (d < bestD) {
      bestD = d;
      best = dog;
    }
  }
  return best;
}

export function petDog(game, dog) {
  dog.happy = 2;
  showToast(game.state, 'You pet the dog. It jumps and wags its tail!', 2);
  return true;
}

// Board the train at the station (E near the train when it is at the
// station), ride it, E again to get off at the station.
export function boardTrain(game) {
  const p = game.state.player;
  const pos = trainPosition(game.living.train.s);
  const nearStation = dist2(pos.x, pos.z, -320, 0) < 2500;
  if (!p.onTrain && nearStation && dist2(p.x, p.z, pos.x, pos.z) < 100) {
    p.onTrain = true;
    showToast(game.state, 'You board the train. Enjoy the ride — E to get off at the station.', 3);
    return true;
  }
  if (p.onTrain && nearStation) {
    p.onTrain = false;
    p.x = -318;
    p.z = 0;
    showToast(game.state, 'You step off the train at the station.', 2);
    return true;
  }
  return false;
}

export function livingBoxes(game, out) {
  const lv = game.living;
  // Train: 3 cars along the loop.
  for (let i = 0; i < 3; i++) {
    const pos = trainPosition(lv.train.s - i * 14);
    out.pushBoxRot(pos.x, 1.5, pos.z, 3, 3, 12, [0.85, 0.2, 0.25], pos.heading);
    out.pushBoxRot(pos.x, 3.4, pos.z, 2.6, 0.8, 11, [0.4, 0.65, 0.85], pos.heading);
  }
  // Dogs.
  for (const dog of lv.dogs) {
    const jump = dog.happy > 0 ? Math.abs(Math.sin(dog.wag)) * 0.5 : 0;
    out.pushBoxRot(dog.x, 0.5 + jump, dog.z, 0.5, 0.6, 1.1, dog.colour, dog.heading);
    out.pushBoxRot(dog.x, 0.95 + jump, dog.z + 0.5, 0.4, 0.4, 0.4, dog.colour, dog.heading);
    const wag = dog.happy > 0 ? Math.sin(dog.wag) * 0.3 : 0;
    out.pushBoxRot(dog.x + wag, 0.7 + jump, dog.z - 0.55, 0.1, 0.4, 0.1, dog.colour, dog.heading);
  }
  // Fish near the surface.
  for (const f of lv.fish) {
    out.pushBox(f.x, -0.1, f.z, 0.8, 0.25, 0.35, f.colour);
  }
  // Birds.
  for (const b of lv.birds) {
    const x = b.cx + Math.cos(b.angle) * b.r;
    const z = b.cz + Math.sin(b.angle) * b.r;
    const flap = Math.sin(b.angle * 6) * 0.3;
    out.pushBox(x, b.h, z, 0.8, 0.15, 0.4, [0.15, 0.15, 0.18]);
    out.pushBox(x - 0.5, b.h + flap, z, 0.5, 0.1, 0.3, [0.15, 0.15, 0.18]);
    out.pushBox(x + 0.5, b.h - flap, z, 0.5, 0.1, 0.3, [0.15, 0.15, 0.18]);
  }
  // Clouds.
  for (const c of game.city.clouds) {
    out.pushBox(c.x, c.y, c.z, c.s, 2, c.s * 0.6, [1.0, 1.0, 1.0]);
  }
  // Elevator platform on the tallest tower.
  const tower = game.city.elevator;
  if (tower) {
    const y = lv.elevator.y;
    out.pushBox(tower.x, y + 0.4, tower.z, 4, 0.8, 4, [0.4, 0.65, 0.85]);
    out.pushBox(tower.x, y + 1.6, tower.z, 3.6, 2, 0.2, [0.6, 0.8, 0.95]);
  }
}
