// Solmar Bay — outfit shop, Vice Threads (rebuild #13).
import { SPAWNS, OUTFIT } from './config.js';
import { showToast } from './state.js';

const SLOTS = ['hair', 'shirt', 'pants', 'shoes'];

export function tryOutfitShop(g) {
  const d = Math.hypot(g.player.x - SPAWNS.outfitDoor.x, g.player.z - SPAWNS.outfitDoor.z);
  if (d > 8) return false;
  g.modal = {
    kind: 'outfit',
    title: 'Vice Threads',
    lines: ['1. Hair  2. Shirt  3. Pants  4. Shoes — cycle to try on, Enter to buy'],
  };
  return true;
}

export function cycleOutfit(g, slot) {
  if (slot < 0 || slot >= SLOTS.length) return false;
  const key = SLOTS[slot];
  const items = OUTFIT[key];
  g.player.outfit[key] = (g.player.outfit[key] + 1) % items.length;
  return true;
}

export function buyOutfit(g) {
  const o = g.player.outfit;
  const total = OUTFIT.hair[o.hair].price + OUTFIT.shirt[o.shirt].price
    + OUTFIT.pants[o.pants].price + OUTFIT.shoes[o.shoes].price;
  if (g.cash < total) return false;
  g.cash -= total;
  g.modal = null;
  showToast(g, `New outfit — $${total}`);
  return true;
}
