// Solmar Bay — food shops: eat to restore health (and armour).
//
// Five shops, each with a menu (Snack $5 / +10 HP, Meal $10 /
// +25 HP, Feast $15 / full HP + 25 armour). E within 5 m of a shop's
// FRONT point opens its menu; E at the door (4 m) steps inside the
// interior instead. The two radii are deliberately different, and
// the menu points sit 5 m south of the interior doors, so the two
// actions never overlap (the round-5 bug: 3 of 5 menus were
// unreachable because the points were inside the shop colliders).

import { FOOD_MENU, FOOD_SHOPS } from './config.js';
import { showToast, addCash, healPlayer } from './state.js';

export function createFood() {
  return {
    menuOpen: null, // shop name whose menu is open, or null
  };
}

// The nearest shop whose menu point is within 5 m of (x, z).
export function foodShopNear(game, x, z) {
  let best = null;
  let bestD = 5;
  for (const shop of FOOD_SHOPS) {
    const d = Math.hypot(shop.x - x, shop.z - z);
    if (d < bestD) { bestD = d; best = shop; }
  }
  return best;
}

export function openFoodMenu(game, shop) {
  game.food.menuOpen = shop.name;
  showToast(game.state, shop.name + ' — 1 Snack $5 · 2 Meal $10 · 3 Feast $15', 5);
}

export function closeFoodMenu(game) {
  game.food.menuOpen = null;
}

// Buy by number key (1/2/3) while a menu is open.
export function buyFood(game, idx) {
  const s = game.state;
  if (!game.food.menuOpen) return false;
  const item = FOOD_MENU[idx];
  if (!item) return false;
  if (s.cash < item.price) {
    showToast(s, 'Not enough cash for a ' + item.name + '.', 3);
    return false;
  }
  addCash(s, -item.price);
  if (item.heal === 'full') {
    s.health = 100;
    s.armour = Math.min(100, s.armour + 25);
  } else {
    healPlayer(s, item.heal);
  }
  showToast(s, item.name + ' — ' + (item.heal === 'full' ? 'full health + 25 armour' : '+' + item.heal + ' HP') + ' (-$' + item.price + ')', 3);
  return true;
}

// Food stalls: a counter + awning + sign in front of each shop.
export function foodBoxes(game, out) {
  for (const shop of FOOD_SHOPS) {
    out.pushBox(shop.x, 0.5, shop.z + 2, 3, 1, 1, [0.9, 0.85, 0.75]);
    out.pushBox(shop.x, 1.2, shop.z + 2, 3.2, 0.15, 1.4, [0.9, 0.3, 0.2]);
    out.pushBox(shop.x, 2.2, shop.z - 1, 2.5, 0.6, 0.1, [1, 0.9, 0.4]);
  }
}
