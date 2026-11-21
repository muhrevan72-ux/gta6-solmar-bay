// Solmar Bay — the outfit shop.
//
// Four slots — hair, shirt, pants, shoes — each with a few styles at
// a price. Cycle a slot to preview it, then buy the whole outfit.

import { OUTFIT, SPAWNS } from './config.js';
import { showToast } from './state.js';

const SLOTS = ['hair', 'shirt', 'pants', 'shoes'];

export function tryOutfitShop(g) {
  const p = g.player;
  if (Math.hypot(p.x - SPAWNS.outfitDoor.x, p.z - SPAWNS.outfitDoor.z) > 6) return false;
  g.modal = {
    kind: 'outfit',
    title: 'Outfit Shop',
    lines: SLOTS.map((slot, i) => `${i + 1}. ${slot}: ${OUTFIT[slot][p.outfit[slot]].name} — $${OUTFIT[slot][p.outfit[slot]].price}`),
  };
  return true;
}

export function cycleOutfit(g, slot) {
  if (slot < 0 || slot >= SLOTS.length) return false;
  const key = SLOTS[slot];
  const count = OUTFIT[key].length;
  g.player.outfit[key] = (g.player.outfit[key] + 1) % count;
  return true;
}

export function outfitPrice(outfit) {
  let total = 0;
  for (const slot of SLOTS) {
    const entry = OUTFIT[slot][outfit[slot]];
    if (entry) total += entry.price;
  }
  return total;
}

export function buyOutfit(g, outfit) {
  const target = outfit || g.player.outfit;
  const price = outfitPrice(target);
  if (g.cash < price) return false;
  g.cash -= price;
  g.player.outfit = { ...target };
  g.modal = null;
  showToast(g, `New outfit — $${price}.`);
  return true;
}
