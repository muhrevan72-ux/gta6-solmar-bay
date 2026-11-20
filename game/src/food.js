// Solmar Bay — food shops: menus, buying, and the shop signs.

import { FOOD_SHOPS, FOOD_MENU } from './config.js';
import { pushBox } from './render.js';

export function nearestFoodShop(g) {
  let best = null;
  let bestD = 8;
  for (const s of FOOD_SHOPS) {
    const d = Math.hypot(s.x - g.player.x, s.z - g.player.z);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

// Open the food menu at a nearby shop.
export function tryFoodShop(g) {
  const shop = nearestFoodShop(g);
  if (!shop) return false;
  g.modal = {
    kind: 'food',
    title: shop.name,
    lines: FOOD_MENU.map(m => `${m.name} — $${m.price}`),
    shop,
  };
  return true;
}

// Buy a menu item. Snack $5 heals 10 HP; Feast $15 heals to 100
// and adds 25 armour. Reads item.heal / item.armour (the round-10
// bug read item.hp, which does not exist, and produced NaN HP).
export function buyFood(g, index) {
  const item = FOOD_MENU[index];
  if (!item) return false;
  if (g.cash < item.price) return false;
  g.cash -= item.price;
  if (item.heal) g.health = Math.min(100, g.health + item.heal);
  if (item.armour) g.armour = (g.armour || 0) + item.armour;
  g.toast = `${item.name} — ${item.heal ? `+${item.heal} HP` : ''}${item.armour ? ` +${item.armour} armour` : ''}`;
  g.toastTimer = 3;
  return true;
}

// One sign box per food shop.
export function foodSignBoxes(g, batch, cam) {
  let n = 0;
  for (const s of FOOD_SHOPS) {
    pushBox(batch, s.x, 3.5, s.z - 1, 6, 1.2, 0.3, s.colour || [0.9, 0.6, 0.2]);
    n++;
  }
  return n;
}
