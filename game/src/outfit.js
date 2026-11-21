// Solmar Bay — the outfit shop (Vice Threads).
// Written fresh for rebuild #18.

import { SPAWNS, OUTFIT } from './config.js';

const SLOTS = ['hair', 'shirt', 'pants', 'shoes'];

export function tryOutfitShop(g) {
  const door = SPAWNS.outfitDoor;
  const d = Math.hypot(g.player.x - door.x, g.player.z - door.z);
  if (d > 10) return false;
  g.modal = { kind: 'outfit', title: 'Vice Threads', lines: ['Pick a style, then buy'] };
  return true;
}

// Cycle one outfit slot forward (wraps). Returns false for a bad slot.
export function cycleOutfit(g, slot) {
  if (slot < 0 || slot > 3) return false;
  const key = SLOTS[slot];
  const list = OUTFIT[key];
  if (!list || list.length === 0) return false;
  if (!g.player.outfit) g.player.outfit = { hair: 0, shirt: 0, pants: 0, shoes: 0 };
  g.player.outfit[key] = (g.player.outfit[key] + 1) % list.length;
  return true;
}

// Buy the currently selected outfit (sum of the selected prices).
export function buyOutfit(g) {
  if (!g.player.outfit) return false;
  const o = g.player.outfit;
  const total =
    (OUTFIT.hair[o.hair] ? OUTFIT.hair[o.hair].price : 0) +
    (OUTFIT.shirt[o.shirt] ? OUTFIT.shirt[o.shirt].price : 0) +
    (OUTFIT.pants[o.pants] ? OUTFIT.pants[o.pants].price : 0) +
    (OUTFIT.shoes[o.shoes] ? OUTFIT.shoes[o.shoes].price : 0);
  if ((g.cash || 0) < total) return false;
  g.cash -= total;
  g.modal = null;
  return true;
}
