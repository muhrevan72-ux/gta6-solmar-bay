// Solmar Bay — the living city: the loop train, fish in the water,
// birds in the sky, drifting clouds, and the glass elevator up the
// tallest downtown tower to a rooftop deck.

import { mulberry32, dist, clamp } from './config.js';
import { setToast, addCash } from './state.js';

export function createLiving(city) {
  const rng = mulberry32(2024);
  const fish = [];
  for (let i = 0; i < 12; i++) {
    fish.push({
      x: -390 + rng() * 30, z: -350 + rng() * 700,
      phase: rng() * Math.PI * 2, speed: 0.5 + rng() * 0.8,
    });
  }
  const birds = [];
  for (let i = 0; i < 8; i++) {
    birds.push({
      cx: -100 + rng() * 300, cz: -150 + rng() * 300,
      r: 20 + rng() * 30, angle: rng() * Math.PI * 2,
      speed: 0.25 + rng() * 0.25, y: 40 + rng() * 20,
    });
  }
  const clouds = [];
  for (let i = 0; i < 6; i++) {
    clouds.push({
      x: -400 + rng() * 800, z: -350 + rng() * 700,
      y: 70 + rng() * 25, speed: 1.5 + rng() * 1.5, size: 14 + rng() * 14,
    });
  }
  return {
    trainAngle: 0,
    trainSpeed: 12,
    fish, birds, clouds,
    elevator: { y: 0, moving: 0, collected: false },
  };
}

function trainCarPos(city, angle, offset) {
  const a = angle - offset;
  return { x: Math.cos(a) * city.train.radius, z: Math.sin(a) * city.train.radius, y: 1.2 };
}

export function trainCars(game) {
  const l = game.living;
  const cars = [];
  for (let i = 0; i < 3; i++) cars.push(trainCarPos(game.city, l.trainAngle, i * 0.14));
  return cars;
}

export function nearestTrainCar(game, x, z, maxDist) {
  const cars = trainCars(game);
  let best = null, bd = maxDist;
  for (const c of cars) {
    const d = dist(x, z, c.x, c.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

export function updateLiving(dt, game) {
  const l = game.living;
  const p = game.player;
  // train loops the ring
  l.trainAngle += (l.trainSpeed / game.city.train.radius) * dt;
  // fish swim in small circles near the surface
  for (const f of l.fish) {
    f.phase += f.speed * dt;
    f.x = -380 + Math.sin(f.phase) * 12;
    f.z += Math.cos(f.phase * 0.7) * 0.4 * dt;
    if (f.z > 390) f.z = -390;
    if (f.z < -390) f.z = 390;
  }
  // birds circle
  for (const b of l.birds) {
    b.angle += b.speed * dt;
  }
  // clouds drift and wrap
  for (const c of l.clouds) {
    c.x += c.speed * dt;
    if (c.x > 420) c.x = -420;
  }
  // elevator: rides between ground and the rooftop
  const el = l.elevator;
  const top = game.city.elevator.topY;
  if (el.moving !== 0) {
    el.y += el.moving * 8 * dt;
    if (el.y >= top) { el.y = top; el.moving = 0; }
    if (el.y <= 0) {
      el.y = 0; el.moving = 0;
      // the ride ends at the ground: the player steps off, otherwise
      // onElevator stays true forever and E would only ever toggle
      // the elevator again (no car entry, no other interaction)
      if (p.onElevator) { p.onElevator = false; p.y = 0; }
    }
    if (p.onElevator) p.y = el.y;
  }
  // rooftop collectible: $50, once
  if (p.onElevator && el.y >= top && !el.collected) {
    el.collected = true;
    addCash(game.state, 50);
    setToast(game.state, 'Rooftop deck! Found $50 with a view!', 3);
    if (game.audio) game.audio.jingle();
  }
  // player riding the train follows its car
  if (p.onTrain) {
    const cars = trainCars(game);
    const car = cars[p.onTrain.carIdx] || cars[0];
    p.x = car.x; p.z = car.z; p.y = car.y;
  }
}

export function boardTrain(game) {
  const p = game.player;
  const cars = trainCars(game);
  const station = game.city.train.station;
  // board only near the station
  const nearStation = dist(p.x, p.z, station.x, station.z) < 20;
  if (!nearStation) return false;
  let idx = -1, bd = 5;
  for (let i = 0; i < cars.length; i++) {
    const d = dist(p.x, p.z, cars[i].x, cars[i].z);
    if (d < bd) { bd = d; idx = i; }
  }
  if (idx < 0) return false;
  p.onTrain = { carIdx: idx, x: cars[idx].x, z: cars[idx].z, y: cars[idx].y };
  setToast(game.state, 'Riding the train! Press E to get off.', 3);
  return true;
}

export function exitTrain(game) {
  const p = game.player;
  if (!p.onTrain) return false;
  p.x = p.onTrain.x;
  p.z = p.onTrain.z;
  p.y = 0;
  p.onTrain = null;
  return true;
}

export function toggleElevator(game) {
  const el = game.living.elevator;
  const p = game.player;
  if (el.moving !== 0) return false;
  if (el.y <= 0) {
    el.moving = 1;
    p.onElevator = true;
    setToast(game.state, 'Elevator going up!', 2);
  } else {
    el.moving = -1;
    setToast(game.state, 'Elevator going down!', 2);
  }
  return true;
}

export function drawLiving(renderer, game) {
  const l = game.living;
  const t = game.time;
  // train: engine + 2 cars
  const cars = trainCars(game);
  cars.forEach((c, i) => {
    // velocity along the circle is (-sin a, cos a) = forward (sin h, cos h) => h = -a
    const heading = -(l.trainAngle - i * 0.14);
    const col = i === 0 ? [0.9, 0.3, 0.2] : [0.3, 0.5, 0.9];
    renderer.box(c.x, c.y + 1.2, c.z, 3.2, 2.4, 6.5, col, 1, heading, 0, 0);
    renderer.box(c.x, c.y + 2.6, c.z, 2.6, 0.9, 5.5, [0.85, 0.9, 0.95], 1, heading, 0, 0);
  });
  // fish (small blue flashes near the surface)
  for (const f of l.fish) {
    renderer.box(f.x, 0.2, f.z, 0.9, 0.3, 0.4, [0.3, 0.6, 0.95], 0.9, f.phase, 0, 0);
  }
  // birds
  for (const b of l.birds) {
    const x = b.cx + Math.cos(b.angle) * b.r;
    const z = b.cz + Math.sin(b.angle) * b.r;
    const flap = Math.sin(t * 8 + b.angle * 3) * 0.4;
    renderer.box(x, b.y, z, 0.5, 0.25, 1.2, [0.15, 0.15, 0.18], 1, b.angle, 0, 0);
    renderer.box(x - 0.8, b.y + flap * 0.3, z, 1.0, 0.12, 0.5, [0.15, 0.15, 0.18], 1, b.angle, 0, 0);
    renderer.box(x + 0.8, b.y - flap * 0.3, z, 1.0, 0.12, 0.5, [0.15, 0.15, 0.18], 1, b.angle, 0, 0);
  }
  // clouds
  for (const c of l.clouds) {
    renderer.box(c.x, c.y, c.z, c.size, 3, c.size * 0.6, [1, 1, 1], 0.85);
    renderer.box(c.x + c.size * 0.4, c.y + 1.5, c.z, c.size * 0.6, 2.5, c.size * 0.4, [1, 1, 1], 0.85);
  }
  // elevator shaft + platform on the tallest tower
  const el = game.city.elevator;
  const ey = l.elevator.y;
  renderer.box(el.x, el.topY / 2, el.z, 3.5, el.topY, 3.5, [0.7, 0.85, 0.95], 0.35);
  renderer.box(el.x, ey + 0.4, el.z, 4, 0.8, 4, [0.4, 0.45, 0.55], 1);
  renderer.box(el.x, ey + 2.2, el.z, 3.4, 3, 3.4, [0.7, 0.85, 0.95], 0.6);
}

export { clamp };
