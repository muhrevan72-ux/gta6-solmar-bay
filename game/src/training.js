// Solmar Bay — training grounds (rebuild #15).
// Shooting range (10 targets, 60 s), swim trial (to the buoy and
// back), slalom (5 gates in a car).

import { SPAWNS } from './config.js';
import { showToast } from './state.js';
import { pushBox } from './render.js';

export function spawnTraining(g) {
  g.training = { rangeBest: 0, rangeScore: 0, swimBest: 0, slalomBest: 0 };
  return g.training;
}

export function tryRange(g) {
  const d = Math.hypot(g.player.x - SPAWNS.shootingRange.x, g.player.z - SPAWNS.shootingRange.z);
  if (d > 10) return false;
  const targets = [];
  for (let i = 0; i < 10; i++) {
    targets.push({ x: SPAWNS.shootingRange.x - 20 + (i % 5) * 10, z: SPAWNS.shootingRange.z - 10 + Math.floor(i / 5) * 8, hit: false });
  }
  g._range = { active: true, targets, hits: 0, t: 60 };
  return true;
}

export function rangeHit(g, x, z) {
  const r = g._range;
  if (!r || !r.active) return false;
  for (const t of r.targets) {
    if (t.hit) continue;
    if (Math.hypot(x - t.x, z - t.z) < 2.5) {
      t.hit = true;
      r.hits += 1;
      g.training.rangeScore = (g.training.rangeScore || 0) + 1;
      if (r.hits >= 10) {
        r.active = false;
        g.training.rangeBest = 10;
        g.cash += 80;
        g.respect += 10;
        showToast(g, 'Range cleared! +$80');
      }
      return true;
    }
  }
  return false;
}

export function trySwim(g) {
  // The sea is west of x = -340.
  if (g.player.x > -340) return false;
  g._swim = { active: true, reached: false };
  return true;
}

export function trySlalom(g) {
  if (!g.player.inCar) return false;
  const d = Math.hypot(g.player.x - SPAWNS.slalomStart.x, g.player.z - SPAWNS.slalomStart.z);
  if (d > 10) return false;
  g._slalom = { active: true, gates: 0 };
  return true;
}

export function stepTraining(g, dt) {
  // Shooting range timer.
  if (g._range && g._range.active) {
    g._range.t -= dt;
    if (g._range.t <= 0) g._range.active = false;
  }
  // Swim trial: reach the buoy, then get back to the shore.
  if (g._swim && g._swim.active) {
    const b = SPAWNS.swimBuoy;
    if (!g._swim.reached && Math.hypot(g.player.x - b.x, g.player.z - b.z) < 5) {
      g._swim.reached = true;
    }
    if (g._swim.reached && Math.hypot(g.player.x + 330, g.player.z - 100) < 6) {
      g._swim.active = false;
      g.cash += 100;
      showToast(g, 'Swim trial done! +$100');
    }
  }
  // Slalom: 5 gates at (200 + i*20, 200).
  if (g._slalom && g._slalom.active) {
    if (g._slalom.gates < 5) {
      const gx = 200 + g._slalom.gates * 20;
      if (Math.hypot(g.player.x - gx, g.player.z - 200) < 6) {
        g._slalom.gates += 1;
      }
    } else {
      g._slalom.active = false;
      g.cash += 150;
      showToast(g, 'Slalom done! +$150');
    }
  }
}

// The buoy (orange) and the range targets (red/white).
export function trainingBoxes(g, b, camera) {
  let n = 0;
  const buoy = SPAWNS.swimBuoy;
  pushBox(b, buoy.x, 0, buoy.z, 1, 1, 1, [1, 0.4, 0.1]);
  n += 1;
  if (g._range && g._range.active) {
    for (const t of g._range.targets) {
      if (!t.hit) {
        pushBox(b, t.x, 0.5, t.z, 1.5, 1.5, 0.2, [0.9, 0.1, 0.1]);
        n += 1;
      }
    }
  }
  return n;
}
