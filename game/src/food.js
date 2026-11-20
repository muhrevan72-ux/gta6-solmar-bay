// Solmar Bay — food shops.
//
// Five food shops (Pizza Palace, Burger Barn, Clucky's Chicken,
// Donut Dock, Taco Tide). Stand at a shop front (within 5 m) and
// press E to open the menu: Snack $5 (+10 HP), Meal $10 (+25 HP),
// Feast $15 (+100 HP, +25 armour). The shop points sit at the
// shop FRONTS — just outside the building, on standable ground,
// never inside a collider — and 5 m south of the interior doors
// so the food radius and the door radius do not overlap.

import { FOOD_MENU, FOOD_SHOPS, TUNE } from './config.js';
import { pushBox } from './render.js';
import { tileUV } from './texture.js';
import { dist } from './config.js';
import { showToast } from './state.js';

export function nearestFoodShop(game) {
  const p = game.player;
  let best = null;
  let bestD = 5;
  for (const s of FOOD_SHOPS) {
    const d = dist(s.x, s.z, p.x, p.z);
    if (d < bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}

export function tryFoodShop(game) {
  const shop = nearestFoodShop(game);
  if (!shop) return false;
  const lines = FOOD_MENU.map((m, i) => `${i + 1}. ${m.name} — $${m.price} (+${m.heal} HP${m.armour ? `, +${m.armour} armour` : ''})`).join('\n');
  game.modal = {
    kind: 'food',
    title: shop.name,
    lines: [lines, '', 'Press 1-3 to order, Esc to leave.'],
  };
  game._foodShop = shop;
  return true;
}

export function buyFood(game, idx) {
  const m = FOOD_MENU[idx];
  if (!m) return false;
  if (game.cash < m.price) {
    showToast(game, 'Not enough cash for that.');
    return false;
  }
  game.cash -= m.price;
  game.health = Math.min(100, game.health + m.heal);
  game.armour = Math.min(100, game.armour + m.armour);
  showToast(game, `${m.name} — HP ${game.health}, armour ${game.armour}`);
  if (game.audio) game.audio.sfx('pickup');
  game.modal = null;
  game._foodShop = null;
  return true;
}

// Food-shop signs: a coloured sign box above each shop front.
export function foodSignBoxes(game, b, cam) {
  const uv = tileUV('plain');
  for (const s of FOOD_SHOPS) {
    pushBox(b, s.x, 6, s.z - 6, 6, 1.5, 0.5, s.colour, uv);
  }
  return FOOD_SHOPS.length;
}
