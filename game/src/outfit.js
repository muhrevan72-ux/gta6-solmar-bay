// Solmar Bay — outfit shop: buy hair, shirts, pants and shoes and
// wear them. The shop is at (-120, 40); E at its door steps inside
// the interior (interiors.js), and the outfit menu opens at the
// counter inside. Outfit changes are visible on the player model
// (playerBoxes reads state.outfit) and persist in the save.

import { OUTFIT } from './config.js';
import { showToast, addCash } from './state.js';

export function createOutfit() {
  return {
    menuOpen: false,
    category: 'hair', // hair | shirt | pants | shoes
  };
}

// Buy the next item in a category (cycles through the table).
export function buyOutfit(game, category) {
  const s = game.state;
  const table = OUTFIT[category];
  if (!table) return false;
  const next = (s.outfit[category] + 1) % table.length;
  const item = table[next];
  if (s.cash < item.price) {
    showToast(s, 'Not enough cash for ' + item.name + ' ($' + item.price + ').', 3);
    return false;
  }
  addCash(s, -item.price);
  s.outfit[category] = next;
  showToast(s, 'You bought ' + item.name + ' (-$' + item.price + '). Looking sharp!', 4);
  return true;
}

export function outfitMenuText(game) {
  const s = game.state;
  const lines = [];
  for (const cat of ['hair', 'shirt', 'pants', 'shoes']) {
    const table = OUTFIT[cat];
    const cur = table[s.outfit[cat]];
    const next = table[(s.outfit[cat] + 1) % table.length];
    lines.push(cat + ': ' + cur.name + ' → next ' + next.name + ' ($' + next.price + ')');
  }
  return lines.join(' · ');
}

export function outfitBoxes(game, out) {
  // Racks inside the outfit shop interior (room coordinates).
  const room = { x: 0, z: 380 };
  out.pushBox(room.x - 5, 0.7, room.z - 3, 1, 1.4, 0.5, [0.8, 0.6, 0.4]);
  out.pushBox(room.x + 5, 0.7, room.z - 3, 1, 1.4, 0.5, [0.6, 0.8, 0.4]);
  out.pushBox(room.x - 5, 0.7, room.z + 3, 1, 1.4, 0.5, [0.4, 0.6, 0.8]);
  out.pushBox(room.x + 5, 0.7, room.z + 3, 1, 1.4, 0.5, [0.8, 0.4, 0.6]);
}
