// Solmar Bay — the outfit shop (Vice Threads).
//
// Cycle the four slots (hair, shirt, pants, shoes) and buy the
// whole outfit for the catalogue total. The set in the suite
// (hair 2, shirt 1, pants 1, shoes 1) costs $155.

import { OUTFIT, SPAWNS } from './config.js';

const SLOTS = ['hair', 'shirt', 'pants', 'shoes'];

export function tryOutfitShop(g) {
  if (Math.hypot(g.player.x - SPAWNS.outfitDoor.x, g.player.z - SPAWNS.outfitDoor.z) > 4) return false;
  g.modal = {
    kind: 'outfit',
    title: 'Vice Threads',
    lines: SLOTS.map((slot) => {
      const list = OUTFIT[slot];
      const cur = list[g.player.outfit[slot]] || list[0];
      return `${slot}: ${cur.name} — $${cur.price}`;
    }),
  };
  return true;
}

export function cycleOutfit(g, slot) {
  if (slot < 0 || slot >= SLOTS.length) return false;
  const key = SLOTS[slot];
  const list = OUTFIT[key];
  g.player.outfit[key] = ((g.player.outfit[key] || 0) + 1) % list.length;
  return true;
}

// Buy the whole outfit: the catalogue total for the selected set.
export function buyOutfit(g) {
  const o = g.player.outfit || { hair: 0, shirt: 0, pants: 0, shoes: 0 };
  let total = 0;
  for (const slot of SLOTS) {
    const item = OUTFIT[slot][o[slot]] || OUTFIT[slot][0];
    total += item.price;
  }
  if ((g.cash || 0) < total) return false;
  g.cash -= total;
  g.modal = null;
  return true;
}
