// Solmar Bay — training places.
//
// (a) Shooting range: targets to shoot, score points, cash
// reward, small permanent damage bonus. (b) Swimming: the
// player swims in the water (slower movement, no drowning), plus
// a swim challenge — swim to the buoy and back for cash.
// (c) Driving training: a slalom/time-trial course with
// checkpoints, cash on completion.

import { TUNE, SPAWNS, dist } from './config.js';
import { addCash, showToast } from './state.js';

export function spawnTraining(game) {
  game.range = {
    x: SPAWNS.shootingRange.x, z: SPAWNS.shootingRange.z,
    targets: [],
    active: false,
    score: 0,
    timeLeft: 0,
  };
  for (let i = 0; i < 5; i++) {
    game.range.targets.push({
      x: SPAWNS.shootingRange.x - 8 + i * 4,
      z: SPAWNS.shootingRange.z - 30,
      hit: false,
    });
  }
  game.swim = { active: false, stage: 0 };
  game.slalom = {
    checkpoints: [
      { x: 200, z: 200 }, { x: 220, z: 240 }, { x: 200, z: 280 },
      { x: 160, z: 280 }, { x: 160, z: 240 }, { x: 180, z: 200 },
    ],
    active: false,
    stage: 0,
    timeLeft: 0,
  };
}

// Start the shooting range (E near the range).
export function tryRange(game) {
  const p = game.player;
  if (dist(p.x, p.z, game.range.x, game.range.z) > 8) return false;
  game.range.active = true;
  game.range.score = 0;
  game.range.timeLeft = 30;
  for (const t of game.range.targets) t.hit = false;
  showToast(game, 'Shooting range: hit all 5 targets in 30 s!');
  return true;
}

// A shot hit a range target. Returns true when it was a target.
export function rangeHit(game, x, z) {
  if (!game.range.active) return false;
  for (const t of game.range.targets) {
    if (!t.hit && dist(x, z, t.x, t.z) < 3) {
      t.hit = true;
      game.range.score += 20;
      game.training.rangeScore = game.range.score;
      showToast(game, `Target hit! Score ${game.range.score}`);
      return true;
    }
  }
  return false;
}

export function stepTraining(game, dt) {
  // Range timer.
  if (game.range.active) {
    game.range.timeLeft -= dt;
    const allHit = game.range.targets.every((t) => t.hit);
    if (allHit || game.range.timeLeft <= 0) {
      game.range.active = false;
      const score = game.range.score;
      game.training.rangeBest = Math.max(game.training.rangeBest, score);
      if (allHit) {
        addCash(game, TUNE.rangeReward, 'range complete');
        game.respect += 10;
        showToast(game, `Range complete! Score ${score} — +$${TUNE.rangeReward}`);
      } else {
        showToast(game, `Range over — score ${score}`);
      }
    }
  }
  // Swim challenge: reach the buoy and come back.
  const p = game.player;
  if (game.swim.active) {
    if (game.swim.stage === 0 && dist(p.x, p.z, SPAWNS.swimBuoy.x, SPAWNS.swimBuoy.z) < 6) {
      game.swim.stage = 1;
      showToast(game, 'Buoy reached — swim back to the pier!');
    } else if (game.swim.stage === 1 && dist(p.x, p.z, SPAWNS.pier.x, SPAWNS.pier.z) < 8) {
      game.swim.active = false;
      addCash(game, TUNE.swimReward, 'swim challenge');
      game.respect += 10;
      showToast(game, `Swim challenge done! +$${TUNE.swimReward}`);
    }
  }
  // Slalom: drive through the checkpoints in order.
  if (game.slalom.active) {
    game.slalom.timeLeft -= dt;
    const cp = game.slalom.checkpoints[game.slalom.stage];
    if (cp && p.inCar && dist(p.x, p.z, cp.x, cp.z) < 6) {
      game.slalom.stage += 1;
      if (game.slalom.stage >= game.slalom.checkpoints.length) {
        game.slalom.active = false;
        addCash(game, TUNE.slalomReward, 'slalom complete');
        game.respect += 10;
        showToast(game, `Slalom complete! +$${TUNE.slalomReward}`);
      } else {
        showToast(game, `Checkpoint ${game.slalom.stage + 1}/${game.slalom.checkpoints.length}`);
      }
    }
    if (game.slalom.timeLeft <= 0) {
      game.slalom.active = false;
      showToast(game, 'Slalom failed — out of time');
    }
  }
}

// Start the swim challenge (E at the pier).
export function trySwim(game) {
  const p = game.player;
  if (dist(p.x, p.z, SPAWNS.pier.x, SPAWNS.pier.z) > 8) return false;
  game.swim.active = true;
  game.swim.stage = 0;
  showToast(game, 'Swim challenge: reach the buoy and come back!');
  return true;
}

// Start the slalom (E at the slalom start, in a car).
export function trySlalom(game) {
  const p = game.player;
  if (!p.inCar) return false;
  if (dist(p.x, p.z, SPAWNS.slalomStart.x, SPAWNS.slalomStart.z) > 10) return false;
  game.slalom.active = true;
  game.slalom.stage = 0;
  game.slalom.timeLeft = 90;
  showToast(game, 'Slalom: hit all 6 checkpoints in 90 s!');
  return true;
}

// Draw the range targets + slalom checkpoints.
export function trainingBoxes(game, out) {
  for (const t of game.range.targets) {
    out.push({ x: t.x, y: 1, z: t.z, w: 1.6, h: 1.6, d: 0.3, c: t.hit ? [0.3, 0.8, 0.3] : [1.2, 0.2, 0.2] });
    out.push({ x: t.x, y: 0, z: t.z, w: 0.3, h: 1, d: 0.3, c: [0.4, 0.35, 0.3] });
  }
  if (game.slalom.active) {
    const cp = game.slalom.checkpoints[game.slalom.stage];
    if (cp) {
      out.push({ x: cp.x, y: 0, z: cp.z, w: 3, h: 4, d: 3, c: [1.3, 1.1, 0.2] });
    }
  }
  // The swim buoy.
  out.push({ x: SPAWNS.swimBuoy.x, y: 0, z: SPAWNS.swimBuoy.z, w: 1.5, h: 1, d: 1.5, c: [1.3, 0.5, 0.1] });
  return out;
}
