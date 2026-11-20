// Solmar Bay — dating Maya (rebuild #15).
// Maya lives at the beach house (-300, 60). A date costs $30;
// after 20 s the date ends and rel rises by 25 (capped at 100).
// At rel 75+ she shares a gang tip afterwards.

import { SPAWNS } from './config.js';
import { pushBoxRot } from './render.js';

export function mayaPos(g) {
  return { x: (g.maya && g.maya.x) ?? SPAWNS.beachHouse.x, z: (g.maya && g.maya.z) ?? SPAWNS.beachHouse.z };
}

export function tryDate(g) {
  const m = mayaPos(g);
  const d = Math.hypot(g.player.x - m.x, g.player.z - m.z);
  if (d > 6) return false;
  if (g.cash < 30) return false;
  g.cash -= 30;
  g.maya.onDate = true;
  g.maya.dateTimer = 20;
  g.player.onDate = true;
  return true;
}

export function dateAte(g, dt) {
  if (!g.maya.onDate) return;
  g.maya.dateTimer -= dt;
  if (g.maya.dateTimer <= 0) {
    g.maya.onDate = false;
    g.player.onDate = false;
    g.maya.rel = Math.min(100, (g.maya.rel || 0) + 25);
    if (g.maya.rel >= 75) {
      g.dialogue = { name: 'Maya', role: 'Beach', text: 'The Sharks are moving product through the harbour tonight. Be careful.', t: 5 };
    }
  }
}

export function maybeMayaCall(g) {
  if ((g.maya.rel || 0) < 50) return false;
  if (!g.messages) g.messages = [];
  g.messages.push({ from: 'Maya', text: 'Maya: Come see me at the beach house.' });
  g.unread = (g.unread || 0) + 1;
  return true;
}

// Maya: 7 boxes (dress, hair, head, arms, legs).
export function mayaBoxes(g, b, camera) {
  const m = mayaPos(g);
  const x = m.x;
  const z = m.z;
  const dress = [0.9, 0.4, 0.6];
  const skin = [0.85, 0.65, 0.5];
  const hair = [0.2, 0.12, 0.08];
  pushBoxRot(b, x, 0, z, 0.55, 1.35, 0.32, 0, dress); // dress
  pushBoxRot(b, x - 0.36, 0.95, z, 0.16, 0.55, 0.16, 0, skin); // arm L
  pushBoxRot(b, x + 0.36, 0.95, z, 0.16, 0.55, 0.16, 0, skin); // arm R
  pushBoxRot(b, x - 0.12, 0, z, 0.2, 0.4, 0.2, 0, skin); // leg L
  pushBoxRot(b, x + 0.12, 0, z, 0.2, 0.4, 0.2, 0, skin); // leg R
  pushBoxRot(b, x, 1.35, z, 0.4, 0.4, 0.4, 0, skin); // head
  pushBoxRot(b, x, 1.73, z, 0.42, 0.14, 0.42, 0, hair); // hair
  return 7;
}
