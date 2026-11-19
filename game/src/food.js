// Solmar Bay — food shops: pizza, burger, chicken, donut, taco.
//
// Shop buildings with signs; walk up to the shop front, press E to
// buy food: Snack +10 HP ($5), Meal +25 HP ($10), Feast full HP
// +25 armour ($15). Eating with the girlfriend counts toward dates.
// All 5 shop points sit at the shop fronts (standable, off-road) —
// the interaction radius is 5 m.

import { FOOD_SHOPS, FOOD_MENU, dist2 } from './config.js';
import { addCash, healPlayer, showToast } from './state.js';

export function nearestFoodShop(game, x, z, range) {
  let best = null;
  let bestD = range * range;
  for (const shop of FOOD_SHOPS) {
    const d = dist2(x, z, shop.x, shop.z);
    if (d < bestD) {
      bestD = d;
      best = shop;
    }
  }
  return best;
}

export function buyFood(game, shop, menuIdx) {
  const s = game.state;
  const item = FOOD_MENU[menuIdx];
  if (!item) return false;
  if (s.cash < item.price) {
    showToast(s, 'Not enough cash for a ' + item.name + ' ($' + item.price + ').', 2);
    return false;
  }
  s.cash -= item.price;
  healPlayer(s, item.heal);
  if (item.armour) s.armour = Math.min(100, s.armour + item.armour);
  showToast(s, shop.name + ': ' + item.name + ' — +' + item.heal + ' HP' + (item.armour ? ' +' + item.armour + ' armour' : ''), 2);
  // Eating with the girlfriend counts toward the date.
  if (game.dating && game.dating.onDate) {
    game.dating.ateTogether = true;
    showToast(s, 'Maya loved the food. Date going well!', 2);
  }
  return true;
}

// The cheapest item the player can afford (used by the E quick-buy).
export function quickBuyFood(game, shop) {
  const s = game.state;
  for (let i = FOOD_MENU.length - 1; i >= 0; i--) {
    if (s.cash >= FOOD_MENU[i].price) return buyFood(game, shop, i);
  }
  showToast(s, 'Not enough cash for food.', 2);
  return false;
}

export function foodShopBoxes(game, out) {
  for (const shop of FOOD_SHOPS) {
    // Sign board above the shop front.
    out.pushBox(shop.x, 5.2, shop.z - 1, 8, 1.2, 0.5, shop.colour);
  }
}

export { FOOD_SHOPS, FOOD_MENU };
