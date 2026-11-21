// Solmar Bay — save and load.
//
// One slot per key ('solmar-bay-save-1'). A save carries the run —
// chapter, cash, respect, owned cars, completion — but never the
// player's position, so loading always drops the player back at the
// spawn. Without a storage backend (plain Node) every call fails
// softly: save returns false, load returns null, hasSave is false.

function storage() {
  if (typeof globalThis === 'undefined') return null;
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

function key(slot) {
  return `solmar-bay-save-${slot || 1}`;
}

export function saveGame(g, slot) {
  const store = storage();
  if (!store) return false;
  const data = {
    chapter: g.chapter,
    chapterDone: g.chapterDone,
    cash: g.cash,
    respect: g.respect,
    ownedCars: g.ownedCars,
    completion: g.completion,
    day: g.day,
    clock: g.clock,
    unlocks: g.unlocks,
  };
  try {
    store.setItem(key(slot), JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(g, slot) {
  const store = storage();
  if (!store) return null;
  let raw = null;
  try {
    raw = store.getItem(key(slot));
  } catch {
    return null;
  }
  if (!raw) return null;
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data.chapter === 'number') g.chapter = data.chapter;
  if (typeof data.chapterDone === 'number') g.chapterDone = data.chapterDone;
  if (typeof data.cash === 'number') g.cash = data.cash;
  if (typeof data.respect === 'number') g.respect = data.respect;
  if (Array.isArray(data.ownedCars)) g.ownedCars = data.ownedCars;
  if (typeof data.completion === 'number') g.completion = data.completion;
  if (typeof data.day === 'number') g.day = data.day;
  if (typeof data.clock === 'number') g.clock = data.clock;
  if (data.unlocks) g.unlocks = data.unlocks;
  return data;
}

export function hasSave(slot) {
  const store = storage();
  if (!store) return false;
  try {
    return store.getItem(key(slot)) !== null;
  } catch {
    return false;
  }
}

export function clearSave(slot) {
  const store = storage();
  if (!store) return false;
  try {
    store.removeItem(key(slot));
    return true;
  } catch {
    return false;
  }
}
