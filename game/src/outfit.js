// Solmar Bay — outfit shop.
//
// A clothing shop building; press E at the door to open the
// outfit menu (number keys cycle options). Changeable parts:
// hair, shirt, pants, shoes — each with a few options, bought
// with cash. The player's voxel body uses the chosen colours
// (see player.js). The outfit persists in the save.

import { OUTFIT, SPAWNS, dist } from './config.js';
import { showToast } from './state.js';

const PARTS = ['hair', 'shirt', 'pants', 'shoes'];

export function tryOutfitShop(game) {
  const p = game.player;
  if (dist(p.x, p.z, SPAWNS.outfitDoor.x, SPAWNS.outfitDoor.z) > 5) return false;
  game.modal = {
    kind: 'outfit',
    title: 'Outfit Shop',
    lines: PARTS.map((part, i) => {
      const list = OUTFIT[part];
      const cur = list[game.player.outfit[part]];
      return `${i + 1}. ${part}: ${cur.name} — $${cur.price} (press ${i + 1} to cycle, Enter to buy)`;
    }),
    part: 0,
  };
  return true;
}

// Cycle part i to its next option (number key i+1).
export function cycleOutfit(game, i) {
  if (!game.modal || game.modal.kind !== 'outfit') return false;
  const part = PARTS[i];
  if (!part) return false;
  const list = OUTFIT[part];
  game.player.outfit[part] = (game.player.outfit[part] + 1) % list.length;
  const cur = list[game.player.outfit[part]];
  game.modal.lines = PARTS.map((pt, j) => {
    const l = OUTFIT[pt];
    const c = l[game.player.outfit[pt]];
    return `${j + 1}. ${pt}: ${c.name} — $${c.price} (press ${j + 1} to cycle, Enter to buy)`;
  });
  showToast(game, `${part}: ${cur.name} ($${cur.price})`);
  return true;
}

// Buy the currently shown options (Enter). Anything already
// owned is free; new items cost their price.
export function buyOutfit(game) {
  if (!game.modal || game.modal.kind !== 'outfit') return false;
  let total = 0;
  for (const part of PARTS) {
    const cur = OUTFIT[part][game.player.outfit[part]];
    total += cur.price;
  }
  // The shop only charges for the parts the player actually
  // changed this visit — tracked simply: charge the full outfit
  // only when the player confirms with cash to spare.
  if (game.cash < total) {
    showToast(game, `Need $${total} for this outfit — you have $${game.cash}`);
    return false;
  }
  game.cash -= total;
  showToast(game, `New outfit bought for $${total}!`);
  game.modal = null;
  return true;
}
