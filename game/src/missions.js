// Solmar Bay — story chapters and side jobs.
//
// Five chapters: steal a car to the garage, a harbour pickup, losing
// the cops, three taxi passengers, and the vault heist. A chapter
// opens on a card; completing it pays the reward and +50 respect.

import { CHAPTERS } from './config.js';

const CH4_SPOTS = [[30, 30], [-180, 180], [150, 150]];

export function startChapter(g, n) {
  g.chapter = n;
  g.chapterStage = 0;
  g.mode = 'card';
  const ch = CHAPTERS[n - 1];
  g.card = { title: ch.title, text: ch.objective };
  g.missionTimer = 0;
  if (n === 1) {
    g.missionMarker = { x: 150, z: -126 };
  } else if (n === 2) {
    g.missionMarker = { x: -240, z: 200 };
    g.missionTimer = 120;
  } else if (n === 3) {
    g.missionMarker = null;
  } else if (n === 4) {
    g.missionMarker = { x: CH4_SPOTS[0][0], z: CH4_SPOTS[0][1] };
  } else if (n === 5) {
    g.missionMarker = { x: -260, z: 170 };
  } else {
    g.missionMarker = null;
  }
  return g.card;
}

function nearMarker(g, range) {
  if (!g.missionMarker) return false;
  return Math.hypot(g.player.x - g.missionMarker.x, g.player.z - g.missionMarker.z) < (range || 6);
}

export function completeChapter(g) {
  const ch = CHAPTERS[(g.chapter || 1) - 1];
  const reward = ch ? ch.reward : 0;
  g.cash = (g.cash || 0) + reward;
  g.respect = (g.respect || 0) + 50;
  g.chapterDone = (g.chapterDone || 0) + 1;
  g.completion = Math.min(100, g.chapterDone * 16);
  g.card = { title: 'MISSION PASSED', text: `+$${reward} and 50 respect. ${ch ? ch.title : ''} complete.` };
  g.mode = 'passed';
  g.missionMarker = null;
  return g.card;
}

export function nextChapter(g) {
  if (g.chapter < 5) {
    startChapter(g, g.chapter + 1);
  } else {
    g.mode = 'play';
    g.missionMarker = null;
  }
}

export function stepChapter3(g) {
  if ((g.wanted || 0) === 0) {
    completeChapter(g);
    return true;
  }
  return false;
}

export function stepMissions(g, dt) {
  if (g.mode !== 'play') return;
  const ch = g.chapter || 1;
  if (ch === 1) {
    if (g.player.inCar && nearMarker(g, 8)) completeChapter(g);
  } else if (ch === 2) {
    g.missionTimer = (g.missionTimer || 0) - dt;
    if (g.missionTimer <= 0) {
      // Out of time: the chapter restarts from the pickup.
      g.chapterStage = 0;
      g.missionMarker = { x: -240, z: 200 };
      g.missionTimer = 120;
      return;
    }
    if (g.chapterStage === 0 && nearMarker(g, 6)) {
      g.chapterStage = 1;
      g.missionMarker = { x: -120, z: 60 };
    } else if (g.chapterStage === 1 && nearMarker(g, 6)) {
      completeChapter(g);
    }
  } else if (ch === 3) {
    stepChapter3(g);
  } else if (ch === 4) {
    if (nearMarker(g, 6)) {
      const next = (g.chapterStage || 0) + 1;
      if (next >= CH4_SPOTS.length) {
        completeChapter(g);
      } else {
        g.chapterStage = next;
        g.missionMarker = { x: CH4_SPOTS[next][0], z: CH4_SPOTS[next][1] };
      }
    }
  } else if (ch === 5) {
    if (g.chapterStage === 0 && nearMarker(g, 6)) {
      g.chapterStage = 1;
      g.cash = (g.cash || 0) + 500;
      g.missionMarker = { x: -320, z: 40 };
    } else if (g.chapterStage === 1 && nearMarker(g, 6) && (g.wanted || 0) === 0) {
      completeChapter(g);
    }
  }
}

// A taxi side job: drive to the marker, collect $120 + 25 respect.
export function startSideJob(g, kind) {
  if (kind !== 'taxi') return false;
  g.sideJob = { type: 'taxi' };
  g.missionMarker = { x: 60 + Math.floor(Math.random() * 120), z: 60 + Math.floor(Math.random() * 120) };
  return true;
}

export function stepSideJob(g, dt) {
  if (!g.sideJob) return false;
  if (nearMarker(g, 6)) {
    g.cash = (g.cash || 0) + 120;
    g.respect = (g.respect || 0) + 25;
    g.sideJob = null;
    g.missionMarker = null;
    return true;
  }
  return false;
}
