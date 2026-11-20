// Solmar Bay — food shops (rebuild #14).
// Five shops. Snack $5 (+10 HP), Meal $10 (+25 HP), Feast $15
// (full HP + 25 armour).

import { FOOD_MENU, FOOD_SHOPS } from './config.js';
import { showToast } from './state.js';
import { pushBox } from './render.js';

export { FOOD_MENU, FOOD_SHOPS };

export function nearestFoodShop(g) {
  let best = null;
  let bestD = 10;
  for (const s of FOOD_SHOPS) {
    const d = Math.hypot(s.x - g.player.x, s.z - g.player.z);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

export function tryFoodShop(g) {
  const shop = nearestFoodShop(g);
  if (!shop) return false;
  g.modal = {
    kind: 'food',
    title: shop.name,
    lines: FOOD_MENU.map((m) => `${m.name} — $${m.price} · ${m.desc}`),
  };
  return true;
}

export function buyFood(g, index) {
  const item = FOOD_MENU[index];
  if (!item) return false;
  if (g.cash < item.price) return false;
  g.cash -= item.price;
  if (index === 0) {
    g.health = Math.min(100, g.health + 10);
  } else if (index === 1) {
    g.health = Math.min(100, g.health + 25);
  } else {
    g.health = 100;
    g.armour = (g.armour || 0) + 25;
  }
  showToast(g, `${item.name} — $${item.price}`);
  return true;
}

// One sign box per shop (5).
export function foodSignBoxes(g, b, camera) {
  for (const s of FOOD_SHOPS) {
    pushBox(b, s.x, 4, s.z + 6, 6, 1.5, 0.3, [0.95, 0.75, 0.2]);
  }
  return FOOD_SHOPS.length;
}
