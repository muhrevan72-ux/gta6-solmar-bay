// Solmar Bay — story chapters (5, sequential) + repeatable side jobs.
// Each chapter has steps; completing a chapter pays its reward and
// opens the next. Side jobs (taxi / courier / time trial / turf /
// gang delivery) are available from markers after chapter 1.

import { CHAPTERS, SIDE_JOBS, RESPECT, clamp, dist2 } from './config.js';
import { showToast, addCash, addRespect } from './state.js';
import { notifyPhone } from './phone.js';
import { showMenu } from './hud.js';
import { spawnPickup } from './combat.js';
import { spawnVehicle } from './vehicles.js';

export function createMissions() {
  return {
    chapter: 1,
    step: 0,
    marker: null, // { x, z, label }
    timer: 0,
    passengers: 0,
    pickedUp: false,
    coolT: 0, // restart cooldown after a job finishes
    active: null, // side job in progress
    nextChapter: null, // set by completeChapter, started by the passed screen
  };
}

// Mission spots are STREET points in front of the sites — never the
// building centres, which sit inside solid colliders and can never
// be reached (a chapter could never complete).
export const SPOTS = {
  garage: { x: 150, z: -120 },
  harbour: { x: 300, z: -100 },
  hideout: { x: 250, z: -220 },
  safehouse: { x: -250, z: 190 },
  fireStation: { x: 150, z: 112 },
  taxiStand: { x: 0, z: 50 },
};

export function startChapter(game, n) {
  const m = game.missions;
  const ch = CHAPTERS[n - 1];
  m.chapter = n;
  m.step = 0;
  m.timer = 0;
  m.passengers = 0;
  m.pickedUp = false;
  m.active = null;
  game.state.chapter = n;
  game.state.mode = 'chapter';
  game.state.chapterIntroShown = true;
  m.marker = chapterMarker(game, n);
  showToast(game.state, ch.title + ' — ' + ch.objective, 5);
  notifyPhone(game, 'Rico', ch.title + ' — ' + ch.objective);
  // a separate intro card (the play-test saw none: the game just sat
  // on the frozen world until a key was pressed)
  showMenu(game.hud, ch.title, ch.intro + '<br><br><b>Objective:</b> ' + ch.objective + '<br>Reward: $' + ch.reward, 'Press Enter to start.');
  if (game.audio) game.audio.play('mission');
}

function chapterMarker(game, n) {
  switch (n) {
    case 1: return { x: SPOTS.garage.x, z: SPOTS.garage.z, label: 'Garage' };
    case 2: return { x: SPOTS.harbour.x, z: SPOTS.harbour.z, label: 'Harbour docks' };
    case 3: return null; // getaway: no marker, just lose the heat
    case 4: return { x: SPOTS.taxiStand.x, z: SPOTS.taxiStand.z, label: 'Pick up passenger' };
    case 5: return { x: SPOTS.harbour.x, z: SPOTS.harbour.z, label: 'Harbour vault' };
    default: return null;
  }
}

function completeChapter(game) {
  const m = game.missions;
  const ch = CHAPTERS[m.chapter - 1];
  addCash(game.state, ch.reward);
  game.state.stats.missionsDone += 1;
  addRespect(game.state, 50);
  if (game.audio) game.audio.play('win');
  m.marker = null;
  const next = m.chapter + 1;
  const storyDone = next > 5;
  // advance the story state NOW (the HUD and tests read it
  // immediately); the next chapter's intro card waits behind the
  // mission-passed screen, shown when the player presses Enter.
  m.chapter = storyDone ? 6 : next;
  game.state.chapter = m.chapter;
  m.nextChapter = storyDone ? 6 : next;
  if (!storyDone) {
    m.step = 0;
    m.timer = 0;
    m.passengers = 0;
    m.pickedUp = false;
    m.active = null;
    m.marker = chapterMarker(game, next);
  }
  const unlock = checkRespectUnlocks(game);
  game.state.mode = 'missionpassed';
  const done = game.state.stats.missionsDone;
  const title = storyDone ? 'STORY COMPLETE' : 'MISSION PASSED';
  const body = ch.title + '<br>+$' + ch.reward + ' · +50 REP' +
    (unlock ? '<br>Unlocked: ' + unlock : '') +
    '<br>Story ' + done + '/5 · Completion ' + completionPct(game) + '%';
  showMenu(game.hud, title, body, 'Press Enter to continue.');
  notifyPhone(game, 'Rico', title + '! +$' + ch.reward + ' +50 REP. Nice work, kid.');
}

// Completion %: story 60 (12 per chapter) + side jobs 20 (3 each,
// capped) + garage cars 8 (4 each, capped) + respect 12 (1 per 100
// REP, capped). Shown on the mission-passed screen and the pause menu.
export function completionPct(game) {
  const s = game.state.stats;
  const story = Math.min(60, (s.missionsDone || 0) * 12);
  const jobs = Math.min(20, (s.sideJobsDone || 0) * 3);
  const cars = Math.min(8, (game.garage ? game.garage.owned.length : 0) * 4);
  const rep = Math.min(12, Math.floor((game.state.respect || 0) / 100));
  return story + jobs + cars + rep;
}

// Respect unlocks: spawn once when a threshold is crossed, tracked
// in state.flags. Returns the label of a newly unlocked item, or null.
export function checkRespectUnlocks(game) {
  const state = game.state;
  const rep = state.respect || 0;
  for (const u of RESPECT.unlocks) {
    if (rep < u.min || state.flags[u.flag]) continue;
    state.flags[u.flag] = true;
    if (u.flag === 'smgUnlocked') {
      spawnPickup(game, 260, 260, 'smg', true); // shooting range, persistent
    } else if (u.flag === 'shotgunUnlocked') {
      spawnPickup(game, 300, -100, 'shotgun', true); // harbour, persistent
    } else if (u.flag === 'sportsCarSpawned') {
      const veh = spawnVehicle(game.vehicles, 'car', 150, -120, 0, [0.95, 0.75, 0.15]);
      veh.driver = 'parked';
      veh.name = 'Solmar Comet';
    }
    showToast(state, 'Respect unlock: ' + u.label, 4);
    notifyPhone(game, 'Rico', 'Respect unlock: ' + u.label);
    return u.label;
  }
  return null;
}

// Per-frame chapter logic. Called from stepGame.
export function updateMissions(game, dt) {
  const m = game.missions;
  const state = game.state;
  const p = game.player;
  if (m.coolT > 0) m.coolT -= dt;
  if (state.mode !== 'playing') return;
  if (m.active) {
    updateSideJob(game, dt);
    return;
  }
  if (m.chapter > 5) return;

  const ch = m.chapter;
  if (ch === 1) {
    // step 0: steal a car. step 1: drive it to the garage.
    if (m.step === 0) {
      if (p.inVehicle) {
        m.step = 1;
        showToast(state, 'Nice wheels. Now drive to the garage.', 3);
      }
    } else if (dist2(p.x, p.z, SPOTS.garage.x, SPOTS.garage.z) < 100) {
      completeChapter(game);
    }
  } else if (ch === 2) {
    if (m.step === 0) {
      if (dist2(p.x, p.z, SPOTS.harbour.x, SPOTS.harbour.z) < 144) {
        m.step = 1;
        m.timer = 90;
        m.marker = { x: SPOTS.hideout.x, z: SPOTS.hideout.z, label: 'Hideout' };
        showToast(state, 'Package grabbed! 90 seconds to the hideout.', 3);
      }
    } else {
      m.timer -= dt;
      if (m.timer <= 0) {
        showToast(state, 'Too slow — the deal moved on. Try again.', 3);
        m.step = 0;
        m.marker = chapterMarker(game, 2);
      } else if (dist2(p.x, p.z, SPOTS.hideout.x, SPOTS.hideout.z) < 100) {
        completeChapter(game);
      }
    }
  } else if (ch === 3) {
    // getaway: survive a 3-star wanted level, then lose it
    if (m.step === 0) {
      if (game.police) game.police.commitCrime(game, 'massRampage');
      m.step = 1;
      showToast(state, '3 stars! Lose the heat.', 3);
    } else if (state.wanted === 0) {
      completeChapter(game);
    }
  } else if (ch === 4) {
    // pick up 3 passengers at the taxi stand, drop each at a marker
    // (drop-offs are street points, never building centres)
    const stops = [
      { x: 150, z: 112, label: 'Drop-off: fire station' },
      { x: -250, z: -210, label: 'Drop-off: suburbs' },
      { x: 250, z: 210, label: 'Drop-off: south beach' },
    ];
    if (m.step < 3) {
      const stop = stops[m.step];
      if (!m.pickedUp) {
        m.marker = { x: SPOTS.taxiStand.x, z: SPOTS.taxiStand.z, label: 'Pick up passenger ' + (m.step + 1) + '/3' };
        if (dist2(p.x, p.z, SPOTS.taxiStand.x, SPOTS.taxiStand.z) < 64) {
          m.pickedUp = true;
          m.marker = { x: stop.x, z: stop.z, label: stop.label };
          showToast(state, 'Passenger aboard — ' + stop.label, 3);
        }
      } else if (dist2(p.x, p.z, stop.x, stop.z) < 100) {
        m.pickedUp = false;
        m.step += 1;
        m.passengers += 1;
        addCash(state, 50);
        showToast(state, 'Fare +$50', 2);
      }
    } else {
      completeChapter(game);
    }
  } else if (ch === 5) {
    if (m.step === 0) {
      if (dist2(p.x, p.z, SPOTS.harbour.x, SPOTS.harbour.z) < 144) {
        m.step = 1;
        if (game.police) game.police.commitCrime(game, 'armedRobbery');
        state.wanted = Math.max(state.wanted, 4);
        m.marker = { x: SPOTS.safehouse.x, z: SPOTS.safehouse.z, label: 'Safehouse' };
        showToast(state, 'Cash grabbed! 4 stars — reach the safehouse.', 3);
      }
    } else if (m.step === 1) {
      if (state.wanted === 0) {
        m.step = 2;
        showToast(state, 'Heat is off. Get to the safehouse.', 3);
      }
    } else if (dist2(p.x, p.z, SPOTS.safehouse.x, SPOTS.safehouse.z) < 100) {
      completeChapter(game);
    }
  }
}

// Side-job markers are street points (never building centres).
// Exported: main.js's E dispatcher reads this same list.
export const SIDE_MARKERS = {
  taxi: { x: 0, z: 50 },
  courier: { x: -150, z: -106 },
  trial: { x: 100, z: -350 },
  turf: { x: -100, z: -100 },
  gangrun: { x: 100, z: 100 },
};

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
    timer: jobId === 'trial' ? 60 : 0,
    target: { x: mk.x, z: mk.z },
  };
  showToast(game.state, def.label + ' started — ' + def.desc, 3);
  return true;
}

function finishSideJob(game, success) {
  const m = game.missions;
  const job = m.active;
  if (!job) return;
  if (success) {
    addCash(game.state, job.reward);
    game.state.stats.sideJobsDone = (game.state.stats.sideJobsDone || 0) + 1;
    addRespect(game.state, 25);
    checkRespectUnlocks(game);
    showToast(game.state, job.label + ' done! +$' + job.reward, 3);
    notifyPhone(game, 'Rico', job.label + ' done! +$' + job.reward);
    if (game.audio) game.audio.play('win');
  } else {
    showToast(game.state, job.label + ' failed.', 3);
  }
  m.active = null;
  m.coolT = 5; // 5s restart cooldown — a job must not re-trigger on its own marker
}

function updateSideJob(game, dt) {
  const m = game.missions;
  const job = m.active;
  const p = game.player;
  if (!job) return;
  if (job.id === 'taxi') {
    // step 0: pick up at the stand (must be in a taxi or any car)
    if (job.step === 0) {
      if (dist2(p.x, p.z, 0, 50) < 64) {
        job.step = 1;
        // destination: a random road intersection (always reachable)
        const nodes = game.city.roadNodes;
        const node = nodes[Math.floor(Math.random() * nodes.length)];
        job.target = { x: node.x, z: node.z };
        showToast(game.state, 'Passenger in! Drive to the marker.', 3);
      }
    } else if (dist2(p.x, p.z, job.target.x, job.target.z) < 100) {
      if (game.state) game.state.stats.faresDone += 1;
      finishSideJob(game, true);
    }
  } else if (job.id === 'courier') {
    if (job.step === 0) {
      if (dist2(p.x, p.z, -150, -106) < 64) {
        job.step = 1;
        job.target = { x: 250, z: 210 };
        showToast(game.state, 'Parcel collected — deliver it south.', 3);
      }
    } else if (dist2(p.x, p.z, job.target.x, job.target.z) < 100) {
      finishSideJob(game, true);
    }
  } else if (job.id === 'trial') {
    job.timer -= dt;
    if (job.timer <= 0) {
      finishSideJob(game, false);
      return;
    }
    // 3 checkpoints in sequence
    const cps = [
      { x: 100, z: -100 },
      { x: -100, z: 100 },
      { x: 0, z: 0 },
    ];
    const cp = cps[Math.min(job.step, 2)];
    job.target = cp;
    if (dist2(p.x, p.z, cp.x, cp.z) < 100) {
      job.step += 1;
      showToast(game.state, 'Checkpoint ' + job.step + '/3', 2);
      if (job.step >= 3) finishSideJob(game, true);
    }
  } else if (job.id === 'turf') {
    // clear hostiles near the marker: count hostile gang members left
    const hostiles = game.gangs ? game.gangs.countHostile() : 0;
    if (job.step === 0) {
      if (dist2(p.x, p.z, -100, -100) < 400) {
        job.step = 1;
        if (game.gangs) game.gangs.spawnHostile(game, -100, -100, 4);
        showToast(game.state, 'Rivals incoming — clear them out!', 3);
      }
    } else if (hostiles <= 0) {
      finishSideJob(game, true);
    }
  } else if (job.id === 'gangrun') {
    if (job.step === 0) {
      if (dist2(p.x, p.z, 100, 100) < 64) {
        job.step = 1;
        job.target = { x: -250, z: -210 };
        showToast(game.state, 'Goods loaded — deliver to the north-west.', 3);
      }
    } else if (dist2(p.x, p.z, job.target.x, job.target.z) < 100) {
      finishSideJob(game, true);
    }
  }
}

export function sideJobMarker(game) {
  const m = game.missions;
  if (!m.active) return null;
  return { x: m.active.target.x, z: m.active.target.z, label: m.active.label };
}

export function missionMarker(game) {
  const m = game.missions;
  if (m.active) return sideJobMarker(game);
  return m.marker;
}
