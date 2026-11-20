// Solmar Bay — enterable interiors (rebuild #13).
// Each room lives at a far-away origin (x ~500+); stepping
// through a door teleports the player there, and back out again.
import { pushBox } from './render.js';
import { SPAWNS } from './config.js';

export const ROOMS = {
  pizza: { door: { x: -90, z: 52 }, origin: { x: 500, z: 500 }, counter: { x: 500, z: 504 }, kind: 'food' },
  burger: { door: { x: -30, z: -68 }, origin: { x: 560, z: 500 }, counter: { x: 560, z: 504 }, kind: 'food' },
  outfit: { door: { x: SPAWNS.outfitDoor.x, z: SPAWNS.outfitDoor.z }, origin: { x: 620, z: 500 }, counter: { x: 620, z: 504 }, kind: 'outfit' },
};

export function roomOrigin(name) {
  return ROOMS[name].origin;
}

export function isInside(g) {
  return !!g.player.inside;
}

export function tryInteriorDoor(g) {
  const p = g.player;
  if (p.inside) {
    const name = p.inside;
    const room = ROOMS[name];
    p.inside = null;
    p.x = room.door.x;
    p.z = room.door.z;
    return name;
  }
  for (const [name, room] of Object.entries(ROOMS)) {
    if (Math.hypot(p.x - room.door.x, p.z - room.door.z) < 6) {
      p.inside = name;
      p.x = room.origin.x;
      p.z = room.origin.z;
      return name;
    }
  }
  return null;
}

export function tryInteriorCounter(g) {
  const p = g.player;
  if (!p.inside) return false;
  const room = ROOMS[p.inside];
  if (!room) return false;
  if (Math.hypot(p.x - room.counter.x, p.z - room.counter.z) > 4) return false;
  if (room.kind === 'food') {
    g.modal = { kind: 'food', title: room === ROOMS.pizza ? 'Pizza Palace' : 'Burger Barn', lines: ['1. Snack — $5', '2. Meal — $10', '3. Feast — $15'] };
  } else {
    g.modal = { kind: 'outfit', title: 'Vice Threads', lines: ['Hair, shirts, pants, shoes — press 1-4 to cycle, Enter to buy'] };
  }
  return true;
}

export function stepInteriors(g, dt) {
  const p = g.player;
  if (!p.inside) return;
  const o = ROOMS[p.inside].origin;
  p.x = Math.max(o.x - 8, Math.min(o.x + 8, p.x));
  p.z = Math.max(o.z - 6, Math.min(o.z + 6, p.z));
}

// 3 rooms drawn; returns the room count. Each room: floor, 2 walls,
// counter, 2 tables, 2 chairs = 7 boxes = 84 tris per room.
export function interiorBoxes(g, b, cam) {
  const plain = [0, 0, 1, 1];
  let rooms = 0;
  for (const [name, room] of Object.entries(ROOMS)) {
    const o = room.origin;
    pushBox(b, o.x, 0, o.z, 18, 0.2, 14, [0.7, 0.6, 0.5], plain);
    pushBox(b, o.x, 0, o.z - 7, 18, 4, 0.4, [0.85, 0.8, 0.75], plain);
    pushBox(b, o.x - 9, 0, o.z, 0.4, 4, 14, [0.85, 0.8, 0.75], plain);
    pushBox(b, o.x, 0, o.z + 4, 4, 1.2, 1, [0.6, 0.4, 0.3], plain);
    pushBox(b, o.x - 4, 0, o.z - 2, 2, 0.9, 2, [0.5, 0.35, 0.25], plain);
    pushBox(b, o.x + 4, 0, o.z - 2, 2, 0.9, 2, [0.5, 0.35, 0.25], plain);
    pushBox(b, o.x - 4, 0, o.z + 1, 1, 0.6, 1, [0.4, 0.3, 0.2], plain);
    rooms += 1;
  }
  return rooms;
}
