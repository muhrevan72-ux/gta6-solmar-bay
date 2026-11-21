// Solmar Bay — the fire service.
//
// Fires break out in buildings on a timer. An unattended fire grows;
// spraying it out pays $150 and respect. The fire truck is parked at
// the fire station, but a hose works on foot too.

import { pushBox } from './render.js';
import { addCash, showToast } from './state.js';

export function spawnFireService(g) {
  g.fires = [];
  g._fireTimer = 90;
  return g.fires;
}

export function stepFires(g, dt) {
  if (!g.fires) g.fires = [];
  // A new fire breaks out when the timer runs out.
  g._fireTimer = (g._fireTimer === undefined ? 90 : g._fireTimer) - dt;
  if (g._fireTimer <= 0) {
    g._fireTimer = 90 + Math.random() * 60;
    const buildings = (g.city && g.city.buildings) || [];
    if (buildings.length > 0) {
      const b = buildings[Math.floor(Math.random() * buildings.length)];
      // No duplicate at the same spot: a fire is identified by its
      // position, not by a building reference (callers may build a
      // fire object without one).
      const already = g.fires.some((f) => f.x === b.x && f.z === b.z);
      if (!already) {
        g.fires.push({ x: b.x, z: b.z, hp: 100, building: b });
        showToast(g, 'A fire broke out in the city! Put it out for $150.');
      }
    }
  }
  // Unattended fires grow.
  for (const f of g.fires) {
    f.hp += 2 * dt;
  }
}

// Spray the nearest fire within hose range.
export function sprayFire(g) {
  const p = g.player;
  if (!g.fires) return false;
  let best = null;
  let bestD = 12;
  for (const f of g.fires) {
    const d = Math.hypot(p.x - f.x, p.z - f.z);
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  if (!best) return false;
  best.hp -= 25;
  if (best.hp <= 0) {
    g.fires = g.fires.filter((f) => f !== best);
    g.stats.firesOut = (g.stats.firesOut || 0) + 1;
    addCash(g, 150, 'Fire out');
    g.respect += 15;
    showToast(g, 'Fire out! +$150, +15 respect.');
  }
  return true;
}

// One flame box per fire.
export function fireBoxes(g, b, cam) {
  const plain = [0, 0, 1, 1];
  let count = 0;
  for (const f of g.fires || []) {
    const s = 0.8 + Math.sin((g.time || 0) * 6) * 0.15;
    pushBox(b, f.x, 0, f.z, 1.6 * s, 2.2, 1.6 * s, [0.95, 0.45, 0.1], plain);
    count += 1;
  }
  return count;
}
