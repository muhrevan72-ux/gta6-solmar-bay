// Solmar Bay — save / load via localStorage. Node-safe: in a
// headless test the storage object is an in-memory stand-in.

const KEY = 'solmar-bay-save-v1';

function storage() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch (e) {
    // fall through to the memory stand-in
  }
  if (!globalThis.__solmarMemoryStore) {
    globalThis.__solmarMemoryStore = {
      data: {},
      getItem(k) { return this.data[k] === undefined ? null : this.data[k]; },
      setItem(k, v) { this.data[k] = String(v); },
      removeItem(k) { delete this.data[k]; },
    };
  }
  return globalThis.__solmarMemoryStore;
}

export function saveGame(game) {
  const state = game.state;
  const p = game.player;
  const data = {
    cash: state.cash,
    chapter: state.chapter,
    health: state.health,
    armour: state.armour,
    relationship: state.relationship,
    outfit: state.outfit,
    x: p.x,
    z: p.z,
    stats: state.stats,
    savedAt: Date.now(),
  };
  try {
    storage().setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = storage().getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try {
    storage().removeItem(KEY);
  } catch (e) {
    // ignore
  }
}
