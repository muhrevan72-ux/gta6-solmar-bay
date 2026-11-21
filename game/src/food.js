// Solmar Bay — food shops.
//
// Five shops across the city. Walk up, open the menu, and buy a snack
// to heal — or a feast to heal and add armour.

import { pushBox } from './render.js';
import { FOOD_MENU, FOOD_SHOPS } from './config.js';
import { showToast } from './state.js';

export function nearestFoodShop(g) {
  const p = g.player;
  let best = null;
  let bestD = 6;
  for (const shop of FOOD_SHOPS) {
    const d = Math.hypot(p.x - shop.x, p.z - shop.z);
    if (d < bestD) {
      bestD = d;
      best = shop;
    }
  }
  return best;
}

export function tryFoodShop(g) {
  const shop = nearestFoodShop(g);
  if (!shop) return false;
  g._foodShop = shop;
  g.modal = {
    kind: 'food',
    title: shop.name,
    lines: FOOD_MENU.map((item) => `${item.name} $${item.price} — +${item.hp} HP${item.armour ? ` +${item.armour} armour` : ''}`),
  };
  return true;
}

export function buyFood(g, index) {
  if (index < 0 || index >= FOOD_MENU.length) return false;
  const item = FOOD_MENU[index];
  if (g.cash < item.price) return false;
  g.cash -= item.price;
  g.health = Math.min(100, g.health + item.hp);
  if (item.armour) g.armour = Math.min(100, (g.armour || 0) + item.armour);
  g.modal = null;
  showToast(g, `${item.name} bought — $${item.price}.`);
  return true;
}

// One sign box above each of the five shops.
export function foodSignBoxes(g, b, cam) {
  const plain = [0, 0, 1, 1];
  for (const shop of FOOD_SHOPS) {
    pushBox(b, shop.x, 3.2, shop.z, 3.2, 0.8, 0.4, [0.95, 0.75, 0.1], plain);
  }
  return FOOD_SHOPS.length;
}
