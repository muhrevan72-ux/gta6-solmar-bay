// Solmar Bay — food shops: find the nearest shop front, open
// its menu, buy a meal. Shop fronts are on open ground so the
// player can always walk up to them.

import { FOOD_SHOPS, FOOD_MENU } from './config.js';
import { pushBox } from './render.js';
import { showToast } from './state.js';

export { FOOD_SHOPS, FOOD_MENU };

export function nearestFoodShop(g) {
  let best = null, bestD = 5;
  for (const s of FOOD_SHOPS) {
    const d = Math.hypot(g.player.x - s.x, g.player.z - s.z);
    if (d < bestD) { bestD = d; best = s; }
  }
  return best;
}

export function tryFoodShop(g) {
  const shop = nearestFoodShop(g);
  if (!shop) return false;
  g.modal = {
    kind: 'food',
    title: shop.name,
    lines: FOOD_MENU.map((m) => `${m.name} $${m.price} — +${m.heal} HP`),
  };
  return true;
}

export function buyFood(g, idx) {
  const item = FOOD_MENU[idx];
  if (!item) return false;
  if (g.cash < item.price) return false;
  g.cash -= item.price;
  g.health = Math.min(100, g.health + item.heal);
  if (item.armour) g.armour = Math.min(100, g.armour + item.armour);
  showToast(g, `${item.name} eaten — +${item.heal} HP`);
  return true;
}

// One sign box above each shop front.
export function foodSignBoxes(g, batch) {
  const plain = [0, 0, 1, 1];
  for (const s of FOOD_SHOPS) {
    pushBox(batch, s.x, 4.5, s.z, 4, 1, 0.4, [1, 0.8, 0.2], plain);
  }
  return 5;
}
