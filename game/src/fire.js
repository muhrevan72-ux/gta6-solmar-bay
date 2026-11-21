// Solmar Bay — fires and the fire service. A fire breaks out
// every 90–180 s at a random building; left alone it grows.
// Spray it with the fire truck nearby to put it out ($150).

import { pushBox } from './render.js';
import { addCash, showToast } from './state.js';

export function spawnFireService(g) {
  g.fires = [];
  g._fireTimer = 120;
  return g;
}

export function stepFires(g, dt) {
  g._fireTimer -= dt;
  if (g._fireTimer <= 0) {
    // Pick a random building; if it is already burning, no new
    // fire starts (no duplicate at the same building).
    const b = g.city.buildings[Math.floor(Math.random() * g.city.buildings.length)];
    const alreadyBurning = g.fires.some((f) => f.building === b || (f.x === b.x && f.z === b.z));
    if (b && !alreadyBurning) {
      g.fires.push({ building: b, x: b.x, z: b.z, hp: 100 });
    }
    g._fireTimer = 90 + Math.random() * 90;
  }
  // Unattended fires grow.
  for (const f of g.fires) {
    f.hp += dt * 2;
  }
}

// Spray the nearest fire (the player must be close to it).
export function sprayFire(g, dt) {
  let best = null, bestD = 10;
  for (const f of g.fires) {
    const d = Math.hypot(f.x - g.player.x, f.z - g.player.z);
    if (d < bestD) { bestD = d; best = f; }
  }
  if (!best) return false;
  best.hp -= dt * 30;
  if (best.hp <= 0) {
    const idx = g.fires.indexOf(best);
    if (idx >= 0) g.fires.splice(idx, 1);
    g.stats.firesOut++;
    addCash(g, 150, 'fire out');
    g.respect += 15;
    showToast(g, 'Fire out! +$150, +15 respect');
  }
  return true;
}

// One box per fire; returns the number of fires drawn.
export function fireBoxes(g, batch) {
  const plain = [0, 0, 1, 1];
  let n = 0;
  for (const f of g.fires) {
    const h = Math.min(8, 2 + f.hp / 30);
    pushBox(batch, f.x, 0.5, f.z, 3, h, 3, [1, 0.45, 0.1], plain);
    n++;
  }
  return n;
}
