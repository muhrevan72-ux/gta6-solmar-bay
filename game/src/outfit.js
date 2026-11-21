// Solmar Bay — the outfit shop. Cycle a slot to preview it,
// buy the whole outfit at once (the total is the sum of the
// selected pieces).

import { OUTFIT, SPAWNS } from './config.js';
import { showToast } from './state.js';

export { OUTFIT };

const SLOTS = ['hair', 'shirt', 'pants', 'shoes'];

export function tryOutfitShop(g) {
  if (Math.hypot(g.player.x - SPAWNS.outfitDoor.x, g.player.z - SPAWNS.outfitDoor.z) > 6) return false;
  g.modal = { kind: 'outfit', title: 'Outfit Shop' };
  return true;
}

export function cycleOutfit(g, slot) {
  let name = null;
  if (typeof slot === 'string') name = slot;
  else if (typeof slot === 'number' && slot >= 0 && slot < SLOTS.length) name = SLOTS[slot];
  if (!name || !OUTFIT[name]) return false;
  const count = OUTFIT[name].length;
  g.player.outfit[name] = (g.player.outfit[name] + 1) % count;
  return true;
}

export function outfitTotal(g) {
  const o = g.player.outfit;
  let total = 0;
  for (const s of SLOTS) {
    const item = OUTFIT[s][o[s]];
    if (item) total += item.price;
  }
  return total;
}

export function buyOutfit(g) {
  const total = outfitTotal(g);
  if (g.cash < total) return false;
  g.cash -= total;
  g.modal = null;
  showToast(g, `New outfit — $${total}`);
  return true;
}
