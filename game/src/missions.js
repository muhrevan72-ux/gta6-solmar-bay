// Solmar Bay — the 5 story chapters and side jobs.
// Written fresh for rebuild #18.

import { CHAPTERS, SPAWNS } from './config.js';
import { showToast, showDialogue, chapterTitle } from './state.js';
import { addCash } from './state.js';

export function startChapter(g, n) {
  const ch = CHAPTERS[n - 1];
  if (!ch) return;
  g.chapter = n;
  g.chapterStage = 0;
  g.missionStage = 0;
  g.missionTimer = ch.timeLimit || 0;
  g.mode = 'card';
  g.card = {
    title: ch.title,
    text: ch.text,
    hint: 'Press Enter to start',
  };
  if (n === 1) g.missionMarker = { x: SPAWNS.garageDoor.x, z: SPAWNS.garageDoor.z };
  else if (n === 2) g.missionMarker = { x: -240, z: 200 };
  else if (n === 3) g.missionMarker = null;
  else if (n === 4) g.missionMarker = { x: 30, z: 30 };
  else if (n === 5) g.missionMarker = { x: -260, z: 170 };
}

export function completeChapter(g) {
  const ch = CHAPTERS[g.chapter - 1];
  if (!ch) return;
  g.chapterDone = Math.max(g.chapterDone, g.chapter);
  g.completion = g.chapterDone * 16;
  addCash(g, ch.reward, 'mission reward');
  g.respect = (g.respect || 0) + 50;
  g.mode = 'passed';
  g.card = {
    title: 'MISSION PASSED',
    text: `You earned $${ch.reward} and 50 respect.`,
    hint: 'Press Enter to continue',
  };
  g.missionMarker = null;
  g.chapterStage = 0;
  g.missionStage = 0;
}

export function nextChapter(g) {
  if (g.chapter >= 5) {
    g.mode = 'play';
    g.card = null;
    showToast(g, 'Free Roam — Solmar Bay is yours');
    return;
  }
  startChapter(g, g.chapter + 1);
}

export function stepMissions(g, dt) {
  if (g.chapter === 1) {
    if (g.missionMarker) {
      const d = Math.hypot(g.player.x - g.missionMarker.x, g.player.z - g.missionMarker.z);
      if (d < 8 && g.player.inCar) completeChapter(g);
    }
  } else if (g.chapter === 2) {
    if (g.missionTimer > 0) {
      g.missionTimer -= dt;
      if (g.missionTimer <= 0) {
        startChapter(g, 2);
        return;
      }
    }
    if (g.chapterStage === 0) {
      const d = Math.hypot(g.player.x - (-240), g.player.z - 200);
      if (d < 8) {
        g.chapterStage = 1;
        g.missionStage = 1;
        g.missionMarker = { x: -120, z: 60 };
        showDialogue(g, 'Rico', 'Fixer', 'Good, you got the package. Now drop it at the harbour warehouse.');
      }
    } else if (g.chapterStage === 1) {
      const d = Math.hypot(g.player.x - (-120), g.player.z - 60);
      if (d < 8) completeChapter(g);
    }
  } else if (g.chapter === 3) {
    if (g.wanted === 0) completeChapter(g);
  } else if (g.chapter === 4) {
    const stops = [[30, 30], [-180, 180], [150, 150]];
    const idx = g.chapterStage;
    if (idx < stops.length) {
      const [sx, sz] = stops[idx];
      g.missionMarker = { x: sx, z: sz };
      const d = Math.hypot(g.player.x - sx, g.player.z - sz);
      if (d < 8) {
        g.chapterStage = idx + 1;
        g.missionStage = idx + 1;
        if (g.chapterStage >= stops.length) {
          completeChapter(g);
        } else {
          // Advance the marker to the next stop right away.
          const [nx, nz] = stops[g.chapterStage];
          g.missionMarker = { x: nx, z: nz };
        }
      }
    }
  } else if (g.chapter === 5) {
    if (g.chapterStage === 0) {
      const d = Math.hypot(g.player.x - (-260), g.player.z - 170);
      if (d < 8) {
        g.chapterStage = 1;
        g.missionStage = 1;
        g.missionMarker = { x: -320, z: 40 };
        addCash(g, 500, 'vault cut');
        showToast(g, 'Vault cracked — $500. Now lose the heat and reach the safehouse.');
      }
    } else if (g.chapterStage === 1) {
      const d = Math.hypot(g.player.x - (-320), g.player.z - 40);
      if (d < 8 && g.wanted === 0) completeChapter(g);
    }
  }
}

export function stepChapter3(g, dt) {
  if (g.chapter === 3 && g.wanted === 0) {
    completeChapter(g);
    return true;
  }
  return false;
}

export function startSideJob(g, kind) {
  if (kind === 'taxi') {
    g.sideJob = { kind: 'taxi', marker: { x: 100, z: 100 } };
    g.missionMarker = { x: 100, z: 100 };
    return true;
  }
  return false;
}

export function stepSideJob(g, dt) {
  if (!g.sideJob) return false;
  if (g.sideJob.kind === 'taxi') {
    const m = g.sideJob.marker;
    const d = Math.hypot(g.player.x - m.x, g.player.z - m.z);
    if (d < 8) {
      addCash(g, 120, 'taxi fare');
      g.respect = (g.respect || 0) + 25;
      g.sideJob = null;
      g.missionMarker = null;
      showToast(g, 'Fare complete — $120');
      return true;
    }
  }
  return false;
}
