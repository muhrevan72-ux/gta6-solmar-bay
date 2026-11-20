// Solmar Bay — story chapters + side jobs.
//
// Five chapters, each with stages and a mission marker on the
// minimap. Completing a chapter pays the reward, adds +50 respect,
// shows the MISSION PASSED card and advances completion. Side jobs
// (taxi, courier, time trial, turf, gang delivery) are repeatable
// for cash and +25 respect.

import { CHAPTERS, SIDE_JOBS, SPAWNS } from './config.js';
import { addCash, showToast, showDialogue, completionPercent } from './state.js';
import { dist } from './config.js';

// Chapter anchors (verified clear of colliders).
export const ANCHORS = {
  garage: { x: 150, z: -126 },
  harbour: { x: -240, z: 200 },
  hideout: { x: -120, z: 60 },
  safehouse: { x: -320, z: 40 },
  vault: { x: -260, z: 170 },
  airport: { x: 300, z: -260 },
  downtown: { x: 30, z: 30 },
};

export function startChapter(game, n) {
  const c = CHAPTERS[n - 1];
  if (!c) return;
  game.chapter = n;
  game.chapterStage = 0;
  game.missionTimer = 0;
  game.missionMarker = null;
  game.card = { title: c.title, text: c.intro };
  game.mode = 'card';
  if (n === 1) {
    game.missionMarker = { x: ANCHORS.garage.x, z: ANCHORS.garage.z, label: 'Garage' };
  } else if (n === 2) {
    game.missionMarker = { x: ANCHORS.harbour.x, z: ANCHORS.harbour.z, label: 'Harbour — pick up the package' };
    game.missionTimer = 240;
  } else if (n === 3) {
    game.missionMarker = { x: ANCHORS.downtown.x, z: ANCHORS.downtown.z, label: 'Lose the heat' };
  } else if (n === 4) {
    game.missionMarker = { x: ANCHORS.downtown.x, z: ANCHORS.downtown.z, label: 'Pick up passenger 1' };
  } else if (n === 5) {
    game.missionMarker = { x: ANCHORS.vault.x, z: ANCHORS.vault.z, label: 'Harbour vault' };
  }
}

export function completeChapter(game) {
  const c = CHAPTERS[game.chapter - 1];
  if (!c) return;
  addCash(game, c.reward, `— ${c.title}`);
  game.respect += 50;
  game.chapterDone += 1;
  game.completion = completionPercent(game);
  game.missionMarker = null;
  game.missionTimer = 0;
  game.card = {
    title: 'MISSION PASSED',
    text: `${c.title}\n+$${c.reward} · +50 respect\nCompletion ${game.completion}%`,
  };
  game.mode = 'passed';
  if (game.audio) game.audio.sfx('mission');
  const next = game.chapter + 1;
  if (next <= CHAPTERS.length) {
    game._nextChapter = next;
  } else {
    game._nextChapter = null;
    showDialogue(game, 'Rico', 'Boss', 'That was the big one, kid. Solmar Bay is yours now. Free roam — do what you want.');
  }
}

export function nextChapter(game) {
  if (game._nextChapter) {
    const n = game._nextChapter;
    game._nextChapter = null;
    startChapter(game, n);
  } else {
    game.mode = 'play';
    game.card = null;
  }
}

// Per-frame chapter logic. Returns true when the chapter advanced.
export function stepMissions(game, dt) {
  const p = game.player;
  const ch = game.chapter;
  if (ch > CHAPTERS.length) return false;
  // Chapter 2 timer.
  if (ch === 2 && game.chapterStage === 1) {
    game.missionTimer -= dt;
    if (game.missionTimer <= 0) {
      showToast(game, 'Too slow — the package moved. Try again.');
      startChapter(game, 2);
      return true;
    }
  }
  if (!game.missionMarker) return false;
  const m = game.missionMarker;
  const d = dist(p.x, p.z, m.x, m.z);
  if (d > 6) return false;
  if (ch === 1) {
    // Reach the garage IN a car.
    if (p.inCar) {
      completeChapter(game);
      return true;
    }
    return false;
  }
  if (ch === 2) {
    if (game.chapterStage === 0) {
      game.chapterStage = 1;
      game.missionMarker = { x: ANCHORS.hideout.x, z: ANCHORS.hideout.z, label: 'Hideout — deliver the package' };
      showToast(game, 'Package picked up — deliver it to the hideout!');
      return true;
    }
    completeChapter(game);
    return true;
  }
  if (ch === 3) {
    // Lose the heat: complete when wanted hits 0.
    return false; // handled below
  }
  if (ch === 4) {
    game.chapterStage += 1;
    if (game.chapterStage >= 3) {
      completeChapter(game);
      return true;
    }
    const spots = [
      { x: -180, z: 180, label: 'Pick up passenger 2' },
      { x: 150, z: 150, label: 'Pick up passenger 3' },
      { x: 0, z: -180, label: 'Drop off the last passenger' },
    ];
    game.missionMarker = spots[game.chapterStage - 1] || spots[0];
    showToast(game, `Passenger ${game.chapterStage + 1} picked up`);
    return true;
  }
  if (ch === 5) {
    if (game.chapterStage === 0) {
      game.chapterStage = 1;
      addCash(game, 500, '— vault cash (part 1)');
      game.missionMarker = { x: ANCHORS.safehouse.x, z: ANCHORS.safehouse.z, label: 'Safehouse — lose 4 stars first' };
      showToast(game, 'Vault hit! Now lose the heat and reach the safehouse.');
      return true;
    }
    if (game.wanted === 0) {
      completeChapter(game);
      return true;
    }
    showToast(game, 'Too hot — lose the wanted level first!');
    return false;
  }
  return false;
}

// Chapter 3 completes when the wanted level reaches 0.
export function stepChapter3(game) {
  if (game.chapter === 3 && game.wanted === 0 && game.chapterStage === 0) {
    game.chapterStage = 1;
    completeChapter(game);
    return true;
  }
  return false;
}

// Side jobs.
export function startSideJob(game, id) {
  const job = SIDE_JOBS.find((j) => j.id === id);
  if (!job) return false;
  const spots = {
    taxi: { x: 60, z: 120, label: 'Taxi fare — pick up the passenger' },
    courier: { x: -180, z: -60, label: 'Courier — pick up the parcel' },
    trial: { x: 0, z: 0, label: 'Time trial — reach the checkpoints' },
    turf: { x: -180, z: 180, label: 'Turf — clear the Sharks' },
    gangrun: { x: 0, z: -40, label: 'Gang delivery — pick up the goods' },
  };
  game.sideJob = { ...job, stage: 0, marker: spots[id] || spots.taxi };
  game.missionMarker = game.sideJob.marker;
  showToast(game, `${job.label}: ${job.desc}`);
  return true;
}

export function stepSideJob(game, dt) {
  if (!game.sideJob) return false;
  const p = game.player;
  const m = game.sideJob.marker;
  if (!m) return false;
  const d = dist(p.x, p.z, m.x, m.z);
  if (d > 6) return false;
  addCash(game, game.sideJob.reward, `— ${game.sideJob.label}`);
  game.respect += 25;
  game.stats.fares += game.sideJob.id === 'taxi' ? 1 : 0;
  showToast(game, `${game.sideJob.label} done! +$${game.sideJob.reward} · +25 respect`);
  game.sideJob = null;
  game.missionMarker = null;
  return true;
}

export { CHAPTERS, SIDE_JOBS };
