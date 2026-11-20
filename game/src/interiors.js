// Solmar Bay — enterable interiors.
//
// Pizza Palace, Burger Barn and Vice Threads each have a room in
// a quiet corner of the map (0, 380) — far from the city, so the
// player can never walk into a room by accident. Press E at a
// shop door to step inside (the player teleports to the room);
// press E at the room door to step back out to the street.
// Inside: a counter, tables, and the shop's stock.

import { SPAWNS } from './config.js';
import { pushBox } from './render.js';
import { tileUV } from './texture.js';
import { dist } from './config.js';
import { showToast } from './state.js';

// Room definitions: door point on the street, room origin offset.
export const ROOMS = {
  pizza: { door: { x: -60, z: -32 }, origin: { x: 0, z: 380 }, label: 'Pizza Palace', colour: [0.9, 0.3, 0.2] },
  burger: { door: { x: 60, z: -32 }, origin: { x: 40, z: 380 }, label: 'Burger Barn', colour: [0.95, 0.6, 0.1] },
  outfit: { door: { x: -120, z: 52 }, origin: { x: 80, z: 380 }, label: 'Vice Threads', colour: [0.7, 0.3, 0.8] },
};

// The origin of a room in world space.
export function roomOrigin(id) {
  const r = ROOMS[id];
  return r ? r.origin : { x: 0, z: 380 };
}

// True when the player is inside any room.
export function isInside(game) {
  return !!game.player.inside;
}

// Step through a shop door (in or out). Returns the room id or null.
export function tryInteriorDoor(game) {
  const p = game.player;
  if (p.inside) {
    // Exit: back to the street door of the room we are in.
    const room = ROOMS[p.inside];
    if (room) {
      p.x = room.door.x;
      p.z = room.door.z + 2;
      p.inside = null;
      showToast(game, 'You step back onto the street.');
      return room.label;
    }
    return null;
  }
  for (const [id, room] of Object.entries(ROOMS)) {
    if (dist(p.x, p.z, room.door.x, room.door.z) < 4) {
      p.inside = id;
      p.x = room.origin.x;
      p.z = room.origin.z;
      p.vx = 0;
      p.vz = 0;
      showToast(game, `Inside ${room.label} — press E at the door to leave.`);
      return id;
    }
  }
  return null;
}

// Use the counter inside a room (order food / browse clothes).
export function tryInteriorCounter(game) {
  const p = game.player;
  if (!p.inside) return false;
  const room = ROOMS[p.inside];
  if (!room) return false;
  if (dist(p.x, p.z, room.origin.x, room.origin.z + 3) < 3) {
    if (p.inside === 'outfit') {
      game.modal = { kind: 'outfit', title: 'Vice Threads', lines: ['1. Hair', '2. Shirt', '3. Pants', '4. Shoes', '', 'Press 1-4 to cycle, Enter to buy, Esc to leave.'] };
    } else {
      game.modal = { kind: 'food', title: room.label, lines: ['1. Snack — $5 (+10 HP)', '2. Meal — $10 (+25 HP)', '3. Feast — $15 (+100 HP, +25 armour)', '', 'Press 1-3 to order, Esc to leave.'] };
    }
    return true;
  }
  return false;
}

// Keep the player inside the room bounds.
export function stepInteriors(game, dt) {
  const p = game.player;
  if (!p.inside) return;
  const room = ROOMS[p.inside];
  if (!room) return;
  p.x = Math.max(room.origin.x - 8, Math.min(room.origin.x + 8, p.x));
  p.z = Math.max(room.origin.z - 6, Math.min(room.origin.z + 6, p.z));
}

// Interior boxes: room floor, walls, counter, tables.
export function interiorBoxes(game, b, cam) {
  const uv = tileUV('plain');
  for (const [id, room] of Object.entries(ROOMS)) {
    const o = room.origin;
    // Floor.
    pushBox(b, o.x, -0.2, o.z, 18, 0.4, 14, [0.6, 0.55, 0.5], uv);
    // Walls (3 sides; the door side is open).
    pushBox(b, o.x, 0, o.z - 7, 18, 5, 0.5, room.colour, uv);
    pushBox(b, o.x - 9, 0, o.z, 0.5, 5, 14, room.colour, uv);
    pushBox(b, o.x + 9, 0, o.z, 0.5, 5, 14, room.colour, uv);
    // Counter.
    pushBox(b, o.x, 0, o.z + 3, 8, 1.2, 1.5, [0.5, 0.35, 0.2], uv);
    // Tables.
    pushBox(b, o.x - 5, 0, o.z + 2, 3, 0.8, 3, [0.7, 0.6, 0.45], uv);
    pushBox(b, o.x + 5, 0, o.z + 2, 3, 0.8, 3, [0.7, 0.6, 0.45], uv);
  }
  return Object.keys(ROOMS).length;
}
