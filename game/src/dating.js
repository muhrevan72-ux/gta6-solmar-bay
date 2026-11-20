// Solmar Bay — dating Maya. She waits at the beach house (-300,60).
// A date costs $30 and, after 20 s, raises the relationship by 25.

import { SPAWNS } from './config.js';
import { pushBox } from './render.js';

export function mayaPos(g) {
  return { x: -300, z: 60 };
}

// Start a date with Maya ($30). Returns false without cash or
// when far from her.
export function tryDate(g) {
  const m = mayaPos(g);
  const d = Math.hypot(g.player.x - m.x, g.player.z - m.z);
  if (d > 6) return false;
  if (g.cash < 30) return false;
  g.cash -= 30;
  g.maya.onDate = true;
  g.maya.dateTimer = 20;
  g.dialogue = { name: 'Maya', role: 'Date', text: 'This is nice. Tell me about your day.', t: 10 };
  return true;
}

// Advance the date; after 20 s it ends and the relationship rises.
export function dateAte(g, dt) {
  if (!g.maya.onDate) return;
  g.maya.dateTimer -= dt;
  if (g.maya.dateTimer <= 0) {
    g.maya.onDate = false;
    g.maya.rel = Math.min(100, (g.maya.rel || 0) + 25);
    if (g.maya.rel >= 75) {
      g.dialogue = { name: 'Maya', role: 'Date', text: 'The Sharks are moving product through the harbour at night. Be careful.', t: 10 };
    } else {
      g.dialogue = { name: 'Maya', role: 'Date', text: 'That was lovely. Let\'s do it again sometime.', t: 10 };
    }
  }
}

// Maya sometimes calls with a tip — only at high relationship.
export function maybeMayaCall(g) {
  if ((g.maya.rel || 0) < 50) return false;
  if (Math.random() < 0.3) {
    g.dialogue = { name: 'Maya', role: 'Phone', text: 'The Sharks are at the harbour tonight.', t: 10 };
    return true;
  }
  return false;
}

// Maya's model: 7 boxes.
export function mayaBoxes(g, batch, cam) {
  const m = mayaPos(g);
  let n = 0;
  const box = (x, y, z, w, h, d, col) => { pushBox(batch, x, y, z, w, h, d, col); n++; };
  box(m.x - 0.18, 0, m.z, 0.32, 0.8, 0.32, [0.2, 0.3, 0.6]);
  box(m.x + 0.18, 0, m.z, 0.32, 0.8, 0.32, [0.2, 0.3, 0.6]);
  box(m.x, 0.8, m.z, 0.7, 0.6, 0.4, [0.9, 0.5, 0.6]);
  box(m.x - 0.5, 0.85, m.z, 0.22, 0.55, 0.22, [0.9, 0.5, 0.6]);
  box(m.x + 0.5, 0.85, m.z, 0.22, 0.55, 0.22, [0.9, 0.5, 0.6]);
  box(m.x, 1.4, m.z, 0.45, 0.4, 0.4, [0.9, 0.75, 0.6]);
  box(m.x, 1.75, m.z, 0.48, 0.15, 0.42, [0.3, 0.2, 0.12]);
  return n;
}
