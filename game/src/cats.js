// Solmar Bay — stray cats. Pick one up, carry it to Maya's
// beach house, earn $20 and +5 respect.

import { SPAWNS } from './config.js';
import { pushBox } from './render.js';
import { addCash, showToast } from './state.js';

export function spawnCats(g) {
  let seed = 55;
  const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  g.cats = [];
  const spots = [[-20, 40], [60, 60], [-100, -40], [140, 100], [-60, 180], [200, -100]];
  for (let i = 0; i < 6; i++) {
    const [x, z] = spots[i];
    g.cats.push({ x, z, state: 'idle', type: 'cat', color: [[0.9, 0.9, 0.9], [0.1, 0.1, 0.1], [0.9, 0.6, 0.2], [0.6, 0.6, 0.65], [0.8, 0.5, 0.3], [0.4, 0.4, 0.45]][i] });
  }
  return g.cats;
}

// E near a cat: pick it up. E while carrying: pet it.
export function tryCat(g) {
  const p = g.player;
  if (p.carryingCat) {
    p.petting = 2;
    showToast(g, 'You pet the cat');
    return true;
  }
  let best = null, bestD = 3;
  for (const c of g.cats) {
    if (c.state !== 'idle') continue;
    const d = Math.hypot(c.x - p.x, c.z - p.z);
    if (d < bestD) { bestD = d; best = c; }
  }
  if (!best) return false;
  best.state = 'carried';
  p.carryingCat = best;
  showToast(g, 'Picked up a stray cat — bring it to the beach house');
  return true;
}

export function stepCats(g, dt) {
  const p = g.player;
  for (const c of g.cats) {
    if (c.state === 'carried') {
      c.x = p.x;
      c.z = p.z;
      // Delivered at the beach house.
      if (Math.hypot(p.x - SPAWNS.beachHouse.x, p.z - SPAWNS.beachHouse.z) < 5) {
        c.state = 'home';
        p.carryingCat = null;
        addCash(g, 20, 'cat delivered');
        g.respect += 5;
        showToast(g, 'Cat delivered! +$20, +5 respect');
      }
    }
  }
}

// 5 boxes per cat: body, head, two ears, tail.
export function catBoxes(g, batch) {
  const plain = [0, 0, 1, 1];
  let n = 0;
  for (const c of g.cats) {
    if (c.state === 'home') continue;
    pushBox(batch, c.x, 0.15, c.z, 0.5, 0.3, 0.3, c.color, plain);
    pushBox(batch, c.x + 0.3, 0.3, c.z, 0.25, 0.25, 0.25, c.color, plain);
    pushBox(batch, c.x + 0.25, 0.55, c.z - 0.08, 0.08, 0.12, 0.08, c.color, plain);
    pushBox(batch, c.x + 0.25, 0.55, c.z + 0.08, 0.08, 0.12, 0.08, c.color, plain);
    pushBox(batch, c.x - 0.3, 0.3, c.z, 0.35, 0.1, 0.1, c.color, plain);
    n += 5;
  }
  return n;
}
