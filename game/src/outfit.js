// Solmar Bay — the outfit shop (rebuild #15).
// Vice Threads at the outfit door. Cycle a slot to preview, buy
// to pay the total of the selected items and close the modal.

import { OUTFIT, SPAWNS } from './config.js';
import { showToast } from './state.js';

export { OUTFIT };

const SLOTS = ['hair', 'shirt', 'pants', 'shoes'];

export function tryOutfitShop(g) {
  const d = Math.hypot(g.player.x - SPAWNS.outfitDoor.x, g.player.z - SPAWNS.outfitDoor.z);
  if (d > 6) return false;
  g.modal = { kind: 'outfit', title: 'Vice Threads', lines: SLOTS.map((s) => `${s}: ${OUTFIT[s][g.player.outfit[s]].name}`) };
  return true;
}

export function cycleOutfit(g, slot) {
  const key = SLOTS[slot];
  if (!key) return false;
  const list = OUTFIT[key];
  g.player.outfit[key] = (g.player.outfit[key] + 1) % list.length;
  if (g.modal && g.modal.kind === 'outfit') {
    g.modal.lines = SLOTS.map((s) => `${s}: ${OUTFIT[s][g.player.outfit[s]].name}`);
  }
  return true;
}

export function buyOutfit(g) {
  const o = g.player.outfit;
  let total = 0;
  for (const key of SLOTS) total += (OUTFIT[key][o[key]] || { price: 0 }).price;
  if (g.cash < total) return false;
  g.cash -= total;
  g.modal = null;
  showToast(g, `New outfit! -$${total}`);
  return true;
}
