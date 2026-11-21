// Solmar Bay — the stray cats.
//
// Six cats roam the city. Pick one up, carry it home to the beach
// house, and earn $20 plus respect. Picking it up again while you
// carry it just gives it a pet.

import { mulberry32, showToast } from './state.js';
import { pushBox } from './render.js';
import { SPAWNS } from './config.js';

const CAT_SPOTS = [
  { x: -315, z: 55 },
  { x: -320, z: 70 },
  { x: 10, z: 40 },
  { x: -40, z: -20 },
  { x: 60, z: 100 },
  { x: -180, z: 120 },
];

export function spawnCats(g) {
  const rng = mulberry32(33);
  const coats = [
    [0.9, 0.85, 0.8],
    [0.15, 0.12, 0.1],
    [0.95, 0.6, 0.2],
    [0.5, 0.5, 0.5],
    [0.85, 0.85, 0.85],
    [0.3, 0.2, 0.12],
  ];
  g.cats = CAT_SPOTS.map((spot, i) => ({
    x: spot.x + (rng() - 0.5) * 4,
    z: spot.z + (rng() - 0.5) * 4,
    state: 'stray',
    heading: rng() * Math.PI * 2,
    coat: coats[i % coats.length],
    petTimer: 0,
  }));
  return g.cats;
}

export function stepCats(g, dt) {
  const p = g.player;
  for (const cat of g.cats) {
    if (cat.state === 'carried') {
      cat.x = p.x;
      cat.z = p.z;
      cat.petTimer = Math.max(0, (cat.petTimer || 0) - dt);
      // Home at last: the beach house takes the cat in.
      if (Math.hypot(p.x - SPAWNS.beachHouse.x, p.z - SPAWNS.beachHouse.z) <= 6) {
        cat.state = 'home';
        p.carryingCat = null;
        g.cash += 20;
        g.respect += 5;
        showToast(g, 'Cat delivered home — +$20, +5 respect.');
      }
    } else if (cat.state === 'stray') {
      cat.heading += (Math.random() - 0.5) * dt * 2;
      cat.x += Math.sin(cat.heading) * 0.5 * dt;
      cat.z += Math.cos(cat.heading) * 0.5 * dt;
    }
  }
}

// Pick up the nearest stray, or pet the one you already carry.
export function tryCat(g) {
  const p = g.player;
  if (p.carryingCat) {
    p.carryingCat.petTimer = 2;
    p.petting = 2;
    p.petTimer = 2;
    g._petTimer = 2;
    showToast(g, 'You pet the cat. It purrs.');
    return true;
  }
  let best = null;
  let bestD = 3;
  for (const cat of g.cats) {
    if (cat.state !== 'stray') continue;
    const d = Math.hypot(p.x - cat.x, p.z - cat.z);
    if (d < bestD) {
      bestD = d;
      best = cat;
    }
  }
  if (!best) return false;
  best.state = 'carried';
  p.carryingCat = best;
  showToast(g, 'You picked up a cat. Take it to the beach house.');
  return true;
}

// Every cat in the city: body, head, two ears, tail — 5 boxes each.
export function catBoxes(g, b, cam) {
  const plain = [0, 0, 1, 1];
  let count = 0;
  for (const cat of g.cats || []) {
    const c = cat.coat || [0.5, 0.5, 0.5];
    pushBox(b, cat.x, 0.18, cat.z, 0.42, 0.2, 0.2, c, plain);
    pushBox(b, cat.x, 0.35, cat.z + 0.24, 0.2, 0.18, 0.18, c, plain);
    pushBox(b, cat.x - 0.07, 0.52, cat.z + 0.24, 0.07, 0.08, 0.05, c, plain);
    pushBox(b, cat.x + 0.07, 0.52, cat.z + 0.24, 0.07, 0.08, 0.05, c, plain);
    pushBox(b, cat.x, 0.2, cat.z - 0.28, 0.06, 0.1, 0.2, c, plain);
    count += 5;
  }
  return count;
}
