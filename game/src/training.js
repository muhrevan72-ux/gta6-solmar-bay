// Solmar Bay — training: shooting range, swimming and the driving
// trial. Each is a small timed skill test with a cash reward and
// +10 respect. The range is at (0, -350), the swim is in the harbour
// basin, the slalom trial is at (100, -350).

import { TUNE } from './config.js';
import { showToast, addCash, addRespect } from './state.js';

export function createTraining() {
  return {
    range: null, // {active, hits, need, timer}
    swim: null, // {active, laps, need}
    trial: null, // {active, checkpoints, need, next}
  };
}

export function startRange(game) {
  game.training.range = { active: true, hits: 0, need: 5, timer: 30 };
  showToast(game.state, 'Shooting range: hit 5 targets in 30 s. +$' + TUNE.rangeReward, 5);
}

export function startSwim(game) {
  game.training.swim = { active: true, laps: 0, need: 2, side: 1 };
  showToast(game.state, 'Swim trial: swim across the harbour and back, twice. +$' + TUNE.swimReward, 5);
}

export function startTrial(game) {
  game.training.trial = { active: true, checkpoints: 0, need: 5, next: 0 };
  showToast(game.state, 'Driving trial: hit 5 checkpoints in order. +$' + TUNE.slalomReward, 5);
}

const TRIAL_POINTS = [
  { x: 100, z: -300 }, { x: 150, z: -250 }, { x: 200, z: -300 },
  { x: 250, z: -250 }, { x: 300, z: -300 },
];

export function stepTraining(game, dt) {
  const s = game.state;
  const p = s.player;
  const tr = game.training;
  if (tr.range && tr.range.active) {
    tr.range.timer -= dt;
    if (tr.range.timer <= 0) {
      tr.range = null;
      showToast(s, 'Range time up. Come back and try again.', 3);
    }
  }
  if (tr.swim && tr.swim.active) {
    // Cross the harbour basin (x 340-400) and back.
    if (tr.swim.side === 1 && p.x > 395) { tr.swim.side = -1; tr.swim.laps += 0.5; }
    if (tr.swim.side === -1 && p.x < 345) { tr.swim.side = 1; tr.swim.laps += 0.5; }
    if (tr.swim.laps >= tr.swim.need) {
      tr.swim = null;
      addCash(s, TUNE.swimReward);
      addRespect(s, 10);
      showToast(s, 'Swim trial done! +$' + TUNE.swimReward + ', +10 REP', 5);
    }
  }
  if (tr.trial && tr.trial.active) {
    const pt = TRIAL_POINTS[tr.trial.next];
    if (pt && p.inCar && Math.hypot(p.x - pt.x, p.z - pt.z) < 10) {
      tr.trial.checkpoints++;
      tr.trial.next++;
      showToast(s, 'Checkpoint ' + tr.trial.checkpoints + '/' + tr.trial.need, 3);
      if (tr.trial.checkpoints >= tr.trial.need) {
        tr.trial = null;
        addCash(s, TUNE.slalomReward);
        addRespect(s, 10);
        showToast(s, 'Driving trial done! +$' + TUNE.slalomReward + ', +10 REP', 5);
      }
    }
  }
}

// A range target hit (called from combat when a shot lands near a
// target — the range targets are at (0, -350), 5 of them in a row).
export function rangeTargetHit(game) {
  const tr = game.training;
  if (!tr.range || !tr.range.active) return false;
  tr.range.hits++;
  if (tr.range.hits >= tr.range.need) {
    tr.range = null;
    addCash(game.state, TUNE.rangeReward);
    addRespect(game.state, 10);
    showToast(game.state, 'Range complete! +$' + TUNE.rangeReward + ', +10 REP', 5);
  }
  return true;
}

export function trainingBoxes(game, out) {
  // Shooting range: 5 targets in a row at (0, -350).
  for (let i = 0; i < 5; i++) {
    const x = -8 + i * 4;
    out.pushBox(x, 1.2, -352, 1.5, 1.5, 0.2, [0.9, 0.2, 0.2]);
    out.pushBox(x, 1.2, -352, 0.8, 0.8, 0.22, [1, 1, 1]);
  }
  // Trial checkpoints as floating rings (drawn as flat markers).
  const tr = game.training;
  if (tr.trial && tr.trial.active) {
    const pt = TRIAL_POINTS[tr.trial.next];
    if (pt) out.pushFlat(pt.x, 0.2, pt.z, 6, 6, [1, 0.8, 0.1], 0);
  }
}
