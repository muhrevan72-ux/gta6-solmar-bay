// The story: five missions in order, then repeatable courier jobs.
// A mission is a list of steps; each step is a place to reach, a car to
// take, a timer to beat, or a wanted level to lose. No drawing, no browser:
// the game loop reads currentObjective() and missionMarker() for the HUD.
import { dist2 } from './config.js';

// Step types:
//  enterCar — get into any car (stealing is the point)
//  goto     — reach the marked place
//  timed    — reach the marked place before the timer runs out
//  escape   — get the wanted level down to zero before the timer runs out
export const MISSIONS = [
  {
    id: 'first-wheels',
    name: 'First Wheels',
    reward: 200,
    intro: 'Mara (garage): "Rook, you owe me a favour. Take any car off the street and bring it to my garage."',
    steps: [
      { type: 'enterCar', text: 'Steal a car — any car will do' },
      { type: 'goto', point: 'garage', r: 90, text: "Drive to Mara's garage" },
    ],
  },
  {
    id: 'the-package',
    name: 'The Package',
    reward: 400,
    intro: 'Mara: "A package is waiting at the plaza. Pick it up, run it to the harbour — and do not keep the buyer waiting."',
    steps: [
      { type: 'goto', point: 'plaza', r: 70, text: 'Pick up the package at the plaza' },
      { type: 'timed', point: 'harbour', r: 80, time: 75, text: 'Deliver to the harbour — 75 seconds!' },
    ],
  },
  {
    id: 'getaway',
    name: 'Getaway',
    reward: 500,
    intro: 'Detective Hale is onto you. Mara: "They saw the car, Rook. Lose them — all of them — before they box you in."',
    steps: [
      { type: 'escape', time: 120, text: 'Lose the cops — wanted level to zero' },
    ],
  },
  {
    id: 'night-run',
    name: 'Night Run',
    reward: 600,
    intro: 'Vic: "My drivers are all in holding. Run three fares across the bay tonight and the harbour job is yours."',
    steps: [
      { type: 'goto', point: 'beach', r: 70, text: 'Pick up the first fare at the beach road' },
      { type: 'goto', point: 'downtown', r: 70, text: 'Pick up the second fare downtown' },
      { type: 'goto', point: 'hospital', r: 70, text: 'Pick up the last fare at the hospital' },
    ],
  },
  {
    id: 'the-big-one',
    name: 'The Big One',
    reward: 1500,
    intro: 'Vic: "The harbour cash is unguarded for ten minutes. Grab it, then get to the safehouse. Do not get caught."',
    steps: [
      { type: 'goto', point: 'harbour', r: 70, text: 'Grab the cash at the harbour' },
      { type: 'goto', point: 'safehouse', r: 90, text: 'Reach the safehouse' },
    ],
  },
];

export function makeMissionState() {
  return {
    index: 0, // which mission in MISSIONS; >= length means free roam
    step: 0,
    timer: 0,
    phase: 'idle', // 'idle' | 'active' | 'done'
    banner: '',
    bannerT: 0,
    intro: '',
    introT: 0,
    job: null, // repeatable courier job in free roam
    jobTimer: 0,
  };
}

function pointOf(world, step) {
  return step.point ? world.points[step.point] : { x: step.x, y: step.y };
}

export function currentMission(state) {
  return state.mission.index < MISSIONS.length ? MISSIONS[state.mission.index] : null;
}

export function currentStep(state) {
  const mission = currentMission(state);
  if (!mission) return null;
  return mission.steps[state.mission.step] || null;
}

export function startMission(state, index) {
  const mission = MISSIONS[index];
  if (!mission) return;
  state.mission.index = index;
  state.mission.step = 0;
  state.mission.phase = 'active';
  const step = mission.steps[0];
  state.mission.timer = step.time || 0;
  state.mission.intro = `${mission.name} — ${mission.intro}`;
  state.mission.introT = 6;
  state.mission.banner = '';
  state.mission.bannerT = 0;
  // The getaway starts hot: the law is already looking.
  if (mission.id === 'getaway') state.wanted = Math.max(state.wanted, 3);
}

function failMission(state, reason) {
  const mission = currentMission(state);
  state.mission.banner = `Mission failed — ${reason}. Try again.`;
  state.mission.bannerT = 4;
  state.mission.phase = 'active';
  state.mission.step = 0;
  const step = mission ? mission.steps[0] : null;
  state.mission.timer = step && step.time ? step.time : 0;
  state.mission.intro = '';
  state.mission.introT = 0;
}

function completeMission(state) {
  const mission = currentMission(state);
  state.cash += mission.reward;
  state.stats.missionsDone += 1;
  state.mission.banner = `Mission complete: ${mission.name}  +$${mission.reward}`;
  state.mission.bannerT = 4;
  state.mission.index += 1;
  state.mission.step = 0;
  state.mission.phase = state.mission.index < MISSIONS.length ? 'idle' : 'done';
  state.mission.timer = 0;
  state.mission.intro = state.mission.index < MISSIONS.length
    ? ''
    : 'Story complete — Solmar Bay is yours. Courier jobs keep paying.';
  state.mission.introT = state.mission.index < MISSIONS.length ? 0 : 6;
}

function nextStep(state) {
  const mission = currentMission(state);
  state.mission.step += 1;
  if (state.mission.step >= mission.steps.length) {
    completeMission(state);
    return;
  }
  const step = mission.steps[state.mission.step];
  state.mission.timer = step.time || 0;
  // Grabbing the harbour cash in the final mission brings the heat.
  if (mission.id === 'the-big-one' && state.mission.step === 1) {
    state.wanted = Math.max(state.wanted, 4);
  }
}

export function updateMissions(state, dt) {
  const m = state.mission;
  if (m.bannerT > 0) m.bannerT -= dt;
  if (m.introT > 0) m.introT -= dt;

  // Free roam: a courier job pays for each delivery.
  if (m.phase === 'done' && !m.job) {
    m.job = { point: randomJobPoint(state), reward: 150, done: false };
    m.jobTimer = 0;
  }
  if (m.phase === 'done' && m.job) {
    const p = state.player;
    const d = dist2(p.x, p.y, m.job.point.x, m.job.point.y);
    if (d < 80 * 80) {
      state.cash += m.job.reward;
      m.banner = `Courier job done  +$${m.job.reward}`;
      m.bannerT = 3;
      m.job = null;
    }
    return;
  }

  if (m.phase !== 'active') return;
  const mission = currentMission(state);
  if (!mission) return;
  const step = currentStep(state);
  if (!step) return;

  if (step.time) {
    m.timer -= dt;
    if (m.timer <= 0) {
      failMission(state, 'out of time');
      return;
    }
  }

  const player = state.player;
  if (step.type === 'enterCar') {
    if (!player.onFoot) nextStep(state);
  } else if (step.type === 'goto' || step.type === 'timed') {
    const p = pointOf(state.world, step);
    const d = dist2(player.x, player.y, p.x, p.y);
    if (d < step.r * step.r) nextStep(state);
  } else if (step.type === 'escape') {
    if (state.wanted === 0) nextStep(state);
  }
}

function randomJobPoint(state) {
  // A job must be a drive away, never under the player's feet: a job
  // that spawns where the player already stands would pay out for
  // nothing on the same frame it appears.
  const far = Object.values(state.world.points).filter((p) => {
    const dx = p.x - state.player.x;
    const dy = p.y - state.player.y;
    return dx * dx + dy * dy > 300 * 300;
  });
  const points = far.length > 0 ? far : Object.values(state.world.points);
  return points[Math.floor(Math.random() * points.length)];
}

// The objective line the HUD shows.
export function currentObjective(state) {
  const m = state.mission;
  if (m.phase === 'done' && m.job) return `Courier job: deliver to the marker  (+$${m.job.reward})`;
  if (m.phase === 'done') return 'Free roam — Solmar Bay is yours.';
  const mission = currentMission(state);
  if (!mission) return '';
  if (m.phase === 'idle') return `${mission.name} — press Enter to start the mission.`;
  const step = currentStep(state);
  if (!step) return mission.name;
  if (step.type === 'timed' || step.type === 'escape') {
    return `${mission.name}: ${step.text}  (${Math.ceil(m.timer)}s)`;
  }
  return `${mission.name}: ${step.text}`;
}

// The map marker for the current step or job, or null.
export function missionMarker(state) {
  const m = state.mission;
  if (m.phase === 'done' && m.job) return m.job.point;
  if (m.phase !== 'active') return null;
  const step = currentStep(state);
  if (!step || step.type === 'enterCar' || step.type === 'escape') return null;
  return pointOf(state.world, step);
}
