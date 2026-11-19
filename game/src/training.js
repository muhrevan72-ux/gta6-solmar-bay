// Solmar Bay — training places: shooting range, swim challenge and
// driving course. Each pays cash and grants a small permanent bonus.

import { SIDE_REWARDS, dist, clamp } from './config.js';
import { setToast, addCash } from './state.js';

export function createTraining() {
  return {
    range: { active: false, score: 0, timer: 0, targets: [] },
    swim: { active: false, stage: 0, timer: 0 },
    course: { active: false, idx: 0, timer: 0, checkpoints: [] },
  };
}

function spawnRangeTargets(game) {
  const t = game.training.range;
  t.targets = [];
  for (let i = 0; i < 5; i++) {
    t.targets.push({
      x: 320 + 20 + Math.random() * 25,
      z: 240 - 20 + i * 10 + (Math.random() - 0.5) * 4,
      alive: true,
    });
  }
}

export function startRange(game) {
  const t = game.training.range;
  t.active = true;
  t.score = 0;
  t.timer = 60;
  spawnRangeTargets(game);
  setToast(game.state, 'Shooting range: hit the targets! 60s.', 3);
}

// Called from the main loop when the player clicks while a range
// session is active: hitscan against the range targets.
export function checkRangeHit(game) {
  const t = game.training.range;
  if (!t.active) return false;
  const cam = game.camera;
  const eye = cam.eye;
  const tx = cam.target[0], tz = cam.target[2];
  let dx = tx - eye[0], dz = tz - eye[2];
  const dl = Math.hypot(dx, dz) || 1;
  dx /= dl; dz /= dl;
  for (const tgt of t.targets) {
    if (!tgt.alive) continue;
    const vx = tgt.x - eye[0], vz = tgt.z - eye[2];
    const along = vx * dx + vz * dz;
    // along is measured from the camera eye, which sits ~13 units
    // behind the player: the farthest target is ~50 from the player,
    // so the eye-to-target distance can reach ~63 — 60 was too tight
    // and made far targets unhittable even when perfectly aimed
    if (along < 1 || along > 80) continue;
    const perp = Math.abs(vx * dz - vz * dx);
    if (perp > 2.2) continue;
    tgt.alive = false;
    t.score += 10;
    if (game.audio) game.audio.blip(1200, 0.06);
    // respawn a fresh target elsewhere
    tgt.x = 320 + 20 + Math.random() * 25;
    tgt.z = 240 - 20 + Math.random() * 40;
    tgt.alive = true;
    return true;
  }
  return false;
}

export function startSwim(game) {
  const t = game.training.swim;
  t.active = true;
  t.stage = 0;
  t.timer = 60;
  setToast(game.state, 'Swim challenge: reach the buoy and swim back to the beach! 60s.', 4);
}

export function startCourse(game) {
  const t = game.training.course;
  t.active = true;
  t.idx = 0;
  t.timer = 60;
  t.checkpoints = [[120, 250], [180, 250], [240, 270], [280, 300], [220, 320], [150, 300]];
  setToast(game.state, 'Driving course: hit all 6 cones in order — 60s!', 3);
}

export function updateTraining(dt, game) {
  const tr = game.training;
  const state = game.state;
  const p = game.player;
  // shooting range
  if (tr.range.active) {
    tr.range.timer -= dt;
    if (tr.range.timer <= 0 || tr.range.score >= 50) {
      const score = tr.range.score;
      tr.range.active = false;
      if (score > 0) {
        addCash(state, SIDE_REWARDS.range);
        state.accuracyBonus = Math.min(0.3, (state.accuracyBonus || 0) + 0.05);
        setToast(state, 'Range done! Score ' + score + ' — +$' + SIDE_REWARDS.range + ', accuracy up!', 4);
        if (game.audio) game.audio.jingle();
      } else {
        setToast(state, 'Range over — no hits. Try again!', 3);
      }
    }
  }
  // swim challenge
  if (tr.swim.active) {
    tr.swim.timer -= dt;
    const buoy = game.city.spawns.buoy;
    if (tr.swim.stage === 0 && dist(p.x, p.z, buoy.x, buoy.z) < 8) {
      tr.swim.stage = 1;
      setToast(state, 'Buoy reached! Swim back to the beach!', 3);
    } else if (tr.swim.stage === 1 && p.x > -340) {
      tr.swim.active = false;
      addCash(state, SIDE_REWARDS.swim);
      setToast(state, 'Swim challenge done! +$' + SIDE_REWARDS.swim, 3);
      if (game.audio) game.audio.jingle();
    }
    if (tr.swim.timer <= 0) {
      tr.swim.active = false;
      setToast(state, 'Swim challenge failed — too slow.', 3);
    }
  }
  // driving course
  if (tr.course.active) {
    tr.course.timer -= dt;
    const cp = tr.course.checkpoints[tr.course.idx];
    if (cp && dist(p.x, p.z, cp[0], cp[1]) < 7 && p.inVehicle) {
      tr.course.idx += 1;
      if (tr.course.idx >= tr.course.checkpoints.length) {
        tr.course.active = false;
        addCash(state, SIDE_REWARDS.driveCourse);
        state.handlingBonus = Math.min(0.25, (state.handlingBonus || 0) + 0.05);
        setToast(state, 'Driving course done! +$' + SIDE_REWARDS.driveCourse + ', handling up!', 4);
        if (game.audio) game.audio.jingle();
      }
    }
    if (tr.course.timer <= 0) {
      tr.course.active = false;
      setToast(state, 'Driving course failed — too slow.', 3);
    }
  }
}

export function drawTraining(renderer, game) {
  const t = game.time;
  // range targets
  for (const tgt of game.training.range.targets) {
    if (!tgt.alive) continue;
    renderer.box(tgt.x, 1.2, tgt.z, 0.4, 2.4, 2.4, [1, 0.3, 0.2], 1, 0, 0, 0);
    renderer.box(tgt.x, 1.2, tgt.z, 0.5, 1.2, 1.2, [1, 1, 1], 1, 0, 0, 0);
  }
  // range marker + course cones
  if (game.training.course.active) {
    const cp = game.training.course.checkpoints[game.training.course.idx];
    if (cp) renderer.box(cp[0], 1, cp[1], 1.2, 2, 1.2, [1, 0.6, 0.1], 0.9, 0, t * 3, 0);
    for (const c of game.training.course.checkpoints) {
      renderer.box(c[0], 0.6, c[1], 1, 1.2, 1, [1, 0.6, 0.1], 0.8);
    }
  }
  // swim buoy
  const buoy = game.city.spawns.buoy;
  renderer.box(buoy.x, 0.8, buoy.z, 1.6, 1.2, 1.6, [1, 0.4, 0.2], 1, 0, t * 1.5, 0);
}

export { clamp };
