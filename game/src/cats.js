// Solmar Bay — cats: small voxel cats wandering the city (beach and
// shops), cute. Press E near a cat to pick it up and carry it (shown
// riding on the player's shoulder); press E again to put it down.
// Pure fun — no wanted, no cash.

import { dist2 } from './config.js';
import { showToast } from './state.js';
import { randomSidewalkPoint, collideCircle } from './world.js';

export function createCats(city, rng) {
  const list = [];
  const spots = [
    { x: -310, z: 100 }, { x: -60, z: -20 }, { x: 40, z: 120 },
    { x: 120, z: 68 }, { x: -40, z: 70 }, { x: 0, z: 40 },
  ];
  for (let i = 0; i < 6; i++) {
    const s = spots[i];
    list.push({
      x: s.x + (rng() - 0.5) * 6,
      z: s.z + (rng() - 0.5) * 6,
      heading: rng() * Math.PI * 2,
      target: null,
      bob: rng() * 6,
      colour: [[0.9, 0.85, 0.7], [0.2, 0.2, 0.22], [0.85, 0.6, 0.4]][i % 3],
      carried: false,
    });
  }
  return { list };
}

export function stepCats(game, dt) {
  for (const cat of game.cats.list) {
    if (cat.carried) {
      // Rides on the player's shoulder.
      cat.x = game.state.player.x;
      cat.z = game.state.player.z;
      continue;
    }
    if (!cat.target || dist2(cat.x, cat.z, cat.target.x, cat.target.z) < 2) {
      cat.target = randomSidewalkPoint(game.city, Math.random);
    }
    const d = Math.sqrt(dist2(cat.x, cat.z, cat.target.x, cat.target.z)) || 1;
    const nx = cat.x + ((cat.target.x - cat.x) / d) * 1.2 * dt;
    const nz = cat.z + ((cat.target.z - cat.z) / d) * 1.2 * dt;
    if (!collideCircle(game.city, nx, nz, 0.5)) {
      cat.x = nx;
      cat.z = nz;
    }
    cat.heading = Math.atan2((cat.target.x - cat.x), (cat.target.z - cat.z));
    cat.bob += dt * 2;
  }
}

export function nearestCat(game, x, z, range) {
  let best = null;
  let bestD = range * range;
  for (const cat of game.cats.list) {
    if (cat.carried) continue;
    const d = dist2(x, z, cat.x, cat.z);
    if (d < bestD) {
      bestD = d;
      best = cat;
    }
  }
  return best;
}

export function pickupCat(game, cat) {
  const p = game.state.player;
  if (p.carryingCat) return false;
  cat.carried = true;
  p.carryingCat = cat;
  showToast(game.state, 'You picked up the cat. It purrs on your shoulder.', 2);
  return true;
}

export function putDownCat(game) {
  const p = game.state.player;
  const cat = p.carryingCat;
  if (!cat) return false;
  cat.carried = false;
  p.carryingCat = null;
  cat.x = p.x + Math.sin(p.heading) * 1.5;
  cat.z = p.z + Math.cos(p.heading) * 1.5;
  showToast(game.state, 'You put the cat down. It wanders off.', 2);
  return true;
}

export function catBoxes(game, out) {
  for (const cat of game.cats.list) {
    if (cat.carried) continue; // drawn on the player's shoulder
    const y = Math.abs(Math.sin(cat.bob)) * 0.1;
    out.pushBoxRot(cat.x, y + 0.35, cat.z, 0.7, 0.5, 0.35, cat.colour, cat.heading);
    out.pushBoxRot(cat.x, y + 0.7, cat.z + 0.25, 0.35, 0.35, 0.35, cat.colour, cat.heading);
    // Ears.
    out.pushBoxRot(cat.x - 0.12, y + 0.95, cat.z + 0.25, 0.1, 0.15, 0.1, cat.colour, cat.heading);
    out.pushBoxRot(cat.x + 0.12, y + 0.95, cat.z + 0.25, 0.1, 0.15, 0.1, cat.colour, cat.heading);
    // Tail.
    out.pushBoxRot(cat.x, y + 0.6, cat.z - 0.35, 0.1, 0.5, 0.1, cat.colour, cat.heading);
  }
}
