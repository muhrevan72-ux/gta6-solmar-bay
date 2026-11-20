// Solmar Bay — stray cats (rebuild #14).
// Six cats wander the city. E picks one up; E again pets it
// (2 s). Carry it to the beach house and it is home: +$20,
// +5 respect.

import { SPAWNS } from './config.js';
import { showToast } from './state.js';
import { pushBox, pushBoxRot } from './render.js';
import { mulberry32 } from './state.js';
import { randomSidewalkPoint } from './world.js';

export function spawnCats(g) {
  const rng = mulberry32(99);
  const cats = [];
  const cols = [[0.9, 0.9, 0.9], [0.2, 0.2, 0.2], [0.9, 0.6, 0.3], [0.6, 0.6, 0.65], [0.85, 0.75, 0.6], [0.4, 0.3, 0.25]];
  for (let i = 0; i < 6; i++) {
    const p = randomSidewalkPoint(rng);
    cats.push({ x: p.x, z: p.z, col: cols[i], state: 'wander', target: null, heading: rng() * Math.PI * 2 });
  }
  g.cats = cats;
  return cats;
}

export function tryCat(g) {
  const p = g.player;
  if (p.carryingCat) {
    p.petting = 2;
    return true;
  }
  let best = null;
  let bestD = 3;
  for (const c of g.cats) {
    if (c.state === 'home' || c.state === 'carried') continue;
    const d = Math.hypot(c.x - p.x, c.z - p.z);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  if (!best) return false;
  best.state = 'carried';
  p.carryingCat = best;
  showToast(g, 'You picked up a cat. Take it to the beach house!');
  return true;
}

export function stepCats(g, dt) {
  const p = g.player;
  if (p.petting !== undefined && p.petting > 0) p.petting = Math.max(0, p.petting - dt);
  for (const c of g.cats) {
    if (c.state === 'carried') {
      c.x = p.x;
      c.z = p.z;
      // Delivered to the beach house?
      if (Math.hypot(p.x - SPAWNS.beachHouse.x, p.z - SPAWNS.beachHouse.z) < 6) {
        c.state = 'home';
        p.carryingCat = null;
        g.cash += 20;
        g.respect += 5;
        showToast(g, 'The cat is home! +$20');
      }
      continue;
    }
    if (c.state === 'home') continue;
    // Wander: drift toward a target, pick a new one there.
    if (!c.target) {
      const t = randomSidewalkPoint(g.rng);
      c.target = { x: t.x, z: t.z };
    }
    const dx = c.target.x - c.x;
    const dz = c.target.z - c.z;
    const d = Math.hypot(dx, dz);
    if (d < 1) {
      c.target = null;
    } else {
      c.x += (dx / d) * 1.2 * dt;
      c.z += (dz / d) * 1.2 * dt;
      c.heading = Math.atan2(dx / d, dz / d);
    }
  }
}

// Every cat is 5 boxes (body, head, 2 ears, tail).
export function catBoxes(g, b, camera) {
  let count = 0;
  for (const c of g.cats || []) {
    if (c.state === 'home') continue;
    const yaw = c.heading || 0;
    const col = c.col || [0.9, 0.9, 0.9];
    pushBoxRot(b, c.x, 0.15, c.z, 0.5, 0.25, 0.25, yaw, col);
    pushBoxRot(b, c.x + 0.3, 0.2, c.z, 0.22, 0.22, 0.22, yaw, col);
    pushBoxRot(b, c.x + 0.24, 0.42, c.z - 0.06, 0.06, 0.1, 0.06, yaw, col);
    pushBoxRot(b, c.x + 0.24, 0.42, c.z + 0.06, 0.06, 0.1, 0.06, yaw, col);
    pushBoxRot(b, c.x - 0.32, 0.25, c.z, 0.08, 0.08, 0.4, yaw, col);
    count += 5;
  }
  return count;
}
