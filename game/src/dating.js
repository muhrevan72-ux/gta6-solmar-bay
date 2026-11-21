// Solmar Bay — dating Maya at the beach house.
// A date costs $30 and raises the relationship; at 75+ she
// shares a tip about the Sharks.

import { SPAWNS } from './config.js';
import { pushBox } from './render.js';
import { showDialogue, showToast } from './state.js';

export function mayaPos(g) {
  return { x: SPAWNS.beachHouse.x, z: SPAWNS.beachHouse.z };
}

export function tryDate(g) {
  const m = mayaPos(g);
  if (Math.hypot(g.player.x - m.x, g.player.z - m.z) > 4) return false;
  if (g.cash < 30) return false;
  g.cash -= 30;
  g.maya.onDate = true;
  g.maya.dateT = 0;
  showToast(g, 'Date with Maya — $30');
  return true;
}

// The date ends (called with the hour). Relationship +25.
export function dateAte(g, hour) {
  if (!g.maya.onDate) return false;
  g.maya.onDate = false;
  g.maya.rel = Math.min(100, g.maya.rel + 25);
  if (g.maya.rel >= 75) {
    showDialogue(g, 'Maya', 'Beach House', 'The Sharks are moving on the harbour tonight. Be careful out there.');
  } else {
    showDialogue(g, 'Maya', 'Beach House', 'That was lovely. Come back soon.');
  }
  return true;
}

// Maya only calls when the relationship is warm enough.
export function maybeMayaCall(g) {
  if (g.maya.rel < 20) return false;
  g.messages.push({ from: 'Maya', text: 'Thinking of you. The beach is quiet tonight.' });
  g.unread++;
  return true;
}

// Draw Maya (7 boxes).
export function mayaBoxes(g, batch) {
  const m = mayaPos(g);
  const plain = [0, 0, 1, 1];
  pushBox(batch, m.x - 0.14, 0, m.z, 0.24, 0.85, 0.24, [0.3, 0.4, 0.8]);
  pushBox(batch, m.x + 0.14, 0, m.z, 0.24, 0.85, 0.24, [0.3, 0.4, 0.8]);
  pushBox(batch, m.x, 0.85, m.z, 0.62, 0.65, 0.36, [0.95, 0.4, 0.5]);
  pushBox(batch, m.x - 0.4, 0.9, m.z, 0.2, 0.6, 0.2, [0.95, 0.4, 0.5]);
  pushBox(batch, m.x + 0.4, 0.9, m.z, 0.2, 0.6, 0.2, [0.95, 0.4, 0.5]);
  pushBox(batch, m.x, 1.5, m.z, 0.42, 0.42, 0.42, [0.9, 0.75, 0.6]);
  pushBox(batch, m.x, 1.86, m.z, 0.44, 0.35, 0.44, [0.5, 0.3, 0.1]);
  return 7;
}
