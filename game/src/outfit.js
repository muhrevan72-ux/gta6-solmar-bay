// Solmar Bay — outfit shop: change the player's look.
//
// A clothing shop building; press E to open the outfit menu (number
// keys cycle options). Changeable parts: hair, shirt, pants, shoes —
// each with a few options, bought with cash. The player's voxel body
// uses the chosen colours. The outfit persists in the save.

import { OUTFIT } from './config.js';
import { showToast } from './state.js';

const PARTS = ['hair', 'shirt', 'pants', 'shoes'];

export function createOutfit() {
  return {
    menuOpen: false,
    part: 0, // index into PARTS
  };
}

// Cycle one part to the next option (Digit1-4 pick the part, Digit5
// buys the current option). Called from main.js's key handling.
export function cyclePart(game, partIdx) {
  const s = game.state;
  const part = PARTS[partIdx];
  if (!part) return false;
  const opts = OUTFIT[part];
  const cur = s.outfit[part];
  const next = (cur + 1) % opts.length;
  s.outfit[part] = next;
  showToast(s, part + ': ' + opts[next].name + (opts[next].price > 0 ? ' ($' + opts[next].price + ' — press 5 to buy)' : ' (free)'), 2);
  return true;
}

export function buyCurrent(game) {
  const s = game.state;
  const part = PARTS[game.outfit.part];
  const opts = OUTFIT[part];
  const cur = s.outfit[part];
  const opt = opts[cur];
  if (opt.price <= 0) {
    showToast(s, opt.name + ' is already yours.', 2);
    return true;
  }
  if (s.cash < opt.price) {
    showToast(s, 'Not enough cash for ' + opt.name + ' ($' + opt.price + ').', 2);
    return false;
  }
  s.cash -= opt.price;
  showToast(s, 'Bought ' + opt.name + ' for $' + opt.price + '!', 2);
  return true;
}

// The outfit menu data for the HUD (part names + current option).
export function outfitMenuData(game) {
  const s = game.state;
  return PARTS.map((part, i) => ({
    part,
    current: OUTFIT[part][s.outfit[part]].name,
    price: OUTFIT[part][s.outfit[part]].price,
    selected: i === game.outfit.part,
  }));
}

export { PARTS, OUTFIT };
