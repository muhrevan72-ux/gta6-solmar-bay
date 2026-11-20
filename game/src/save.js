// Solmar Bay — save / load (rebuild #14).
// Slot 1 under the key 'solmar-bay-save-1'. Progress only
// (chapter, cash, respect, completion, owned cars) — never the
// player position. Safe no-ops when localStorage is absent (Node).

const KEY = 'solmar-bay-save-1';

function store() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch (e) {
    return null;
  }
}

export function saveGame(g, slot) {
  const s = store();
  if (!s) return false;
  const data = {
    chapter: g.chapter,
    chapterDone: g.chapterDone,
    cash: g.cash,
    bank: g.bank,
    respect: g.respect,
    completion: g.completion,
    ownedCars: g.ownedCars || [],
    outfit: g.player ? g.player.outfit : null,
  };
  try {
    s.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame(g, slot) {
  const s = store();
  if (!s) return null;
  let raw;
  try {
    raw = s.getItem(KEY);
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
  if (typeof data.cash === 'number') g.cash = data.cash;
  if (typeof data.chapter === 'number') g.chapter = data.chapter;
  if (typeof data.chapterDone === 'number') g.chapterDone = data.chapterDone;
  if (typeof data.respect === 'number') g.respect = data.respect;
  if (typeof data.completion === 'number') g.completion = data.completion;
  if (typeof data.bank === 'number') g.bank = data.bank;
  if (Array.isArray(data.ownedCars)) g.ownedCars = data.ownedCars;
  if (data.outfit && g.player) g.player.outfit = data.outfit;
  return data;
}

export function hasSave(slot) {
  const s = store();
  if (!s) return false;
  try {
    return s.getItem(KEY) !== null;
  } catch (e) {
    return false;
  }
}

export function clearSave(slot) {
  const s = store();
  if (!s) return false;
  try {
    s.removeItem(KEY);
    return true;
  } catch (e) {
    return false;
  }
}
