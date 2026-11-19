// Solmar Bay — missions: 5 sequential story CHAPTERS with titles and
// story text, plus repeatable SIDE missions (taxi, courier, time
// trial) from green markers once chapter 1 is done.

import { MISSION_REWARDS, COL, WANTED } from './config.js';
import { MODES } from './state.js';

export const CHAPTERS = [
  {
    title: 'Chapter 1 — First Wheels',
    text: 'You just got out of the county lockup with $150 and a grudge. Solmar Bay is yours for the taking — but first, you need wheels. Any wheels.',
    reward: MISSION_REWARDS.chapter1,
  },
  {
    title: 'Chapter 2 — The Package',
    text: 'Marlo the fixer has a job: pick up a package downtown and deliver it across town. The clock is ticking and the cops are bored.',
    reward: MISSION_REWARDS.chapter2,
  },
  {
    title: 'Chapter 3 — Getaway',
    text: 'The delivery went sideways. Three stars on your head and every cop in Solmar Bay wants a piece of you. Lose them.',
    reward: MISSION_REWARDS.chapter3,
  },
  {
    title: 'Chapter 4 — Night Run',
    text: 'Word is out: you drive. Three fares across the city, no questions asked. Pick them up, drop them off, get paid.',
    reward: MISSION_REWARDS.chapter4,
  },
  {
    title: 'Chapter 5 — The Big One',
    text: 'The harbour vault. One last job, $1,500 in cash, and four stars of heat between you and the safehouse. Make it count.',
    reward: MISSION_REWARDS.chapter5,
  },
];

const CHAPTER_MARKERS = {
  garage: { x: 24, z: 62 },
  packagePickup: { x: -88, z: 44 },
  packageDrop: { x: 200, z: 200 },
  safehouse: { x: -120, z: -300 },
  harbourCash: { x: 350, z: 300 },
};

const TAXI_SPOTS = [
  { pick: [-88, 88], drop: [88, -88] },
  { pick: [200, -88], drop: [-132, 132] },
  { pick: [-200, 200], drop: [60, 200] },
];

const SIDE_MARKERS = [
  { type: 'taxi', x: -44, z: 0, label: 'Taxi fare' },
  { type: 'courier', x: 260, z: 260, label: 'Courier run' },
  { type: 'timeTrial', x: 345, z: -160, label: 'Time trial' },
];

export function createMissions() {
  return {
    chapter: 0,
    step: 0,
    marker: null,      // {x,z,label}
    timer: 0,
    side: null,        // {type,step,marker,timer,passenger}
    sideCooldown: 0,
    leg: 0,
    introT: 0,
  };
}

function setMarker(missions, x, z, label) {
  missions.marker = { x, z, label };
}

export function startChapter(game, idx) {
  const m = game.missions;
  const state = game.state;
  m.chapter = idx;
  m.step = 0;
  m.leg = 0;
  m.timer = 0;
  m.marker = null;
  const ch = CHAPTERS[idx];
  state.chapterTitle = ch.title;
  state.chapterText = ch.text;
  state.chapterActive = true;
  state.mode = MODES.CHAPTER;
  m.introT = 0;
  game.audio.jingle();
  if (idx === 0) {
    state.objective = 'Steal a car.';
  } else if (idx === 1) {
    state.objective = 'Pick up the package downtown.';
    setMarker(m, CHAPTER_MARKERS.packagePickup.x, CHAPTER_MARKERS.packagePickup.z, 'Package');
  } else if (idx === 2) {
    state.objective = 'Lose the 3-star wanted level!';
    state.wanted = 3;
    state.wantedTimer = 0;
    game.audio.sirenStart();
    m.timer = 150;
  } else if (idx === 3) {
    state.objective = 'Pick up the first passenger.';
    spawnPassenger(game, TAXI_SPOTS[0].pick);
    setMarker(m, TAXI_SPOTS[0].pick[0], TAXI_SPOTS[0].pick[1], 'Passenger');
  } else if (idx === 4) {
    state.objective = 'Get to the harbour and grab the cash.';
    setMarker(m, CHAPTER_MARKERS.harbourCash.x, CHAPTER_MARKERS.harbourCash.z, 'Harbour cash');
  }
}

function spawnPassenger(game, at) {
  const ped = {
    x: at[0], z: at[1], heading: 0, speed: 0, state: 'passenger',
    health: 100, shirt: COL.marker, target: null, fleeT: 0, deadT: 0, walkPhase: 0,
  };
  game.peds.list.push(ped);
  return ped;
}

function completeChapter(game) {
  const m = game.missions;
  const state = game.state;
  const reward = CHAPTERS[m.chapter].reward;
  state.cash += reward;
  state.stats.missionsDone++;
  const next = m.chapter + 1;
  state.chapter = next;
  state.chapterActive = false;
  game.audio.jingle();
  game.toast('Chapter complete! +$' + reward);
  m.marker = null;
  m.side = null;
  if (next >= CHAPTERS.length) {
    state.objective = 'Story complete — Solmar Bay is yours. Free roam!';
    state.mode = MODES.COMPLETE;
    return;
  }
  startChapter(game, next);
}

function failChapter(game, why) {
  const m = game.missions;
  const state = game.state;
  game.toast('Mission failed: ' + why + ' — try again.');
  state.wanted = 0;
  game.vehicles.list = game.vehicles.list.filter((v) => !v.police);
  game.police.cops = [];
  game.audio.sirenStop();
  // remove any waiting passenger
  game.peds.list = game.peds.list.filter((p) => p.state !== 'passenger');
  startChapter(game, m.chapter);
}

function nearPlayer(game, x, z, r) {
  const p = game.player;
  const px = p.inVehicle ? p.inVehicle.x : p.x;
  const pz = p.inVehicle ? p.inVehicle.z : p.z;
  return Math.hypot(px - x, pz - z) < r;
}

export function updateMissions(dt, game) {
  const m = game.missions;
  const state = game.state;
  const p = game.player;
  if (state.mode !== 'playing') return;
  if (m.sideCooldown > 0) m.sideCooldown -= dt;

  // ---- story chapters ----
  if (state.chapterActive && m.chapter < CHAPTERS.length) {
    if (m.chapter === 0) {
      if (m.step === 0) {
        if (p.inVehicle) {
          m.step = 1;
          state.objective = 'Drive to the garage.';
          setMarker(m, CHAPTER_MARKERS.garage.x, CHAPTER_MARKERS.garage.z, 'Garage');
        }
      } else if (nearPlayer(game, CHAPTER_MARKERS.garage.x, CHAPTER_MARKERS.garage.z, 7)) {
        completeChapter(game);
        return;
      }
    } else if (m.chapter === 1) {
      if (m.step === 0) {
        if (nearPlayer(game, CHAPTER_MARKERS.packagePickup.x, CHAPTER_MARKERS.packagePickup.z, 5)) {
          m.step = 1;
          m.timer = 90;
          state.objective = 'Deliver the package — 90 seconds!';
          setMarker(m, CHAPTER_MARKERS.packageDrop.x, CHAPTER_MARKERS.packageDrop.z, 'Deliver here');
          game.audio.blip(880, 0.15);
        }
      } else {
        m.timer -= dt;
        state.objective = 'Deliver the package — ' + Math.ceil(m.timer) + 's left!';
        if (nearPlayer(game, CHAPTER_MARKERS.packageDrop.x, CHAPTER_MARKERS.packageDrop.z, 7)) {
          completeChapter(game);
          return;
        }
        if (m.timer <= 0) { failChapter(game, 'the package was late'); return; }
      }
    } else if (m.chapter === 2) {
      m.timer -= dt;
      state.objective = 'Lose the cops! ' + Math.ceil(m.timer) + 's left — wanted: ' + state.wanted + '★';
      if (state.wanted === 0) { completeChapter(game); return; }
      if (m.timer <= 0) { failChapter(game, 'the cops caught up'); return; }
    } else if (m.chapter === 3) {
      const spot = TAXI_SPOTS[m.leg];
      if (m.step === 0) {
        if (p.inVehicle && nearPlayer(game, spot.pick[0], spot.pick[1], 4)) {
          // passenger boards
          game.peds.list = game.peds.list.filter((pd) => pd.state !== 'passenger');
          m.step = 1;
          state.objective = 'Drop the passenger at the marker.';
          setMarker(m, spot.drop[0], spot.drop[1], 'Drop-off');
          game.audio.blip(880, 0.15);
        }
      } else if (p.inVehicle && nearPlayer(game, spot.drop[0], spot.drop[1], 7)) {
        m.leg++;
        if (m.leg >= TAXI_SPOTS.length) { completeChapter(game); return; }
        m.step = 0;
        spawnPassenger(game, TAXI_SPOTS[m.leg].pick);
        state.objective = 'Pick up passenger ' + (m.leg + 1) + ' of 3.';
        setMarker(m, TAXI_SPOTS[m.leg].pick[0], TAXI_SPOTS[m.leg].pick[1], 'Passenger');
      } else if (!p.inVehicle && m.step === 1) {
        state.objective = 'Get back in the car — the fare is waiting!';
      }
    } else if (m.chapter === 4) {
      if (m.step === 0) {
        if (nearPlayer(game, CHAPTER_MARKERS.harbourCash.x, CHAPTER_MARKERS.harbourCash.z, 6)) {
          m.step = 1;
          m.timer = 240;
          state.wanted = 4;
          state.wantedTimer = 0;
          game.audio.sirenStart();
          state.objective = 'Cash grabbed! Lose the heat, reach the safehouse.';
          setMarker(m, CHAPTER_MARKERS.safehouse.x, CHAPTER_MARKERS.safehouse.z, 'Safehouse');
          game.audio.jingle();
        }
      } else {
        m.timer -= dt;
        state.objective = 'Reach the safehouse — ' + Math.ceil(m.timer) + 's left, wanted: ' + state.wanted + '★';
        if (nearPlayer(game, CHAPTER_MARKERS.safehouse.x, CHAPTER_MARKERS.safehouse.z, 7)) {
          completeChapter(game);
          return;
        }
        if (m.timer <= 0) { failChapter(game, 'you ran out of time'); return; }
      }
    }
  }

  // ---- side missions ----
  if (!m.side && state.chapter >= 1 && m.sideCooldown <= 0 && !state.chapterActive) {
    for (const s of SIDE_MARKERS) {
      if (nearPlayer(game, s.x, s.z, 5)) {
        startSide(game, s.type);
        break;
      }
    }
  }
  if (m.side) updateSide(dt, game);
}

function startSide(game, type) {
  const m = game.missions;
  const city = game.city;
  const node = () => city.nodes[Math.floor(Math.random() * city.nodes.length)];
  if (type === 'taxi') {
    const pick = node(), drop = node();
    spawnPassenger(game, [pick.x + 8, pick.z + 8]);
    m.side = { type, step: 0, pick, drop, timer: 0 };
    setMarker(m, pick.x + 8, pick.z + 8, 'Passenger');
    game.state.objective = 'Side job: pick up the taxi fare.';
    game.toast('Taxi fare — pick up the passenger.');
  } else if (type === 'courier') {
    const drop = node();
    m.side = { type, step: 0, drop, timer: 60 };
    setMarker(m, drop.x, drop.z, 'Courier drop');
    game.state.objective = 'Side job: deliver the courier package — 60s!';
    game.toast('Courier run — deliver fast!');
  } else if (type === 'timeTrial') {
    const marks = [node(), node(), node()];
    m.side = { type, step: 0, marks, timer: 75 };
    setMarker(m, marks[0].x, marks[0].z, 'Checkpoint 1/3');
    game.state.objective = 'Side job: hit 3 checkpoints — 75s!';
    game.toast('Time trial — go!');
  }
  game.audio.blip(990, 0.12);
}

function updateSide(dt, game) {
  const m = game.missions;
  const s = m.side;
  const state = game.state;
  const p = game.player;
  if (s.type === 'taxi') {
    if (s.step === 0) {
      if (p.inVehicle && nearPlayer(game, s.pick.x + 8, s.pick.z + 8, 4)) {
        game.peds.list = game.peds.list.filter((pd) => pd.state !== 'passenger');
        s.step = 1;
        setMarker(m, s.drop.x, s.drop.z, 'Drop-off');
        state.objective = 'Side job: drop the fare off.';
      }
    } else if (p.inVehicle && nearPlayer(game, s.drop.x, s.drop.z, 7)) {
      finishSide(game, MISSION_REWARDS.taxi, 'Taxi fare done! +$120');
    }
  } else if (s.type === 'courier') {
    s.timer -= dt;
    state.objective = 'Side job: deliver the package — ' + Math.ceil(s.timer) + 's left!';
    if (nearPlayer(game, s.drop.x, s.drop.z, 7)) {
      finishSide(game, MISSION_REWARDS.courier, 'Courier done! +$160');
    } else if (s.timer <= 0) {
      m.side = null; m.marker = null; m.sideCooldown = 20;
      state.objective = 'Free roam — find a side-job marker.';
      game.toast('Courier failed — too slow.');
    }
  } else if (s.type === 'timeTrial') {
    s.timer -= dt;
    state.objective = 'Side job: checkpoint ' + (s.step + 1) + '/3 — ' + Math.ceil(s.timer) + 's left!';
    const mark = s.marks[s.step];
    if (nearPlayer(game, mark.x, mark.z, 7)) {
      s.step++;
      if (s.step >= 3) {
        finishSide(game, MISSION_REWARDS.timeTrial, 'Time trial done! +$200');
      } else {
        setMarker(m, s.marks[s.step].x, s.marks[s.step].z, 'Checkpoint ' + (s.step + 1) + '/3');
        game.audio.blip(880, 0.1);
      }
    } else if (s.timer <= 0) {
      m.side = null; m.marker = null; m.sideCooldown = 20;
      state.objective = 'Free roam — find a side-job marker.';
      game.toast('Time trial failed.');
    }
  }
}

function finishSide(game, reward, text) {
  const m = game.missions;
  game.state.cash += reward;
  game.state.stats.sideDone++;
  m.side = null;
  m.marker = null;
  m.sideCooldown = 20;
  game.state.objective = game.state.chapterActive ? game.state.objective : 'Free roam — find a side-job marker.';
  game.toast(text);
  game.audio.jingle();
}

// ---- drawing: mission marker beam + side-job markers ----

export function drawMissions(renderer, game) {
  const m = game.missions;
  const t = game.time;
  if (m.marker) {
    const pulse = 1 + Math.sin(t * 4) * 0.15;
    renderer.box(m.marker.x, 5, m.marker.z, 1.1 * pulse, 10, 1.1 * pulse, 0, COL.marker, COL.marker);
    renderer.box(m.marker.x, 11 + Math.sin(t * 2) * 0.5, m.marker.z, 1.4, 1.4, 1.4, t, COL.marker, COL.marker);
  }
  // side-job markers (green) when free roaming after chapter 1
  if (!m.side && game.state.chapter >= 1 && !game.state.chapterActive && m.sideCooldown <= 0) {
    for (const s of SIDE_MARKERS) {
      renderer.box(s.x, 3, s.z, 0.8, 6, 0.8, 0, COL.markerGreen, COL.markerGreen);
      renderer.box(s.x, 6.5 + Math.sin(t * 2 + s.x) * 0.4, s.z, 1.0, 1.0, 1.0, t * 0.5, COL.markerGreen, COL.markerGreen);
    }
  }
}
