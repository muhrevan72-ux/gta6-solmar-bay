// Solmar Bay — interiors (rebuild #14).
// Three rooms you can step into: Pizza Palace, Burger Barn and
// Vice Threads. E at the door walks in (teleport to the room);
// E inside walks back out. The counter inside a food room opens
// the menu; inside the outfit room it opens the shop.

import { FOOD_SHOPS } from './config.js';
import { FOOD_MENU } from './food.js';
import { OUTFIT } from './outfit.js';
import { pushBox } from './render.js';

export const ROOMS = {
  pizza: { name: 'Pizza Palace', door: { x: FOOD_SHOPS[0].x, z: FOOD_SHOPS[0].z }, origin: { x: -1000, z: -1000 } },
  burger: { name: 'Burger Barn', door: { x: FOOD_SHOPS[1].x, z: FOOD_SHOPS[1].z }, origin: { x: -1000, z: -980 } },
  outfit: { name: 'Vice Threads', door: { x: -120, z: 52 }, origin: { x: -1000, z: -960 } },
};

export function roomOrigin(name) {
  return ROOMS[name] ? ROOMS[name].origin : null;
}

export function isInside(g) {
  return !!g.player.inside;
}

export function tryInteriorDoor(g) {
  // Inside already — step back out to the street door.
  if (g.player.inside) {
    const room = ROOMS[g.player.inside];
    if (room) {
      g.player.x = room.door.x;
      g.player.z = room.door.z;
    }
    g.player.inside = null;
    return null;
  }
  for (const [key, room] of Object.entries(ROOMS)) {
    const d = Math.hypot(g.player.x - room.door.x, g.player.z - room.door.z);
    if (d < 5) {
      g.player.inside = key;
      g.player.x = room.origin.x;
      g.player.z = room.origin.z;
      return key;
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
    g.modal = { kind: 'outfit', title: 'Vice Threads', lines: Object.keys(OUTFIT).map((s) => `${s}: ${OUTFIT[s][g.player.outfit[s]].name}`) };
  } else {
    g.modal = { kind: 'food', title: room.name, lines: FOOD_MENU.map((m) => `${m.name} — $${m.price} · ${m.desc}`) };
  }
  return true;
}

export function stepInteriors(g, dt) {
  if (!g.player.inside) return;
  const room = ROOMS[g.player.inside];
  if (!room) return;
  g.player.x = Math.max(room.origin.x - 8, Math.min(room.origin.x + 8, g.player.x));
  g.player.z = Math.max(room.origin.z - 6, Math.min(room.origin.z + 6, g.player.z));
}

// All three rooms, drawn side by side for the count.
export function interiorBoxes(g, b, camera) {
  for (const room of Object.values(ROOMS)) {
    // Floor.
    pushBox(b, room.origin.x, -0.1, room.origin.z, 16, 0.2, 12, [0.7, 0.6, 0.5]);
    // Back wall.
    pushBox(b, room.origin.x, 0, room.origin.z - 6, 16, 3, 0.3, [0.85, 0.8, 0.7]);
    // Counter.
    pushBox(b, room.origin.x, 0, room.origin.z + 3, 6, 1, 1.5, [0.5, 0.35, 0.2]);
    // A table.
    pushBox(b, room.origin.x + 4, 0, room.origin.z - 2, 2, 0.8, 2, [0.6, 0.4, 0.25]);
  }
  return 3;
}
