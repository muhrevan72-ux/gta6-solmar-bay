// Solmar Bay — training grounds.
//
// Three repeatable trials: the shooting range (hit 10 targets,
// $80 + SMG unlock at 100 respect), swimming (reach the buoy and
// back, $100), and the slalom driving course ($150). Each keeps
// its best score in game.training.

import { SPAWNS, TUNE } from './config.js';
import { pushBox } from './render.js';
import { tileUV } from './texture.js';
import { dist } from './config.js';
import { addCash, showToast } from './state.js';

export function spawnTraining(game) {
  game.training = { rangeScore: 0, rangeBest: 0, swimBest: 0, slalomBest: 0 };
  game._range = { active: false, targets: [], hits: 0, t: 0 };
  game._swim = { active: false, t: 0 };
  game._slalom = { active: false, gates: 0, t: 0 };
}

// Start the shooting range: 10 targets appear at the range.
export function tryRange(game) {
  const p = game.player;
  if (dist(p.x, p.z, SPAWNS.shootingRange.x, SPAWNS.shootingRange.z) > 10) return false;
  if (game._range.active) return false;
  game._range.active = true;
  game._range.hits = 0;
  game._range.t = 60;
  game._range.targets = [];
  for (let i = 0; i < 10; i++) {
    game._range.targets.push({ x: 260 + (i % 5) * 4, z: 130 + Math.floor(i / 5) * 4, hit: false });
  }
  showToast(game, 'Range started — hit all 10 targets in 60 s!');
  return true;
}

// A shot at (tx, tz) that lands on a range target.
export function rangeHit(game, tx, tz) {
  if (!game._range.active) return false;
  for (const t of game._range.targets) {
    if (!t.hit && dist(t.x, t.z, tx, tz) < 2) {
      t.hit = true;
      game._range.hits += 1;
      game.training.rangeScore = game._range.hits;
      showToast(game, `Target ${game._range.hits}/10`);
      if (game._range.hits >= 10) {
        game._range.active = false;
        addCash(game, TUNE.rangeReward, '— range cleared');
        game.respect += 10;
        game.training.rangeBest = Math.max(game.training.rangeBest, 10);
        showToast(game, `Range cleared! +$${TUNE.rangeReward} · +10 respect`);
      }
      return true;
    }
  }
  return false;
}

export function stepTraining(game, dt) {
  if (game._range.active) {
    game._range.t -= dt;
    if (game._range.t <= 0) {
      game._range.active = false;
      showToast(game, `Range over — ${game._range.hits}/10 targets.`);
    }
  }
  if (game._swim.active) {
    game._swim.t += dt;
    const p = game.player;
    if (dist(p.x, p.z, SPAWNS.swimBuoy.x, SPAWNS.swimBuoy.z) < 5 && !game._swim.reached) {
      game._swim.reached = true;
      showToast(game, 'Buoy reached — swim back to the beach!');
    }
    if (game._swim.reached && p.x > -340) {
      game._swim.active = false;
      const t = game._swim.t;
      game.training.swimBest = game.training.swimBest === 0 ? t : Math.min(game.training.swimBest, t);
      addCash(game, TUNE.swimReward, '— swim trial');
      game.respect += 10;
      showToast(game, `Swim trial done in ${t.toFixed(1)} s! +$${TUNE.swimReward}`);
    }
  }
  if (game._slalom.active) {
    game._slalom.t += dt;
    const p = game.player;
    const gates = game._slalom.gates;
    if (gates < 5) {
      const gx = 200 + gates * 20;
      if (dist(p.x, p.z, gx, 200) < 5) {
        game._slalom.gates += 1;
        showToast(game, `Gate ${game._slalom.gates}/5`);
      }
    } else {
      game._slalom.active = false;
      const t = game._slalom.t;
      game.training.slalomBest = game.training.slalomBest === 0 ? t : Math.min(game.training.slalomBest, t);
      addCash(game, TUNE.slalomReward, '— slalom trial');
      game.respect += 10;
      showToast(game, `Slalom done in ${t.toFixed(1)} s! +$${TUNE.slalomReward}`);
    }
  }
}

export function trySwim(game) {
  const p = game.player;
  if (p.x > -340) return false;
  if (game._swim.active) return false;
  game._swim.active = true;
  game._swim.t = 0;
  game._swim.reached = false;
  showToast(game, 'Swim trial — reach the buoy and come back!');
  return true;
}

export function trySlalom(game) {
  const p = game.player;
  if (!p.inCar) {
    showToast(game, 'The slalom needs a car.');
    return false;
  }
  if (dist(p.x, p.z, SPAWNS.slalomStart.x, SPAWNS.slalomStart.z) > 10) return false;
  if (game._slalom.active) return false;
  game._slalom.active = true;
  game._slalom.gates = 0;
  game._slalom.t = 0;
  showToast(game, 'Slalom started — drive through all 5 gates!');
  return true;
}

export function trainingBoxes(game, b, cam) {
  const uv = tileUV('plain');
  // Range targets.
  if (game._range.active) {
    for (const t of game._range.targets) {
      if (!t.hit) pushBox(b, t.x, 1, t.z, 1.5, 1.5, 0.2, [0.9, 0.2, 0.2], uv);
    }
  }
  // Swim buoy.
  pushBox(b, SPAWNS.swimBuoy.x, 0, SPAWNS.swimBuoy.z, 1.5, 1, 1.5, [1, 0.6, 0.1], uv);
  // Slalom gates.
  if (game._slalom.active) {
    for (let i = 0; i < 5; i++) {
      const done = i < game._slalom.gates;
      pushBox(b, 200 + i * 20, 0, 198, 0.5, 3, 0.5, done ? [0.2, 0.8, 0.3] : [0.9, 0.2, 0.2], uv);
      pushBox(b, 200 + i * 20, 0, 202, 0.5, 3, 0.5, done ? [0.2, 0.8, 0.3] : [0.9, 0.2, 0.2], uv);
    }
  }
  return 0;
}
