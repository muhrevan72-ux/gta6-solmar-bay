// Solmar Bay — training: the shooting range, swimming and the
// driving slalom. Each pays cash + respect on completion.
//
// State shape (the tests read these fields directly):
//   g._range   = { targets (10), t: 60, hits: 0, active: true }
//   g.training = { rangeScore, rangeBest }
//   g._swim    = { active, reached }
//   g._slalom  = { active, gates }

import { SPAWNS } from './config.js';
import { pushBox } from './render.js';

export function spawnTraining(g) {
  g.training = { rangeScore: 0, rangeBest: 0 };
  g._range = null;
  g._swim = null;
  g._slalom = null;
}

// Start the shooting range: 10 targets, 60 s.
export function tryRange(g) {
  const d = Math.hypot(g.player.x - SPAWNS.shootingRange.x, g.player.z - SPAWNS.shootingRange.z);
  if (d > 12) return false;
  const targets = [];
  for (let i = 0; i < 10; i++) {
    targets.push({ x: SPAWNS.shootingRange.x - 20 + (i % 5) * 10, z: SPAWNS.shootingRange.z - 15 - Math.floor(i / 5) * 5, hit: false });
  }
  g._range = { targets, t: 60, hits: 0, active: true };
  g.training.rangeScore = 0;
  g.toast = 'Shooting range — hit all 10 targets in 60 s!';
  g.toastTimer = 3;
  return true;
}

// A shot at (x, z): hit a target to score it. Updates BOTH the
// range hit count and the training score.
export function rangeHit(g, x, z) {
  const r = g._range;
  if (!r || !r.active) return false;
  for (const target of r.targets) {
    if (target.hit) continue;
    if (Math.hypot(target.x - x, target.z - z) < 3) {
      target.hit = true;
      r.hits++;
      g.training.rangeScore = (g.training.rangeScore || 0) + 1;
      if (r.hits >= 10) {
        r.active = false;
        g.training.rangeBest = Math.max(g.training.rangeBest || 0, 10);
        g.cash += 80;
        g.respect = (g.respect || 0) + 10;
        g.toast = 'Range cleared! +$80, +10 respect';
        g.toastTimer = 3;
      }
      return true;
    }
  }
  return false;
}

// Start swimming in the sea at (-350,100).
export function trySwim(g) {
  const d = Math.hypot(g.player.x - (-350), g.player.z - 100);
  if (d > 10) return false;
  g._swim = { active: true, reached: false };
  g.toast = 'Swim to the buoy and back!';
  g.toastTimer = 3;
  return true;
}

// Start the slalom in a car at the start line.
export function trySlalom(g) {
  if (!g.player.inCar) return false;
  const d = Math.hypot(g.player.x - SPAWNS.slalomStart.x, g.player.z - SPAWNS.slalomStart.z);
  if (d > 12) return false;
  g._slalom = { active: true, gates: 0 };
  g.toast = 'Slalom — drive through all 5 gates!';
  g.toastTimer = 3;
  return true;
}

// The combined training stepper: range timeout, swim, slalom.
export function stepTraining(g, dt) {
  // Range: the 60 s timer runs out.
  const r = g._range;
  if (r && r.active) {
    r.t -= dt;
    if (r.t <= 0) {
      r.active = false;
      g.training.rangeBest = Math.max(g.training.rangeBest || 0, r.hits);
      g.toast = `Range over — ${r.hits}/10 targets`;
      g.toastTimer = 3;
    }
  }
  // Swim: reach the buoy, then return to (-330,100).
  const s = g._swim;
  if (s && s.active) {
    const buoy = SPAWNS.swimBuoy;
    if (!s.reached) {
      if (Math.hypot(g.player.x - buoy.x, g.player.z - buoy.z) < 5) s.reached = true;
    } else if (Math.hypot(g.player.x - (-330), g.player.z - 100) < 5) {
      s.active = false;
      g.cash += 100;
      g.toast = 'Swim complete! +$100';
      g.toastTimer = 3;
    }
  }
  // Slalom: gates at (200 + i*20, 200) for i 0..4.
  const sl = g._slalom;
  if (sl && sl.active) {
    const gate = { x: 200 + sl.gates * 20, z: 200 };
    if (Math.hypot(g.player.x - gate.x, g.player.z - gate.z) < 6) {
      sl.gates++;
      if (sl.gates >= 5) {
        sl.active = false;
        g.cash += 150;
        g.toast = 'Slalom complete! +$150';
        g.toastTimer = 3;
      }
    }
  }
}

// The buoy and the range targets, as boxes.
export function trainingBoxes(g, batch, cam) {
  let n = 0;
  const buoy = SPAWNS.swimBuoy;
  pushBox(batch, buoy.x, 0.5, buoy.z, 1, 1, 1, [1, 0.5, 0.1]);
  n++;
  const targets = (g._range && g._range.targets) || (g.training && g.training.targets) || [];
  for (const target of targets) {
    if (target.hit) continue;
    pushBox(batch, target.x, 1, target.z, 1.5, 1.5, 0.2, [0.9, 0.1, 0.1]);
    n++;
  }
  return n;
}
