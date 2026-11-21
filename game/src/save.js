// Solmar Bay — save / load (localStorage, slot 1).
// Written fresh for rebuild #18. No localStorage => no-op, no throw.

function store() {
  try {
    if (typeof globalThis.localStorage === 'undefined') return null;
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function saveGame(g, slot = 1) {
  const s = store();
  if (!s) return false;
  const data = {
    chapter: g.chapter,
    chapterDone: g.chapterDone,
    cash: g.cash,
    bank: g.bank,
    respect: g.respect,
    health: g.health,
    armour: g.armour,
    ownedCars: g.ownedCars || [],
    completion: g.completion,
    day: g.day,
    clock: g.clock,
    outfit: g.player ? g.player.outfit : null,
    weapon: g.weapon,
    stats: g.stats,
  };
  try {
    s.setItem(`solmar-bay-save-${slot}`, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(g, slot = 1) {
  const s = store();
  if (!s) return null;
  let raw = null;
  try {
    raw = s.getItem(`solmar-bay-save-${slot}`);
  } catch {
    return null;
  }
  if (!raw) return null;
  let data = null;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data) return null;
  g.chapter = data.chapter ?? g.chapter;
  g.chapterDone = data.chapterDone ?? g.chapterDone;
  g.cash = data.cash ?? g.cash;
  g.bank = data.bank ?? g.bank;
  g.respect = data.respect ?? g.respect;
  g.health = data.health ?? g.health;
  g.armour = data.armour ?? g.armour;
  g.ownedCars = data.ownedCars ?? g.ownedCars;
  g.completion = data.completion ?? g.completion;
  g.day = data.day ?? g.day;
  g.clock = data.clock ?? g.clock;
  if (data.outfit && g.player) g.player.outfit = data.outfit;
  if (typeof data.weapon === 'number') g.weapon = data.weapon;
  if (data.stats) g.stats = data.stats;
  return data;
}

export function hasSave(slot = 1) {
  const s = store();
  if (!s) return false;
  try {
    return s.getItem(`solmar-bay-save-${slot}`) !== null;
  } catch {
    return false;
  }
}

export function clearSave(slot = 1) {
  const s = store();
  if (!s) return false;
  try {
    s.removeItem(`solmar-bay-save-${slot}`);
    return true;
  } catch {
    return false;
  }
}
