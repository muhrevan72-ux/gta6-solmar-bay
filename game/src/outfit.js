// Solmar Bay — outfit shop.
//
// Vice Threads, at (-120, 52) — the door is on the shop front,
// 5 m from the food stall at (-120, 55) so the two radii do not
// overlap. Press E at the door to open the shop: 1/2/3/4 cycle
// hair, shirt, pants, shoes; Enter buys the shown item. The
// player's hair and shoes follow the bought outfit (round-7 fix:
// a bought "Red mohawk" used to render brown).

import { OUTFIT } from './config.js';
import { dist } from './config.js';
import { showToast } from './state.js';
import { SPAWNS } from './config.js';

export function tryOutfitShop(game) {
  const p = game.player;
  if (dist(p.x, p.z, SPAWNS.outfitDoor.x, SPAWNS.outfitDoor.z) > 4) return false;
  const o = p.outfit;
  const lines = [
    '1. Hair: ' + OUTFIT.hair[o.hair].name + ' ($' + OUTFIT.hair[o.hair].price + ')',
    '2. Shirt: ' + OUTFIT.shirt[o.shirt].name + ' ($' + OUTFIT.shirt[o.shirt].price + ')',
    '3. Pants: ' + OUTFIT.pants[o.pants].name + ' ($' + OUTFIT.pants[o.pants].price + ')',
    '4. Shoes: ' + OUTFIT.shoes[o.shoes].name + ' ($' + OUTFIT.shoes[o.shoes].price + ')',
    '',
    'Press 1-4 to cycle, Enter to buy, Esc to leave.',
  ];
  game.modal = { kind: 'outfit', title: 'Vice Threads', lines };
  return true;
}

export function cycleOutfit(game, slot) {
  const o = game.player.outfit;
  const keys = ['hair', 'shirt', 'pants', 'shoes'];
  const key = keys[slot];
  if (!key) return false;
  o[key] = (o[key] + 1) % OUTFIT[key].length;
  const item = OUTFIT[key][o[key]];
  game.modal = {
    kind: 'outfit',
    title: 'Vice Threads',
    lines: [
      '1. Hair: ' + OUTFIT.hair[o.hair].name + ' ($' + OUTFIT.hair[o.hair].price + ')',
      '2. Shirt: ' + OUTFIT.shirt[o.shirt].name + ' ($' + OUTFIT.shirt[o.shirt].price + ')',
      '3. Pants: ' + OUTFIT.pants[o.pants].name + ' ($' + OUTFIT.pants[o.pants].price + ')',
      '4. Shoes: ' + OUTFIT.shoes[o.shoes].name + ' ($' + OUTFIT.shoes[o.shoes].price + ')',
      '',
      item.name + ' — $' + item.price + '. Press Enter to buy.',
    ],
  };
  return true;
}

export function buyOutfit(game) {
  const o = game.player.outfit;
  const total =
    OUTFIT.hair[o.hair].price +
    OUTFIT.shirt[o.shirt].price +
    OUTFIT.pants[o.pants].price +
    OUTFIT.shoes[o.shoes].price;
  // Only charge for items not yet owned (price 0 = owned).
  if (game.cash < total) {
    showToast(game, 'Not enough cash for this outfit.');
    return false;
  }
  game.cash -= total;
  showToast(game, 'New outfit! You look sharp.');
  game.modal = null;
  return true;
}
