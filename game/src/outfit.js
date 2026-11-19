// Solmar Bay — outfit shop. A clothing shop building; press E to
// open the menu, number keys cycle hair / shirt / pants / shoes,
// each option bought with cash. The player's voxel body uses the
// chosen colours, and the outfit persists in the save.

import { OUTFIT } from './config.js';
import { showToast } from './state.js';
import { showMenu } from './hud.js';

export function showOutfitMenu(game) {
  const o = game.player.outfit;
  const parts = ['hair', 'shirt', 'pants', 'shoes'];
  const lines = parts.map((part, i) => {
    const opts = OUTFIT[part];
    const cur = opts[o[part]];
    return (i + 1) + '. ' + part + ': ' + cur.name + (cur.price ? ' ($' + cur.price + ')' : ' (owned)');
  }).join('<br>');
  showMenu(game.hud, 'Outfit Shop', lines, 'Press 1-4 to cycle a part, Esc to close. Cash: $' + game.state.cash);
}

export function createOutfit() {
  return {
    open: false,
    shop: { x: -50, z: 150 },
  };
}

export function buyOutfitPart(game, part) {
  const state = game.state;
  const outfit = game.player.outfit;
  const options = OUTFIT[part];
  if (!options) return false;
  const next = (outfit[part] + 1) % options.length;
  const item = options[next];
  if (item.price > 0 && state.cash < item.price) {
    showToast(state, 'Not enough cash for the ' + item.name + ' ($' + item.price + ').', 2);
    return false;
  }
  state.cash -= item.price;
  outfit[part] = next;
  showToast(state, part + ': ' + item.name + (item.price ? ' (-$' + item.price + ')' : ''), 2);
  if (game.audio) game.audio.play('pickup');
  return true;
}

export function outfitBoxes(shop) {
  return [
    { x: shop.x, y: 2, z: shop.z, sx: 12, sy: 4, sz: 9, c: [0.75, 0.4, 0.85] },
    { x: shop.x, y: 4.4, z: shop.z + 4.6, sx: 9, sy: 1.0, sz: 0.5, c: [1, 0.3, 0.6] },
    { x: shop.x, y: 1.2, z: shop.z + 4.8, sx: 3, sy: 2.4, sz: 0.4, c: [0.95, 0.9, 0.7] },
  ];
}
