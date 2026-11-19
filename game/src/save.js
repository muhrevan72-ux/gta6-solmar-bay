// Solmar Bay — save/load via localStorage.
// Saved: cash, bank, mission progress, position, respect, outfit,
// owned cars, flags, stats, chapter. Guarded: with no localStorage
// (headless tests) the functions no-op / return null.

const KEY = 'solmar-bay-save-v1';

export function saveGame(game) {
  if (typeof localStorage === 'undefined') return false;
  const s = game.state;
  const data = {
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
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame(game) {
  if (typeof localStorage === 'undefined') return null;
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch (e) {
    return null;
  }
  if (!raw) return null;
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return null;
  }
  const s = game.state;
  s.cash = data.cash;
  s.bank = data.bank || 0;
  s.health = data.health;
  s.armour = data.armour || 0;
  s.bombs = data.bombs;
  s.respect = data.respect || 0;
  s.weapons = { pistol: true, smg: !!data.weapons.smg, shotgun: !!data.weapons.shotgun };
  s.ammo.smg = data.ammo ? data.ammo.smg : 0;
  s.ammo.shotgun = data.ammo ? data.ammo.shotgun : 0;
  s.outfit = data.outfit || s.outfit;
  s.ownedCars = data.ownedCars || [];
  s.flags = data.flags || {};
  s.chapter = data.chapter || 1;
  s.day = data.day || 1;
  s.clock = data.clock || 6 * 3600;
  s.stats = data.stats || s.stats;
  if (data.player) {
    s.player.x = data.player.x;
    s.player.z = data.player.z;
    s.player.heading = data.player.heading;
  }
  game.missions.chapter = s.chapter;
  game.weather.time = s.clock;
  game.weather.day = s.day;
  return data;
}

export function hasSave() {
  if (typeof localStorage === 'undefined') return false;
  try {
    return !!localStorage.getItem(KEY);
  } catch (e) {
    return false;
  }
}
