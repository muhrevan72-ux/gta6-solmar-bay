// Solmar Bay — food shops.
//
// Five storefronts. Standing at a front opens the menu; buying
// charges the FOOD_MENU price and applies its effect. The shop
// signs are drawn as five boxes in the dynamic batch.

import { FOOD_SHOPS, FOOD_MENU } from './config.js';
import { pushBox } from './render.js';

export function nearestFoodShop(g) {
  let best = null;
  let bestD = 5;
  for (const shop of FOOD_SHOPS) {
    const d = Math.hypot(g.player.x - shop.x, g.player.z - shop.z);
    if (d < bestD) { bestD = d; best = shop; }
  }
  return best;
}

export function tryFoodShop(g) {
  const shop = nearestFoodShop(g);
  if (!shop) return false;
  g.modal = {
    kind: 'food',
    title: shop.name,
    lines: FOOD_MENU.map((m, i) => `${i + 1}. ${m.name} — $${m.price} (+${m.hp} HP)`),
  };
  return true;
}

export function buyFood(g, idx) {
  const item = FOOD_MENU[idx];
  if (!item) return false;
  if ((g.cash || 0) < item.price) return false;
  g.cash -= item.price;
  g.health = Math.min(100, (g.health || 0) + (item.heal || 0));
  if (item.armour) g.armour = (g.armour || 0) + item.armour;
  if (g.player) g.player.health = g.health;
  g.modal = null;
  return true;
}

// One sign box per shop.
export function foodSignBoxes(g, b, camera) {
  let n = 0;
  for (const shop of FOOD_SHOPS) {
    pushBox(b, shop.x, 3, shop.z + 2, 4, 1.2, 0.3, [0.95, 0.8, 0.2]);
    n++;
  }
  return n;
}
