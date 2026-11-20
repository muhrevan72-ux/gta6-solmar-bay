// Solmar Bay — localStorage save/load.
//
// One slot: cash, bank, chapter progress, position, outfit, owned
// cars, unlocks, respect, stats. Guarded for Node (no
// localStorage) so headless tests can call it safely.

const KEY = 'solmar-bay-save-1';

export function saveGame(game) {
  if (typeof localStorage === 'undefined') return false;
  try {
    const data = {
      cash: game.cash,
      bank: game.bank,
      chapter: game.chapter,
      chapterDone: game.chapterDone,
      respect: game.respect,
      x: game.player.x,
      z: game.player.z,
      outfit: game.player.outfit,
      ownedCars: game.ownedCars,
      unlocks: game.unlocks,
      stats: game.stats,
      day: game.day,
      clock: game.clock,
      saveSlot: game.saveSlot,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame(game) {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    game.cash = data.cash ?? game.cash;
    game.bank = data.bank ?? 0;
    game.chapter = data.chapter ?? 1;
    game.chapterDone = data.chapterDone ?? 0;
    game.respect = data.respect ?? 0;
    game.player.x = data.x ?? game.player.x;
    game.player.z = data.z ?? game.player.z;
    game.player.outfit = data.outfit ?? game.player.outfit;
    game.ownedCars = data.ownedCars ?? [];
    game.unlocks = data.unlocks ?? game.unlocks;
    game.stats = data.stats ?? game.stats;
    game.day = data.day ?? 1;
    game.clock = data.clock ?? 8;
    return data;
  } catch (e) {
    return null;
  }
}

export function hasSave() {
  if (typeof localStorage === 'undefined') return false;
  try {
    return !!localStorage.getItem(KEY);
  } catch (e) {
    return false;
  }
}

export function clearSave() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(KEY);
  } catch (e) {
    // ignore
  }
}
