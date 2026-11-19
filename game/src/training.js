// Solmar Bay — training places: (a) shooting range with targets,
// score and a cash reward plus a small permanent accuracy bonus;
// (b) swimming — the player swims in the water, plus a swim
// challenge to a buoy and back for cash; (c) a driving course with
// slalom checkpoints for cash.

import { dist2, clamp } from './config.js';
import { addCash, showToast } from './state.js';

export function createTraining() {
  return {
    targets: [], // { x, z, alive, hp }
    rangeScore: 0,
    rangeActive: false,
    accuracyBonus: 0, // +damage per completed range session
    swimChallenge: { active: false, stage: 0, t: 0 },
    course: { active: false, step: 0, t: 0 },
    courseCheckpoints: [
      { x: -50, z: -350 },
      { x: 50, z: -350 },
      { x: 100, z: -300 },
      { x: 0, z: -300 },
    ],
  };
}

export function startRange(game) {
  const tr = game.training;
  if (tr.rangeActive) return;
  tr.rangeActive = true;
  tr.rangeScore = 0;
  tr.targets = [];
  // 6 targets downrange, three rows
  for (let i = 0; i < 6; i++) {
    tr.targets.push({
      x: 240 + (i % 3) * 14,
      z: 240 + Math.floor(i / 3) * 12,
      alive: true,
      hp: 1,
    });
  }
  showToast(game.state, 'Shooting range! Hit all 6 targets.', 3);
}

// A hitscan shot hit a range target.
export function hitTarget(game, target, damage) {
  const tr = game.training;
  if (!target.alive) return;
  target.alive = false;
  tr.rangeScore += 1;
  if (game.audio) game.audio.play('pickup');
  if (tr.rangeScore >= 6) {
    tr.rangeActive = false;
    tr.accuracyBonus = Math.min(10, tr.accuracyBonus + 2);
    addCash(game.state, 100);
    showToast(game.state, 'Range cleared! +$100, accuracy up.', 3);
  }
}

export function startSwimChallenge(game) {
  const tr = game.training;
  if (tr.swimChallenge.active) return;
  tr.swimChallenge = { active: true, stage: 0, t: 0 };
  showToast(game.state, 'Swim challenge! Reach the buoy at (-380, 0) and back.', 3);
}

export function startCourse(game) {
  const tr = game.training;
  if (tr.course.active) return;
  tr.course = { active: true, step: 0, t: 0 };
  showToast(game.state, 'Driving course! Hit all 4 checkpoints.', 3);
}

export function updateTraining(game, dt) {
  const tr = game.training;
  const p = game.player;
  // swim challenge: buoy out and back
  if (tr.swimChallenge.active) {
    tr.swimChallenge.t += dt;
    if (tr.swimChallenge.stage === 0 && dist2(p.x, p.z, -380, 0) < 100) {
      tr.swimChallenge.stage = 1;
      showToast(game.state, 'Buoy reached! Swim back to the beach.', 2);
    } else if (tr.swimChallenge.stage === 1 && dist2(p.x, p.z, -320, 0) < 100) {
      tr.swimChallenge.active = false;
      const bonus = Math.max(30, 150 - Math.floor(tr.swimChallenge.t));
      addCash(game.state, bonus);
      showToast(game.state, 'Swim challenge done! +$' + bonus, 3);
    }
  }
  // driving course: checkpoints in sequence, must be in a vehicle
  if (tr.course.active) {
    tr.course.t += dt;
    const cp = tr.courseCheckpoints[Math.min(tr.course.step, 3)];
    if (p.inVehicle && dist2(p.x, p.z, cp.x, cp.z) < 100) {
      tr.course.step += 1;
      showToast(game.state, 'Checkpoint ' + tr.course.step + '/4', 2);
      if (tr.course.step >= 4) {
        tr.course.active = false;
        addCash(game.state, 200);
        showToast(game.state, 'Course complete! +$200', 3);
        if (game.audio) game.audio.play('win');
      }
    }
  }
}

export function targetBoxes(t) {
  if (!t.alive) return [];
  return [
    { x: t.x, y: 1.0, z: t.z, sx: 2.2, sy: 2.0, sz: 0.3, c: [0.95, 0.95, 0.9] },
    { x: t.x, y: 1.0, z: t.z + 0.2, sx: 1.4, sy: 1.4, sz: 0.1, c: [0.9, 0.2, 0.2] },
    { x: t.x, y: 1.0, z: t.z + 0.26, sx: 0.7, sy: 0.7, sz: 0.1, c: [0.95, 0.85, 0.2] },
  ];
}

export function rangeBoxes() {
  return [
    { x: 260, y: 1.5, z: 235, sx: 40, sy: 3, sz: 2, c: [0.6, 0.55, 0.5] },
  ];
}
