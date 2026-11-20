// Solmar Bay — save/load via localStorage (slot 1). The player's
// position is NOT saved; chapter, cash, respect, owned cars and
// completion are. Without localStorage every call is a safe no-op.

const KEY = (slot) => `solmar-bay-save-${slot || 1}`;

export function saveGame(g, slot) {
  if (typeof localStorage === 'undefined') return false;
  try {
    const data = {
      chapter: g.chapter,
      chapterDone: g.chapterDone || 0,
      cash: g.cash,
      respect: g.respect || 0,
      // The garage cars, as full car objects (name/colour/condition/kind).
      ownedCars: (g.ownedCars || []).map(c => ({ name: c.name, colour: c.colour, condition: c.condition, kind: c.kind })),
      completion: g.completion || 0,
      bank: g.bank || 0,
      day: g.day,
      clock: g.clock,
    };
    localStorage.setItem(KEY(slot), JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame(g, slot) {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY(slot));
    if (!raw) return null;
    const data = JSON.parse(raw);
    g.chapter = data.chapter || 1;
    g.chapterDone = data.chapterDone || 0;
    g.cash = data.cash ?? 150;
    g.respect = data.respect || 0;
    g.completion = data.completion || 0;
    g.bank = data.bank || 0;
    g.day = data.day || 1;
    g.clock = data.clock ?? 8;
    if (data.ownedCars) {
      g.ownedCars = data.ownedCars.map(c => ({ name: c.name, colour: c.colour, condition: c.condition, kind: c.kind }));
      for (const v of g.vehicles || []) {
        if (data.ownedCars.some(c => c.name === v.name)) v.owned = true;
      }
    }
    return data;
  } catch (e) {
    return null;
  }
}

export function hasSave(slot) {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(KEY(slot)) !== null;
  } catch (e) {
    return false;
  }
}

export function clearSave(slot) {
  if (typeof localStorage === 'undefined') return false;
  try {
    localStorage.removeItem(KEY(slot));
    return true;
  } catch (e) {
    return false;
  }
}
