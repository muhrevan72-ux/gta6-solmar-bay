// Solmar Bay — training: shooting range, swimming, slalom.
// Written fresh for rebuild #18.

import { SPAWNS } from './config.js';
import { pushBox } from './render.js';
import { addCash, showToast } from './state.js';

export function spawnTraining(g) {
  g.training = { rangeScore: 0, rangeBest: 0, swimBest: 0, slalomBest: 0 };
  g._range = { active: false, targets: [], t: 0, hits: 0 };
  g._swim = { active: false, reached: false };
  g._slalom = { active: false, gates: 0, next: 0 };
  return g.training;
}

export function tryRange(g) {
  const r = SPAWNS.shootingRange;
  const d = Math.hypot(g.player.x - r.x, g.player.z - r.z);
  if (d > 10) return false;
  const targets = [];
  for (let i = 0; i < 10; i++) {
    targets.push({ x: r.x - 10 + i * 2.5, z: r.z - 20, hit: false });
  }
  g._range = { active: true, targets, t: 60, hits: 0 };
  showToast(g, 'Shooting range — 60 seconds, 10 targets');
  return true;
}

export function rangeHit(g, x, z) {
  if (!g._range || !g._range.active) return false;
  for (const t of g._range.targets) {
    if (!t.hit && Math.hypot(t.x - x, t.z - z) < 3) {
      t.hit = true;
      g._range.hits++;
      g.training.rangeScore = g._range.hits;
      if (g._range.hits >= 10) {
        g._range.active = false;
        g.training.rangeBest = 10;
        addCash(g, 80, 'range reward');
        g.respect = (g.respect || 0) + 10;
        showToast(g, 'Range complete — $80');
      }
      return true;
    }
  }
  return false;
}

export function trySwim(g) {
  if (g.player.x > -340) return false;
  g._swim = { active: true, reached: false };
  showToast(g, 'Swim to the buoy and back');
  return true;
}

export function trySlalom(g) {
  if (!g.player.inCar) return false;
  const s = SPAWNS.slalomStart;
  const d = Math.hypot(g.player.x - s.x, g.player.z - s.z);
  if (d > 12) return false;
  g._slalom = { active: true, gates: 0, next: 0 };
  showToast(g, 'Slalom — drive through 5 gates');
  return true;
}

export function stepTraining(g, dt) {
  if (g._range && g._range.active) {
    g._range.t -= dt;
    if (g._range.t <= 0) {
      g._range.active = false;
      showToast(g, 'Range time up');
    }
  }
  if (g._swim && g._swim.active) {
    const buoy = SPAWNS.swimBuoy;
    if (!g._swim.reached) {
      const d = Math.hypot(g.player.x - buoy.x, g.player.z - buoy.z);
      if (d < 6) g._swim.reached = true;
    } else {
      // Back to shore (x near -330).
      if (g.player.x > -335 && g.player.x < -320) {
        g._swim.active = false;
        addCash(g, 100, 'swim reward');
        showToast(g, 'Swim complete — $100');
      }
    }
  }
  if (g._slalom && g._slalom.active) {
    // Completion lands on the tick AFTER the last gate.
    if (g._slalom.done) {
      g._slalom.active = false;
      addCash(g, 150, 'slalom reward');
      showToast(g, 'Slalom complete — $150');
      return;
    }
    const gates = [];
    for (let i = 0; i < 5; i++) gates.push({ x: 200 + i * 20, z: 200 });
    const next = g._slalom.next;
    if (next < gates.length) {
      const gate = gates[next];
      const d = Math.hypot(g.player.x - gate.x, g.player.z - gate.z);
      if (d < 6) {
        g._slalom.gates++;
        g._slalom.next++;
        if (g._slalom.next >= gates.length && g._slalom.gates >= 5) {
          g._slalom.done = true;
        }
      }
    }
  }
}

export function trainingBoxes(g, b, gl) {
  let n = 0;
  if (g._range && g._range.active) {
    for (const t of g._range.targets) {
      if (!t.hit) {
        pushBox(b, t.x, 1, t.z, 1, 1, 0.2, [0.9, 0.2, 0.2], [0, 0, 1, 1]);
        n++;
      }
    }
  }
  const buoy = SPAWNS.swimBuoy;
  pushBox(b, buoy.x, 0.5, buoy.z, 1, 1, 1, [0.95, 0.7, 0.1], [0, 0, 1, 1]);
  n++;
  return n * 12;
}
