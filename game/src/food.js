// Solmar Bay — food shops: eat to heal, feast for armour.
// Written fresh for rebuild #18.

import { FOOD_SHOPS, FOOD_MENU } from './config.js';
import { pushBox } from './render.js';

export function nearestFoodShop(g) {
  let best = null;
  let bestD = 12;
  for (const s of FOOD_SHOPS) {
    const d = Math.hypot(s.x - g.player.x, s.z - g.player.z);
    if (d < bestD) { best = s; bestD = d; }
  }
  return best;
}

export function tryFoodShop(g) {
  const shop = nearestFoodShop(g);
  if (!shop) return false;
  g.modal = {
    kind: 'food',
    title: shop.name,
    lines: FOOD_MENU.map((m) => `${m.name} — $${m.price} (heal ${m.heal})`),
  };
  return true;
}

export function buyFood(g, i) {
  const item = FOOD_MENU[i];
  if (!item) return false;
  if ((g.cash || 0) < item.price) return false;
  g.cash -= item.price;
  g.health = Math.min(100, (g.health || 0) + item.heal);
  if (item.armour) g.armour = Math.min(100, (g.armour || 0) + item.armour);
  return true;
}

// A sign box over each of the 5 food shops.
export function foodSignBoxes(g, b, gl) {
  let n = 0;
  for (const s of FOOD_SHOPS) {
    pushBox(b, s.x, 6, s.z, 4, 1.2, 0.6, [0.95, 0.75, 0.1], [0, 0, 1, 1]);
    n++;
  }
  return n;
}
