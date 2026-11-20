// Solmar Bay — the living city: train, elevator, animals, and
// ambient life that is not a pedestrian.
//
// - Train: a 3-car train loops the rectangular track (±320) and
//   stops at the station (-320, 0). Board it with E at the station
//   (rides are free); E again to get off at the next stop.
// - Elevator: the tallest tower has a working elevator — E at its
//   door rides to the roof (and back down). The roof is a viewpoint.
// - Animals: dogs that follow their owners, birds that circle the
//   beach, fish that swim in the harbour basin.
// - Clouds drift; trees sway gently.

import { showToast } from './state.js';

export function createLiving(city) {
  return {
    train: { x: -320, z: -320, dir: 0, speed: 0, stopped: false, stopT: 0 },
    elevator: { floor: 0, moving: false, t: 0 },
    dogs: [
      { x: -60, z: 20, heading: 0, bob: 0, owner: null },
      { x: 80, z: -60, heading: 0, bob: 0, owner: null },
    ],
    birds: Array.from({ length: 8 }, (_, i) => ({
      x: -300 + i * 10, z: 100 + (i % 4) * 20, y: 25 + (i % 3) * 5,
      angle: (i / 8) * Math.PI * 2, r: 20 + i * 3,
    })),
    fish: Array.from({ length: 12 }, (_, i) => ({
      x: 350 + (i % 4) * 10, z: -140 + (i % 3) * 20, angle: (i / 12) * Math.PI * 2,
    })),
    cloudDrift: 0,
  };
}

const TRACK = 320;

export function stepLiving(game, dt) {
  const L = game.living;
  const s = game.state;
  const p = s.player;
  // Train: runs the rectangle, stops 8 s at each corner station.
  const tr = L.train;
  if (tr.stopped) {
    tr.stopT -= dt;
    if (tr.stopT <= 0) tr.stopped = false;
  } else {
    tr.speed = Math.min(14, tr.speed + 4 * dt);
    const seg = tr.dir % 4;
    if (seg === 0) { tr.x += tr.speed * dt; if (tr.x >= TRACK) { tr.dir++; tr.stopped = true; tr.stopT = 8; } }
    else if (seg === 1) { tr.z += tr.speed * dt; if (tr.z >= TRACK) { tr.dir++; tr.stopped = true; tr.stopT = 8; } }
    else if (seg === 2) { tr.x -= tr.speed * dt; if (tr.x <= -TRACK) { tr.dir++; tr.stopped = true; tr.stopT = 8; } }
    else { tr.z -= tr.speed * dt; if (tr.z <= -TRACK) { tr.dir = 0; tr.stopped = true; tr.stopT = 8; } }
  }
  // Riding: the player moves with the train.
  if (p.onTrain) {
    p.x = tr.x;
    p.z = tr.z;
  }
  // Elevator: rides the player between the ground and the roof.
  const el = L.elevator;
  if (el.moving) {
    el.t += dt;
    if (el.t > 3) {
      el.moving = false;
      el.t = 0;
      el.floor = el.floor === 0 ? 1 : 0;
      showToast(s, el.floor === 1 ? 'Roof — the whole city is below you.' : 'Ground floor.', 4);
    }
  }
  // Dogs: follow the nearest ped.
  for (const dog of L.dogs) {
    dog.bob += dt * 5;
    let best = null, bestD = 30;
    for (const ped of game.peds) {
      if (ped.dead) continue;
      const d = Math.hypot(ped.x - dog.x, ped.z - dog.z);
      if (d < bestD) { bestD = d; best = ped; }
    }
    if (best) {
      dog.owner = best;
      const dx = best.x - dog.x, dz = best.z - dog.z;
      const d = Math.hypot(dx, dz) || 1;
      if (d > 2) {
        dog.heading = Math.atan2(dx, dz);
        dog.x += (dx / d) * 3 * dt;
        dog.z += (dz / d) * 3 * dt;
      }
    }
  }
  // Birds circle the beach; fish swim the basin.
  for (const b of L.birds) {
    b.angle += dt * 0.3;
    b.x = -300 + Math.cos(b.angle) * b.r;
    b.z = 120 + Math.sin(b.angle) * b.r;
  }
  for (const f of L.fish) {
    f.angle += dt * 0.5;
    f.x = 370 + Math.cos(f.angle) * 15;
    f.z = -100 + Math.sin(f.angle) * 25;
  }
  L.cloudDrift += dt * 0.5;
}

// Board / leave the train (E at the station, -320, 0).
export function tryTrain(game) {
  const s = game.state;
  const p = s.player;
  const tr = game.living.train;
  if (p.onTrain) {
    p.onTrain = false;
    p.x = tr.x + 3;
    p.z = tr.z + 3;
    showToast(s, 'You got off the train.', 3);
    return true;
  }
  if (Math.hypot(tr.x + 320, tr.z - 0) < 8 && tr.stopped) {
    p.onTrain = true;
    showToast(s, 'You boarded the train. Press E to get off at the next stop.', 4);
    return true;
  }
  return false;
}

// Ride the elevator in the tallest tower (E at its door).
export function tryElevator(game) {
  const s = game.state;
  const p = s.player;
  const t = game.city.tallestTower;
  if (Math.hypot(p.x - t.x, p.z - (t.z + t.d / 2 + 2)) < 4) {
    const el = game.living.elevator;
    if (!el.moving) {
      el.moving = true;
      el.t = 0;
      showToast(s, el.floor === 0 ? 'Elevator going up…' : 'Elevator going down…', 3);
      return true;
    }
  }
  return false;
}

export function livingBoxes(game, out) {
  const L = game.living;
  const tr = L.train;
  // Train: 3 cars.
  for (let i = 0; i < 3; i++) {
    const off = i * 8;
    const x = tr.dir % 2 === 0 ? tr.x - off : tr.x;
    const z = tr.dir % 2 === 0 ? tr.z : tr.z - off;
    out.pushBox(x, 1.2, z, 3, 2.4, 7, [0.8, 0.2, 0.2]);
    out.pushBox(x, 2.6, z, 2.8, 0.4, 6.8, [0.9, 0.9, 0.9]);
  }
  // Dogs.
  for (const dog of L.dogs) {
    out.pushBoxRot(dog.x, 0.35, dog.z, 0.3, 0.3, 0.7, [0.6, 0.45, 0.3], dog.heading);
    out.pushBoxRot(dog.x, 0.6, dog.z + 0.3, 0.2, 0.2, 0.2, [0.6, 0.45, 0.3], dog.heading);
  }
  // Birds (small white boxes in the sky).
  for (const b of L.birds) {
    out.pushBox(b.x, b.y, b.z, 0.6, 0.1, 0.2, [1, 1, 1]);
  }
  // Fish (small blue boxes under the water surface).
  for (const f of L.fish) {
    out.pushBox(f.x, -0.3, f.z, 0.5, 0.15, 0.2, [0.3, 0.5, 0.8]);
  }
}
