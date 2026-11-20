// Solmar Bay — save/load.
//
// One localStorage slot per save slot. Every call is try/catch
// guarded: a save must NEVER throw and kill the game loop (the
// pause handler calls saveGame, and a throw there would freeze
// the game with no visible error).

const KEY = 'solmar-bay-save-';

export function saveGame(game, slot) {
  try {
    if (typeof localStorage === 'undefined') return false;
    const data = {
      cash: game.cash,
      bank: game.bank,
      chapter: game.chapter,
      chapterDone: game.chapterDone,
      completion: game.completion,
      respect: game.respect,
      day: game.day,
      clock: game.clock,
      ownedCars: game.ownedCars,
      unlocks: game.unlocks,
      outfit: game.player.outfit,
      stats: game.stats,
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY + (slot || game.saveSlot || 1), JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame(game, slot) {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(KEY + (slot || game.saveSlot || 1));
    if (!raw) return null;
    const data = JSON.parse(raw);
    game.cash = data.cash;
    game.bank = data.bank;
    game.chapter = data.chapter;
    game.chapterDone = data.chapterDone;
    game.completion = data.completion;
    game.respect = data.respect;
    game.day = data.day;
    game.clock = data.clock;
    game.ownedCars = data.ownedCars || [];
    game.unlocks = data.unlocks || game.unlocks;
    game.player.outfit = data.outfit || game.player.outfit;
    game.stats = data.stats || game.stats;
    return data;
  } catch (e) {
    return null;
  }
}

export function hasSave(slot) {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(KEY + (slot || 1)) !== null;
  } catch (e) {
    return false;
  }
}

export function clearSave(slot) {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.removeItem(KEY + (slot || 1));
    return true;
  } catch (e) {
    return false;
  }
}
