// Solmar Bay — food shops: pizza, burger, chicken, donut, taco.
// Walk up to a shop, press E, buy food with cash to heal. Eating
// with the girlfriend counts toward a date.

import { FOOD_MENU, dist } from './config.js';
import { setToast } from './state.js';

export function createFood() {
  return { menuOpen: false, shop: null };
}

export function nearestShop(game, x, z, maxDist) {
  let best = null, bd = maxDist;
  for (const s of game.city.shops) {
    const d = dist(x, z, s.x, s.z);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

export function openFoodMenu(game, shop) {
  game.food.menuOpen = true;
  game.food.shop = shop;
  setToast(game.state, shop.name + ' — press 1/2/3 to buy, Esc to leave.', 4);
}

export function closeFoodMenu(game) {
  game.food.menuOpen = false;
  game.food.shop = null;
}

export function buyFood(game, idx) {
  const state = game.state;
  const item = FOOD_MENU[idx];
  if (!item) return false;
  if (state.cash < item.price) {
    setToast(state, 'Not enough cash for a ' + item.name + ' ($' + item.price + ').', 2);
    return false;
  }
  state.cash -= item.price;
  state.health = Math.min(100, state.health + item.heal);
  state.armour = Math.min(100, state.armour + item.armour);
  setToast(state, item.name + ' — yum! +$' + item.price + ' spent.', 2);
  if (game.audio) game.audio.blip(700, 0.1);
  // eating together counts toward a date
  if (game.dating && game.dating.active && game.dating.stage === 1) {
    game.dating.stage = 2;
    state.objective = 'Drop her off at the beach house.';
    setToast(state, 'She loved the food! Now drive her home.', 3);
  }
  return true;
}

export function drawFood(renderer, game) {
  // shop signs above each food shop
  for (const s of game.city.shops) {
    renderer.box(s.x, 5.2, s.z - 8, 7, 1.6, 0.5, s.color, 1);
    renderer.box(s.x, 5.2, s.z + 8, 7, 1.6, 0.5, s.color, 1);
  }
}
