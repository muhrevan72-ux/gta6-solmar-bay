// Solmar Bay — fires and the fire truck hose.
// Written fresh for rebuild #18.

import { mulberry32 } from './config.js';
import { pushBox } from './render.js';
import { addCash, showToast } from './state.js';

export function spawnFireService(g) {
  g.fires = [];
  g._fireTimer = 60 + Math.random() * 60;
  return g.fires;
}

export function stepFires(g, dt) {
  g._fireTimer -= dt;
  if (g._fireTimer <= 0) {
    g._fireTimer = 90 + Math.random() * 90;
    const b = g.city.buildings[Math.floor(Math.random() * g.city.buildings.length)];
    if (b && !g.fires.some((f) => f.x === b.x && f.z === b.z)) {
      g.fires.push({ x: b.x, z: b.z, hp: 100, building: b });
    }
  }
  for (const f of g.fires) {
    f.hp = Math.min(200, f.hp + dt * 2);
  }
}

// Spray the nearest fire (within ~12 m). Returns false when far.
export function sprayFire(g, dt) {
  let best = null;
  let bestD = 12;
  for (const f of g.fires) {
    const d = Math.hypot(f.x - g.player.x, f.z - g.player.z);
    if (d < bestD) { best = f; bestD = d; }
  }
  if (!best) return false;
  best.hp -= 30 * dt;
  if (best.hp <= 0) {
    g.fires = g.fires.filter((f) => f !== best);
    g.stats.firesOut = (g.stats.firesOut || 0) + 1;
    addCash(g, 150, 'fire reward');
    g.respect = (g.respect || 0) + 15;
    showToast(g, 'Fire out — $150');
  }
  return true;
}

export function fireBoxes(g, b, gl) {
  for (const f of g.fires) {
    pushBox(b, f.x, 0, f.z, 3, 4, 3, [0.95, 0.4, 0.1], [0, 0, 1, 1]);
    pushBox(b, f.x, 4, f.z, 2, 2, 2, [0.95, 0.7, 0.1], [0, 0, 1, 1]);
  }
  return g.fires.length;
}
