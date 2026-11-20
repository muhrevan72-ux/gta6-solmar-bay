// Solmar Bay — fires and the fire service. Fires break out on a
// timer; spraying water near one puts it out ($150 + 15 respect).
// An unattended fire grows slowly.

import { SPAWNS } from './config.js';
import { pushBox } from './render.js';

export function spawnFireService(g) {
  g.fires = [];
  g._fireTimer = 90;
}

// A fire breaks out when the timer expires (90+ s). Pick a RANDOM
// building from ALL buildings; if that building already has a fire,
// spawn NOTHING this cycle (never filter-then-pick — with a stubbed
// rng that would always spawn at the next building).
export function stepFires(g, dt) {
  if (!g.fires) g.fires = [];
  g._fireTimer -= dt;
  if (g._fireTimer <= 0) {
    g._fireTimer = 90 + Math.random() * 60;
    const buildings = g.city.buildings;
    if (buildings.length) {
      const b = buildings[Math.floor(Math.random() * buildings.length)];
      // Match by position (not only by the building reference):
      // a fire may be recorded without a `building` field.
      const alreadyBurning = g.fires.some(f => f.building === b || (f.x === b.x && f.z === b.z));
      if (!alreadyBurning) {
        g.fires.push({ x: b.x, z: b.z, hp: 100, building: b, size: 1 });
      }
    }
  }
  for (const f of g.fires) {
    // An unattended fire grows in HP (1 HP/s).
    f.hp += dt;
    f.size = Math.min(3, 1 + (f.hp - 100) / 100);
  }
}

// Spray water: near a fire it loses HP; far from any fire nothing.
export function sprayFire(g, dt) {
  if (!g.fires) return false;
  let hit = false;
  for (let i = g.fires.length - 1; i >= 0; i--) {
    const f = g.fires[i];
    const d = Math.hypot(f.x - g.player.x, f.z - g.player.z);
    if (d < 12) {
      f.hp -= 50 * dt;
      hit = true;
      if (f.hp <= 0) {
        g.fires.splice(i, 1);
        g.cash += 150;
        g.respect = (g.respect || 0) + 15;
        g.stats.firesOut = (g.stats.firesOut || 0) + 1;
        g.toast = 'Fire out! +$150, +15 respect';
        g.toastTimer = 3;
      }
    }
  }
  return hit;
}

// One box per fire (flames + smoke read as a single box here).
export function fireBoxes(g, batch, cam) {
  let n = 0;
  for (const f of g.fires || []) {
    pushBox(batch, f.x, 0, f.z, 2 * f.size, 3 * f.size, 2 * f.size, [1, 0.5, 0.1]);
    n++;
  }
  return n;
}
