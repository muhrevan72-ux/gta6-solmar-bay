// Solmar Bay — outfit shop: change the player's look from hair to
// shoes. Walk up to the clothing shop downtown, press E, then press
// 1/2/3/4 to cycle hair / shirt / pants / shoes. Each cycle buys the
// next option if the player can afford it. The outfit persists in
// the save (see save.js).

import { OUTFIT, dist } from './config.js';
import { setToast } from './state.js';

export const OUTFIT_PARTS = ['hair', 'shirt', 'pants', 'shoes'];

export function createOutfit() {
  return { menuOpen: false };
}

export function openOutfitMenu(game) {
  game.outfit.menuOpen = true;
  setToast(game.state, 'Outfit shop — 1 hair, 2 shirt, 3 pants, 4 shoes. Esc to leave.', 4);
}

export function closeOutfitMenu(game) {
  game.outfit.menuOpen = false;
}

// Cycle one part to its next option, buying it if affordable.
export function cycleOutfit(game, part) {
  const state = game.state;
  const options = OUTFIT[part];
  const next = (state.outfit[part] + 1) % options.length;
  const opt = options[next];
  if (state.cash < opt.price) {
    setToast(state, opt.name + ' costs $' + opt.price + ' — not enough cash.', 2);
    return false;
  }
  state.cash -= opt.price;
  state.outfit[part] = next;
  setToast(state, part + ': ' + opt.name + (opt.price > 0 ? ' (-$' + opt.price + ')' : ''), 2);
  if (game.audio) game.audio.blip(700, 0.08);
  return true;
}

export function drawOutfit(renderer, game) {
  const s = game.city.spawns.outfitShop;
  renderer.box(s.x, 5.2, s.z - 10, 8, 1.6, 0.5, [0.9, 0.4, 0.7], 1);
  renderer.box(s.x, 5.2, s.z + 10, 8, 1.6, 0.5, [0.9, 0.4, 0.7], 1);
}

export { dist };
