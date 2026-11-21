// Solmar Bay — the 5 story chapters + side jobs.
// Each chapter sets a marker; reaching it (in the right state)
// advances or completes the chapter.

import { CHAPTERS, SPAWNS } from './config.js';
import { chapterTitle, completionPercent, addCash, showToast } from './state.js';

const CH4_SPOTS = [[30, 30], [-180, 180], [150, 150]];
const CH2_PICKUP = { x: -240, z: 200 };
const CH2_HIDEOUT = { x: -120, z: 60 };
const CH5_VAULT = { x: -260, z: 170 };
const CH5_SAFEHOUSE = { x: -320, z: 40 };

function near(g, x, z, r) {
  return Math.hypot(g.player.x - x, g.player.z - z) < r;
}

export function startChapter(g, n) {
  g.chapter = n;
  g.chapterStage = 0;
  g.mode = 'card';
  const c = CHAPTERS[n - 1];
  g.card = { title: chapterTitle(g), text: c.intro };
  if (n === 1) g.missionMarker = { x: SPAWNS.garageDoor.x, z: SPAWNS.garageDoor.z };
  else if (n === 2) { g.missionMarker = { x: CH2_PICKUP.x, z: CH2_PICKUP.z }; g.missionTimer = 120; }
  else if (n === 3) { g.wanted = 3; g.missionMarker = null; }
  else if (n === 4) g.missionMarker = { x: CH4_SPOTS[0][0], z: CH4_SPOTS[0][1] };
  else if (n === 5) g.missionMarker = { x: CH5_VAULT.x, z: CH5_VAULT.z };
  return g.card;
}

export function completeChapter(g) {
  const c = CHAPTERS[g.chapter - 1];
  g.mode = 'passed';
  g.card = { title: 'MISSION PASSED', text: `Reward $${c.reward} · +50 respect` };
  addCash(g, c.reward, '');
  g.respect += 50;
  g.chapterDone++;
  g.completion = completionPercent(g);
  g.missionMarker = null;
  return g.card;
}

export function nextChapter(g) {
  if (g.chapter < 5) {
    startChapter(g, g.chapter + 1);
  } else {
    g.chapter = 6;
    g.mode = 'play';
    g.card = null;
    g.missionMarker = null;
  }
}

// Chapter 3 completes when the heat is gone.
export function stepChapter3(g) {
  if (g.chapter === 3 && g.wanted <= 0) {
    completeChapter(g);
    return true;
  }
  return false;
}

export function stepMissions(g, dt) {
  if (g.mode !== 'play' && g.mode !== 'phone') return;
  const n = g.chapter;
  if (n === 1) {
    if (g.player.inCar && near(g, SPAWNS.garageDoor.x, SPAWNS.garageDoor.z, 8)) completeChapter(g);
  } else if (n === 2) {
    g.missionTimer -= dt;
    if (g.missionTimer <= 0) {
      g.chapterStage = 0;
      g.missionTimer = 120;
      g.missionMarker = { x: CH2_PICKUP.x, z: CH2_PICKUP.z };
      showToast(g, 'Too slow — the package run restarted');
      return;
    }
    if (g.chapterStage === 0 && near(g, CH2_PICKUP.x, CH2_PICKUP.z, 6)) {
      g.chapterStage = 1;
      g.missionMarker = { x: CH2_HIDEOUT.x, z: CH2_HIDEOUT.z };
      showToast(g, 'Package picked up — deliver it to the hideout');
    } else if (g.chapterStage === 1 && near(g, CH2_HIDEOUT.x, CH2_HIDEOUT.z, 6)) {
      completeChapter(g);
    }
  } else if (n === 3) {
    stepChapter3(g);
  } else if (n === 4) {
    const idx = g.chapterStage;
    if (idx < CH4_SPOTS.length) {
      const [sx, sz] = CH4_SPOTS[idx];
      if (near(g, sx, sz, 6)) {
        g.chapterStage++;
        if (g.chapterStage >= CH4_SPOTS.length) completeChapter(g);
        else {
          const [nx, nz] = CH4_SPOTS[g.chapterStage];
          g.missionMarker = { x: nx, z: nz };
          showToast(g, `Passenger ${g.chapterStage + 1} of 3 picked up`);
        }
      }
    }
  } else if (n === 5) {
    if (g.chapterStage === 0 && near(g, CH5_VAULT.x, CH5_VAULT.z, 6)) {
      g.chapterStage = 1;
      addCash(g, 500, 'vault cash');
      g.wanted = Math.max(g.wanted, 4);
      g.missionMarker = { x: CH5_SAFEHOUSE.x, z: CH5_SAFEHOUSE.z };
      showToast(g, 'Vault cash grabbed! Lose the heat, then reach the safehouse');
    } else if (g.chapterStage === 1 && near(g, CH5_SAFEHOUSE.x, CH5_SAFEHOUSE.z, 6)) {
      if (g.wanted <= 0) completeChapter(g);
      else showToast(g, 'Too hot — lose the wanted level first');
    }
  }
}

// Side jobs: a taxi fare. Returns true when started.
export function startSideJob(g, kind) {
  if (kind !== 'taxi') return false;
  const spots = [[120, 120], [-60, -120], [200, 60], [-180, -60]];
  const s = spots[Math.floor(Math.random() * spots.length)];
  g.sideJob = { type: 'taxi', x: s[0], z: s[1] };
  g.missionMarker = { x: s[0], z: s[1] };
  return true;
}

export function stepSideJob(g, dt) {
  if (!g.sideJob) return false;
  if (near(g, g.sideJob.x, g.sideJob.z, 6)) {
    addCash(g, 120, 'taxi fare');
    g.respect += 25;
    g.sideJob = null;
    g.missionMarker = null;
    showToast(g, 'Fare complete +$120');
    return true;
  }
  return false;
}
