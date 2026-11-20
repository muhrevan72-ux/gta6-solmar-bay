// Solmar Bay — save / load.
//
// One slot per key ('solmar-bay-save-1'). Only progress is saved —
// chapter, cash, respect, completion and the owned cars. The player
// position is deliberately NOT saved: loading always restarts the
// player at the spawn. In Node (no localStorage) every call is a
// safe no-op returning false / null.

const KEY = 'solmar-bay-save-1';

function storage() {
  try {
    return typeof globalThis !== 'undefined' && globalThis.localStorage ? globalThis.localStorage : null;
  } catch {
    return null;
  }
}

export function saveGame(g, slot = 1) {
  const store = storage();
  if (!store) return false;
  try {
    const data = {
      chapter: g.chapter || 1,
      cash: g.cash || 0,
      respect: g.respect || 0,
      completion: g.completion || 0,
      ownedCars: g.ownedCars || [],
    };
    store.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(g, slot = 1) {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.chapter !== undefined) g.chapter = data.chapter;
    if (data.cash !== undefined) g.cash = data.cash;
    if (data.respect !== undefined) g.respect = data.respect;
    if (data.completion !== undefined) g.completion = data.completion;
    if (data.ownedCars !== undefined) g.ownedCars = data.ownedCars;
    return data;
  } catch {
    return null;
  }
}

export function hasSave(slot = 1) {
  const store = storage();
  if (!store) return false;
  try {
    return store.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

export function clearSave(slot = 1) {
  const store = storage();
  if (!store) return false;
  try {
    store.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}
