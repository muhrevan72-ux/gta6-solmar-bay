// Solmar Bay — dating (wholesome, GTA San Andreas style): a
// girlfriend, Maya, waits at the beach house. Press E to start a
// date: drive her to the viewpoint, eat at a food shop together,
// drop her home. Relationship 0–100% in the HUD; milestones give
// small bonuses. Dates, conversation and gifts only.

import { dist } from './config.js';
import { setToast, addCash } from './state.js';

export function createDating() {
  return {
    active: false,
    stage: 0, // 0 drive to viewpoint, 1 eat together, 2 drive home
    gf: { x: -335, z: -112, heading: 0, phase: 0 },
    milestone: 0, // highest milestone already paid out
  };
}

export function startDate(game) {
  const d = game.dating;
  d.active = true;
  d.stage = 0;
  game.state.objective = 'Date: drive Maya to the viewpoint.';
  setToast(game.state, 'Date with Maya! Drive her to the viewpoint.', 3);
  if (game.audio) game.audio.jingle();
}

function endDate(game, ok) {
  const d = game.dating;
  const state = game.state;
  d.active = false;
  if (!ok) {
    setToast(state, 'The date fell through...', 3);
    state.objective = state.chapterActive ? 'Continue the story.' : 'Free roam.';
    return;
  }
  state.relationship = Math.min(100, state.relationship + 25);
  state.stats.datesDone += 1;
  setToast(state, 'Great date! Relationship ' + state.relationship + '%', 4);
  if (game.audio) game.audio.jingle();
  // milestones
  const rel = state.relationship;
  if (rel >= 25 && d.milestone < 1) {
    d.milestone = 1;
    state.health = 100;
    setToast(state, 'Maya tops up your health!', 3);
  } else if (rel >= 50 && d.milestone < 2) {
    d.milestone = 2;
    addCash(state, 100);
    setToast(state, 'Maya gifts you $100!', 3);
  } else if (rel >= 75 && d.milestone < 3) {
    d.milestone = 3;
    setToast(state, 'Maya tips you off: a rare car is parked at the airport!', 4);
  } else if (rel >= 100 && d.milestone < 4) {
    d.milestone = 4;
    addCash(state, 250);
    setToast(state, 'Maya gifts you $250!', 3);
  }
  state.objective = state.chapterActive ? 'Continue the story.' : 'Free roam — find a side-job marker.';
}

export function updateDating(dt, game) {
  const d = game.dating;
  const state = game.state;
  const p = game.player;
  void dt;
  if (!d.active) {
    // Maya waits at the beach house
    d.gf.x = -335; d.gf.z = -112;
    return;
  }
  // she rides along: stands next to the player / in the car
  if (p.inVehicle) {
    d.gf.x = p.x; d.gf.z = p.z;
  } else {
    d.gf.x = p.x + 1.5; d.gf.z = p.z + 1.5;
  }
  // a date fails if the player gets busted-level heat
  if (state.wanted >= 3) { endDate(game, false); return; }
  const vp = game.city.spawns.viewpoint;
  const home = game.city.spawns.beachHouse;
  if (d.stage === 0) {
    if (dist(p.x, p.z, vp.x, vp.z) < 10) {
      d.stage = 1;
      state.objective = 'Date: eat together at a food shop.';
      setToast(state, 'Beautiful view! Now grab food together.', 3);
    }
  } else if (d.stage === 2) {
    if (dist(p.x, p.z, home.x, home.z) < 10) endDate(game, true);
  }
}

export function drawDating(renderer, game) {
  const d = game.dating;
  const bob = Math.sin(game.time * 5 + d.gf.phase) * 0.06;
  // Maya: pink outfit, dark hair
  renderer.box(d.gf.x, 0.4 + bob, d.gf.z, 0.45, 0.8, 0.45, [0.3, 0.3, 0.5], 1, d.gf.heading, 0, 0);
  renderer.box(d.gf.x, 1.15 + bob, d.gf.z, 0.9, 0.75, 0.5, [1, 0.45, 0.65], 1, d.gf.heading, 0, 0);
  renderer.box(d.gf.x, 1.8 + bob, d.gf.z, 0.55, 0.55, 0.55, [0.92, 0.75, 0.6], 1, d.gf.heading, 0, 0);
  renderer.box(d.gf.x, 2.15 + bob, d.gf.z, 0.6, 0.3, 0.6, [0.25, 0.15, 0.2], 1, d.gf.heading, 0, 0);
  if (!d.active) {
    // heart marker above her when she is waiting
    renderer.box(d.gf.x, 3 + bob, d.gf.z, 0.8, 0.8, 0.4, [1, 0.3, 0.5], 0.9, 0, game.time, 0);
  }
}
