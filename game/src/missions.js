// Solmar Bay — story chapters (5) + side jobs (taxi).

import { CHAPTERS, SPAWNS } from './config.js';
import { chapterTitle } from './state.js';

// Every chapter gives +50 respect on completion.
const CHAPTER_RESPECT = 50;

export function missionObjective(g) {
  const ch = g.chapter;
  if (ch === 1) return 'Drive to the garage';
  if (ch === 2) return g.chapterStage === 1 ? 'Deliver the package to the hideout' : 'Pick up the package at the harbour';
  if (ch === 3) return 'Lose the cops — get wanted to 0';
  if (ch === 4) return `Pick up passengers (${g._passengers || 0}/3)`;
  if (ch === 5) return g.chapterStage === 1 ? 'Get to the safehouse with 0 stars' : 'Grab the vault cash';
  return 'Free Roam';
}

export function startChapter(g, n) {
  const ch = CHAPTERS[n - 1];
  if (!ch) return;
  g.chapter = n;
  g.chapterStage = 0;
  g.mode = 'card';
  g.card = { title: chapterTitle(g), text: ch.objective, reward: ch.reward, respect: CHAPTER_RESPECT };
  // Chapter markers.
  if (n === 1) g.missionMarker = { x: SPAWNS.garageDoor.x, z: SPAWNS.garageDoor.z + 2 };
  else if (n === 2) g.missionMarker = { x: -240, z: 200 };
  else if (n === 3) g.missionMarker = null;
  else if (n === 4) g.missionMarker = { x: 30, z: 30 };
  else if (n === 5) g.missionMarker = { x: -260, z: 170 };
  g._passengers = 0;
  g.missionTimer = n === 2 ? 120 : 0;
  // Chapter 3 starts with heat on the player — they must lose it.
  if (n === 3) g.wanted = 2;
}

export function completeChapter(g) {
  const ch = CHAPTERS[g.chapter - 1];
  if (!ch) return;
  g.cash += ch.reward;
  g.respect = (g.respect || 0) + CHAPTER_RESPECT;
  g.chapterDone = (g.chapterDone || 0) + 1;
  g.completion = g.chapterDone * 16;
  g.mode = 'passed';
  g.card = {
    title: 'MISSION PASSED',
    text: `You earned $${ch.reward} and ${CHAPTER_RESPECT} respect.`,
    reward: ch.reward,
    respect: CHAPTER_RESPECT,
  };
  g.missionMarker = null;
  g.chapterStage = 0;
  if (g.audio) g.audio.sfx('mission');
}

export function nextChapter(g) {
  if (g.chapter >= 5) {
    g.mode = 'play';
    g.card = null;
    return;
  }
  startChapter(g, g.chapter + 1);
}

// Check the current chapter's completion condition. Returns true
// when the chapter completes.
export function stepMissions(g, dt) {
  const ch = g.chapter;
  if (ch === 1) {
    // Complete when the player reaches the garage IN a car.
    if (g.player.inCar && g.missionMarker) {
      const d = Math.hypot(g.player.x - g.missionMarker.x, g.player.z - g.missionMarker.z);
      if (d < 25) {
        completeChapter(g);
        return true;
      }
    }
    return false;
  }
  if (ch === 2) {
    // Timer: running out restarts the chapter.
    if (g.missionTimer !== undefined && g.missionTimer > 0) {
      g.missionTimer -= dt;
      if (g.missionTimer <= 0) {
        startChapter(g, 2);
        return false;
      }
    }
    if (g.chapterStage === 0) {
      const d = Math.hypot(g.player.x - (-240), g.player.z - 200);
      if (d < 10) {
        g.chapterStage = 1;
        g.missionMarker = { x: -120, z: 60 };
        g.toast = 'Package picked up — deliver it to the hideout';
        g.toastTimer = 3;
      }
      return false;
    }
    const d = Math.hypot(g.player.x - (-120), g.player.z - 60);
    if (d < 10) {
      completeChapter(g);
      return true;
    }
    return false;
  }
  if (ch === 3) {
    // Complete when wanted reaches 0.
    return stepChapter3(g);
  }
  if (ch === 4) {
    const spots = [[30, 30], [-180, 180], [150, 150]];
    const idx = g._passengers || 0;
    if (idx < 3) {
      const [sx, sz] = spots[idx];
      g.missionMarker = { x: sx, z: sz };
      const d = Math.hypot(g.player.x - sx, g.player.z - sz);
      if (d < 10) {
        g._passengers = idx + 1;
        g.toast = `Passenger ${g._passengers}/3 picked up`;
        g.toastTimer = 3;
        if (g._passengers >= 3) {
          completeChapter(g);
          return true;
        }
        // Move the marker to the next passenger.
        const [nx, nz] = spots[g._passengers];
        g.missionMarker = { x: nx, z: nz };
      }
    }
    return false;
  }
  if (ch === 5) {
    if (g.chapterStage === 0) {
      const d = Math.hypot(g.player.x - (-260), g.player.z - 170);
      if (d < 10) {
        g.chapterStage = 1;
        g.cash += 500;
        g.missionMarker = { x: -320, z: 40 };
        g.toast = 'Vault cash grabbed — get to the safehouse!';
        g.toastTimer = 3;
      }
      return false;
    }
    const d = Math.hypot(g.player.x - (-320), g.player.z - 40);
    if (d < 10 && g.wanted <= 0) {
      completeChapter(g);
      return true;
    }
    return false;
  }
  return false;
}

// Chapter 3 completes when the wanted level reaches 0.
export function stepChapter3(g) {
  if (g.wanted <= 0 && g.chapter === 3) {
    completeChapter(g);
    return true;
  }
  return false;
}

// --- side jobs ---
export function startSideJob(g, kind) {
  if (kind === 'taxi') {
    g.sideJob = { kind: 'taxi', stage: 0 };
    g.missionMarker = { x: -120, z: -60 };
    g.toast = 'Taxi job: pick up the fare';
    g.toastTimer = 3;
    return true;
  }
  return false;
}

export function stepSideJob(g, dt) {
  if (!g.sideJob) return false;
  if (g.sideJob.kind === 'taxi') {
    if (!g.missionMarker) return false;
    const d = Math.hypot(g.player.x - g.missionMarker.x, g.player.z - g.missionMarker.z);
    if (d < 10) {
      g.cash += 120;
      g.respect = (g.respect || 0) + 25;
      g.toast = '+$120 — taxi fare';
      g.toastTimer = 3;
      g.sideJob = null;
      g.missionMarker = null;
      return true;
    }
  }
  return false;
}
