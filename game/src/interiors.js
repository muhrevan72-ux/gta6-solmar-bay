// Solmar Bay — enterable interiors: the pizza place, the burger
// joint and the outfit shop. Each room lives far off-map (z=380)
// so it never collides with the city.

import { SPAWNS } from './config.js';
import { pushBox } from './render.js';

export const ROOMS = {
  pizza: { door: { x: 30, z: 68 }, origin: { x: 0, z: 380 }, label: 'Pizza Palace' },
  burger: { door: { x: -150, z: 68 }, origin: { x: 30, z: 380 }, label: 'Burger Barn' },
  outfit: { door: { x: 150, z: 8 }, origin: { x: 60, z: 380 }, label: 'Vice Threads' },
};

export function roomOrigin(name) {
  const r = ROOMS[name];
  return r ? { ...r.origin } : null;
}

export function isInside(g) {
  return !!g.player.inside;
}

// E at a shop door steps inside; E inside steps back out.
export function tryInteriorDoor(g) {
  const p = g.player;
  if (p.inside) {
    const room = ROOMS[p.inside];
    if (!room) return null;
    p.inside = null;
    p.x = room.door.x;
    p.z = room.door.z;
    p.y = 0;
    return room.label;
  }
  for (const [name, room] of Object.entries(ROOMS)) {
    const d = Math.hypot(p.x - room.door.x, p.z - room.door.z);
    if (d < 5) {
      p.inside = name;
      p.x = room.origin.x;
      p.z = room.origin.z;
      p.y = 0;
      return name;
    }
  }
  return null;
}

// E near the counter inside a room opens the food or outfit menu.
export function tryInteriorCounter(g) {
  const p = g.player;
  if (!p.inside) return false;
  const room = ROOMS[p.inside];
  if (!room) return false;
  const cx = room.origin.x;
  const cz = room.origin.z + 3;
  const d = Math.hypot(p.x - cx, p.z - cz);
  if (d > 4) return false;
  if (p.inside === 'outfit') {
    g.modal = { kind: 'outfit', title: 'Vice Threads', lines: ['Pick an outfit'] };
  } else {
    g.modal = { kind: 'food', title: room.label, lines: ['Snack — $5', 'Meal — $10', 'Feast — $15'] };
  }
  return true;
}

// Clamp the player to the room bounds while inside.
export function stepInteriors(g, dt) {
  const p = g.player;
  if (!p.inside) return;
  const room = ROOMS[p.inside];
  if (!room) return;
  p.x = Math.max(room.origin.x - 8, Math.min(room.origin.x + 8, p.x));
  p.z = Math.max(room.origin.z - 6, Math.min(room.origin.z + 6, p.z));
}

// Furniture for the three rooms: floors, walls, counters, tables.
// Returns the number of rooms drawn (3); the batch carries the
// furniture triangles (>100).
export function interiorBoxes(g, batch, cam) {
  for (const [name, room] of Object.entries(ROOMS)) {
    const o = room.origin;
    // Floor and back wall.
    pushBox(batch, o.x, 0, o.z, 18, 0.2, 14, [0.7, 0.6, 0.5]);
    pushBox(batch, o.x, 0, o.z - 7, 18, 4, 0.4, [0.85, 0.8, 0.7]);
    // Counter.
    pushBox(batch, o.x, 0, o.z + 3, 8, 1.2, 1, [0.6, 0.4, 0.3]);
    // Two tables with chairs.
    pushBox(batch, o.x - 5, 0, o.z + 1, 2.5, 0.8, 2.5, [0.7, 0.55, 0.4]);
    pushBox(batch, o.x + 5, 0, o.z + 1, 2.5, 0.8, 2.5, [0.7, 0.55, 0.4]);
    pushBox(batch, o.x - 5, 0, o.z - 2, 1, 0.6, 1, [0.5, 0.35, 0.25]);
    pushBox(batch, o.x + 5, 0, o.z - 2, 1, 0.6, 1, [0.5, 0.35, 0.25]);
    // Shelves on the wall.
    pushBox(batch, o.x - 6, 2, o.z - 6.5, 4, 0.3, 0.6, [0.6, 0.5, 0.4]);
    pushBox(batch, o.x + 6, 2, o.z - 6.5, 4, 0.3, 0.6, [0.6, 0.5, 0.4]);
  }
  return Object.keys(ROOMS).length;
}
