// Solmar Bay — food shops (rebuild #13).
import { FOOD_SHOPS, FOOD_MENU } from './config.js';
import { pushBox } from './render.js';

export function nearestFoodShop(g) {
  let best = null;
  let bestD = 10;
  for (const s of FOOD_SHOPS) {
    const d = Math.hypot(s.x - g.player.x, s.z - g.player.z);
    if (d < bestD) { bestD = d; best = s; }
  }
  return best;
}

export function tryFoodShop(g) {
  const s = nearestFoodShop(g);
  if (!s) return false;
  g.modal = {
    kind: 'food',
    title: s.name,
    lines: FOOD_MENU.map((m, i) => `${i + 1}. ${m.name} — $${m.price} (+${m.heal} HP${m.armour ? `, +${m.armour} armour` : ''})`),
  };
  return true;
}

export function buyFood(g, i) {
  const item = FOOD_MENU[i];
  if (!item) return false;
  if (g.cash < item.price) return false;
  g.cash -= item.price;
  g.health = Math.min(100, g.health + item.heal);
  if (item.armour) g.armour += item.armour;
  return true;
}

// One sign per shop; returns the shop count.
export function foodSignBoxes(g, b, cam) {
  const plain = [0, 0, 1, 1];
  let n = 0;
  for (const s of FOOD_SHOPS) {
    pushBox(b, s.x, 3, s.z, 3, 1, 0.3, [0.95, 0.8, 0.2], plain);
    n += 1;
  }
  return n;
}
