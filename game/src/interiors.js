// Solmar Bay — interiors: walk into a shop, walk back out.
// Written fresh for rebuild #18. Rooms live in a separate zone
// (x ~ 2000) so they never overlap the city.

import { FOOD_SHOPS, SPAWNS } from './config.js';
import { pushBox } from './render.js';

export const ROOMS = {
  pizza: { door: { x: 50, z: 90 }, origin: { x: 2000, z: 0 } },
  burger: { door: { x: -50, z: 30 }, origin: { x: 2100, z: 0 } },
  outfit: { door: { x: 90, z: 30 }, origin: { x: 2200, z: 0 } },
};

export function roomOrigin(name) {
  const r = ROOMS[name];
  return r ? { x: r.origin.x, z: r.origin.z } : null;
}

export function isInside(g) {
  return g.player.inside ? true : false;
}

export function tryInteriorDoor(g) {
  // Already inside: step back out to the door.
  if (g.player.inside) {
    const room = ROOMS[g.player.inside];
    if (room) {
      g.player.x = room.door.x;
      g.player.z = room.door.z;
    }
    g.player.inside = null;
    return null;
  }
  for (const [name, room] of Object.entries(ROOMS)) {
    const d = Math.hypot(g.player.x - room.door.x, g.player.z - room.door.z);
    if (d < 6) {
      g.player.inside = name;
      g.player.x = room.origin.x;
      g.player.z = room.origin.z;
      return name;
    }
  }
  return null;
}

export function tryInteriorCounter(g) {
  if (!g.player.inside) return false;
  const room = ROOMS[g.player.inside];
  if (!room) return false;
  const d = Math.hypot(g.player.x - room.origin.x, g.player.z - (room.origin.z + 3));
  if (d > 4) return false;
  if (g.player.inside === 'outfit') {
    g.modal = { kind: 'outfit', title: 'Vice Threads', lines: ['Pick a style, then buy'] };
  } else {
    const shop = g.player.inside === 'pizza' ? FOOD_SHOPS[0] : FOOD_SHOPS[1];
    g.modal = {
      kind: 'food',
      title: shop.name,
      lines: ['Snack — $5 (heal 10)', 'Meal — $10 (heal 30)', 'Feast — $15 (heal 100, +25 armour)'],
    };
  }
  return true;
}

// Keep the player inside the room bounds.
export function stepInteriors(g, dt) {
  if (!g.player.inside) return;
  const room = ROOMS[g.player.inside];
  if (!room) return;
  const o = room.origin;
  g.player.x = Math.max(o.x - 8, Math.min(o.x + 8, g.player.x));
  g.player.z = Math.max(o.z - 6, Math.min(o.z + 6, g.player.z));
}

// Draw all three rooms (floor, counter, shelf each) and return 3.
export function interiorBoxes(g, b, gl) {
  let n = 0;
  for (const name of Object.keys(ROOMS)) {
    const o = ROOMS[name].origin;
    pushBox(b, o.x, -0.1, o.z, 16, 0.2, 12, [0.7, 0.6, 0.5], [0, 0, 1, 1]);
    pushBox(b, o.x, 0, o.z + 3, 6, 1.1, 1.2, [0.85, 0.6, 0.3], [0, 0, 1, 1]);
    pushBox(b, o.x - 6, 0, o.z - 4, 3, 2.5, 1, [0.5, 0.4, 0.3], [0, 0, 1, 1]);
    pushBox(b, o.x + 6, 0, o.z - 4, 3, 2.5, 1, [0.5, 0.4, 0.3], [0, 0, 1, 1]);
    pushBox(b, o.x, 3, o.z - 5.5, 12, 3, 0.4, [0.9, 0.85, 0.75], [0, 0, 1, 1]);
    pushBox(b, o.x, 6, o.z, 16, 0.3, 12, [0.95, 0.9, 0.8], [0, 0, 1, 1]);
    n++;
  }
  return n;
}
