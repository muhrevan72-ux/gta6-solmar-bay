// Solmar Bay — stray cats: pick one up, carry it home to the beach
// house for a reward. Written fresh for rebuild #18.

import { mulberry32, SPAWNS } from './config.js';
import { randomSidewalkPoint } from './world.js';
import { pushBox } from './render.js';
import { addCash, showToast } from './state.js';

export function spawnCats(g) {
  const rng = mulberry32(5150);
  const cats = [];
  for (let i = 0; i < 6; i++) {
    const p = randomSidewalkPoint(rng);
    cats.push({
      x: p.x, z: p.z, state: 'wander',
      color: [[0.2, 0.2, 0.2], [0.9, 0.7, 0.4], [0.6, 0.6, 0.6]][i % 3],
      tx: p.x, tz: p.z,
    });
  }
  g.cats = cats;
  return cats;
}

export function tryCat(g) {
  // Already carrying one? Pet it instead.
  if (g.player.carryingCat) {
    g.player.petting = 2;
    return true;
  }
  let best = null;
  let bestD = 3;
  for (const c of g.cats) {
    if (c.state !== 'wander') continue;
    const d = Math.hypot(c.x - g.player.x, c.z - g.player.z);
    if (d < bestD) { best = c; bestD = d; }
  }
  if (!best) return false;
  best.state = 'carried';
  g.player.carryingCat = best;
  showToast(g, 'You picked up a cat. Take it to the beach house!');
  return true;
}

export function stepCats(g, dt) {
  for (const c of g.cats) {
    if (c.state === 'carried') {
      // Ride along with the player exactly.
      c.x = g.player.x;
      c.z = g.player.z;
      // Delivered to the beach house?
      const d = Math.hypot(c.x - SPAWNS.beachHouse.x, c.z - SPAWNS.beachHouse.z);
      if (d < 8) {
        c.state = 'home';
        g.player.carryingCat = null;
        addCash(g, 20, 'cat rescue');
        g.respect = (g.respect || 0) + 5;
        showToast(g, 'Cat delivered home — $20');
      }
      continue;
    }
    if (c.state !== 'wander') continue;
    const dx = c.tx - c.x, dz = c.tz - c.z;
    const d = Math.hypot(dx, dz);
    if (d < 1) {
      const t = randomSidewalkPoint(Math.random);
      c.tx = t.x; c.tz = t.z;
    } else {
      c.x += (dx / d) * 1.2 * dt;
      c.z += (dz / d) * 1.2 * dt;
    }
  }
}

// 5 boxes per cat (body, head, ears, tail).
export function catBoxes(g, b, gl) {
  let n = 0;
  for (const c of g.cats) {
    if (c.state === 'home') continue;
    pushBox(b, c.x, 0.15, c.z, 0.5, 0.3, 0.3, c.color, [0, 0, 1, 1]);
    pushBox(b, c.x, 0.45, c.z + 0.28, 0.25, 0.25, 0.25, c.color, [0, 0, 1, 1]);
    pushBox(b, c.x - 0.08, 0.68, c.z + 0.28, 0.07, 0.1, 0.07, c.color, [0, 0, 1, 1]);
    pushBox(b, c.x + 0.08, 0.68, c.z + 0.28, 0.07, 0.1, 0.07, c.color, [0, 0, 1, 1]);
    pushBox(b, c.x, 0.35, c.z - 0.35, 0.08, 0.08, 0.5, c.color, [0, 0, 1, 1]);
    n += 5;
  }
  return n;
}
