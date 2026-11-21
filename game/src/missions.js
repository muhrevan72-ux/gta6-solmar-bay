// Solmar Bay — story chapters and side jobs.
//
// Five chapters: steal the Comet and bring it to the garage, run a
// package from the harbour to the hideout before the timer ends, lose
// the heat, drive three passengers across town, then hit the vault and
// reach the safehouse clean. Completing a chapter pays cash and
// respect and shows the MISSION PASSED card; Enter on that card starts
// the next chapter, and after the fifth the city is free roam.

import { CHAPTERS, SPAWNS } from './config.js';
import { chapterTitle, completionPercent, addCash, showToast } from './state.js';

const GARAGE_MARKER = { x: 150, z: -126, label: 'Garage' };
const HARBOUR_PICKUP = { x: -240, z: 200, label: 'Harbour' };
const HIDEOUT = { x: -120, z: 60, label: 'Hideout' };
const PASSENGERS = [
  { x: 30, z: 30, label: 'Passenger 1' },
  { x: -180, z: 180, label: 'Passenger 2' },
  { x: 150, z: 150, label: 'Passenger 3' },
];
const VAULT = { x: -260, z: 170, label: 'Vault' };
const SAFEHOUSE = { x: -320, z: 40, label: 'Safehouse' };

function nearMarker(g, marker, radius = 8) {
  if (!marker) return false;
  return Math.hypot(g.player.x - marker.x, g.player.z - marker.z) <= radius;
}

export function startChapter(g, n) {
  g.chapter = n;
  g.chapterStage = 0;
  g.missionTimer = n === 2 ? 120 : 0;
  const ch = CHAPTERS[n - 1];
  if (n === 1) g.missionMarker = { ...GARAGE_MARKER };
  else if (n === 2) g.missionMarker = { ...HARBOUR_PICKUP };
  else if (n === 3) {
    g.missionMarker = null;
    g.wanted = 3;
  } else if (n === 4) g.missionMarker = { ...PASSENGERS[0] };
  else if (n === 5) g.missionMarker = { ...VAULT };
  else g.missionMarker = null;
  g.mode = 'card';
  g.card = {
    title: chapterTitle(g),
    text: ch ? ch.brief : 'Free roam. Solmar Bay is yours.',
    hint: 'Press Enter to start',
  };
  return g.card;
}

export function completeChapter(g) {
  const ch = CHAPTERS[g.chapter - 1];
  const reward = ch ? ch.reward : 0;
  const respect = ch ? ch.respect : 0;
  addCash(g, reward, 'Chapter complete');
  g.respect += respect;
  g.chapterDone += 1;
  g.completion = completionPercent(g);
  g.missionMarker = null;
  g.missionTimer = 0;
  g.mode = 'passed';
  g.card = {
    title: 'MISSION PASSED',
    text: `Chapter complete! You earned $${reward} and ${respect} respect. ${g.chapterDone} of 5 chapters done.`,
    hint: 'Press Enter to continue',
  };
  if (g.audio) g.audio.sfx('success');
  return g.card;
}

export function nextChapter(g) {
  if (g.chapter >= 5) {
    g.chapter = 6;
    g.mode = 'play';
    g.card = null;
    g.missionMarker = null;
    showToast(g, 'Free roam — Solmar Bay is yours.');
    return;
  }
  startChapter(g, g.chapter + 1);
}

// Chapter 3: the only way out is to lose every star.
export function stepChapter3(g) {
  if (g.wanted <= 0) {
    completeChapter(g);
    return true;
  }
  return false;
}

export function stepMissions(g, dt) {
  const ch = g.chapter;
  if (ch === 1) {
    if (g.player.inCar && nearMarker(g, GARAGE_MARKER)) {
      completeChapter(g);
    }
  } else if (ch === 2) {
    g.missionTimer -= dt;
    if (g.missionTimer <= 0) {
      // Too slow: the deal is off, start the chapter over.
      g.chapterStage = 0;
      g.missionTimer = 120;
      g.missionMarker = { ...HARBOUR_PICKUP };
      showToast(g, 'Too slow — the deal is off. Start over.');
      return;
    }
    if (g.chapterStage === 0 && nearMarker(g, HARBOUR_PICKUP)) {
      g.chapterStage = 1;
      g.missionMarker = { ...HIDEOUT };
      showToast(g, 'Package picked up — deliver it to the hideout.');
    } else if (g.chapterStage === 1 && nearMarker(g, HIDEOUT)) {
      completeChapter(g);
    }
  } else if (ch === 3) {
    stepChapter3(g);
  } else if (ch === 4) {
    const spot = PASSENGERS[g.chapterStage];
    if (spot && nearMarker(g, spot)) {
      g.chapterStage += 1;
      if (g.chapterStage >= PASSENGERS.length) {
        completeChapter(g);
      } else {
        g.missionMarker = { ...PASSENGERS[g.chapterStage] };
        showToast(g, 'Passenger dropped off — next fare waiting.');
      }
    }
  } else if (ch === 5) {
    if (g.chapterStage === 0 && nearMarker(g, VAULT)) {
      g.chapterStage = 1;
      addCash(g, 500, 'Vault cash');
      g.missionMarker = { ...SAFEHOUSE };
      showToast(g, 'Vault grabbed — get to the safehouse, no stars.');
    } else if (g.chapterStage === 1 && nearMarker(g, SAFEHOUSE)) {
      if (g.wanted <= 0) {
        completeChapter(g);
      }
    }
  }
}

// ---------- side jobs ----------
export function startSideJob(g, type) {
  if (type === 'taxi') {
    g.sideJob = { type: 'taxi', label: 'Taxi fare' };
    g.missionMarker = { x: 120, z: 180, label: 'Taxi fare' };
    return true;
  }
  if (type === 'pizza' || type === 'delivery') {
    g.sideJob = { type, label: 'Delivery' };
    g.missionMarker = { x: -60, z: -120, label: 'Delivery' };
    return true;
  }
  return false;
}

export function stepSideJob(g, dt) {
  if (!g.sideJob) return false;
  if (!nearMarker(g, g.missionMarker)) return false;
  if (g.sideJob.type === 'taxi') {
    addCash(g, 120, 'Taxi fare');
    g.respect += 25;
  } else {
    addCash(g, 80, 'Delivery');
    g.respect += 10;
  }
  g.sideJob = null;
  g.missionMarker = null;
  if (g.audio) g.audio.sfx('cash');
  return true;
}
