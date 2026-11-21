// Solmar Bay — training: the shooting range, the swim trial,
// and the slalom course. Each pays cash and respect when cleared.

import { SPAWNS } from './config.js';
import { pushBox } from './render.js';
import { addCash, showToast } from './state.js';

export function spawnTraining(g) {
  g.training = { rangeScore: 0, rangeBest: 0 };
  g._range = { active: false, targets: [], hits: 0, t: 0 };
  g._swim = { active: false, reached: false };
  g._slalom = { active: false, gates: 0 };
  return g.training;
}

export function tryRange(g) {
  if (Math.hypot(g.player.x - SPAWNS.shootingRange.x, g.player.z - SPAWNS.shootingRange.z) > 8) return false;
  const targets = [];
  for (let i = 0; i < 10; i++) {
    targets.push({ x: SPAWNS.shootingRange.x + (i % 5) * 4 - 8, z: SPAWNS.shootingRange.z - 10 - Math.floor(i / 5) * 4, hit: false });
  }
  g._range = { active: true, targets, hits: 0, t: 60 };
  showToast(g, 'Range started — hit all 10 targets in 60 s');
  return true;
}

export function rangeHit(g, x, z) {
  if (!g._range || !g._range.active) return false;
  for (const t of g._range.targets) {
    if (!t.hit && Math.hypot(t.x - x, t.z - z) < 2.5) {
      t.hit = true;
      g._range.hits++;
      g.training.rangeScore = g._range.hits;
      if (g._range.hits >= 10) {
        g._range.active = false;
        g.training.rangeBest = 10;
        addCash(g, 80, 'range cleared');
        g.respect += 10;
        showToast(g, 'Range cleared! +$80, +10 respect');
      }
      return true;
    }
  }
  return false;
}

export function trySwim(g) {
  // The sea is west of x = -340.
  if (g.player.x > -340) return false;
  if (Math.hypot(g.player.x - -350, g.player.z - 100) > 12) return false;
  g._swim = { active: true, reached: false };
  showToast(g, 'Swim trial — reach the buoy, then come back');
  return true;
}

export function trySlalom(g) {
  if (!g.player.inCar) return false;
  if (Math.hypot(g.player.x - SPAWNS.slalomStart.x, g.player.z - SPAWNS.slalomStart.z) > 8) return false;
  g._slalom = { active: true, gates: 0 };
  showToast(g, 'Slalom — drive through all 5 gates');
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
    if (!g._swim.reached && Math.hypot(g.player.x - SPAWNS.swimBuoy.x, g.player.z - SPAWNS.swimBuoy.z) < 4) {
      g._swim.reached = true;
      showToast(g, 'Buoy reached — swim back to shore');
    } else if (g._swim.reached && Math.hypot(g.player.x - -330, g.player.z - 100) < 4) {
      g._swim.active = false;
      addCash(g, 100, 'swim trial');
      showToast(g, 'Swim trial done! +$100');
    }
  }
  if (g._slalom && g._slalom.active) {
    const i = g._slalom.gates;
    if (i < 5) {
      const gx = 200 + i * 20, gz = 200;
      if (Math.hypot(g.player.x - gx, g.player.z - gz) < 4) {
        g._slalom.gates++;
        if (g._slalom.gates >= 5) {
          g._slalom.active = false;
          addCash(g, 150, 'slalom');
          showToast(g, 'Slalom cleared! +$150');
        }
      }
    }
  }
}

// Buoy + range targets.
export function trainingBoxes(g, batch) {
  const plain = [0, 0, 1, 1];
  let tris = 0;
  pushBox(batch, SPAWNS.swimBuoy.x, 0.3, SPAWNS.swimBuoy.z, 1.5, 1, 1.5, [1, 0.5, 0.1], plain);
  tris += 12;
  if (g._range && g._range.active) {
    for (const t of g._range.targets) {
      if (t.hit) continue;
      pushBox(batch, t.x, 1, t.z, 1.5, 1.5, 0.2, [0.9, 0.2, 0.2], plain);
      tris += 12;
    }
  }
  if (g._slalom && g._slalom.active) {
    for (let i = g._slalom.gates; i < 5; i++) {
      pushBox(batch, 200 + i * 20, 0, 200, 1, 3, 1, [0.2, 0.8, 0.4], plain);
      tris += 12;
    }
  }
  return tris;
}
