// Solmar Bay — training: the shooting range, the swim, the slalom.
//
// The range is ten targets in 60 seconds; the swim is out to the buoy
// and back to shore; the slalom is five gates in the car. Each pays
// cash and respect when finished.

import { pushBox } from './render.js';
import { addCash, showToast } from './state.js';
import { SPAWNS } from './config.js';

const RANGE_TARGETS = [];
for (let i = 0; i < 10; i++) {
  RANGE_TARGETS.push({ x: SPAWNS.shootingRange.x + (i % 5) * 4, z: SPAWNS.shootingRange.z + 5 + Math.floor(i / 5) * 4 });
}
const SLALOM_GATES = [];
for (let i = 0; i < 5; i++) {
  SLALOM_GATES.push({ x: 200 + i * 20, z: 200 });
}

export function spawnTraining(g) {
  g.training = { rangeScore: 0, rangeBest: 0, swimBest: 0, slalomBest: 0 };
  g._range = { active: false, targets: [], t: 0, hits: 0 };
  g._swim = { active: false, reached: false };
  g._slalom = { active: false, gate: 0 };
  return g.training;
}

export function tryRange(g) {
  const p = g.player;
  if (Math.hypot(p.x - SPAWNS.shootingRange.x, p.z - SPAWNS.shootingRange.z) > 12) return false;
  g._range = { active: true, targets: RANGE_TARGETS.map((t) => ({ x: t.x, z: t.z })), t: 60, hits: 0 };
  g.training.rangeScore = 0;
  showToast(g, 'Shooting range — hit all 10 targets in 60 seconds!');
  return true;
}

export function rangeHit(g, x, z) {
  if (!g._range || !g._range.active) return false;
  const targets = Array.isArray(g._range.targets) && g._range.targets.length
    ? g._range.targets
    : RANGE_TARGETS;
  for (const t of targets) {
    if (Math.hypot(x - t.x, z - t.z) <= 2) {
      g._range.hits += 1;
      g.training.rangeScore = g._range.hits;
      if (g._range.hits >= 10) {
        g._range.active = false;
        g.training.rangeBest = Math.max(g.training.rangeBest || 0, 10);
        addCash(g, 80, 'Range complete');
        g.respect += 10;
        showToast(g, 'Range complete! +$80, +10 respect.');
      }
      return true;
    }
  }
  return false;
}

export function trySwim(g) {
  const p = g.player;
  if (p.x >= -300) return false;
  g._swim = { active: true, reached: false };
  showToast(g, 'Swim to the buoy and back to shore!');
  return true;
}

export function trySlalom(g) {
  const p = g.player;
  if (!p.inCar) return false;
  if (Math.hypot(p.x - SPAWNS.slalomStart.x, p.z - SPAWNS.slalomStart.z) > 10) return false;
  g._slalom = { active: true, gate: 0, gates: 0 };
  showToast(g, 'Slalom — drive through all 5 gates!');
  return true;
}

export function stepTraining(g, dt) {
  // Shooting range timer.
  if (g._range && g._range.active) {
    g._range.t -= dt;
    if (g._range.t <= 0) {
      g._range.active = false;
      g._range.t = 0;
      showToast(g, 'Time up on the range.');
    }
  }
  // Swim: out to the buoy, back to the shore.
  if (g._swim && g._swim.active) {
    const p = g.player;
    if (!g._swim.reached && Math.hypot(p.x - SPAWNS.swimBuoy.x, p.z - SPAWNS.swimBuoy.z) <= 8) {
      g._swim.reached = true;
      showToast(g, 'Buoy reached — swim back to shore!');
    } else if (g._swim.reached && Math.hypot(p.x - -330, p.z - 100) <= 8) {
      g._swim.active = false;
      g.training.swimBest = Math.max(g.training.swimBest || 0, 1);
      addCash(g, 100, 'Swim complete');
      showToast(g, 'Swim complete! +$100.');
    }
  }
  // Slalom: drive through the gates in order.
  if (g._slalom && g._slalom.active) {
    const p = g.player;
    const gateIdx = g._slalom.gate ?? g._slalom.gates ?? 0;
    const gate = SLALOM_GATES[gateIdx];
    if (gate && Math.hypot(p.x - gate.x, p.z - gate.z) <= 6) {
      g._slalom.gate = gateIdx + 1;
      g._slalom.gates = gateIdx + 1;
      if (gateIdx + 1 >= SLALOM_GATES.length) {
        g._slalom.active = false;
        g.training.slalomBest = Math.max(g.training.slalomBest || 0, 1);
        addCash(g, 150, 'Slalom complete');
        showToast(g, 'Slalom complete! +$150.');
      }
    }
  }
}

// Range targets, the swim buoy, the slalom gates.
export function trainingBoxes(g, b, cam) {
  const plain = [0, 0, 1, 1];
  let count = 0;
  for (const t of RANGE_TARGETS) {
    pushBox(b, t.x, 0.8, t.z, 1, 1, 0.2, [0.95, 0.3, 0.2], plain);
    count += 1;
  }
  pushBox(b, SPAWNS.swimBuoy.x, 0.5, SPAWNS.swimBuoy.z, 1, 0.8, 1, [0.95, 0.6, 0.1], plain);
  count += 1;
  for (const gate of SLALOM_GATES) {
    pushBox(b, gate.x - 2, 0, gate.z, 0.3, 2.4, 0.3, [0.95, 0.75, 0.1], plain);
    pushBox(b, gate.x + 2, 0, gate.z, 0.3, 2.4, 0.3, [0.95, 0.75, 0.1], plain);
    count += 2;
  }
  return count;
}
