// Solmar Bay — training: shooting range, swim trial, slalom (rebuild #13).
import { pushBox } from './render.js';
import { SPAWNS } from './config.js';
import { addCash } from './state.js';

export function spawnTraining(g) {
  g.training = { rangeBest: 0, swimBest: 0, slalomBest: 0 };
  g._range = { active: false, t: 0, targets: [], hits: 0 };
  g._swim = { active: false, reached: false };
  g._slalom = { active: false, gates: 0 };
}

export function tryRange(g) {
  const d = Math.hypot(g.player.x - SPAWNS.shootingRange.x, g.player.z - SPAWNS.shootingRange.z);
  if (d > 10) return false;
  const targets = [];
  for (let i = 0; i < 10; i++) {
    targets.push({ x: SPAWNS.shootingRange.x + 10 + (i % 5) * 4, z: SPAWNS.shootingRange.z - 10 - Math.floor(i / 5) * 4 });
  }
  g._range = { active: true, t: 60, targets, hits: 0 };
  return true;
}

export function rangeHit(g, x, z) {
  if (!g._range.active) return false;
  for (let i = 0; i < g._range.targets.length; i++) {
    const t = g._range.targets[i];
    if (Math.hypot(t.x - x, t.z - z) < 3) {
      g._range.targets.splice(i, 1);
      g._range.hits += 1;
      g.training.rangeScore = g._range.hits;
      if (g._range.targets.length === 0) {
        g._range.active = false;
        addCash(g, 80, 'range');
        g.respect += 10;
        g.training.rangeBest = Math.max(g.training.rangeBest, 10);
      }
      return true;
    }
  }
  return false;
}

export function trySwim(g) {
  if (g.player.x >= -330) return false; // must be in the sea
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
  if (g._range.active) {
    g._range.t -= dt;
    if (g._range.t <= 0) g._range.active = false;
  }
  if (g._swim.active) {
    if (!g._swim.reached && Math.hypot(g.player.x - SPAWNS.swimBuoy.x, g.player.z - SPAWNS.swimBuoy.z) < 10) {
      g._swim.reached = true;
    } else if (g._swim.reached && g.player.x >= -330) {
      g._swim.active = false;
      addCash(g, 100, 'swim trial');
      g.training.swimBest = 1;
    }
  }
  if (g._slalom.active) {
    if (g._slalom.gates >= 5) {
      g._slalom.active = false;
      addCash(g, 150, 'slalom');
      g.training.slalomBest = 1;
      return;
    }
    const gx = 200 + g._slalom.gates * 20;
    if (Math.hypot(g.player.x - gx, g.player.z - 200) < 8) {
      g._slalom.gates += 1;
      if (g._slalom.gates >= 5) {
        g._slalom.active = false;
        addCash(g, 150, 'slalom');
        g.training.slalomBest = 1;
      }
    }
  }
}

export function trainingBoxes(g, b, cam) {
  const plain = [0, 0, 1, 1];
  let n = 0;
  const box = (x, y, z, w, h, d, col) => { pushBox(b, x, y, z, w, h, d, col, plain); n++; };
  box(SPAWNS.swimBuoy.x, 0, SPAWNS.swimBuoy.z, 1.5, 1, 1.5, [1, 0.6, 0.1]);
  if (g._range.active) {
    for (const t of g._range.targets) box(t.x, 1, t.z, 1.2, 1.2, 0.2, [0.9, 0.2, 0.2]);
  } else {
    for (let i = 0; i < 10; i++) {
      box(SPAWNS.shootingRange.x + 10 + (i % 5) * 4, 1, SPAWNS.shootingRange.z - 10 - Math.floor(i / 5) * 4, 1.2, 1.2, 0.2, [0.9, 0.2, 0.2]);
    }
  }
  if (g._slalom.active) {
    for (let i = 0; i < 5; i++) box(200 + i * 20, 0, 200, 0.4, 3, 0.4, [1, 0.8, 0.2]);
  }
  return n;
}
