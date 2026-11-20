// Solmar Bay — story chapters + side jobs.
//
// 5 sequential chapters with intro cards, objective markers and
// a MISSION PASSED screen (reward + respect + completion %).
// Side jobs (taxi, courier, time trial, turf, gang delivery)
// are repeatable markers after chapter 1. Every chapter's
// objective is a real position in the city — no fake markers.

import { CHAPTERS, SIDE_JOBS, SPAWNS, dist } from './config.js';
import { addCash, showToast, showDialogue, completionPercent } from './state.js';

// Chapter anchors (real places).
const ANCHORS = {
  garage: { x: SPAWNS.garage.x, z: SPAWNS.garage.z - 14, label: 'Garage' },
  harbourPackage: { x: -60, z: 320, label: 'Package at the docks' },
  hideout: { x: 200, z: 180, label: 'Hideout' },
  safehouse: { x: -220, z: -220, label: 'Safehouse' },
  vault: { x: 60, z: 310, label: 'Vault container' },
  passengers: [
    { x: 60, z: 60, label: 'Passenger 1' },
    { x: -180, z: -60, label: 'Passenger 2' },
    { x: 120, z: 200, label: 'Passenger 3' },
  ],
  dropoffs: [
    { x: -60, z: 120, label: 'Dropoff 1' },
    { x: 180, z: -120, label: 'Dropoff 2' },
    { x: 0, z: -220, label: 'Dropoff 3' },
  ],
};

export function startChapter(game, n) {
  game.chapter = n;
  game.chapterStage = 0;
  const c = CHAPTERS[n - 1];
  if (!c) return;
  game.card = { title: c.title, text: c.intro };
  game.mode = 'card';
  game.missionTimer = 0;
  if (n === 1) {
    game.missionMarker = ANCHORS.garage;
    showDialogue(game, 'Rico', 'Your fixer', 'Take any car on the street and bring it to the garage on Bay Street.');
  } else if (n === 2) {
    game.missionMarker = ANCHORS.harbourPackage;
    game.missionTimer = 240;
    showDialogue(game, 'Rico', 'Your fixer', 'The package is at the harbour docks. Four minutes. Do not get cute with the cops.');
  } else if (n === 3) {
    game.policeCommit && game.policeCommit('massRampage');
    game.wanted = 3;
    game.missionMarker = null;
    showDialogue(game, 'Rico', 'Your fixer', 'Three stars and every cop in the city. Lose them — hide, outrun, outsmart.');
  } else if (n === 4) {
    game.missionMarker = ANCHORS.passengers[0];
    showDialogue(game, 'Maya', 'Your girl', 'Night shift. Three fares, three dropoffs. Be nice — tips included.');
  } else if (n === 5) {
    game.missionMarker = ANCHORS.vault;
    showDialogue(game, 'Rico', 'Your fixer', 'The vault container at the harbour. Grab the cash, lose four stars, reach the safehouse.');
  }
}

// Advance the current chapter. Called every frame while playing.
export function stepMissions(game, dt) {
  if (game.mode !== 'play') return;
  const p = game.player;
  if (game.missionTimer > 0) {
    game.missionTimer -= dt;
    if (game.missionTimer <= 0) {
      // Chapter 2 timeout: restart the chapter.
      showToast(game, 'Out of time — the drop failed. Try again.');
      startChapter(game, game.chapter);
      return;
    }
  }
  const at = (a, r = 8) => a && dist(p.x, p.z, a.x, a.z) < r;
  if (game.chapter === 1) {
    if (game.chapterStage === 0 && p.inCar) {
      game.chapterStage = 1;
      showToast(game, 'Nice wheels. Now drive to the garage.');
    } else if (game.chapterStage === 1 && at(ANCHORS.garage, 10)) {
      completeChapter(game);
    }
  } else if (game.chapter === 2) {
    if (game.chapterStage === 0 && at(ANCHORS.harbourPackage, 6)) {
      game.chapterStage = 1;
      game.missionMarker = ANCHORS.hideout;
      showToast(game, 'Package secured. Deliver it to the hideout!');
    } else if (game.chapterStage === 1 && at(ANCHORS.hideout, 8)) {
      completeChapter(game);
    }
  } else if (game.chapter === 3) {
    if (game.wanted === 0) completeChapter(game);
  } else if (game.chapter === 4) {
    const stage = game.chapterStage;
    const leg = Math.floor(stage / 2);
    if (stage % 2 === 0) {
      // Pick up passenger `leg`.
      if (at(ANCHORS.passengers[leg], 7)) {
        game.chapterStage = stage + 1;
        game.missionMarker = ANCHORS.dropoffs[leg];
        showToast(game, `Passenger ${leg + 1} aboard — drive to the dropoff.`);
      }
    } else if (at(ANCHORS.dropoffs[leg], 8)) {
      addCash(game, 100, 'fare + tip');
      game.stats.fares += 1;
      if (leg >= 2) {
        completeChapter(game);
      } else {
        game.chapterStage = stage + 1;
        game.missionMarker = ANCHORS.passengers[leg + 1];
        showToast(game, `Fare done. Next passenger: ${ANCHORS.passengers[leg + 1].label}.`);
      }
    }
  } else if (game.chapter === 5) {
    if (game.chapterStage === 0 && at(ANCHORS.vault, 7)) {
      game.chapterStage = 1;
      addCash(game, 500, 'heist cash');
      game.wanted = 4;
      game.missionMarker = ANCHORS.safehouse;
      showToast(game, 'Cash grabbed! Lose the heat and reach the safehouse.');
    } else if (game.chapterStage === 1 && game.wanted === 0 && at(ANCHORS.safehouse, 10)) {
      completeChapter(game);
    } else if (game.chapterStage === 1 && game.wanted === 0) {
      game.missionMarker = ANCHORS.safehouse;
    }
  }
  // Side jobs (repeatable, after chapter 1).
  if (game.sideJob) stepSideJob(game, dt);
}

export function completeChapter(game) {
  const c = CHAPTERS[game.chapter - 1];
  if (!c) return;
  addCash(game, c.reward, `Chapter ${game.chapter} complete`);
  game.respect += 50;
  game.chapterDone = Math.max(game.chapterDone, game.chapter);
  game.completion = completionPercent(game);
  game.missionMarker = null;
  game.missionTimer = 0;
  // Respect unlocks.
  if (game.respect >= 100 && !game.unlocks.smgUnlocked) {
    game.unlocks.smgUnlocked = true;
    game.pickups.push({ kind: 'smg', x: 260, z: 120, amount: 0, t: 600 });
  }
  if (game.respect >= 250 && !game.unlocks.shotgunUnlocked) {
    game.unlocks.shotgunUnlocked = true;
    game.pickups.push({ kind: 'shotgun', x: 60, z: 310, amount: 0, t: 600 });
  }
  if (game.respect >= 500 && !game.unlocks.sportsCarSpawned) {
    game.unlocks.sportsCarSpawned = true;
    showToast(game, 'Unlock: Solmar Comet sports car at the garage!');
  }
  game.mode = 'passed';
  game.card = {
    title: 'MISSION PASSED',
    text: `${c.title} — $${c.reward} earned, +50 respect. Completion ${game.completion}%.`,
  };
  if (game.audio) game.audio.jingle();
}

// Continue after the MISSION PASSED screen.
export function nextChapter(game) {
  if (game.chapter >= CHAPTERS.length) {
    game.mode = 'play';
    game.card = null;
    game.missionMarker = null;
    showToast(game, 'Story complete — free roam. The city is yours.');
    return;
  }
  startChapter(game, game.chapter + 1);
}

// ---- side jobs ----

const SIDE_SPOTS = {
  taxi: [{ x: -40, z: -80 }, { x: 140, z: 80 }],
  courier: [{ x: -200, z: 140 }, { x: 220, z: -160 }],
  trial: [{ x: 0, z: -300 }, { x: 0, z: 300 }],
  turf: [{ x: 0, z: -40 }],
  gangrun: [{ x: -180, z: 180 }],
};

export function startSideJob(game, id) {
  const def = SIDE_JOBS.find((j) => j.id === id);
  if (!def) return false;
  const spots = SIDE_SPOTS[id] || [{ x: 0, z: 0 }];
  game.sideJob = { id, label: def.label, reward: def.reward, stage: 0, spot: spots[0], spots, t: id === 'trial' ? 90 : 0 };
  game.missionMarker = { x: spots[0].x, z: spots[0].z, label: def.label };
  showToast(game, `Side job: ${def.label} — ${def.desc}`);
  return true;
}

function stepSideJob(game, dt) {
  const job = game.sideJob;
  if (!job) return;
  if (job.t > 0) {
    job.t -= dt;
    if (job.t <= 0) {
      showToast(game, 'Time trial failed — too slow.');
      game.sideJob = null;
      game.missionMarker = null;
      return;
    }
  }
  const p = game.player;
  if (dist(p.x, p.z, job.spot.x, job.spot.z) > 8) return;
  if (job.id === 'turf') {
    // Clear the gang members in the turf.
    const left = game.gangMembers.filter((g) => g.gang === 'sharks').length;
    if (left > 0) {
      showToast(game, `${left} Sharks left in the turf — clear them out!`);
      return;
    }
  }
  if (job.id === 'trial' && job.stage < job.spots.length - 1) {
    job.stage += 1;
    job.spot = job.spots[job.stage];
    game.missionMarker = { x: job.spot.x, z: job.spot.z, label: 'Next checkpoint' };
    return;
  }
  addCash(game, job.reward, job.label);
  game.respect += 25;
  game.completion = completionPercent(game);
  showToast(game, `Side job done: ${job.label} +$${job.reward}`);
  game.sideJob = null;
  game.missionMarker = null;
}

export { ANCHORS };
