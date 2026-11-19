// Solmar Bay — food shops: pizza, burger, chicken, donut, taco.
// Walk up, press E to open the menu, number keys buy food:
// snack +10 HP, meal +25 HP, feast full HP + armour. Eating with
// the girlfriend during a date counts toward it.

import { FOOD_MENU, FOOD_SHOPS, clamp, dist2 } from './config.js';
import { showToast } from './state.js';
import { showMenu } from './hud.js';

export function showFoodMenu(game, shop) {
  const lines = FOOD_MENU.map((m, i) => (i + 1) + '. ' + m.name + ' — $' + m.price + ' (+' + m.heal + ' HP' + (m.armour ? ', +' + m.armour + ' armour' : '') + ')').join('<br>');
  showMenu(game.hud, shop.name, lines, 'Press 1-3 to buy, Esc to close. Cash: $' + game.state.cash);
}

export function createFood() {
  return {
    shops: FOOD_SHOPS.map((s) => ({ ...s })),
    openShop: null, // shop the player is browsing, or null
  };
}

// Nearest shop within E range.
export function nearestFoodShop(game) {
  const p = game.player;
  for (const s of game.food.shops) {
    if (dist2(p.x, p.z, s.x, s.z) < 25) return s;
  }
  return null;
}

export function buyFood(game, index) {
  const food = game.food;
  const shop = food.openShop;
  if (!shop) return false;
  const item = FOOD_MENU[index];
  if (!item) return false;
  if (game.state.cash < item.price) {
    showToast(game.state, 'Not enough cash for the ' + item.name + '.', 2);
    return false;
  }
  game.state.cash -= item.price;
  game.state.health = clamp(game.state.health + item.heal, 0, 100);
  game.state.armour = clamp(game.state.armour + item.armour, 0, 100);
  showToast(game.state, item.name + ' from ' + shop.name + '! +' + item.heal + ' HP', 2);
  if (game.audio) game.audio.play('pickup');
  // eating with the girlfriend counts toward the date
  if (game.dating && game.dating.onDate) {
    game.dating.ateTogether = true;
    game.dating.progress = Math.max(game.dating.progress, 2);
  }
  return true;
}

export function foodBoxes(shop) {
  return [
    { x: shop.x, y: 1.5, z: shop.z, sx: 10, sy: 3, sz: 8, c: shop.colour },
    { x: shop.x, y: 3.4, z: shop.z + 4.2, sx: 8, sy: 0.8, sz: 1.2, c: [0.95, 0.95, 0.9] },
    { x: shop.x, y: 4.4, z: shop.z + 4.4, sx: 7, sy: 1.2, sz: 0.4, c: shop.colour },
  ];
}
