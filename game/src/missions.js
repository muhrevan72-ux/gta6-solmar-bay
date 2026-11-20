// Solmar Bay — story missions (5 chapters) + side jobs.
//
// Chapter flow: startChapter sets mode 'chapter' and shows the intro
// card; Enter starts play. Completing a chapter pays the reward,
// +50 respect, and shows the MISSION PASSED card (reward + REP +
// unlock + completion %); Enter on that card starts the next
// chapter's intro. Chapter 5 is the finale: grab the cash at the
// harbour (wanted jumps to 4), lose the heat, reach the safehouse.
//
// Side jobs (markers on the map): taxi fares ($120), courier runs
// ($150), the driving trial ($180), turf war ($250), gang runs
// ($200). Each completion is +25 respect and counts toward the
// completion %.

import { CHAPTERS, SIDE_JOBS, TUNE } from './config.js';
import { showToast, showMenu, hideMenu, addCash, addRespect, showDialogue } from './state.js';
import { playJingle } from './audio.js';
import { startTurfJob } from './gangs.js';

export function createMissions() {
  return {
    stage: 0, // stage within the current chapter
    timer: 0, // chapter 2 countdown
    passengers: 0, // chapter 4
    target: null, // current objective point {x, z, label}
  };
}

export function startChapter(game, n) {
  const s = game.state;
  s.chapter = n;
  const ch = CHAPTERS[n - 1];
  const m = game.missions;
  m.stage = 0;
  m.timer = 0;
  m.passengers = 0;
  m.target = null;
  s.mode = 'chapter';
  s.hud.card = { title: 'CHAPTER ' + n + ' — ' + ch.title, text: ch.intro, t: 0 };
  showDialogue(s, ch.npc, ch.npcRole, ch.intro, 10);
  if (n === 3) {
    // Chapter 3 opens hot.
    s.wanted = 3;
  }
  if (n === 1) m.target = { x: 150, z: -120, label: 'Garage' };
  if (n === 2) m.target = { x: -150, z: -106, label: 'Police station' };
  if (n === 4) m.target = { x: 0, z: 50, label: 'Taxi stand' };
  if (n === 5) m.target = { x: 330, z: -100, label: 'Harbour' };
}

export function completeChapter(game) {
  const s = game.state;
  const ch = CHAPTERS[s.chapter - 1];
  addCash(s, ch.reward);
  addRespect(s, 50);
  s.stats.missionsDone++;
  playJingle(game.audio);
  const next = s.chapter + 1;
  const pct = completionPct(game);
  if (next > CHAPTERS.length) {
    showMenu(s, 'STORY COMPLETE', 'You finished all 5 chapters! Reward: +$' + ch.reward + ', +50 REP. Completion: ' + pct + '%.', 'Press Enter to keep playing in free roam.');
    s.mode = 'passed';
    game.missions.target = null;
    return;
  }
  showMenu(s, 'MISSION PASSED', ch.title + ' — +$' + ch.reward + ', +50 REP. Completion: ' + pct + '%.', 'Press Enter for Chapter ' + next + '.');
  s.mode = 'passed';
  game.missions.nextChapter = next;
}

function completionPct(game) {
  const s = game.state;
  const story = Math.min(5, s.chapter - 1) * 12;
  const side = Math.min(20, s.stats.sideJobsDone * 4);
  const garage = Math.min(8, s.ownedCars.length * 2);
  const rep = Math.min(12, Math.floor(s.respect / 100));
  return Math.min(100, story + side + garage + rep);
}

// Advance to the next chapter after the MISSION PASSED card.
export function advanceChapter(game) {
  const next = game.missions.nextChapter;
  if (next) {
    game.missions.nextChapter = null;
    hideMenu(game.state);
    startChapter(game, next);
  } else {
    hideMenu(game.state);
    game.state.mode = 'play';
  }
}

export function stepMissions(game, dt) {
  const s = game.state;
  if (s.mode !== 'play') return;
  const m = game.missions;
  const p = s.player;
  const ch = CHAPTERS[s.chapter - 1];
  if (!ch) return;
  switch (s.chapter) {
    case 1: {
      // Steal a car and drive to the garage.
      if (m.stage === 0 && p.inCar) {
        m.stage = 1;
        m.target = { x: 150, z: -120, label: 'Garage' };
        showToast(s, 'Nice wheels. Now drive to the garage.', 4);
      }
      if (m.stage === 1 && p.inCar && Math.hypot(p.x - 150, p.z + 120) < 12) {
        completeChapter(game);
      }
      break;
    }
    case 2: {
      // Deliver the package to the police station in 90 s.
      if (m.stage === 0) {
        m.stage = 1;
        m.timer = 90;
        showToast(s, 'Deliver the package to the police station — 90 seconds!', 5);
      }
      if (m.stage === 1) {
        m.timer -= dt;
        if (m.timer <= 0) {
          showToast(s, 'Too slow! The package job failed — try again.', 4);
          m.stage = 0;
          startChapter(game, 2);
          return;
        }
        if (Math.hypot(p.x + 150, p.z + 106) < 10) completeChapter(game);
      }
      break;
    }
    case 3: {
      // Lose the heat: survive until wanted hits 0.
      if (s.wanted === 0) completeChapter(game);
      break;
    }
    case 4: {
      // Pick up 3 passengers at the taxi stand (one every 3 s).
      m.passengerT = (m.passengerT || 0) - dt;
      if (m.passengerT <= 0 && Math.hypot(p.x - 0, p.z - 50) < 8 && p.inCar) {
        m.passengers++;
        m.passengerT = 3;
        showToast(s, 'Passenger ' + m.passengers + '/3 picked up!', 3);
        if (m.passengers >= 3) completeChapter(game);
      }
      break;
    }
    case 5: {
      // Grab the cash at the harbour, then lose the heat and reach
      // the safehouse.
      if (m.stage === 0 && Math.hypot(p.x - 330, p.z + 100) < 12) {
        m.stage = 1;
        s.wanted = Math.max(s.wanted, 4);
        addCash(s, 500);
        showToast(s, 'You grabbed $500! Now lose the heat and reach the safehouse.', 5);
        m.target = { x: -250, z: 190, label: 'Safehouse' };
      }
      if (m.stage === 1 && s.wanted === 0 && Math.hypot(p.x + 250, p.z - 190) < 12) {
        completeChapter(game);
      }
      break;
    }
  }
  // Side jobs: standing at a marker with E starts one.
  stepSideJobs(game, dt);
}

function stepSideJobs(game, dt) {
  const s = game.state;
  if (game.sideJob) {
    // Taxi fares and courier runs are handled by taxi.js / their own
    // timers; the turf and gang-run jobs are tracked in gangs.js.
    return;
  }
  // E at a side-job marker starts the job (handled by main.js's
  // interact dispatcher, which calls startSideJob).
}

export function startSideJob(game, kind) {
  const s = game.state;
  const job = SIDE_JOBS[kind];
  if (!job) return false;
  if (kind === 'taxi') {
    game.taxi.fare = { active: true, pickup: null, dropoff: null, stage: 0 };
    showToast(s, 'Taxi job: pick up a passenger at the taxi stand.', 5);
  } else if (kind === 'courier') {
    game.sideJob = { kind: 'courier', stage: 0, timer: 120 };
    showToast(s, 'Courier job: deliver to the harbour in 120 s. +$' + job.reward, 5);
  } else if (kind === 'trial') {
    game.sideJob = { kind: 'trial', stage: 0, checkpoints: 0 };
    showToast(s, 'Driving trial: hit 5 checkpoints. +$' + job.reward, 5);
  } else if (kind === 'turf') {
    // gangs.js owns the turf job.
    startTurfJob(game);
  } else if (kind === 'gangrun') {
    game.sideJob = { kind: 'gangrun', stage: 0 };
    showToast(s, 'Gang run: drive to the hideout, then the safehouse. +$' + job.reward, 5);
  }
  return true;
}

export function completeSideJob(game, kind) {
  const s = game.state;
  const job = SIDE_JOBS[kind];
  game.sideJob = null;
  if (kind === 'taxi' && game.taxi) game.taxi.fare = null;
  addCash(s, job.reward);
  addRespect(s, 25);
  s.stats.sideJobsDone++;
  showToast(s, job.name + ' done! +$' + job.reward + ', +25 REP', 5);
  playJingle(game.audio);
}
