// Solmar Bay — dating Maya.
//
// Maya hangs out by the beach house at (-300, 60). A date costs $30
// and raises her relationship; a good dinner at 21:00 raises it more.
// High relationship unlocks warmer calls from her on the phone.

import { pushBox } from './render.js';
import { showDialogue, showToast } from './state.js';

export function mayaPos(g) {
  const m = (g && g.maya) || null;
  if (m) return { x: m.x, z: m.z };
  return { x: -300, z: 60 };
}

export function initMaya(g) {
  const p = mayaPos(g);
  g.maya = { x: p.x, z: p.z, rel: 0, onDate: false, heading: 0 };
  return g.maya;
}

export function tryDate(g) {
  const m = g.maya || initMaya(g);
  const d = Math.hypot(g.player.x - m.x, g.player.z - m.z);
  if (d > 6) return false;
  if (g.cash < 30) return false;
  g.cash -= 30;
  m.onDate = true;
  showDialogue(g, 'Maya', 'Date', 'A date! Let\'s meet for dinner at 21:00 — I know a great spot.');
  return true;
}

// Dinner is over: the date ends and the relationship grows.
export function dateAte(g, hour) {
  const m = g.maya || initMaya(g);
  if (!m.onDate) return false;
  if (hour < 21) return false;
  m.onDate = false;
  m.rel = Math.min(100, m.rel + 25);
  showDialogue(g, 'Maya', 'Date', 'That was lovely. We should do it again sometime.');
  return true;
}

// Maya rings sometimes when she likes you enough.
export function maybeMayaCall(g) {
  const m = g.maya || initMaya(g);
  if (m.rel < 50) return false;
  showDialogue(g, 'Maya', 'Call', 'Hey, it\'s Maya. Fancy a walk on the beach later?');
  return true;
}

// Maya: legs, torso, arms, head, hair.
export function mayaBoxes(g, b, cam) {
  const m = g.maya || initMaya(g);
  const plain = [0, 0, 1, 1];
  const skin = [0.85, 0.62, 0.45];
  const dress = [0.9, 0.3, 0.5];
  const hair = [0.2, 0.12, 0.08];
  pushBox(b, m.x - 0.09, 0, m.z, 0.15, 0.75, 0.15, skin, plain);
  pushBox(b, m.x + 0.09, 0, m.z, 0.15, 0.75, 0.15, skin, plain);
  pushBox(b, m.x, 0.75, m.z, 0.44, 0.55, 0.26, dress, plain);
  pushBox(b, m.x - 0.3, 0.8, m.z, 0.13, 0.5, 0.13, skin, plain);
  pushBox(b, m.x + 0.3, 0.8, m.z, 0.13, 0.5, 0.13, skin, plain);
  pushBox(b, m.x, 1.3, m.z, 0.3, 0.3, 0.3, skin, plain);
  pushBox(b, m.x, 1.58, m.z, 0.34, 0.14, 0.32, hair, plain);
  return 7;
}
