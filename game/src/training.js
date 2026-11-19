// Solmar Bay — training places: shooting range, swimming, driving.
//
// (a) Shooting range — targets to shoot, score points, cash reward,
//     small permanent accuracy/damage bonus (+10% damage per win,
//     capped at +50%).
// (b) Swimming — the player swims in the water (slower movement, no
//     drowning), plus a swim challenge: swim to a buoy and back for
//     cash.
// (c) Driving training — a slalom / time-trial course with
//     checkpoints, cash on completion.

import { TUNE, dist2 } from './config.js';
import { addCash, addRespect, showToast } from './state.js';

export function createTraining() {
  return {
    targets: [], // shooting-range targets {x, z, hit}
    score: 0,
    damageBonus: 0, // +0.1 per range win, max 0.5
    rangeActive: false,
    rangeT: 0,
    swim: { active: false, buoy: { x: -370, z: 100 }, back: false },
    slalom: { active: false, checkpoints: [], idx: 0, t: 0 },
  };
}

export function initTraining(game) {
  const t = game.training;
  // 6 targets in a row at the range (0, -350).
  t.targets = [];
  for (let i = 0; i < 6; i++) {
    t.targets.push({ x: -10 + i * 4, z: -360, hit: false });
  }
  // Slalom checkpoints.
  t.slalom.checkpoints = [
    { x: 100, z: -350 }, { x: 120, z: -320 }, { x: 100, z: -290 },
    { x: 80, z: -320 }, { x: 100, z: -350 },
  ];
}

export function startRange(game) {
  const t = game.training;
  if (t.rangeActive) return false;
  t.rangeActive = true;
  t.rangeT = 60;
  t.score = 0;
  for (const tg of t.targets) tg.hit = false;
  showToast(game.state, 'Shooting range: hit all 6 targets in 60 seconds!', 3);
  return true;
}

export function startSwim(game) {
  const t = game.training;
  if (t.swim.active) return false;
  t.swim.active = true;
  t.swim.back = false;
  showToast(game.state, 'Swim challenge: swim to the buoy (-370, 100) and back!', 3);
  return true;
}

export function startSlalom(game) {
  const t = game.training;
  if (t.slalom.active) return false;
  t.slalom.active = true;
  t.slalom.idx = 0;
  t.slalom.t = 90;
  showToast(game.state, 'Slalom: hit all 5 checkpoints in 90 seconds!', 3);
  return true;
}

export function stepTraining(game, dt) {
  const t = game.training;
  const p = game.state.player;
  if (t.rangeActive) {
    t.rangeT -= dt;
    const hit = t.targets.filter((tg) => tg.hit).length;
    if (hit >= 6) {
      t.rangeActive = false;
      t.damageBonus = Math.min(0.5, t.damageBonus + 0.1);
      addCash(game.state, TUNE.rangeReward);
      addRespect(game.state, 10);
      showToast(game.state, 'Range complete! +$' + TUNE.rangeReward + ' +10 REP, damage +10% (now +' + Math.round(t.damageBonus * 100) + '%).', 4);
    } else if (t.rangeT <= 0) {
      t.rangeActive = false;
      showToast(game.state, 'Range over — ' + hit + '/6 targets. Try again!', 3);
    }
  }
  if (t.swim.active) {
    const buoy = t.swim.buoy;
    if (!t.swim.back && dist2(p.x, p.z, buoy.x, buoy.z) < 100) {
      t.swim.back = true;
      showToast(game.state, 'Buoy reached! Swim back to the pier.', 2);
    } else if (t.swim.back && dist2(p.x, p.z, -330, 100) < 100) {
      t.swim.active = false;
      addCash(game.state, TUNE.swimReward);
      addRespect(game.state, 10);
      showToast(game.state, 'Swim challenge done! +$' + TUNE.swimReward + ' +10 REP.', 3);
    }
  }
  if (t.slalom.active) {
    t.slalom.t -= dt;
    const cp = t.slalom.checkpoints[t.slalom.idx];
    if (cp && p.inCar && dist2(p.x, p.z, cp.x, cp.z) < 144) {
      t.slalom.idx++;
      showToast(game.state, 'Checkpoint ' + t.slalom.idx + '/5!', 2);
      if (t.slalom.idx >= t.slalom.checkpoints.length) {
        t.slalom.active = false;
        addCash(game.state, TUNE.slalomReward);
        addRespect(game.state, 10);
        showToast(game.state, 'Slalom complete! +$' + TUNE.slalomReward + ' +10 REP.', 3);
      }
    } else if (t.slalom.t <= 0) {
      t.slalom.active = false;
      showToast(game.state, 'Slalom time up. Try again!', 2);
    }
  }
}

export function trainingBoxes(game, out) {
  const t = game.training;
  for (const tg of t.targets) {
    if (tg.hit) continue;
    out.pushBox(tg.x, 1.2, tg.z, 1.2, 2.4, 0.2, [0.9, 0.2, 0.2]);
    out.pushBox(tg.x, 1.2, tg.z, 0.6, 0.6, 0.24, [0.95, 0.95, 0.95]);
  }
  // Buoy in the water.
  out.pushBox(-370, 0.8, 100, 1.5, 1.5, 1.5, [0.95, 0.5, 0.1]);
  // Slalom checkpoints (cones).
  if (t.slalom.active) {
    const cp = t.slalom.checkpoints[t.slalom.idx];
    if (cp) out.pushBox(cp.x, 1, cp.z, 2, 2, 2, [0.95, 0.8, 0.15]);
  }
}
