// Solmar Bay — shop interiors (pizza, burger, outfit).
// Stepping through a shop door teleports the player into a
// small room; E again walks them back out.

import { pushBox } from './render.js';

export const ROOMS = {
  pizza: { name: 'pizza', door: { x: -40, z: 32 }, origin: { x: 0, z: 500 } },
  burger: { name: 'burger', door: { x: 80, z: -44 }, origin: { x: 30, z: 500 } },
  outfit: { name: 'outfit', door: { x: 80, z: 32 }, origin: { x: 60, z: 500 } },
};

export function roomOrigin(name) {
  const r = ROOMS[name];
  return r ? { x: r.origin.x, z: r.origin.z } : null;
}

export function isInside(g) {
  return !!g.player.inside;
}

// At a door: enter the room (teleport to its origin). Inside:
// E again walks back out to the door. Far away: null.
export function tryInteriorDoor(g) {
  const p = g.player;
  if (p.inside) {
    const room = ROOMS[p.inside];
    if (room) {
      p.x = room.door.x;
      p.z = room.door.z;
    }
    const name = p.inside;
    p.inside = null;
    return name;
  }
  for (const room of Object.values(ROOMS)) {
    if (Math.hypot(p.x - room.door.x, p.z - room.door.z) < 4) {
      p.inside = room.name;
      p.x = room.origin.x;
      p.z = room.origin.z;
      return room.name;
    }
  }
  return null;
}

// At the counter inside a room: open the shop menu.
export function tryInteriorCounter(g) {
  const p = g.player;
  if (!p.inside) return false;
  const room = ROOMS[p.inside];
  if (!room) return false;
  const cx = room.origin.x, cz = room.origin.z + 3;
  if (Math.hypot(p.x - cx, p.z - cz) > 2.5) return false;
  if (room.name === 'outfit') g.modal = { kind: 'outfit', title: 'Outfit Shop' };
  else g.modal = { kind: 'food', title: room.name === 'pizza' ? 'Pizza Palace' : 'Burger Barn', lines: ['Snack $5 — +10 HP', 'Meal $10 — +25 HP', 'Feast $15 — full HP + armour'] };
  return true;
}

// Keep the player inside the room bounds.
export function stepInteriors(g, dt) {
  const p = g.player;
  if (!p.inside) return;
  const room = ROOMS[p.inside];
  if (!room) return;
  const ox = room.origin.x, oz = room.origin.z;
  if (p.x < ox - 8) p.x = ox - 8;
  if (p.x > ox + 8) p.x = ox + 8;
  if (p.z < oz - 6) p.z = oz - 6;
  if (p.z > oz + 6) p.z = oz + 6;
}

// Draw all three rooms (floor, walls, counter, tables).
export function interiorBoxes(g, batch) {
  const plain = [0, 0, 1, 1];
  let tris = 0;
  for (const room of Object.values(ROOMS)) {
    const ox = room.origin.x, oz = room.origin.z;
    const wallCol = room.name === 'pizza' ? [0.9, 0.5, 0.3] : room.name === 'burger' ? [0.7, 0.4, 0.2] : [0.5, 0.4, 0.7];
    pushBox(batch, ox, 0, oz, 17, 0.2, 13, [0.7, 0.6, 0.5], plain); // floor
    pushBox(batch, ox, 0.2, oz - 6.5, 17, 4, 0.4, wallCol, plain); // back wall
    pushBox(batch, ox, 0.2, oz + 6.5, 17, 4, 0.4, wallCol, plain); // front wall
    pushBox(batch, ox - 8.5, 0.2, oz, 0.4, 4, 13, wallCol, plain); // left wall
    pushBox(batch, ox + 8.5, 0.2, oz, 0.4, 4, 13, wallCol, plain); // right wall
    pushBox(batch, ox, 0.2, oz + 3, 6, 1.1, 1.2, [0.85, 0.75, 0.6], plain); // counter
    pushBox(batch, ox - 4, 0.2, oz - 2, 2.5, 0.8, 2.5, [0.6, 0.4, 0.25], plain); // table
    pushBox(batch, ox + 4, 0.2, oz - 2, 2.5, 0.8, 2.5, [0.6, 0.4, 0.25], plain); // table
    tris += 96;
  }
  return 3;
}
