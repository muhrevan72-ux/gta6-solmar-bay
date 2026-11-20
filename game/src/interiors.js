// Solmar Bay — interiors.
//
// Three rooms (pizza, burger, outfit) live far off the map at
// z=380 so they never collide with the street. E at a street door
// steps inside (teleported to the room origin); E again steps back
// out. The counter at the back of a room opens its menu.

import { FOOD_SHOPS, SPAWNS } from './config.js';
import { pushBox } from './render.js';

export const ROOMS = {
  pizza: {
    door: { x: FOOD_SHOPS[0].x, z: FOOD_SHOPS[0].z },
    origin: { x: 0, z: 380 },
  },
  burger: {
    door: { x: FOOD_SHOPS[1].x, z: FOOD_SHOPS[1].z },
    origin: { x: 30, z: 380 },
  },
  outfit: {
    door: { x: SPAWNS.outfitDoor.x, z: SPAWNS.outfitDoor.z },
    origin: { x: 60, z: 380 },
  },
};

export function roomOrigin(id) {
  return ROOMS[id] ? { ...ROOMS[id].origin } : null;
}

export function isInside(g) {
  return !!g.player.inside;
}

// E at a door: step inside (or back out when already inside).
export function tryInteriorDoor(g) {
  if (g.player.inside) {
    const room = ROOMS[g.player.inside];
    const exited = g.player.inside;
    if (room) {
      g.player.x = room.door.x;
      g.player.z = room.door.z;
    }
    g.player.inside = null;
    return exited;
  }
  for (const [id, room] of Object.entries(ROOMS)) {
    if (Math.hypot(g.player.x - room.door.x, g.player.z - room.door.z) < 4) {
      g.player.inside = id;
      g.player.x = room.origin.x;
      g.player.z = room.origin.z;
      return id;
    }
  }
  return null;
}

// The counter at the back of a room opens its menu.
export function tryInteriorCounter(g) {
  if (!g.player.inside) return false;
  const room = ROOMS[g.player.inside];
  if (!room) return false;
  const dx = Math.abs(g.player.x - room.origin.x);
  const dz = Math.abs(g.player.z - (room.origin.z + 3));
  if (dx > 2 || dz > 2) return false;
  if (g.player.inside === 'outfit') {
    g.modal = {
      kind: 'outfit',
      title: 'Outfit Shop',
      lines: ['Hair', 'Shirt', 'Pants', 'Shoes'],
    };
  } else {
    g.modal = {
      kind: 'food',
      title: g.player.inside === 'pizza' ? 'Pizza Palace' : 'Burger Barn',
      lines: ['1. Snack — $5 (+10 HP)', '2. Meal — $10 (+25 HP)', '3. Feast — $15 (full HP + 25 armour)'],
    };
  }
  return true;
}

// Keep the player inside the room's bounds.
export function stepInteriors(g, dt) {
  if (!g.player.inside) return;
  const room = ROOMS[g.player.inside];
  if (!room) return;
  g.player.x = Math.max(room.origin.x - 8, Math.min(room.origin.x + 8, g.player.x));
  g.player.z = Math.max(room.origin.z - 6, Math.min(room.origin.z + 6, g.player.z));
}

// Each room draws as a floor, walls and a counter — 3 rooms.
export function interiorBoxes(g, b, camera) {
  let n = 0;
  for (const room of Object.values(ROOMS)) {
    const o = room.origin;
    pushBox(b, o.x, 0, o.z, 16, 0.3, 12, [0.8, 0.75, 0.7]); n++; // floor
    pushBox(b, o.x, 0, o.z - 6, 16, 4, 0.4, [0.9, 0.85, 0.8]); n++; // back wall
    pushBox(b, o.x - 8, 0, o.z, 0.4, 4, 12, [0.9, 0.85, 0.8]); n++; // left wall
    pushBox(b, o.x + 8, 0, o.z, 0.4, 4, 12, [0.9, 0.85, 0.8]); n++; // right wall
    pushBox(b, o.x, 0, o.z + 3, 8, 1.1, 1.2, [0.6, 0.4, 0.25]); n++; // counter
  }
  return 3;
}
