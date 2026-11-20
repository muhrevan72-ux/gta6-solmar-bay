// Solmar Bay — the outfit shop (Vice Threads): cycle options, buy
// the whole outfit. Total for hair 2 + shirt 1 + pants 1 + shoes 1
// is $155.

import { OUTFIT, SPAWNS } from './config.js';

export function tryOutfitShop(g) {
  const d = Math.hypot(g.player.x - SPAWNS.outfitDoor.x, g.player.z - SPAWNS.outfitDoor.z);
  if (d > 6) return false;
  g.modal = { kind: 'outfit', title: 'Vice Threads', lines: ['Pick an outfit'] };
  return true;
}

// Cycle one slot: 0 hair, 1 shirt, 2 pants, 3 shoes. Wraps around.
export function cycleOutfit(g, slot) {
  const lists = [OUTFIT.hair, OUTFIT.shirt, OUTFIT.pants, OUTFIT.shoes];
  const keys = ['hair', 'shirt', 'pants', 'shoes'];
  if (slot < 0 || slot >= lists.length) return false;
  const list = lists[slot];
  const key = keys[slot];
  g.player.outfit[key] = ((g.player.outfit[key] || 0) + 1) % list.length;
  return true;
}

// The price of the currently selected outfit.
export function outfitTotal(g) {
  const o = g.player.outfit;
  const hair = OUTFIT.hair[o.hair] || OUTFIT.hair[0];
  const shirt = OUTFIT.shirt[o.shirt] || OUTFIT.shirt[0];
  const pants = OUTFIT.pants[o.pants] || OUTFIT.pants[0];
  const shoes = OUTFIT.shoes[o.shoes] || OUTFIT.shoes[0];
  return hair.price + shirt.price + pants.price + shoes.price;
}

// Buy the selected outfit (charges the total, closes the modal).
export function buyOutfit(g) {
  const total = outfitTotal(g);
  if (g.cash < total) return false;
  g.cash -= total;
  g.modal = null;
  g.toast = `New outfit — $${total}`;
  g.toastTimer = 3;
  return true;
}
