// Solmar Bay — localStorage save / load. Cash, chapter, position,
// stats, weapons. Nothing sensitive.

import { SAVE_KEY } from './config.js';

export function saveGame(game) {
  try {
    const s = game.state;
    const p = game.player;
    const data = {
      cash: s.cash,
      chapter: s.chapter,
      chapterActive: s.chapterActive,
      weapon: s.weapon,
      ammo: s.ammo,
      bombs: s.bombs,
      stats: s.stats,
      player: { x: p.inVehicle ? p.inVehicle.x : p.x, z: p.inVehicle ? p.inVehicle.z : p.z },
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.chapter !== 'number') return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}
