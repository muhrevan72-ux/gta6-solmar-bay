// Solmar Bay — localStorage save/load (save slot 1).
//
// Saves cash, bank, health, armour, bombs, respect, weapons, ammo,
// outfit, owned cars, flags, chapter, day, clock, stats and the
// player position. Wanted is never saved (a fresh load starts clean).
// All storage access is guarded: in a browser without localStorage
// (or a blocked one) the game simply plays without saving.

const SAVE_KEY = 'solmar-bay-save-v1';

export function saveGame(game) {
  if (typeof localStorage === 'undefined') return false;
  const s = game.state;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: s.cash,
      bank: s.bank,
      health: s.health,
      armour: s.armour,
      bombs: s.bombs,
      wanted: 0,
      respect: s.respect,
      weapons: s.weapons,
      ammo: { smg: s.ammo.smg, shotgun: s.ammo.shotgun },
      outfit: s.outfit,
      ownedCars: s.ownedCars,
      flags: s.flags,
      chapter: s.chapter,
      day: s.day,
      clock: s.clock,
      stats: s.stats,
      player: { x: s.player.x, z: s.player.z, heading: s.player.heading },
    }));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame(game) {
  if (typeof localStorage === 'undefined') return false;
  let raw = null;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch (e) {
    return false;
  }
  if (!raw) return false;
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return false;
  }
  const s = game.state;
  s.cash = data.cash ?? 150;
  s.bank = data.bank ?? 0;
  s.health = data.health ?? 100;
  s.armour = data.armour ?? 0;
  s.bombs = data.bombs ?? 3;
  s.wanted = 0;
  s.respect = data.respect ?? 0;
  if (data.weapons) s.weapons = data.weapons;
  if (data.ammo) {
    s.ammo.smg = data.ammo.smg ?? 0;
    s.ammo.shotgun = data.ammo.shotgun ?? 0;
  }
  if (data.outfit) s.outfit = data.outfit;
  s.ownedCars = data.ownedCars || [];
  s.flags = data.flags || {};
  s.chapter = data.chapter ?? 1;
  s.day = data.day ?? 1;
  s.clock = data.clock ?? 6 * 3600;
  if (data.stats) s.stats = data.stats;
  if (data.player) {
    s.player.x = data.player.x;
    s.player.z = data.player.z;
    s.player.heading = data.player.heading || 0;
  }
  return true;
}

export function hasSave() {
  if (typeof localStorage === 'undefined') return false;
  try {
    return !!localStorage.getItem(SAVE_KEY);
  } catch (e) {
    return false;
  }
}
