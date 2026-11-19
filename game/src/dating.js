// Solmar Bay — dating (wholesome, GTA San Andreas style).
//
// Maya, the girlfriend NPC, waits at the beach house. Press E to
// start a date: drive her to the viewpoint, eat at a food shop
// together, drop her home. Relationship meter 0-100% in the HUD;
// milestones give small bonuses (she calls with a tip, tops up
// health, gifts cash). Dates, conversation and gifts only — nothing
// sexual.

import { dist2 } from './config.js';
import { addCash, addRespect, healPlayer, showToast, showDialogue } from './state.js';

export function createDating() {
  return {
    maya: { x: -310, z: 100, heading: 0 }, // beach house
    onDate: false,
    stage: 0, // 0 idle, 1 drive to viewpoint, 2 eat together, 3 drop home
    relationship: 0, // 0..100
    ateTogether: false,
    milestones: {}, // 25/50/75/100 claimed
  };
}

export function startDate(game) {
  const d = game.dating;
  if (d.onDate) return false;
  d.onDate = true;
  d.stage = 1;
  d.ateTogether = false;
  showDialogue(game.state, 'Maya', 'Girlfriend', 'Take me somewhere with a view, then food. I\'m starving!', 6);
  showToast(game.state, 'Date with Maya: drive her to the viewpoint (-300, 250).', 4);
  return true;
}

const VIEWPOINT = { x: -300, z: 250 };
const MAYA_HOME = { x: -310, z: 100 };

export function stepDating(game, dt) {
  const d = game.dating;
  if (!d.onDate) return;
  const p = game.state.player;
  if (d.stage === 1) {
    if (dist2(p.x, p.z, VIEWPOINT.x, VIEWPOINT.z) < 144) {
      d.stage = 2;
      showDialogue(game.state, 'Maya', 'Girlfriend', 'Wow, look at that sunset. Now let\'s eat — any food shop!', 6);
      showToast(game.state, 'Viewpoint reached! Now eat together at a food shop.', 3);
    }
  } else if (d.stage === 2) {
    if (d.ateTogether) {
      d.stage = 3;
      showDialogue(game.state, 'Maya', 'Girlfriend', 'That was lovely. Take me home now?', 5);
      showToast(game.state, 'Dinner done! Drop Maya home at the beach house.', 3);
    }
  } else if (d.stage === 3) {
    if (dist2(p.x, p.z, MAYA_HOME.x, MAYA_HOME.z) < 100) {
      endDate(game, true);
    }
  }
}

function endDate(game, success) {
  const d = game.dating;
  d.onDate = false;
  d.stage = 0;
  d.ateTogether = false;
  if (success) {
    d.relationship = Math.min(100, d.relationship + 20);
    addRespect(game.state, 10);
    showDialogue(game.state, 'Maya', 'Girlfriend', 'Best date ever. See you soon!', 5);
    showToast(game.state, 'Date complete! Relationship ' + d.relationship + '% (+10 REP).', 3);
    // Milestones.
    for (const m of [25, 50, 75, 100]) {
      if (d.relationship >= m && !d.milestones[m]) {
        d.milestones[m] = true;
        if (m === 25) {
          showToast(game.state, 'Maya calls with a tip: a parked Comet is near the garage.', 4);
        } else if (m === 50) {
          healPlayer(game.state, 100);
          showToast(game.state, 'Maya patched you up. +100 HP!', 3);
        } else if (m === 75) {
          addCash(game.state, 200);
          showToast(game.state, 'Maya gifted you $200!', 3);
        } else if (m === 100) {
          addCash(game.state, 500);
          showToast(game.state, 'Maya: "You\'re my favourite criminal." +$500!', 4);
        }
      }
    }
  }
}

export function mayaBoxes(game, out) {
  const d = game.dating;
  // Maya: pink top, dark hair, standing at the beach house (or riding
  // with the player on a date — she follows the car).
  let x = d.maya.x;
  let z = d.maya.z;
  if (d.onDate && game.state.player.inCar) {
    const v = game.state.player.inCar;
    x = v.x - Math.sin(v.heading) * 1;
    z = v.z - Math.cos(v.heading) * 1;
  }
  out.pushBox(x, 0.45, z, 0.6, 0.9, 0.35, [0.25, 0.35, 0.6]);
  out.pushBox(x, 1.25, z, 0.8, 0.75, 0.42, [1.0, 0.5, 0.7]);
  out.pushBox(x, 1.95, z, 0.52, 0.52, 0.48, [0.95, 0.8, 0.65]);
  out.pushBox(x, 2.2, z, 0.54, 0.2, 0.5, [0.15, 0.1, 0.08]);
}

export { VIEWPOINT, MAYA_HOME };
