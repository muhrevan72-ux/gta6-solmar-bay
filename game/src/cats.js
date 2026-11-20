// Solmar Bay — stray cats: pick one up, carry it, deliver it to
// the beach house for $20 + 5 respect.

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

export function spawnCats(g) {
  const rng = mulberry32(5150);
  g.cats = [];
  const cols = [[0.9, 0.85, 0.8], [0.2, 0.2, 0.2], [0.8, 0.6, 0.4], [0.95, 0.7, 0.5]];
  for (let i = 0; i < 6; i++) {
    g.cats.push({
      x: -200 + rng() * 400,
      z: -200 + rng() * 400,
      state: 'wander',
      heading: rng() * Math.PI * 2,
      colour: cols[i % cols.length],
    });
  }
  g.player.carryingCat = null;
  g.player.petting = 0;
}

// E near a cat picks it up; E while carrying pets it.
export function tryCat(g) {
  if (g.player.carryingCat) {
    g.player.petting = 2;
    g.toast = 'You pet the cat. It purrs.';
    g.toastTimer = 3;
    return true;
  }
  for (const cat of g.cats) {
    if (cat.state === 'home') continue;
    const d = Math.hypot(cat.x - g.player.x, cat.z - g.player.z);
    if (d < 3) {
      cat.state = 'carried';
      g.player.carryingCat = cat;
      g.toast = 'You picked up the cat!';
      g.toastTimer = 3;
      return true;
    }
  }
  return false;
}

export function stepCats(g, dt) {
  if (g.player.petting > 0) g.player.petting = Math.max(0, g.player.petting - dt);
  for (const cat of g.cats) {
    if (cat.state === 'carried') {
      // The carried cat follows the player exactly.
      cat.x = g.player.x;
      cat.z = g.player.z;
      // Delivering to the beach house pays $20 + 5 respect.
      const d = Math.hypot(g.player.x - SPAWNS.beachHouse.x, g.player.z - SPAWNS.beachHouse.z);
      if (d < 10) {
        cat.state = 'home';
        g.player.carryingCat = null;
        g.cash += 20;
        g.respect = (g.respect || 0) + 5;
        g.toast = 'The cat is home! +$20, +5 respect';
        g.toastTimer = 3;
      }
    } else if (cat.state === 'wander') {
      cat.x += Math.sin(cat.heading) * 0.8 * dt;
      cat.z += Math.cos(cat.heading) * 0.8 * dt;
      if (Math.random() < 0.01) cat.heading += (Math.random() - 0.5) * 2;
    }
  }
}

// A cat is 5 boxes (body, head, 2 ears, tail).
export function catBoxes(g, batch, cam) {
  let n = 0;
  for (const cat of g.cats) {
    if (cat.state === 'home') continue;
    const box = (x, y, z, w, h, d, col) => { pushBox(batch, x, y, z, w, h, d, col); n++; };
    box(cat.x, 0.15, cat.z, 0.6, 0.3, 0.3, cat.colour);
    box(cat.x, 0.4, cat.z + 0.35, 0.25, 0.25, 0.25, cat.colour);
    box(cat.x - 0.08, 0.6, cat.z + 0.35, 0.08, 0.12, 0.08, cat.colour);
    box(cat.x + 0.08, 0.6, cat.z + 0.35, 0.08, 0.12, 0.08, cat.colour);
    box(cat.x, 0.25, cat.z - 0.35, 0.1, 0.1, 0.4, cat.colour);
  }
  return n;
}
