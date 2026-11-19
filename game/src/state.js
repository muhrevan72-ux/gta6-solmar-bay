// Solmar Bay — game state machine + player progression.
// Plain data, no DOM: menu / playing / paused / busted / chapter intro.

import { PLAYER, WEAPONS, BOMB } from './config.js';

export const MODES = {
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  BUSTED: 'busted',
  CHAPTER: 'chapter',
  COMPLETE: 'complete',
};

export function createState() {
  return {
    mode: MODES.MENU,
    cash: 150,
    health: PLAYER.health,
    armor: 0,
    chapter: 0,          // 0..5 chapters done; 5 = story complete
    chapterActive: false,
    wanted: 0,
    wantedTimer: 0,      // seconds since last seen by police
    hiddenTimer: 0,
    weapon: 'pistol',
    ammo: { smg: 0, shotgun: 0 },
    bombs: BOMB.count,
    stats: {
      kills: 0,
      carsStolen: 0,
      missionsDone: 0,
      sideDone: 0,
      distanceDriven: 0,
      timePlayed: 0,
    },
    // transient UI bits the HUD reads
    toast: '',
    toastTimer: 0,
    objective: 'Steal a car and drive to the garage.',
    chapterTitle: '',
    chapterText: '',
    bustedReason: '',
    muted: false,
  };
}

export function resetState(state, fresh) {
  state.mode = MODES.PLAYING;
  state.health = PLAYER.health;
  state.armor = 0;
  state.wanted = 0;
  state.wantedTimer = 0;
  state.hiddenTimer = 0;
  state.weapon = 'pistol';
  state.ammo = { smg: 0, shotgun: 0 };
  state.bombs = BOMB.count;
  if (fresh) {
    state.cash = 150;
    state.chapter = 0;
    state.chapterActive = false;
    state.stats = { kills: 0, carsStolen: 0, missionsDone: 0, sideDone: 0, distanceDriven: 0, timePlayed: 0 };
    state.objective = 'Steal a car and drive to the garage.';
  }
}

export function addCash(state, amount) {
  state.cash += amount;
  state.toast = '+$' + amount;
  state.toastTimer = 1.6;
}

export function setToast(state, text, seconds = 2.2) {
  state.toast = text;
  state.toastTimer = seconds;
}

// Damage the player (armour absorbs first). Returns true if dead.
export function damagePlayer(state, amount) {
  let rest = amount;
  if (state.armor > 0) {
    const absorbed = Math.min(state.armor, rest);
    state.armor -= absorbed;
    rest -= absorbed;
  }
  state.health -= rest;
  if (state.health <= 0) {
    state.health = 0;
    return true;
  }
  return false;
}

export function healPlayer(state, amount) {
  state.health = Math.min(PLAYER.health, state.health + amount);
}

export function addArmor(state, amount) {
  state.armor = Math.min(100, state.armor + amount);
}

export function cycleWeapon(state, dir) {
  const order = ['pistol', 'smg', 'shotgun'];
  let i = order.indexOf(state.weapon);
  i = (i + dir + order.length) % order.length;
  state.weapon = order[i];
}

export function selectWeapon(state, name) {
  if (WEAPONS[name]) state.weapon = name;
}

// Current weapon's remaining ammo (Infinity for the pistol).
export function weaponAmmo(state) {
  if (state.weapon === 'pistol') return Infinity;
  return state.ammo[state.weapon] || 0;
}

export function spendAmmo(state) {
  if (state.weapon === 'pistol') return true;
  if ((state.ammo[state.weapon] || 0) <= 0) return false;
  state.ammo[state.weapon]--;
  return true;
}
