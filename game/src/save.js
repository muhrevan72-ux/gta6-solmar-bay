// Solmar Bay — save / load (localStorage in the browser,
// a safe no-op in Node where there is no storage).
// The save holds progression only — chapter, cash, respect,
// completion, owned cars. It deliberately never stores the
// live player object.

function storage() {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) return globalThis.localStorage;
  } catch (e) { /* no storage */ }
  return null;
}

export function saveGame(g, slot = 1) {
  const ls = storage();
  if (!ls) return false;
  const data = {
    chapter: g.chapter,
    chapterDone: g.chapterDone,
    cash: g.cash,
    bank: g.bank,
    respect: g.respect,
    completion: g.completion,
    ownedCars: (g.ownedCars || []).map((c) => ({ name: c.name, kind: c.kind, color: c.color, condition: c.condition })),
    day: g.day,
    clock: g.clock,
  };
  try {
    ls.setItem(`solmar-bay-save-${slot}`, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame(g, slot = 1) {
  const ls = storage();
  if (!ls) return null;
  let raw = null;
  try { raw = ls.getItem(`solmar-bay-save-${slot}`); } catch (e) { return null; }
  if (!raw) return null;
  let data;
  try { data = JSON.parse(raw); } catch (e) { return null; }
  if (!data || typeof data !== 'object') return null;
  g.chapter = data.chapter ?? 1;
  g.chapterDone = data.chapterDone ?? 0;
  g.cash = data.cash ?? 150;
  g.bank = data.bank ?? 0;
  g.respect = data.respect ?? 0;
  g.completion = data.completion ?? 0;
  g.day = data.day ?? 1;
  g.clock = data.clock ?? 8;
  g.ownedCars = (data.ownedCars || []).map((c) => ({ name: c.name, kind: c.kind, color: c.color, condition: c.condition, driver: null, owned: true, speed: 0, x: 0, z: 0, heading: 0 }));
  return data;
}

export function hasSave(slot = 1) {
  const ls = storage();
  if (!ls) return false;
  try { return ls.getItem(`solmar-bay-save-${slot}`) !== null; } catch (e) { return false; }
}

export function clearSave(slot = 1) {
  const ls = storage();
  if (!ls) return false;
  try { ls.removeItem(`solmar-bay-save-${slot}`); return true; } catch (e) { return false; }
}
