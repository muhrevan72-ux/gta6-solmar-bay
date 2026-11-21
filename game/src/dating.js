// Solmar Bay — dating Maya at the beach.
// Written fresh for rebuild #18.

import { pushBox } from './render.js';
import { showDialogue, showToast } from './state.js';
import { addCash } from './state.js';

export function mayaPos(g) {
  return { x: -300, z: 60 };
}

export function tryDate(g) {
  const m = mayaPos(g);
  const d = Math.hypot(g.player.x - m.x, g.player.z - m.z);
  if (d > 6) return false;
  if ((g.cash || 0) < 30) return false;
  g.cash -= 30;
  g.maya.onDate = true;
  g.maya.dateT = 0;
  showToast(g, 'Date with Maya — $30');
  return true;
}

export function dateAte(g, dt) {
  if (!g.maya || !g.maya.onDate) return;
  g.maya.dateT = (g.maya.dateT || 0) + dt;
  if (g.maya.dateT >= 20) {
    g.maya.onDate = false;
    g.maya.rel = Math.min(100, (g.maya.rel || 0) + 25);
    if (g.maya.rel >= 75) {
      showDialogue(g, 'Maya', 'Date', 'That was lovely. The Sharks are moving on the harbour tonight — stay away from the docks, okay?');
    } else {
      showDialogue(g, 'Maya', 'Date', 'That was nice. Let us do it again sometime.');
    }
  }
}

// Maya sometimes calls when the relationship is strong.
export function maybeMayaCall(g) {
  if (!g.maya) return false;
  if ((g.maya.rel || 0) < 50) return false;
  if (Math.random() > 0.02) return false;
  showDialogue(g, 'Maya', 'Call', 'Hey, it is Maya. Come by the beach when you are free.');
  return true;
}

// Maya: 7 boxes (legs, torso, arms, head, hair, dress, eyes).
export function mayaBoxes(g, b, gl) {
  const m = mayaPos(g);
  const skin = [0.85, 0.65, 0.5];
  const dress = [0.9, 0.3, 0.5];
  const hair = [0.2, 0.12, 0.08];
  pushBox(b, m.x - 0.12, 0, m.z, 0.22, 0.85, 0.22, skin, [0, 0, 1, 1]);
  pushBox(b, m.x + 0.12, 0, m.z, 0.22, 0.85, 0.22, skin, [0, 0, 1, 1]);
  pushBox(b, m.x, 0.85, m.z, 0.65, 0.7, 0.35, dress, [0, 0, 1, 1]);
  pushBox(b, m.x - 0.42, 0.9, m.z, 0.18, 0.55, 0.18, skin, [0, 0, 1, 1]);
  pushBox(b, m.x + 0.42, 0.9, m.z, 0.18, 0.55, 0.18, skin, [0, 0, 1, 1]);
  pushBox(b, m.x, 1.55, m.z, 0.34, 0.34, 0.34, skin, [0, 0, 1, 1]);
  pushBox(b, m.x, 1.87, m.z, 0.38, 0.12, 0.38, hair, [0, 0, 1, 1]);
  return 7;
}
