// Solmar Bay — enterable shop interiors (simplified).
//
// Three shops have a door: Pizza Palace, Burger Barn and the outfit
// shop. Press E at the door to step into a small box room (floor,
// walls, ceiling, counter, shelves, shopkeeper); E at the counter
// opens the shop's menu, E at the door steps back out.
//
// The room lives at a quiet spot in the world (0, 380) and is drawn
// by swapping the renderer's static buffer while inside; stepping
// out restores the city. The camera switches to close mode inside
// so it stays in the room. Police and gangs do not update while the
// player is inside (a shop is safe).

import { dist2 } from './config.js';
import { showToast } from './state.js';
import { showFoodMenu } from './food.js';
import { showOutfitMenu } from './outfit.js';
import { snapCamera } from './shots.js';

export const ROOM = { x: 0, z: 380, hw: 9, hd: 7, h: 5.5 }; // centre, half-width/depth, height

export const INTERIORS = {
  pizza: {
    key: 'pizza',
    name: 'Pizza Palace',
    door: { x: -60, z: -32 }, // 1m north of the shop front, outside its collider
    shop: { name: 'Pizza Palace', x: -60, z: -32, colour: [0.9, 0.3, 0.2] },
    colour: [0.9, 0.3, 0.2],
    kind: 'food',
  },
  burger: {
    key: 'burger',
    name: 'Burger Barn',
    door: { x: 60, z: -28 }, // 1m north of the shop front, outside its collider
    shop: { name: 'Burger Barn', x: 60, z: -28, colour: [0.95, 0.6, 0.1] },
    colour: [0.95, 0.6, 0.1],
    kind: 'food',
  },
  outfit: {
    key: 'outfit',
    name: 'Outfit Shop',
    door: { x: -50, z: 156 },
    colour: [0.75, 0.4, 0.85],
    kind: 'outfit',
  },
};

// The interior door the player is standing at (within 4 m), or null.
export function nearestInteriorDoor(game) {
  const p = game.player;
  for (const key of Object.keys(INTERIORS)) {
    const d = INTERIORS[key].door;
    if (dist2(p.x, p.z, d.x, d.z) < 16) return INTERIORS[key];
  }
  return null;
}

export function enterInterior(game, def) {
  const state = game.state;
  const p = game.player;
  if (state.interior || !def) return false;
  state.interior = {
    key: def.key,
    name: def.name,
    returnX: p.x,
    returnZ: p.z,
  };
  p.x = ROOM.x;
  p.z = ROOM.z + 4;
  p.y = 0;
  p.heading = Math.PI; // face north, into the room
  p.vx = 0;
  p.vz = 0;
  p.eCooldown = 0.25;
  game.camera.close = true;
  snapCamera(game.camera, p, p.heading);
  if (game.render) game.render.setStatic(interiorBoxes(def));
  showToast(state, 'Inside ' + def.name + '. E at the counter to shop, E at the door to leave.', 3);
  return true;
}

export function exitInterior(game) {
  const state = game.state;
  const p = game.player;
  const it = state.interior;
  if (!it) return false;
  p.x = it.returnX;
  p.z = it.returnZ;
  p.y = 0;
  p.eCooldown = 0.25;
  state.interior = null;
  game.camera.close = false;
  snapCamera(game.camera, p, p.heading);
  if (game.render) game.render.setStatic(game.city.boxes);
  return true;
}

// E while inside: counter opens the shop menu, door steps out.
export function interiorInteract(game) {
  const p = game.player;
  const it = game.state.interior;
  if (!it) return false;
  // door on the south wall
  if (dist2(p.x, p.z, ROOM.x, ROOM.z + ROOM.hd) < 9) {
    return exitInterior(game);
  }
  // counter in the middle-north of the room
  if (dist2(p.x, p.z, ROOM.x, ROOM.z - 3) < 9) {
    const def = INTERIORS[it.key];
    if (def.kind === 'food') {
      game.food.openShop = def.shop;
      showFoodMenu(game, def.shop);
      return true;
    }
    game.outfit.open = true;
    showOutfitMenu(game);
    return true;
  }
  return false;
}

// Clamp the player inside the room (called after movement).
export function clampToRoom(game) {
  const p = game.player;
  p.x = Math.max(ROOM.x - ROOM.hw + 0.6, Math.min(ROOM.x + ROOM.hw - 0.6, p.x));
  p.z = Math.max(ROOM.z - ROOM.hd + 0.6, Math.min(ROOM.z + ROOM.hd - 0.6, p.z));
}

// Static boxes for one shop's room: floor, walls (south wall split
// for the door gap), ceiling, counter, shelves, shopkeeper, sign.
export function interiorBoxes(def) {
  const c = def.colour;
  const { x: cx, z: cz, hw, hd, h } = ROOM;
  const wall = [0.85, 0.8, 0.7];
  const floor = [0.6, 0.45, 0.3];
  const boxes = [];
  // floor + ceiling
  boxes.push({ x: cx, y: 0.1, z: cz, sx: hw * 2, sy: 0.2, sz: hd * 2, c: floor });
  boxes.push({ x: cx, y: h, z: cz, sx: hw * 2, sy: 0.3, sz: hd * 2, c: [0.95, 0.9, 0.8] });
  // north wall (z - hd) and side walls
  boxes.push({ x: cx, y: h / 2, z: cz - hd, sx: hw * 2, sy: h, sz: 0.4, c: wall });
  boxes.push({ x: cx - hw, y: h / 2, z: cz, sx: 0.4, sy: h, sz: hd * 2, c: wall });
  boxes.push({ x: cx + hw, y: h / 2, z: cz, sx: 0.4, sy: h, sz: hd * 2, c: wall });
  // south wall split for the 3-wide door gap
  boxes.push({ x: cx - hw / 2 - 1.5, y: h / 2, z: cz + hd, sx: hw - 3, sy: h, sz: 0.4, c: wall });
  boxes.push({ x: cx + hw / 2 + 1.5, y: h / 2, z: cz + hd, sx: hw - 3, sy: h, sz: 0.4, c: wall });
  boxes.push({ x: cx, y: h - 0.75, z: cz + hd, sx: 3, sy: 1.5, sz: 0.4, c: wall });
  // counter + shelves + shopkeeper + sign
  boxes.push({ x: cx, y: 0.6, z: cz - 3, sx: 7, sy: 1.2, sz: 1.2, c });
  boxes.push({ x: cx, y: 1.5, z: cz - 3, sx: 7, sy: 0.3, sz: 1.2, c: [0.95, 0.9, 0.7] });
  boxes.push({ x: cx - 6, y: 1.2, z: cz - hd + 0.8, sx: 4, sy: 2.4, sz: 0.8, c: [0.5, 0.35, 0.2] });
  boxes.push({ x: cx + 6, y: 1.2, z: cz - hd + 0.8, sx: 4, sy: 2.4, sz: 0.8, c: [0.5, 0.35, 0.2] });
  boxes.push({ x: cx - 6, y: 2.8, z: cz - hd + 0.8, sx: 3.4, sy: 0.5, sz: 0.6, c });
  boxes.push({ x: cx + 6, y: 2.8, z: cz - hd + 0.8, sx: 3.4, sy: 0.5, sz: 0.6, c });
  // shopkeeper behind the counter
  boxes.push({ x: cx, y: 1.2, z: cz - 4.6, sx: 0.9, sy: 0.9, sz: 0.5, c: [0.2, 0.6, 0.9] });
  boxes.push({ x: cx, y: 1.9, z: cz - 4.6, sx: 0.6, sy: 0.6, sz: 0.55, c: [0.95, 0.75, 0.55] });
  boxes.push({ x: cx, y: 2.25, z: cz - 4.6, sx: 0.64, sy: 0.25, sz: 0.6, c: [0.15, 0.12, 0.1] });
  // shop sign above the counter
  boxes.push({ x: cx, y: 3.6, z: cz - hd + 0.5, sx: 8, sy: 1.0, sz: 0.3, c });
  return boxes;
}
