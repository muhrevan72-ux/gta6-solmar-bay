// Solmar Bay — dating (wholesome, GTA San Andreas style).
//
// Maya lives at the beach house. Press E near her to start a
// date: drive her to the viewpoint, eat at a food shop together,
// drop her home. Relationship 0–100% shows in the HUD;
// milestones give small bonuses (she tops up health, gifts
// cash, calls with a tip). Dates, conversation and gifts only —
// nothing sexual.

import { SPAWNS, dist } from './config.js';
import { showToast, showDialogue } from './state.js';

const VIEWPOINT = { x: -320, z: -180, label: 'Viewpoint' };

export function mayaPos(game) {
  return { x: SPAWNS.beachHouse.x, z: SPAWNS.beachHouse.z };
}

// Start / advance a date (E near Maya, or at the date stops).
export function tryDate(game) {
  const p = game.player;
  const maya = game.maya;
  const mp = mayaPos(game);
  if (!maya.onDate) {
    if (dist(p.x, p.z, mp.x, mp.z) < 5) {
      maya.onDate = true;
      maya.stage = 0;
      game.missionMarker = { x: VIEWPOINT.x, z: VIEWPOINT.z, label: 'Viewpoint with Maya' };
      showDialogue(game, 'Maya', 'Your girl', 'A drive to the viewpoint? I packed sandwiches. Let us go!');
      return true;
    }
    return false;
  }
  // On a date: stage 0 = drive to viewpoint, 1 = eat together,
  // 2 = drop her home.
  if (maya.stage === 0 && dist(p.x, p.z, VIEWPOINT.x, VIEWPOINT.z) < 8) {
    maya.stage = 1;
    maya.rel = Math.min(100, maya.rel + 10);
    showDialogue(game, 'Maya', 'Your girl', 'The sunset here is unreal. Let us grab food — I am starving.');
    const shop = game.city.shops[0];
    game.missionMarker = { x: shop.x, z: shop.z, label: 'Eat together' };
    return true;
  }
  if (maya.stage === 2 && dist(p.x, p.z, mp.x, mp.z) < 6) {
    endDate(game, true);
    return true;
  }
  return false;
}

// Called when the player eats while on a date.
export function dateAte(game) {
  const maya = game.maya;
  if (!maya.onDate || maya.stage !== 1) return;
  maya.stage = 2;
  maya.rel = Math.min(100, maya.rel + 10);
  const mp = mayaPos(game);
  game.missionMarker = { x: mp.x, z: mp.z, label: 'Drop Maya home' };
  showDialogue(game, 'Maya', 'Your girl', 'That was lovely. Take me home?');
}

function endDate(game, happy) {
  const maya = game.maya;
  maya.onDate = false;
  maya.stage = 0;
  game.missionMarker = null;
  if (happy) {
    maya.rel = Math.min(100, maya.rel + 10);
    if (maya.rel >= 50 && maya.rel < 100) {
      game.health = 100;
      showToast(game, 'Maya topped up your health (date bonus)');
    }
    if (maya.rel >= 100) {
      game.cash += 100;
      showToast(game, 'Maya gifted you $100 — she really likes you');
    }
    showToast(game, `Date over. Relationship ${maya.rel}%`);
  }
}

// Maya calls with a tip when the relationship passes 25%.
export function maybeMayaCall(game) {
  const maya = game.maya;
  if (maya.rel >= 25 && !maya.called) {
    maya.called = true;
    game.messages.push({ from: 'Maya', text: 'Heard the cops are heavy near the harbour tonight. Stay sharp. x' });
    game.unread += 1;
  }
}

// Draw Maya (pink dress) at the beach house when not on a date,
// or next to the player while dating.
export function mayaBoxes(game, out) {
  const maya = game.maya;
  const mp = maya.onDate ? { x: game.player.x + 1.5, z: game.player.z + 1 } : mayaPos(game);
  out.push({ x: mp.x, y: 0.85, z: mp.z, w: 0.7, h: 0.9, d: 0.45, c: [1.0, 0.4, 0.6] });
  out.push({ x: mp.x, y: 1.65, z: mp.z, w: 0.55, h: 0.55, d: 0.5, c: [0.95, 0.75, 0.6] });
  out.push({ x: mp.x, y: 1.95, z: mp.z, w: 0.6, h: 0.4, d: 0.5, c: [0.3, 0.2, 0.15] });
  out.push({ x: mp.x - 0.18, y: 0.15, z: mp.z, w: 0.3, h: 0.7, d: 0.3, c: [0.95, 0.85, 0.75] });
  out.push({ x: mp.x + 0.18, y: 0.15, z: mp.z, w: 0.3, h: 0.7, d: 0.3, c: [0.95, 0.85, 0.75] });
  return out;
}
