// Solmar Bay — shop interiors.
//
// Three rooms — pizza, burger, outfit — each with a door in the world
// and an interior origin far outside the city. Walk through a door to
// step inside; press E at the counter to order (or try on clothes);
// press E anywhere else inside to step back out. Inside, the player
// is clamped to the room. ROOMS is a keyed map so callers can reach a
// room by id (ROOMS.pizza.door, ROOMS.burger.origin, ...).

import { pushBox } from './render.js';
import { FOOD_SHOPS, SPAWNS } from './config.js';

export const ROOMS = {
  pizza: { id: 'pizza', name: 'Pizza Palace', door: { x: FOOD_SHOPS[0].x, z: FOOD_SHOPS[0].z }, origin: { x: 500, z: 500 } },
  burger: { id: 'burger', name: 'Burger Barn', door: { x: FOOD_SHOPS[1].x, z: FOOD_SHOPS[1].z }, origin: { x: 560, z: 500 } },
  outfit: { id: 'outfit', name: 'Outfit Shop', door: { x: SPAWNS.outfitDoor.x, z: SPAWNS.outfitDoor.z }, origin: { x: 620, z: 500 } },
};

export function roomOrigin(id) {
  const room = ROOMS[id];
  return room ? { ...room.origin } : null;
}

// Which room the player is inside, if any. The player's own field
// is the source of truth (tests set it directly); g.inside mirrors it.
function insideRoom(g) {
  return (g.player && g.player.inside) || g.inside || null;
}

export function isInside(g) {
  return !!insideRoom(g);
}

export function stepInteriors(g, dt) {
  const id = insideRoom(g);
  if (!id) return;
  const origin = roomOrigin(id);
  if (!origin) return;
  g.player.x = Math.max(origin.x - 8, Math.min(origin.x + 8, g.player.x));
  g.player.z = Math.max(origin.z - 6, Math.min(origin.z + 6, g.player.z));
}

// Walk through a door (or back out, when already inside).
export function tryInteriorDoor(g) {
  const p = g.player;
  const inside = insideRoom(g);
  if (inside) {
    const room = ROOMS[inside];
    if (room) {
      p.x = room.door.x;
      p.z = room.door.z;
    }
    g.inside = null;
    p.inside = null;
    return inside;
  }
  for (const room of Object.values(ROOMS)) {
    if (Math.hypot(p.x - room.door.x, p.z - room.door.z) <= 4) {
      g.inside = room.id;
      p.inside = room.id;
      p.x = room.origin.x;
      p.z = room.origin.z;
      return room.id;
    }
  }
  return null;
}

// The counter inside a room: food in the pizza/burger rooms, the
// outfit rack in the outfit shop.
export function tryCounter(g) {
  const id = insideRoom(g);
  if (!id) return false;
  const origin = roomOrigin(id);
  if (!origin) return false;
  const p = g.player;
  const counter = { x: origin.x, z: origin.z + 3 };
  if (Math.hypot(p.x - counter.x, p.z - counter.z) > 2) return false;
  if (id === 'outfit') {
    g.modal = {
      kind: 'outfit',
      title: 'Outfit Shop',
      lines: ['1. Hair', '2. Shirt', '3. Pants', '4. Shoes'],
    };
  } else {
    g.modal = {
      kind: 'food',
      title: id === 'pizza' ? 'Pizza Palace' : 'Burger Barn',
      lines: ['Snack $5', 'Meal $10', 'Feast $15'],
    };
  }
  return true;
}

export const tryInteriorCounter = tryCounter;

// All three rooms, drawn in their interior area.
export function interiorBoxes(g, b, cam) {
  const plain = [0, 0, 1, 1];
  for (const room of Object.values(ROOMS)) {
    const o = room.origin;
    pushBox(b, o.x, 0, o.z, 16, 0.2, 12, [0.7, 0.6, 0.5], plain);
    pushBox(b, o.x, 0, o.z - 6, 16, 3, 0.3, [0.85, 0.75, 0.65], plain);
    pushBox(b, o.x - 8, 0, o.z, 0.3, 3, 12, [0.85, 0.75, 0.65], plain);
    pushBox(b, o.x, 0, o.z + 3, 3, 1, 0.8, room.id === 'outfit' ? [0.6, 0.4, 0.8] : [0.9, 0.5, 0.2], plain);
  }
  return 3;
}
