// Solmar Bay — dating.
//
// Maya lives near the beach house. Raise the relationship by
// taking her on dates (beach, restaurant, movie): each date
// costs $30 and adds +25 relationship. At 75+ she calls the
// player with tips (mission markers). The date itself is a short
// walk together, then a card.

import { SPAWNS } from './config.js';
import { pushBox } from './render.js';
import { tileUV } from './texture.js';
import { dist } from './config.js';
import { showToast, showDialogue } from './state.js';

export function mayaPos(game) {
  return { x: -300, z: 60 };
}

export function tryDate(game) {
  const p = game.player;
  const m = mayaPos(game);
  if (dist(p.x, p.z, m.x, m.z) > 6) return false;
  if (game.maya.onDate) return false;
  if (game.cash < 30) {
    showToast(game, 'A date costs $30 — you cannot afford it.');
    return false;
  }
  game.cash -= 30;
  game.maya.onDate = true;
  game.maya.stage = 0;
  showDialogue(game, 'Maya', 'Date', 'A walk on the beach? I like that. Let us go.');
  return true;
}

export function dateAte(game, dt) {
  if (!game.maya.onDate) return;
  game.maya.stage += dt;
  if (game.maya.stage > 20) {
    game.maya.onDate = false;
    game.maya.rel = Math.min(100, game.maya.rel + 25);
    showToast(game, `Date over — Maya likes you more (rel ${game.maya.rel})`);
    if (game.maya.rel >= 75) {
      showDialogue(game, 'Maya', 'Tip', 'I heard the Sharks are moving goods through the harbour tonight. Be careful out there.');
    }
  }
}

// Maya sometimes calls with a tip.
export function maybeMayaCall(game, rng) {
  if (game.maya.rel < 50) return false;
  if (Math.random() < 0.001) {
    game.messages.push({ from: 'Maya', text: 'The Kings are throwing a party downtown tonight. Free food if you show up!', t: game.time });
    game.unread += 1;
    return true;
  }
  return false;
}

export function mayaBoxes(game, b, cam) {
  const uv = tileUV('plain');
  const m = mayaPos(game);
  const p = game.player;
  // Maya walks beside the player during a date.
  const x = game.maya.onDate ? p.x + 1.5 : m.x;
  const z = game.maya.onDate ? p.z + 1 : m.z;
  pushBox(b, x - 0.15, 0, z, 0.28, 0.85, 0.28, [0.2, 0.25, 0.4], uv);
  pushBox(b, x + 0.15, 0, z, 0.28, 0.85, 0.28, [0.2, 0.25, 0.4], uv);
  pushBox(b, x, 0.85, z, 0.75, 0.7, 0.4, [1, 0.25, 0.6], uv);
  pushBox(b, x - 0.5, 0.9, z, 0.22, 0.65, 0.22, [0.95, 0.8, 0.65], uv);
  pushBox(b, x + 0.5, 0.9, z, 0.22, 0.65, 0.22, [0.95, 0.8, 0.65], uv);
  pushBox(b, x, 1.55, z, 0.45, 0.45, 0.45, [0.95, 0.8, 0.65], uv);
  pushBox(b, x, 1.9, z, 0.48, 0.2, 0.48, [0.25, 0.18, 0.1], uv);
  return 7;
}
