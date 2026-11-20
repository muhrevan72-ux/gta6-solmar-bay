// Solmar Bay — save / load (rebuild #13).
// Slot key 'solmar-bay-save-1'. Safe no-ops when localStorage
// does not exist (Node / headless tests).
const KEY = 'solmar-bay-save-1';

function storage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch (e) {
    return null;
  }
}

export function saveGame(g, slot = 1) {
  const s = storage();
  if (!s) return false;
  try {
    s.setItem(KEY, JSON.stringify({
      chapter: g.chapter,
      cash: g.cash,
      respect: g.respect,
      ownedCars: g.ownedCars,
      completion: g.completion,
    }));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame(g, slot = 1) {
  const s = storage();
  if (!s) return null;
  let raw = null;
  try {
    raw = s.getItem(KEY);
  } catch (e) {
    return null;
  }
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    g.chapter = data.chapter;
    g.cash = data.cash;
    g.respect = data.respect;
    g.ownedCars = data.ownedCars || [];
    g.completion = data.completion || 0;
    return data;
  } catch (e) {
    return null;
  }
}

export function hasSave(slot = 1) {
  const s = storage();
  if (!s) return false;
  try {
    return s.getItem(KEY) !== null;
  } catch (e) {
    return false;
  }
}

export function clearSave(slot = 1) {
  const s = storage();
  if (!s) return false;
  try {
    s.removeItem(KEY);
    return true;
  } catch (e) {
    return false;
  }
}
