// Solmar Bay — story chapters (5, sequential) + repeatable side jobs
// (taxi fares, courier, time trials, gang jobs). Markers are tall
// glowing beacons so the player always knows where to go.

import { CHAPTERS, SIDE_REWARDS, dist } from './config.js';
import { setToast, addCash, MODES } from './state.js';

export function createMissions() {
  return {
    introT: 0,
    timer: 0, // chapter timer (M2 delivery)
    stage: 0, // per-chapter stage
    passengers: [], // M4: {x, z, destX, destZ, picked}
    sideJobs: [
      { type: 'taxi', x: 0, z: 160, color: [1, 0.85, 0.1], label: 'Taxi fare', active: false, stage: 0, tx: 0, tz: 0, timer: 0, reward: 0, coolT: 0 },
      { type: 'courier', x: -100, z: -100, color: [0.4, 0.8, 1], label: 'Courier run', active: false, stage: 0, tx: 0, tz: 0, timer: 0, reward: 0, coolT: 0 },
      { type: 'trial', x: 200, z: -200, color: [1, 0.5, 0.2], label: 'Time trial', active: false, stage: 0, tx: 0, tz: 0, timer: 0, reward: 0, coolT: 0 },
      { type: 'turf', x: -44, z: 44, color: [1, 0.8, 0.15], label: 'Turf clear-out', active: false, stage: 0, tx: 0, tz: 0, timer: 0, reward: 0, coolT: 0 },
      { type: 'gangrun', x: 290, z: 330, color: [0.15, 0.75, 0.8], label: 'Gang delivery', active: false, stage: 0, tx: 0, tz: 0, timer: 0, reward: 0, coolT: 0 },
    ],
    checkpoints: [], // time-trial checkpoints
    trialIdx: 0,
  };
}

export function startChapter(game, i) {
  const state = game.state;
  const m = game.missions;
  const ch = CHAPTERS[i];
  state.chapter = i;
  state.chapterActive = true;
  state.chapterTitle = 'Chapter ' + (i + 1) + ' — ' + ch.title;
  state.chapterText = ch.text;
  state.mode = MODES.chapter;
  m.introT = 0;
  m.stage = 0;
  m.timer = 0;
  m.passengers = [];
  if (i === 0) state.objective = 'Steal a car and drive to the garage.';
  if (i === 1) state.objective = 'Pick up the package downtown.';
  if (i === 2) {
    state.objective = 'Lose the cops and reach the hideout.';
    if (game.police) { state.wanted = 3; }
  }
  if (i === 3) {
    state.objective = 'Pick up 3 passengers across the city.';
    m.passengers = [
      { x: -40, z: 140, destX: 0, destZ: 160, picked: false, done: false },
      { x: 140, z: -40, destX: 0, destZ: 160, picked: false, done: false },
      { x: 0, z: -160, destX: 0, destZ: 160, picked: false, done: false },
    ];
  }
  if (i === 4) state.objective = 'Grab the cash from the dock office.';
}

function completeChapter(game) {
  const state = game.state;
  const ch = CHAPTERS[state.chapter];
  addCash(state, ch.reward);
  state.stats.missionsDone += 1;
  setToast(state, ch.title + ' complete! +$' + ch.reward, 4);
  if (game.audio) game.audio.jingle();
  state.chapterActive = false;
  if (state.chapter >= 4) {
    state.objective = 'Story complete — Solmar Bay is yours. Free roam!';
    state.mode = MODES.complete;
    return;
  }
  startChapter(game, state.chapter + 1);
}

function chapterTarget(game) {
  const s = game.city.spawns;
  const state = game.state;
  const m = game.missions;
  switch (state.chapter) {
    case 0: return { x: s.garage.x, z: s.garage.z };
    case 1: return m.stage === 0 ? { x: s.packagePickup.x, z: s.packagePickup.z } : { x: s.harbourOffice.x, z: s.harbourOffice.z };
    case 2: return { x: s.hideout.x, z: s.hideout.z };
    case 3: {
      const next = m.passengers.find((p) => !p.done);
      if (!next) return null;
      return next.picked ? { x: next.destX, z: next.destZ } : { x: next.x, z: next.z };
    }
    case 4: return m.stage === 0 ? { x: s.harbourOffice.x, z: s.harbourOffice.z } : { x: s.safehouse.x, z: s.safehouse.z };
    default: return null;
  }
}

export function updateMissions(dt, game) {
  const state = game.state;
  const m = game.missions;
  const p = game.player;
  if (state.mode === MODES.chapter) {
    m.introT += dt;
    return;
  }
  if (state.mode !== MODES.playing) return;

  // ---- story chapters ----
  if (state.chapterActive) {
    const t = chapterTarget(game);
    if (t) {
      const near = dist(p.x, p.z, t.x, t.z);
      if (state.chapter === 0) {
        if (p.inVehicle && near < 12) completeChapter(game);
      } else if (state.chapter === 1) {
        if (m.stage === 0) {
          if (near < 6) { m.stage = 1; m.timer = 120; state.objective = 'Deliver the package to the harbour office — 120s!'; }
        } else {
          m.timer -= dt;
          state.objective = 'Deliver the package to the harbour office — ' + Math.max(0, Math.ceil(m.timer)) + 's';
          if (m.timer <= 0) {
            setToast(state, 'Delivery failed — the package is late.', 3);
            startChapter(game, 1); // retry the chapter
          } else if (near < 8) completeChapter(game);
        }
      } else if (state.chapter === 2) {
        if (state.wanted === 0 && near < 12) completeChapter(game);
      } else if (state.chapter === 3) {
        const next = m.passengers.find((x) => !x.done);
        if (next) {
          if (!next.picked && near < 6 && p.inVehicle) {
            next.picked = true;
            state.objective = 'Drive the passenger to the taxi stand.';
            setToast(state, 'Passenger aboard — drive to the taxi stand.', 3);
          } else if (next.picked && near < 8) {
            next.done = true;
            addCash(state, 100);
            setToast(state, 'Fare +$100', 2);
            const left = m.passengers.filter((x) => !x.done).length;
            state.objective = left > 0 ? 'Pick up ' + left + ' more passenger' + (left > 1 ? 's' : '') + '.' : '';
            if (left === 0) completeChapter(game);
          }
        }
      } else if (state.chapter === 4) {
        if (m.stage === 0) {
          if (near < 6) {
            m.stage = 1;
            state.wanted = 4;
            if (game.police) game.police.decayT = 0;
            state.objective = 'Cash grabbed! Lose the heat and reach the safehouse.';
            setToast(state, 'Cash grabbed! Lose the heat!', 3);
          }
        } else if (state.wanted <= 2 && near < 10) {
          completeChapter(game);
        }
      }
    }
  }

  // ---- side jobs ----
  for (const job of m.sideJobs) {
    if (job.active) {
      updateSideJob(dt, game, job);
      continue;
    }
    // restart cooldown: finishing a job on its own marker must not
    // instantly start the same job again (the player is standing on it)
    if (job.coolT > 0) job.coolT -= dt;
    if (job.coolT <= 0 && dist(p.x, p.z, job.x, job.z) < 6) startSideJob(game, job);
  }
}

function startSideJob(game, job) {
  const state = game.state;
  const m = game.missions;
  job.active = true;
  job.stage = 0;
  if (job.type === 'taxi') {
    // pick a passenger spot, then a destination
    const spots = [[-140, 40], [140, -40], [-40, -140], [100, 100], [-300, 100]];
    const s = spots[Math.floor(Math.random() * spots.length)];
    job.tx = s[0]; job.tz = s[1];
    job.reward = SIDE_REWARDS.taxiFare;
    state.objective = 'Taxi: pick up the passenger.';
    setToast(state, 'Taxi fare: pick up the passenger.', 3);
  } else if (job.type === 'courier') {
    job.tx = 290; job.tz = 330;
    job.timer = 90;
    job.reward = SIDE_REWARDS.courier;
    state.objective = 'Courier: deliver to the harbour — 90s!';
  } else if (job.type === 'trial') {
    m.checkpoints = [[200, -100], [100, -200], [-100, -200], [-200, 0], [0, 100]];
    m.trialIdx = 0;
    job.timer = 75;
    job.reward = SIDE_REWARDS.timeTrial;
    state.objective = 'Time trial: hit all 5 checkpoints — 75s!';
  } else if (job.type === 'turf') {
    if (game.gangs) game.gangs.spawnHostile(game, 'shark', -44, 44, 4);
    job.reward = SIDE_REWARDS.turf;
    state.objective = 'Turf clear-out: take out the 4 Sharks.';
  } else if (job.type === 'gangrun') {
    job.tx = -220; job.tz = 330;
    job.timer = 75;
    job.reward = SIDE_REWARDS.gangRun;
    state.objective = 'Gang delivery: reach the safehouse — 75s!';
  }
}

function updateSideJob(dt, game, job) {
  const state = game.state;
  const m = game.missions;
  const p = game.player;
  const finish = (ok) => {
    job.active = false;
    job.coolT = 5; // don't restart on the same marker for 5s
    if (ok) {
      addCash(state, job.reward);
      state.stats.sideDone += 1;
      setToast(state, job.label + ' done! +$' + job.reward, 3);
      if (game.audio) game.audio.jingle();
    } else {
      setToast(state, job.label + ' failed.', 3);
    }
    if (state.chapterActive) state.objective = currentChapterObjective(game);
    else state.objective = 'Free roam — find a side-job marker.';
  };
  if (job.type === 'taxi') {
    if (job.stage === 0) {
      if (dist(p.x, p.z, job.tx, job.tz) < 6 && p.inVehicle) {
        job.stage = 1;
        job.tx = 0; job.tz = 160;
        state.objective = 'Taxi: drive the passenger to the taxi stand.';
      }
    } else if (dist(p.x, p.z, job.tx, job.tz) < 8) {
      finish(true);
    }
  } else if (job.type === 'courier') {
    job.timer -= dt;
    state.objective = 'Courier: deliver to the harbour — ' + Math.max(0, Math.ceil(job.timer)) + 's';
    if (job.timer <= 0) finish(false);
    else if (dist(p.x, p.z, job.tx, job.tz) < 8) finish(true);
  } else if (job.type === 'trial') {
    job.timer -= dt;
    const cp = m.checkpoints[m.trialIdx];
    if (cp && dist(p.x, p.z, cp[0], cp[1]) < 8) {
      m.trialIdx += 1;
      if (m.trialIdx >= m.checkpoints.length) { finish(true); return; }
      state.objective = 'Time trial: checkpoint ' + (m.trialIdx + 1) + ' of 5 — ' + Math.max(0, Math.ceil(job.timer)) + 's';
    } else {
      state.objective = 'Time trial: checkpoint ' + (m.trialIdx + 1) + ' of 5 — ' + Math.max(0, Math.ceil(job.timer)) + 's';
    }
    if (job.timer <= 0) finish(false);
  } else if (job.type === 'turf') {
    const left = game.gangs ? game.gangs.countHostile(game, 'shark') : 0;
    state.objective = 'Turf clear-out: ' + left + ' Sharks left.';
    if (left <= 0) finish(true);
  } else if (job.type === 'gangrun') {
    job.timer -= dt;
    state.objective = 'Gang delivery: reach the safehouse — ' + Math.max(0, Math.ceil(job.timer)) + 's';
    if (job.timer <= 0) finish(false);
    else if (dist(p.x, p.z, job.tx, job.tz) < 8) finish(true);
  }
}

function currentChapterObjective(game) {
  const state = game.state;
  if (state.chapter === 0) return 'Steal a car and drive to the garage.';
  if (state.chapter === 1) return game.missions.stage === 0 ? 'Pick up the package downtown.' : 'Deliver the package to the harbour office.';
  if (state.chapter === 2) return 'Lose the cops and reach the hideout.';
  if (state.chapter === 3) return 'Pick up passengers across the city.';
  if (state.chapter === 4) return game.missions.stage === 0 ? 'Grab the cash from the dock office.' : 'Lose the heat and reach the safehouse.';
  return 'Free roam.';
}

export function drawMissions(renderer, game) {
  const t = game.time;
  const pulse = 0.6 + Math.sin(t * 4) * 0.25;
  // story target beacon
  if (game.state.chapterActive) {
    const tgt = chapterTarget(game);
    if (tgt) {
      renderer.box(tgt.x, 6, tgt.z, 2.5, 12, 2.5, [1, 0.85, 0.2], pulse);
      renderer.box(tgt.x, 0.5, tgt.z, 6, 1, 6, [1, 0.85, 0.2], 0.8);
    }
  }
  // side-job markers
  for (const job of game.missions.sideJobs) {
    if (job.active) continue;
    const b = Math.sin(t * 3 + job.x) * 0.3;
    renderer.box(job.x, 2 + b, job.z, 1.6, 4, 1.6, job.color, 0.85);
  }
  // active side-job target
  for (const job of game.missions.sideJobs) {
    if (!job.active) continue;
    let tgt = null;
    if (job.type === 'trial') tgt = game.missions.checkpoints[game.missions.trialIdx];
    else if (job.tx !== undefined && job.tz !== undefined && job.type !== 'turf') tgt = [job.tx, job.tz];
    if (tgt) renderer.box(tgt[0], 6, tgt[1], 2.5, 12, 2.5, job.color, pulse);
  }
  // M4 passengers
  if (game.state.chapter === 3 && game.state.chapterActive) {
    for (const ps of game.missions.passengers) {
      if (ps.done || ps.picked) continue;
      renderer.box(ps.x, 1.2, ps.z, 0.9, 2.4, 0.9, [1, 0.9, 0.2], 0.9);
    }
  }
}
