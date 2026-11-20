// Solmar Bay — story chapters + side jobs (rebuild #13).
import { CHAPTERS } from './config.js';
import { chapterTitle, addCash } from './state.js';

const CH4_SPOTS = [[30, 30], [-180, 180], [150, 150]];

export function startChapter(g, n) {
  g.chapter = n;
  g.chapterStage = 0;
  g.missionTimer = n === 2 ? 120 : 0;
  g.mode = 'card';
  g.card = { title: chapterTitle(g), text: CHAPTERS[n - 1].objective };
  if (n === 1) g.missionMarker = { x: 150, z: -126, label: 'Garage' };
  else if (n === 2) g.missionMarker = { x: -240, z: 200, label: 'Package' };
  else if (n === 3) g.missionMarker = { x: 0, z: 0, label: 'Lay low' };
  else if (n === 4) g.missionMarker = { x: CH4_SPOTS[0][0], z: CH4_SPOTS[0][1], label: 'Passenger' };
  else if (n === 5) g.missionMarker = { x: -260, z: 170, label: 'Vault' };
}

export function completeChapter(g) {
  const ch = CHAPTERS[g.chapter - 1];
  addCash(g, ch.reward, 'mission');
  g.respect += 50;
  g.chapterDone += 1;
  g.completion = g.chapterDone * 16;
  g.mode = 'passed';
  g.card = { title: 'MISSION PASSED', text: `$${ch.reward} · +50 respect` };
}

export function nextChapter(g) {
  if (g.chapter >= 5) {
    g.chapter = 6;
    g.mode = 'play';
    g.missionMarker = null;
    g.card = null;
    return;
  }
  startChapter(g, g.chapter + 1);
}

export function stepChapter3(g) {
  if (g.wanted === 0) {
    completeChapter(g);
    return true;
  }
  return false;
}

function nearMarker(g, range) {
  if (!g.missionMarker) return false;
  return Math.hypot(g.player.x - g.missionMarker.x, g.player.z - g.missionMarker.z) < range;
}

export function stepMissions(g, dt) {
  if (g.mode !== 'play') return;
  if (g.chapter === 1) {
    if (g.player.inCar && nearMarker(g, 8)) completeChapter(g);
  } else if (g.chapter === 2) {
    g.missionTimer -= dt;
    if (g.missionTimer <= 0) {
      startChapter(g, 2);
      return;
    }
    if (g.chapterStage === 0) {
      if (nearMarker(g, 8)) {
        g.chapterStage = 1;
        g.missionMarker = { x: -120, z: 60, label: 'Hideout' };
        g.missionTimer = 120;
      }
    } else if (nearMarker(g, 8)) {
      completeChapter(g);
    }
  } else if (g.chapter === 3) {
    stepChapter3(g);
  } else if (g.chapter === 4) {
    if (nearMarker(g, 8)) {
      g.chapterStage += 1;
      if (g.chapterStage >= 3) completeChapter(g);
      else {
        const s = CH4_SPOTS[g.chapterStage];
        g.missionMarker = { x: s[0], z: s[1], label: 'Passenger' };
      }
    }
  } else if (g.chapter === 5) {
    if (g.chapterStage === 0) {
      if (nearMarker(g, 8)) {
        g.chapterStage = 1;
        addCash(g, 500, 'vault');
        g.missionMarker = { x: -320, z: 40, label: 'Safehouse' };
      }
    } else if (nearMarker(g, 8) && g.wanted === 0) {
      completeChapter(g);
    }
  }
}

export function startSideJob(g, kind) {
  if (kind !== 'taxi') return false;
  g.sideJob = { kind: 'taxi' };
  g.missionMarker = { x: 120, z: 120, label: 'Passenger' };
  return true;
}

export function stepSideJob(g, dt) {
  if (!g.sideJob) return false;
  if (g.sideJob.kind === 'taxi' && nearMarker(g, 8)) {
    addCash(g, 120, 'taxi job');
    g.respect += 25;
    g.sideJob = null;
    g.missionMarker = null;
    return true;
  }
  return false;
}
