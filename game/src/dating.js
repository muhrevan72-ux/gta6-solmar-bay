// Solmar Bay — dating Maya.
//
// Maya lives by the beach house (-300, 60). A date costs $30 and
// lasts 20 s; afterwards the relationship rises by 25 (capped at
// 100), and at 75+ she shares a tip. She calls the player once the
// relationship is warm enough.

import { SPAWNS } from './config.js';
import { pushBox } from './render.js';

export function mayaPos(g) {
  return { x: (g.maya && g.maya.x) || -300, z: (g.maya && g.maya.z) || 60 };
}

export function tryDate(g) {
  const m = mayaPos(g);
  if (Math.hypot(g.player.x - m.x, g.player.z - m.z) > 4) return false;
  if ((g.cash || 0) < 30) return false;
  g.cash -= 30;
  g.maya.onDate = true;
  g.maya.dateT = 0;
  return true;
}

export function dateAte(g, dt) {
  if (!g.maya.onDate) return;
  g.maya.dateT = (g.maya.dateT || 0) + dt;
  if (g.maya.dateT < 20) return;
  g.maya.onDate = false;
  g.maya.dateT = 0;
  g.maya.rel = Math.min(100, (g.maya.rel || 0) + 25);
  if (g.maya.rel >= 75) {
    g.dialogue = {
      name: 'Maya',
      role: 'Beach House',
      text: 'The Sharks run the harbour at night — stay clear of the docks after dark.',
      t: 10,
    };
  }
}

export function maybeMayaCall(g) {
  if ((g.maya.rel || 0) < 50) return false;
  if ((g._mayaCallCd || 0) > 0) return false;
  g._mayaCallCd = 300;
  g.messages = g.messages || [];
  g.messages.push({ from: 'Maya', text: 'Hey, come by the beach house when you are free.', t: g.time || 0 });
  g.unread = (g.unread || 0) + 1;
  return true;
}

// Maya: dress, hair, head, 2 arms, 2 legs — 7 boxes.
export function mayaBoxes(g, b, camera) {
  const m = mayaPos(g);
  const skin = [0.85, 0.65, 0.5];
  const dress = [0.9, 0.4, 0.6];
  let n = 0;
  const put = (x, y, z, w, h, d, col) => { pushBox(b, x, y, z, w, h, d, col); n++; };
  put(m.x, 0.7, m.z, 0.55, 1.0, 0.35, dress); // dress
  put(m.x, 1.5, m.z, 0.4, 0.4, 0.4, skin); // head
  put(m.x, 1.88, m.z, 0.44, 0.18, 0.44, [0.3, 0.2, 0.1]); // hair
  put(m.x - 0.36, 0.9, m.z, 0.18, 0.55, 0.18, skin); // left arm
  put(m.x + 0.36, 0.9, m.z, 0.18, 0.55, 0.18, skin); // right arm
  put(m.x - 0.14, 0.15, m.z, 0.22, 0.3, 0.22, skin); // left leg
  put(m.x + 0.14, 0.15, m.z, 0.22, 0.3, 0.22, skin); // right leg
  return n;
}
