// Solmar Bay — localStorage save / load. Guarded: with no
// localStorage (Node tests) every call is a safe no-op / null.

const KEY = 'solmar-bay-save-v1';

export function saveGame(game) {
  try {
    if (typeof localStorage === 'undefined') return false;
    const s = game.state;
    const data = {
      cash: s.cash,
      chapter: s.chapter,
      chapterActive: s.chapterActive,
      weapon: s.weapon,
      ammo: s.ammo,
      bombs: s.bombs,
      outfit: s.outfit,
      relationship: s.relationship,
      accuracyBonus: s.accuracyBonus,
      handlingBonus: s.handlingBonus,
      stats: s.stats,
      player: { x: game.player.x, z: game.player.z },
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function clearSave() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(KEY);
  } catch (e) { /* ignore */ }
}
