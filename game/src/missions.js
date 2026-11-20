// Solmar Bay — story missions + side jobs (rebuild #15).
// Five chapters, each with a marker the player must reach. Ch1
// needs a car at the garage; Ch2 is a timed pickup/delivery; Ch3
// is losing the heat; Ch4 is three fares; Ch5 is the vault grab
// and a clean getaway to the safehouse.

import { CHAPTERS } from './config.js';
import { showToast, completionPercent } from './state.js';

const CH4_SPOTS = [[30, 30], [-180, 180], [150, 150]];

export function startChapter(g, n) {
  const ch = CHAPTERS[n - 1];
  if (!ch) return false;
  g.chapter = n;
  g.chapterStage = 0;
  g.missionTimer = ch.timeLimit || 0;
  g.mode = 'card';
  g.card = { title: ch.title, text: ch.brief || ch.title };
  if (n === 1) g.missionMarker = { x: 150, z: -126 };
  else if (n === 2) g.missionMarker = { x: -240, z: 200 };
  else if (n === 3) { g.missionMarker = null; g.wanted = Math.max(g.wanted, 2); }
  else if (n === 4) g.missionMarker = { x: CH4_SPOTS[0][0], z: CH4_SPOTS[0][1] };
  else if (n === 5) g.missionMarker = { x: -260, z: 170 };
  return true;
}

export function completeChapter(g) {
  const ch = CHAPTERS[g.chapter - 1];
  const reward = ch ? ch.reward : 0;
  const respect = ch ? (ch.respect || 0) : 0;
  g.cash += reward;
  g.respect += respect;
  g.chapterDone += 1;
  g.completion = completionPercent(g);
  g.mode = 'passed';
  g.card = { title: 'MISSION PASSED', text: `+$${reward}  +${respect} respect` };
  showToast(g, `Mission passed! +$${reward}`);
  return true;
}

export function nextChapter(g) {
  if (g.chapter < 5) {
    startChapter(g, g.chapter + 1);
  } else {
    g.chapter = 6;
    g.mode = 'play';
    g.card = null;
    g.missionMarker = null;
    showToast(g, 'Free Roam — the city is yours.');
  }
  return g.chapter;
}

function atMarker(g, radius) {
  if (!g.missionMarker) return false;
  return Math.hypot(g.player.x - g.missionMarker.x, g.player.z - g.missionMarker.z) < (radius || 6);
}

export function stepMissions(g, dt) {
  if (g.mode !== 'play') return;
  // Chapter 2 has a time limit; expiry restarts the chapter.
  if (g.chapter === 2 && g.missionTimer > 0) {
    g.missionTimer -= dt;
    if (g.missionTimer <= 0) {
      startChapter(g, 2);
      g.mode = 'play';
      showToast(g, 'Too slow — the harbour run restarts.');
      return;
    }
  }
  const ch = g.chapter;
  if (ch === 1) {
    if (atMarker(g, 8) && g.player.inCar) completeChapter(g);
  } else if (ch === 2) {
    if (g.chapterStage === 0 && atMarker(g, 6)) {
      g.chapterStage = 1;
      g.missionMarker = { x: -120, z: 60 };
      showToast(g, 'Package picked up — deliver it to the hideout.');
    } else if (g.chapterStage === 1 && atMarker(g, 6)) {
      completeChapter(g);
    }
  } else if (ch === 3) {
    stepChapter3(g);
  } else if (ch === 4) {
    if (atMarker(g, 6)) {
      g.chapterStage += 1;
      if (g.chapterStage >= 3) {
        completeChapter(g);
      } else {
        const s = CH4_SPOTS[g.chapterStage];
        g.missionMarker = { x: s[0], z: s[1] };
        showToast(g, `Passenger ${g.chapterStage} of 3 picked up.`);
      }
    }
  } else if (ch === 5) {
    if (g.chapterStage === 0 && atMarker(g, 6)) {
      g.chapterStage = 1;
      g.cash += 500;
      g.missionMarker = { x: -320, z: 40 };
      showToast(g, 'Vault grabbed! +$500 — lose the heat, then reach the safehouse.');
    } else if (g.chapterStage === 1 && atMarker(g, 6)) {
      if ((g.wanted || 0) === 0) completeChapter(g);
      else showToast(g, 'Too hot — lose the cops first.');
    }
  }
}

export function stepChapter3(g) {
  if (g.chapter !== 3) return false;
  if ((g.wanted || 0) === 0) {
    completeChapter(g);
    return true;
  }
  return false;
}

export function startSideJob(g, type) {
  if (type === 'taxi') {
    g.sideJob = { type: 'taxi' };
    g.missionMarker = { x: 180, z: -60 };
    showToast(g, 'Taxi fare: drive to the marker.');
    return true;
  }
  return false;
}

export function stepSideJob(g, dt) {
  if (!g.sideJob) return false;
  if (atMarker(g, 6)) {
    g.cash += 120;
    g.respect += 25;
    g.sideJob = null;
    showToast(g, 'Fare complete! +$120');
    return true;
  }
  return false;
}
