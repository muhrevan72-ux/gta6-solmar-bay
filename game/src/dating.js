// Solmar Bay — dating (wholesome, GTA San Andreas style). Maya
// waits at her beach house. Press E to start a date: drive her to
// the viewpoint, eat together at a food shop, drop her home.
// Relationship 0–100% in the HUD; milestones give small bonuses.
// Dates, conversation and gifts only — nothing else.

import { dist2, clamp } from './config.js';
import { addCash, showToast } from './state.js';

export function createDating() {
  return {
    maya: { x: -310, z: 120, heading: 0, bob: 0 },
    onDate: false,
    stage: 0, // 0 idle, 1 drive to viewpoint, 2 eat together, 3 drive home
    progress: 0, // date progress 0..3 (mirrors stage for the HUD)
    ateTogether: false,
    inCar: false,
    giftT: 0,
  };
}

export function updateDating(game, dt) {
  const dating = game.dating;
  const p = game.player;
  const state = game.state;
  dating.giftT -= dt;
  const maya = dating.maya;
  maya.bob += dt * 2;

  if (!dating.onDate) {
    // Maya waits at the beach house, swaying gently
    maya.x = -310;
    maya.z = 120;
    return;
  }

  // Maya rides with the player (in the car, or follows on foot)
  if (p.inVehicle) {
    dating.inCar = true;
    maya.x = p.x - Math.sin(p.heading) * 1.5;
    maya.z = p.z - Math.cos(p.heading) * 1.5;
  } else if (dating.inCar) {
    dating.inCar = false;
    maya.x = p.x + 2;
    maya.z = p.z + 2;
  }

  if (dating.stage === 1) {
    // drive to the viewpoint on the beach road
    if (dist2(p.x, p.z, -320, -200) < 144) {
      dating.stage = 2;
      dating.progress = 1;
      showToast(state, 'What a view! Maya loved the drive. Now grab food together.', 3);
      state.relationship = clamp(state.relationship + 15, 0, 100);
    }
  } else if (dating.stage === 2) {
    if (dating.ateTogether) {
      dating.stage = 3;
      dating.progress = 2;
      showToast(state, 'Dinner was lovely. Take Maya home.', 3);
      state.relationship = clamp(state.relationship + 20, 0, 100);
    }
  } else if (dating.stage === 3) {
    if (dist2(p.x, p.z, -310, 120) < 100) {
      dating.onDate = false;
      dating.stage = 0;
      dating.ateTogether = false;
      dating.progress = 3;
      state.relationship = clamp(state.relationship + 25, 0, 100);
      showToast(state, 'Date complete! Relationship ' + Math.round(state.relationship) + '%', 4);
      if (game.audio) game.audio.play('win');
      // milestones: she gifts cash / tops up health
      if (state.relationship >= 50 && dating.giftT <= 0) {
        dating.giftT = 300;
        addCash(state, 100);
        showToast(state, 'Maya slipped you $100. Sweet!', 3);
      } else if (state.relationship >= 100) {
        state.health = 100;
        showToast(state, 'Maya topped up your health. True love!', 3);
      }
    }
  }
}

export function startDate(game) {
  const dating = game.dating;
  if (dating.onDate) return false;
  dating.onDate = true;
  dating.stage = 1;
  dating.ateTogether = false;
  dating.progress = 0;
  showToast(game.state, 'Date with Maya! Drive to the viewpoint on the beach road.', 3);
  if (game.audio) game.audio.play('mission');
  return true;
}

export function datingMarker(game) {
  const dating = game.dating;
  if (!dating.onDate) return { x: -310, z: 120, label: 'Maya' };
  if (dating.stage === 1) return { x: -320, z: -200, label: 'Viewpoint' };
  if (dating.stage === 2) return { x: -60, z: -40, label: 'Eat together' };
  return { x: -310, z: 120, label: 'Take Maya home' };
}

export function mayaBoxes(game) {
  const m = game.dating.maya;
  const bobY = Math.sin(m.bob) * 0.05;
  return [
    { x: m.x - 0.22, y: 0.4 + bobY, z: m.z, sx: 0.4, sy: 0.8, sz: 0.4, c: [0.3, 0.3, 0.5] },
    { x: m.x + 0.22, y: 0.4 + bobY, z: m.z, sx: 0.4, sy: 0.8, sz: 0.4, c: [0.3, 0.3, 0.5] },
    { x: m.x, y: 1.2 + bobY, z: m.z, sx: 0.9, sy: 0.8, sz: 0.5, c: [0.95, 0.4, 0.6] },
    { x: m.x, y: 1.85 + bobY, z: m.z, sx: 0.6, sy: 0.55, sz: 0.55, c: [0.9, 0.7, 0.55] },
    { x: m.x, y: 2.15 + bobY, z: m.z, sx: 0.66, sy: 0.22, sz: 0.62, c: [0.35, 0.2, 0.1] },
  ];
}
