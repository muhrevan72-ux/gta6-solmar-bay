// Solmar Bay — dating Maya (rebuild #13).
import { pushBox } from './render.js';
import { showDialogue } from './state.js';
import { SPAWNS } from './config.js';

export function mayaPos(g) {
  return { x: SPAWNS.beachHouse.x, z: SPAWNS.beachHouse.z };
}

export function tryDate(g) {
  const m = mayaPos(g);
  if (Math.hypot(g.player.x - m.x, g.player.z - m.z) > 6) return false;
  if (g.cash < 30) return false;
  g.cash -= 30;
  g.maya.onDate = true;
  g.maya.dateTimer = 0;
  return true;
}

export function dateAte(g, dt) {
  if (!g.maya.onDate) return;
  g.maya.dateTimer += dt;
  if (g.maya.dateTimer >= 20) {
    g.maya.onDate = false;
    g.maya.rel = Math.min(100, g.maya.rel + 25);
    if (g.maya.rel >= 75) {
      showDialogue(g, 'Maya', 'Beach House', 'The Sharks stash their cash in the harbour warehouse. Thought you should know.');
    }
  }
}

export function maybeMayaCall(g) {
  if (g.maya.rel < 50) return false;
  showDialogue(g, 'Maya', 'Beach House', 'Hey. The beach is quiet tonight — come by if you want.');
  return true;
}

// 7 boxes: dress, head, hair, arms 2, legs 2.
export function mayaBoxes(g, b, cam) {
  const m = mayaPos(g);
  const plain = [0, 0, 1, 1];
  let n = 0;
  const box = (x, y, z, w, h, d, col) => { pushBox(b, x, y, z, w, h, d, col, plain); n++; };
  box(m.x, 0.5, m.z, 0.7, 0.9, 0.4, [0.9, 0.4, 0.6]); // dress
  box(m.x - 0.45, 0.9, m.z, 0.18, 0.5, 0.18, [0.85, 0.65, 0.5]); // arm L
  box(m.x + 0.45, 0.9, m.z, 0.18, 0.5, 0.18, [0.85, 0.65, 0.5]); // arm R
  box(m.x, 1.4, m.z, 0.36, 0.36, 0.36, [0.85, 0.65, 0.5]); // head
  box(m.x, 1.72, m.z, 0.38, 0.2, 0.38, [0.3, 0.2, 0.1]); // hair
  box(m.x - 0.14, 0, m.z, 0.2, 0.5, 0.2, [0.85, 0.65, 0.5]); // leg L
  box(m.x + 0.14, 0, m.z, 0.2, 0.5, 0.2, [0.85, 0.65, 0.5]); // leg R
  return n;
}
