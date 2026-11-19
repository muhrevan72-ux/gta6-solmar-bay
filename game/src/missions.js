// Solmar Bay — story chapters (5, sequential) + repeatable side jobs.
//
// Chapter flow: each chapter has steps; completing a chapter pays its
// reward, adds +50 respect and shows the MISSION PASSED card, then
// the next chapter's intro card waits behind it (Enter dismisses the
// card, then the intro). Side jobs (taxi, courier, time trial, turf
// clear-out, gang delivery) are available from markers after
// chapter 1. ALL markers are street points — never building centres,
// which sit inside solid colliders and can never be reached.

import { CHAPTERS, SIDE_JOBS, RESPECT, clamp, dist2 } from './config.js';
import { addCash, addRespect, showToast, showMenu } from './state.js';
import { notifyPhone } from './phone.js';
import { playJingle } from './audio.js';

// Mission/side-job spots: street points (never building centres).
export const SPOTS = {
  garage: { x: 150, z: -120 },
  // (300, -100) sits inside the vault's footprint; (290, -100) is the
  // street point just west of the vault's west face.
  harbour: { x: 290, z: -100 },
  hideout: { x: 250, z: -220 },
  safehouse: { x: -250, z: 190 },
  fireStation: { x: 150, z: 112 },
  taxiStand: { x: 0, z: 50 },
};

// Side-job markers are street points (never building centres).
// Exported: main.js's E dispatcher reads this same list.
export const SIDE_MARKERS = {
  taxi: { x: 0, z: 50 },
  courier: { x: -150, z: -106 },
  trial: { x: 100, z: -350 },
  turf: { x: -100, z: -100 },
  // (100, 100) sits on a downtown tower footprint; (100, 150) is on
  // the x = 100 road, clear of every collider.
  gangrun: { x: 100, z: 150 },
};

export function createMissions() {
  return {
    chapter: 1,
    step: 0, // step within the current chapter
    marker: null, // {x, z, label}
    active: null, // active side job {id, label, reward, step, ...}
    coolT: 0,
    timer: 0, // chapter 2 delivery timer
    passengers: 0, // chapter 4 count
    hasPackage: false,
    hasCash: false,
    passedCard: null, // {title, body} waiting for Enter
  };
}

export function startChapter(game, n) {
  const m = game.missions;
  if (n < 1 || n > 5) return;
  const ch = CHAPTERS[n - 1];
  m.chapter = n;
  m.step = 0;
  m.timer = 0;
  m.passengers = 0;
  m.hasPackage = false;
  m.hasCash = false;
  game.state.chapter = n;
  game.state.mode = 'chapter';
  game.state.chapterIntroShown = true;
  // Chapter 3 starts with the heat already on you: a 3-star wanted
  // level to escape. Without this the chapter completes the moment
  // it starts (wanted is already 0) — the escape never happens.
  if (n === 3) game.state.wanted = 3;
  m.marker = chapterMarker(game, n);
  showToast(game.state, ch.title + ' — ' + ch.objective, 5);
  notifyPhone(game, 'Rico', ch.title + ' — ' + ch.objective);
  // The intro card: shown after New Game AND after each MISSION
  // PASSED card. startGame must NOT hide it right after showing it
  // (that was the round-4 play-test bug).
  game.state.hud.card = { title: ch.title, text: ch.intro + ' Objective: ' + ch.objective + ' — Reward: $' + ch.reward };
}

function chapterMarker(game, n) {
  switch (n) {
    case 1: return { x: SPOTS.garage.x, z: SPOTS.garage.z, label: 'Garage' };
    case 2: return { x: SPOTS.harbour.x, z: SPOTS.harbour.z, label: 'Harbour docks' };
    case 3: return { x: SPOTS.garage.x, z: SPOTS.garage.z, label: 'Lose the heat' };
    case 4: return { x: SPOTS.taxiStand.x, z: SPOTS.taxiStand.z, label: 'Pick up passenger' };
    case 5: return { x: SPOTS.harbour.x, z: SPOTS.harbour.z, label: 'Harbour vault' };
    default: return null;
  }
}

export function completeChapter(game) {
  const m = game.missions;
  const ch = CHAPTERS[m.chapter - 1];
  addCash(game.state, ch.reward);
  addRespect(game.state, 50);
  game.state.stats.missionsDone++;
  if (game.audio) playJingle(game.audio);
  const storyDone = m.chapter >= 5;
  const next = m.chapter + 1;
  // The MISSION PASSED card shows first; the next chapter's intro
  // card waits behind it (Enter dismisses one, then the other).
  const title = storyDone ? 'STORY COMPLETE' : 'MISSION PASSED';
  const body = ch.title + '<br>+$' + ch.reward + ' · +50 REP' +
    (storyDone ? '<br>You own Solmar Bay now.' : '<br>Next: ' + CHAPTERS[next - 1].title);
  m.passedCard = { title, body };
  m.chapter = storyDone ? 6 : next;
  game.state.chapter = m.chapter;
  game.state.mode = 'passed';
  showMenu(game.state, title, body, 'Press Enter to continue.');
  notifyPhone(game, 'Rico', title + '! +$' + ch.reward + ' +50 REP. Nice work, kid.');
}

// Dismiss the MISSION PASSED card (Enter): starts the next chapter.
export function dismissPassedCard(game) {
  const m = game.missions;
  if (!m.passedCard) return false;
  m.passedCard = null;
  game.state.mode = 'play';
  if (m.chapter <= 5) startChapter(game, m.chapter);
  return true;
}

// Completion %: story 60 (12 per chapter) + side jobs 20 (3 each,
// capped) + garage 8 (2 per owned car) + respect 12 (1 per 100 REP).
export function completionPct(game) {
  const s = game.state;
  const story = Math.min(5, s.chapter - 1) * 12 + (s.chapter > 5 ? 0 : 0);
  const side = Math.min(20, s.stats.sideJobsDone * 4);
  const garage = Math.min(8, s.ownedCars.length * 2);
  const rep = Math.min(12, Math.floor(s.respect / 100));
  return Math.min(100, story + side + garage + rep);
}

// Per-frame chapter logic. Called from stepGame.
export function stepMissions(game, dt) {
  const m = game.missions;
  const s = game.state;
  if (s.mode !== 'play') return;
  if (m.chapter > 5) return;
  const p = s.player;
  const ch = m.chapter;
  if (ch === 1) {
    // Steal a car and drive to the garage.
    if (p.inCar && dist2(p.x, p.z, SPOTS.garage.x, SPOTS.garage.z) < 100) {
      completeChapter(game);
    }
  } else if (ch === 2) {
    if (m.step === 0) {
      if (dist2(p.x, p.z, SPOTS.harbour.x, SPOTS.harbour.z) < 144) {
        m.hasPackage = true;
        m.step = 1;
        m.timer = 90;
        m.marker = { x: SPOTS.hideout.x, z: SPOTS.hideout.z, label: 'Hideout' };
        showToast(s, 'Package picked up! Deliver it in 90 seconds.', 3);
      }
    } else if (m.step === 1) {
      m.timer -= dt;
      if (m.timer <= 0) {
        // Timer ran out: back to the docks.
        m.step = 0;
        m.hasPackage = false;
        m.marker = chapterMarker(game, 2);
        showToast(s, 'Too slow — the package is back at the docks.', 3);
      } else if (dist2(p.x, p.z, SPOTS.hideout.x, SPOTS.hideout.z) < 100) {
        completeChapter(game);
      }
    }
  } else if (ch === 3) {
    // Escape the 3-star wanted level.
    if (s.wanted === 0 && m.step === 0) {
      completeChapter(game);
    }
  } else if (ch === 4) {
    // Pick up 3 passengers across the city.
    if (m.step < 3) {
      if (dist2(p.x, p.z, SPOTS.taxiStand.x, SPOTS.taxiStand.z) < 64) {
        m.passengers++;
        m.step = m.passengers;
        showToast(s, 'Passenger ' + m.passengers + '/3 picked up. Drop them at the marker.', 3);
        m.marker = { x: SPOTS.harbour.x, z: SPOTS.harbour.z, label: 'Drop off passenger ' + m.passengers + '/3' };
        if (m.passengers >= 3) completeChapter(game);
      }
    }
  } else if (ch === 5) {
    if (m.step === 0) {
      if (dist2(p.x, p.z, SPOTS.harbour.x, SPOTS.harbour.z) < 144) {
        m.hasCash = true;
        m.step = 1;
        s.wanted = Math.max(s.wanted, 4);
        m.marker = { x: SPOTS.safehouse.x, z: SPOTS.safehouse.z, label: 'Safehouse' };
        showToast(s, 'Cash grabbed! Lose the heat and reach the safehouse.', 4);
      }
    } else if (m.step === 1) {
      if (s.wanted === 0 && dist2(p.x, p.z, SPOTS.safehouse.x, SPOTS.safehouse.z) < 100) {
        completeChapter(game);
      }
    }
  }
}

export function startSideJob(game, jobId) {
  const m = game.missions;
  if (m.active || m.coolT > 0) return false;
  const def = SIDE_JOBS.find((j) => j.id === jobId);
  if (!def) return false;
  const mk = SIDE_MARKERS[jobId];
  m.active = {
    id: jobId,
    label: def.label,
    reward: def.reward,
    step: 0,
    x: mk.x,
    z: mk.z,
  };
  game.state.mode = 'play';
  showToast(game.state, def.label + ' started — ' + def.desc, 3);
  return true;
}

export function completeSideJob(game) {
  const m = game.missions;
  if (!m.active) return false;
  const job = m.active;
  addCash(game.state, job.reward);
  addRespect(game.state, 25);
  game.state.stats.sideJobsDone++;
  showToast(game.state, job.label + ' done! +$' + job.reward, 3);
  notifyPhone(game, 'Rico', job.label + ' done! +$' + job.reward);
  m.active = null;
  m.coolT = 5;
  return true;
}

export function stepSideJob(game, dt) {
  const m = game.missions;
  if (m.coolT > 0) m.coolT -= dt;
  if (!m.active) return;
  const p = game.state.player;
  if (dist2(p.x, p.z, m.active.x, m.active.z) < 100) {
    completeSideJob(game);
  }
}

// HUD data: the mission panel (chapter + stage + objective + NEXT
// + respect + location + completion %).
export function missionPanelData(game) {
  const s = game.state;
  const m = game.missions;
  const ch = m.chapter <= 5 ? CHAPTERS[m.chapter - 1] : null;
  return {
    chapter: ch ? ch.title : 'Story complete',
    objective: ch ? ch.objective : 'Free roam — Solmar Bay is yours.',
    next: ch && m.chapter < 5 ? CHAPTERS[m.chapter].title : null,
    marker: m.marker,
    sideJob: m.active ? m.active.label : null,
    completion: completionPct(game),
  };
}

export { CHAPTERS, SIDE_JOBS };
