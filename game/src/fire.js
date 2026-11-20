// Solmar Bay — the fire service (rebuild #14).
// Fires break out on buildings on a timer. Spray water on one to
// put it out: +$150, +15 respect, and one more fire out.

import { showToast } from './state.js';
import { pushBox } from './render.js';

export function spawnFireService(g) {
  if (!g.fires) g.fires = [];
  if (g._fireTimer === undefined) g._fireTimer = 90;
  return g.fires;
}

export function stepFires(g, dt) {
  if (g._fireTimer === undefined) g._fireTimer = 90;
  g._fireTimer -= dt;
  if (g._fireTimer <= 0) {
    // Pick a building at random, but never one that already burns.
    const bs = g.city.buildings;
    if (bs.length > 0) {
      const b = bs[Math.floor(Math.random() * bs.length)];
      const dup = g.fires.some((f) => Math.hypot(f.x - b.x, f.z - b.z) < 5);
      if (!dup) {
        g.fires.push({ x: b.x, z: b.z, hp: 100, spread: 0 });
      }
    }
    g._fireTimer = 90 + Math.random() * 90;
  }
  // Unattended fires grow.
  for (const f of g.fires) {
    f.hp += 0.5 * dt;
    f.spread += 0.1 * dt;
  }
}

export function sprayFire(g, dt) {
  let sprayed = false;
  for (const f of g.fires) {
    const d = Math.hypot(g.player.x - f.x, g.player.z - f.z);
    if (d > 12) continue;
    sprayed = true;
    f.hp -= 60 * dt;
    if (f.hp <= 0) {
      g.fires = g.fires.filter((x) => x !== f);
      g.stats.firesOut = (g.stats.firesOut || 0) + 1;
      g.cash += 150;
      g.respect += 15;
      showToast(g, 'Fire out! +$150');
    }
  }
  return sprayed;
}

// One box per fire (flames + smoke are drawn as a tall orange box
// with a grey box above it, counted as one fire).
export function fireBoxes(g, b, camera) {
  for (const f of g.fires) {
    pushBox(b, f.x, 0, f.z, 3, 3, 3, [1, 0.4, 0.1]);
    pushBox(b, f.x, 3, f.z, 2, 2, 2, [0.5, 0.5, 0.5]);
  }
  return g.fires.length;
}
