// Solmar Bay — training.
//
// Three trials: the shooting range (10 targets, 60 s, $80 + 10
// respect), the swim to the buoy and back ($100), and the slalom
// (5 gates, $150). The slalom completes on the tick after the
// fifth gate, so a gate crossed and the reward never land in the
// same step.

import { SPAWNS } from './config.js';
import { pushBox } from './render.js';

export function spawnTraining(g) {
  g.training = { rangeBest: 0, rangeScore: 0 };
  g._range = { active: false, targets: [], hits: 0, t: 0 };
  g._swim = { active: false, reached: false };
  g._slalom = { active: false, gates: 0 };
}

export function tryRange(g) {
  if (Math.hypot(g.player.x - SPAWNS.shootingRange.x, g.player.z - SPAWNS.shootingRange.z) > 8) return false;
  const targets = [];
  for (let i = 0; i < 10; i++) {
    targets.push({
      x: SPAWNS.shootingRange.x - 20 + (i % 5) * 10,
      z: SPAWNS.shootingRange.z + 10 + Math.floor(i / 5) * 8,
      hit: false,
    });
  }
  g._range = { active: true, targets, hits: 0, t: 60 };
  return true;
}

export function rangeHit(g, x, z) {
  if (!g._range.active) return false;
  for (const t of g._range.targets) {
    if (!t.hit && Math.hypot(t.x - x, t.z - z) < 2) {
      t.hit = true;
      g._range.hits += 1;
      g.training.rangeScore = (g.training.rangeScore || 0) + 1;
      if (g._range.hits >= 10) {
        g._range.active = false;
        g.cash = (g.cash || 0) + 80;
        g.respect = (g.respect || 0) + 10;
        g.training.rangeBest = 10;
      }
      return true;
    }
  }
  return false;
}

export function trySwim(g) {
  if (g.player.x >= -330) return false; // the sea starts west of -330
  g._swim = { active: true, reached: false };
  return true;
}

export function trySlalom(g) {
  if (!g.player.inCar) return false;
  if (Math.hypot(g.player.x - SPAWNS.slalomStart.x, g.player.z - SPAWNS.slalomStart.z) > 8) return false;
  g._slalom = { active: true, gates: 0 };
  return true;
}

export function stepTraining(g, dt) {
  // Shooting range: the clock runs out.
  if (g._range.active) {
    g._range.t -= dt;
    if (g._range.t <= 0) g._range.active = false;
  }
  // Swim: reach the buoy, then come back to the shore.
  if (g._swim.active) {
    if (!g._swim.reached && Math.hypot(g.player.x - SPAWNS.swimBuoy.x, g.player.z - SPAWNS.swimBuoy.z) < 4) {
      g._swim.reached = true;
    } else if (g._swim.reached && Math.hypot(g.player.x - -330, g.player.z - 100) < 6) {
      g._swim.active = false;
      g.cash = (g.cash || 0) + 100;
    }
  }
  // Slalom: completion ticks on the step after the fifth gate.
  if (g._slalom.active) {
    if (g._slalom.gates >= 5) {
      g._slalom.active = false;
      g.cash = (g.cash || 0) + 150;
      return;
    }
    const gate = { x: 200 + g._slalom.gates * 20, z: 200 };
    if (Math.hypot(g.player.x - gate.x, g.player.z - gate.z) < 6) {
      g._slalom.gates += 1;
    }
  }
}

// The buoy, the slalom gates and (while active) the range targets.
export function trainingBoxes(g, b, camera) {
  let n = 0;
  const put = (x, y, z, w, h, d, col) => { pushBox(b, x, y, z, w, h, d, col); n++; };
  put(SPAWNS.swimBuoy.x, 0.5, SPAWNS.swimBuoy.z, 1, 1, 1, [1, 0.6, 0.1]); // buoy
  for (let i = 0; i < 5; i++) {
    put(200 + i * 20, 0, 200, 0.4, 3, 0.4, [1, 0.85, 0.1]); // slalom gate
  }
  if (g._range.active) {
    for (const t of g._range.targets) {
      if (!t.hit) put(t.x, 1, t.z, 1.5, 1.5, 0.2, [0.9, 0.2, 0.2]);
    }
  }
  return n;
}
