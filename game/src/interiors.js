// Solmar Bay — interiors: enterable shops.
//
// Pizza Palace, Burger Barn and the outfit shop have a door: press E
// at the door to step into a small interior room (floor, counter,
// shelves, shopkeeper, sign), E at the counter opens that shop's
// menu, E at the door to step back out. Interiors are simple box
// rooms at (0, 380) — a fenced-off patch south of the city — NOT
// full buildings. While inside, the camera switches to close mode,
// police/gangs don't update, and the player is clamped to the room.

import { dist2 } from './config.js';
import { showToast } from './state.js';

// Door points (just outside the shop buildings, on standable ground).
// Pizza/Burger doors sit 5 m north of their food-shop points so the
// 5 m food radius and the 4 m door radius do not overlap.
export const INTERIOR_DOORS = [
  { shop: 'Pizza Palace', x: -60, z: -32, kind: 'food', menu: 'pizza' },
  { shop: 'Burger Barn', x: 60, z: -28, kind: 'food', menu: 'burger' },
  // Outfit door: 2 m south of the outfit shop's south face (the shop
  // sits at (-120, 40), 24 x 20, so its south face is z = 50).
  { shop: 'Outfit Shop', x: -120, z: 52, kind: 'outfit', menu: 'outfit' },
];

const ROOM = { x: 0, z: 380, w: 14, d: 10, h: 5 };

export function createInteriors() {
  return {
    inside: null, // {shop, kind, menu} or null
    savedPos: null, // where the player stood before entering
  };
}

export function nearestDoor(game, x, z, range) {
  let best = null;
  let bestD = range * range;
  for (const d of INTERIOR_DOORS) {
    const dd = dist2(x, z, d.x, d.z);
    if (dd < bestD) {
      bestD = dd;
      best = d;
    }
  }
  return best;
}

export function enterInterior(game, door) {
  const it = game.interiors;
  if (it.inside) return false;
  it.inside = { shop: door.shop, kind: door.kind, menu: door.menu };
  it.savedPos = { x: game.state.player.x, z: game.state.player.z };
  game.state.player.x = ROOM.x;
  game.state.player.z = ROOM.z;
  game.state.player.vx = 0;
  game.state.player.vz = 0;
  showToast(game.state, 'You step inside ' + door.shop + '. E at the counter to browse, E at the door to leave.', 4);
  return true;
}

export function exitInterior(game) {
  const it = game.interiors;
  if (!it.inside) return false;
  const saved = it.savedPos || { x: -60, z: -27 };
  it.inside = null;
  it.savedPos = null;
  game.state.player.x = saved.x;
  game.state.player.z = saved.z;
  game.state.player.vx = 0;
  game.state.player.vz = 0;
  showToast(game.state, 'You step back out onto the street.', 2);
  return true;
}

// Counter point inside the room (north end).
export function counterPoint() {
  return { x: ROOM.x, z: ROOM.z - ROOM.d / 2 + 1 };
}
// Door point inside the room (south end).
export function roomDoorPoint() {
  return { x: ROOM.x, z: ROOM.z + ROOM.d / 2 - 1 };
}

// Keep the player inside the room while in it.
export function clampToRoom(game) {
  if (!game.interiors.inside) return;
  const p = game.state.player;
  const hw = ROOM.w / 2 - 1;
  const hd = ROOM.d / 2 - 1;
  if (p.x < ROOM.x - hw) p.x = ROOM.x - hw;
  if (p.x > ROOM.x + hw) p.x = ROOM.x + hw;
  if (p.z < ROOM.z - hd) p.z = ROOM.z - hd;
  if (p.z > ROOM.z + hd) p.z = ROOM.z + hd;
}

// Draw the interior room (only when inside): floor, walls, counter,
// shelves, shopkeeper, sign.
export function interiorBoxes(game, out) {
  if (!game.interiors.inside) return;
  const it = game.interiors.inside;
  const floorCol = it.kind === 'food' ? [0.85, 0.75, 0.6] : [0.6, 0.4, 0.7];
  // Floor + ceiling + walls.
  out.pushBox(ROOM.x, -0.3, ROOM.z, ROOM.w, 0.6, ROOM.d, floorCol);
  out.pushBox(ROOM.x, ROOM.h + 0.3, ROOM.z, ROOM.w, 0.6, ROOM.d, [0.9, 0.9, 0.92]);
  out.pushBox(ROOM.x, ROOM.h / 2, ROOM.z - ROOM.d / 2, ROOM.w, ROOM.h, 0.4, [0.8, 0.75, 0.7]);
  out.pushBox(ROOM.x, ROOM.h / 2, ROOM.z + ROOM.d / 2, ROOM.w, ROOM.h, 0.4, [0.8, 0.75, 0.7]);
  out.pushBox(ROOM.x - ROOM.w / 2, ROOM.h / 2, ROOM.z, 0.4, ROOM.h, ROOM.d, [0.8, 0.75, 0.7]);
  out.pushBox(ROOM.x + ROOM.w / 2, ROOM.h / 2, ROOM.z, 0.4, ROOM.h, ROOM.d, [0.8, 0.75, 0.7]);
  // Counter (north end) + shelves + shopkeeper + sign.
  const cp = counterPoint();
  out.pushBox(cp.x, 0.6, cp.z, 8, 1.2, 1.2, [0.5, 0.35, 0.2]);
  out.pushBox(cp.x - 3, 1.5, cp.z, 1.6, 2, 1, [0.9, 0.3, 0.2]);
  out.pushBox(cp.x + 3, 1.5, cp.z, 1.6, 2, 1, [0.95, 0.6, 0.1]);
  out.pushBox(cp.x, 1.9, cp.z - 1.2, 0.7, 1.6, 0.5, [0.95, 0.8, 0.65]); // shopkeeper
  out.pushBox(cp.x, 2.6, cp.z - 1.2, 0.6, 0.5, 0.5, [0.2, 0.2, 0.25]); // hair
  out.pushBox(ROOM.x, 4.2, ROOM.z - ROOM.d / 2 + 0.3, 6, 1, 0.3, [0.95, 0.8, 0.15]); // sign
  // Extra furniture: tables + chairs.
  for (const [tx, tz] of [[-4, 2], [4, 2], [-4, -1], [4, -1]]) {
    out.pushBox(ROOM.x + tx, 0.5, ROOM.z + tz, 1.6, 0.2, 1.6, [0.6, 0.45, 0.3]);
    out.pushBox(ROOM.x + tx, 0.9, ROOM.z + tz + 1.2, 0.8, 0.8, 0.4, [0.5, 0.35, 0.2]);
  }
}
