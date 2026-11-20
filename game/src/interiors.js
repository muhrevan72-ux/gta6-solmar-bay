// Solmar Bay — enterable interiors.
//
// 3 shops (pizza, burger, outfit) have small interior rooms: a
// floor, a counter, shelves and a shopkeeper. Press E at the door
// to step in, E again to step back out. Interiors are simple box
// rooms at (0, 380) — far from the city, so the player can never
// walk into them by accident. While inside, the player stands in
// the room and the shop functions still work there (food menu,
// outfit menu).

import { SPAWNS, FOOD_SHOPS, dist } from './config.js';
import { showToast } from './state.js';

// Room layout: each interior is a 16x12 room, centred at
// (originX + i*24, 380). Doors on the south wall.
const ROOMS = [
  { id: 'pizza', name: 'Pizza Palace', colour: [0.9, 0.3, 0.2] },
  { id: 'burger', name: 'Burger Barn', colour: [0.95, 0.6, 0.1] },
  { id: 'outfit', name: 'Outfit Shop', colour: [0.85, 0.6, 0.9] },
];

export function roomOrigin(i) {
  return { x: SPAWNS.interiorOrigin.x + i * 24, z: SPAWNS.interiorOrigin.z };
}

export function isInside(game) {
  return !!game.player.inside;
}

// Try to enter an interior (E at a shop door). Returns the room
// id or null.
export function tryInteriorDoor(game) {
  const p = game.player;
  if (p.inside) {
    // Step back out to the door the player came in through.
    const room = ROOMS.find((r) => r.id === p.inside);
    const door = doorFor(room ? room.id : 'pizza');
    p.inside = null;
    p.x = door.x;
    p.z = door.z + 3;
    showToast(game, 'You stepped outside');
    return 'exit';
  }
  for (const door of game.city.doors) {
    if (!door.id.startsWith('shop-') && door.id !== 'outfit') continue;
    if (dist(p.x, p.z, door.x, door.z) < 4) {
      const roomId = door.id === 'outfit' ? 'outfit' : door.id.slice(5).toLowerCase().includes('pizza') ? 'pizza' : 'burger';
      const idx = ROOMS.findIndex((r) => r.id === roomId);
      const origin = roomOrigin(idx < 0 ? 0 : idx);
      p.inside = roomId;
      p.x = origin.x;
      p.z = origin.z + 3;
      showToast(game, `Inside the ${ROOMS[idx < 0 ? 0 : idx].name}`);
      return roomId;
    }
  }
  return null;
}

function doorFor(roomId) {
  if (roomId === 'outfit') return { x: SPAWNS.outfitDoor.x, z: SPAWNS.outfitDoor.z };
  const shop = FOOD_SHOPS.find((s) => s.name.toLowerCase().includes(roomId === 'pizza' ? 'pizza' : 'burger'));
  return shop ? { x: shop.x, z: shop.z - 1 } : { x: 0, z: 0 };
}

// Try the counter inside a room (E at the counter): opens the
// shop's menu (food or outfit).
export function tryInteriorCounter(game) {
  const p = game.player;
  if (!p.inside) return false;
  const idx = ROOMS.findIndex((r) => r.id === p.inside);
  const origin = roomOrigin(idx);
  if (dist(p.x, p.z, origin.x, origin.z - 2) > 4) return false;
  if (p.inside === 'outfit') {
    // Reuse the outfit modal.
    game.modal = {
      kind: 'outfit',
      title: 'Outfit Shop',
      lines: ['1. hair', '2. shirt', '3. pants', '4. shoes'],
      part: 0,
    };
  } else {
    const shop = FOOD_SHOPS.find((s) => s.name.toLowerCase().includes(p.inside));
    game.modal = {
      kind: 'food',
      title: shop ? shop.name : 'Food Shop',
      lines: ['1. Snack — $5 (+10 HP)', '2. Meal — $10 (+25 HP)', '3. Feast — $15 (full HP, +25 armour)'],
      shop,
    };
  }
  return true;
}

// Step the interior: keep the player inside the room bounds.
export function stepInteriors(game, dt) {
  const p = game.player;
  if (!p.inside) return;
  const idx = ROOMS.findIndex((r) => r.id === p.inside);
  const origin = roomOrigin(idx < 0 ? 0 : idx);
  p.x = Math.max(origin.x - 7, Math.min(origin.x + 7, p.x));
  p.z = Math.max(origin.z - 5, Math.min(origin.z + 5, p.z));
}

// Draw the interior rooms (floor, walls, counter, shelves,
// shopkeeper) into `out`. Only drawn when the player is inside
// one — the rooms are far away, so drawing them always would
// waste the batch.
export function interiorBoxes(game, out) {
  if (!game.player.inside) return out;
  const idx = ROOMS.findIndex((r) => r.id === game.player.inside);
  const origin = roomOrigin(idx < 0 ? 0 : idx);
  const room = ROOMS[idx < 0 ? 0 : idx];
  // Floor + walls (low, so the camera can see in).
  out.push({ x: origin.x, y: -0.1, z: origin.z, w: 16, h: 0.2, d: 12, c: [0.7, 0.6, 0.5] });
  out.push({ x: origin.x, y: 0, z: origin.z - 6, w: 16, h: 4, d: 0.5, c: room.colour });
  out.push({ x: origin.x - 8, y: 0, z: origin.z, w: 0.5, h: 4, d: 12, c: room.colour });
  out.push({ x: origin.x + 8, y: 0, z: origin.z, w: 0.5, h: 4, d: 12, c: room.colour });
  // Counter + shelves + shopkeeper.
  out.push({ x: origin.x, y: 0, z: origin.z - 2, w: 8, h: 1.2, d: 1.5, c: [0.6, 0.45, 0.3] });
  out.push({ x: origin.x - 5, y: 1, z: origin.z - 5, w: 3, h: 2, d: 1, c: [0.5, 0.4, 0.3] });
  out.push({ x: origin.x + 5, y: 1, z: origin.z - 5, w: 3, h: 2, d: 1, c: [0.5, 0.4, 0.3] });
  out.push({ x: origin.x, y: 1.2, z: origin.z - 4, w: 0.8, h: 1, d: 0.5, c: [0.9, 0.9, 0.9] });
  out.push({ x: origin.x, y: 2.2, z: origin.z - 4, w: 0.6, h: 0.55, d: 0.5, c: [0.85, 0.65, 0.5] });
  return out;
}

export { ROOMS };
