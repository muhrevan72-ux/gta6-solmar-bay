// Saving to this browser's localStorage: cash, mission progress, the
// player's spot, and the run's stats. Every call is guarded, so a
// private window or a disabled store just means the save does not last.
import { SAVE_KEY } from './config.js';

export function hasSave() {
  try {
    return window.localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

export function saveGame(state) {
  try {
    const data = {
      cash: state.cash,
      missionIndex: state.mission.index,
      missionsDone: state.stats.missionsDone,
      playerX: state.player.x,
      playerY: state.player.y,
      health: state.player.health,
      armor: state.player.armor,
      stats: state.stats,
      time: state.time,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}
