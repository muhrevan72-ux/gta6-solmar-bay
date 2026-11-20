// Solmar Bay — food shops.
//
// Five original food shops (pizza, burger, chicken, donut,
// taco). Walk up to the shop front point, press E, pick a menu
// item with 1/2/3: Snack +10 HP ($5), Meal +25 HP ($10), Feast
// full HP + armour ($15). The interaction points sit at the
// shop FRONTS — just outside the building, on standable ground
// — never inside a collider (round-5 bug: 3 of 5 menus were
// unreachable because the points sat inside the shops).

import { FOOD_MENU, FOOD_SHOPS, dist } from './config.js';
import { showToast } from './state.js';

export function nearestFoodShop(game) {
  const p = game.player;
  let best = null;
  let bestD = 5;
  for (const s of FOOD_SHOPS) {
    const d = dist(p.x, p.z, s.x, s.z);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

// Open the food menu for the nearest shop (E). Returns the shop
// or null. The menu itself is rendered by hud.js; the choice is
// handled by buyFood().
export function tryFoodShop(game) {
  const shop = nearestFoodShop(game);
  if (!shop) return null;
  game.modal = {
    kind: 'food',
    title: shop.name,
    lines: FOOD_MENU.map((m, i) => `${i + 1}. ${m.name} — $${m.price} (+${m.heal} HP${m.armour ? `, +${m.armour} armour` : ''})`),
    shop,
  };
  return shop;
}

// Buy menu item i (0-based) at the open food menu.
export function buyFood(game, i) {
  const m = FOOD_MENU[i];
  if (!m || !game.modal || game.modal.kind !== 'food') return false;
  if (game.cash < m.price) {
    showToast(game, 'Not enough cash for that');
    return false;
  }
  game.cash -= m.price;
  game.health = Math.min(100, game.health + m.heal);
  game.armour = Math.min(100, game.armour + m.armour);
  showToast(game, `Ate a ${m.name} — +${m.heal} HP`);
  if (game.maya.onDate) {
    game.maya.rel = Math.min(100, game.maya.rel + 5);
    showToast(game, 'Maya liked the meal (+5%)');
  }
  game.modal = null;
  return true;
}

// Draw the food-shop signs (the shop bodies are static geometry;
// the signs are dynamic so they can glow at night).
export function foodSignBoxes(game, out) {
  for (const s of FOOD_SHOPS) {
    out.push({ x: s.x, y: 5.2, z: s.z - 8 + 7 + 0.4, w: 8, h: 1.4, d: 0.5, c: [1.2, 1.2, 1.2] });
  }
  return out;
}
