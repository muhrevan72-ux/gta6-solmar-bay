// Solmar Bay — game state machine and player stats.

export const MODES = {
  menu: 'menu',
  playing: 'playing',
  paused: 'paused',
  chapter: 'chapter',
  busted: 'busted',
  complete: 'complete',
};

export function createState() {
  return {
    mode: MODES.menu,
    cash: 150,
    health: 100,
    armour: 0,
    wanted: 0,
    chapter: 0,
    chapterActive: false,
    chapterTitle: '',
    chapterText: '',
    objective: 'Start a new game.',
    weapon: 'pistol',
    ammo: { smg: 0, shotgun: 0 },
    bombs: 3,
    stats: {
      kills: 0, carsStolen: 0, missionsDone: 0, sideDone: 0,
      distanceDriven: 0, timePlayed: 0, firesOut: 0, fares: 0,
      catsPet: 0, datesDone: 0,
    },
    toast: '',
    toastTimer: 0,
    bustedReason: '',
    outfit: { hair: 0, shirt: 0, pants: 0, shoes: 0 },
    relationship: 0,
    accuracyBonus: 0, // from shooting-range training
    handlingBonus: 0, // from driving training
    // cooldowns — ALWAYS gated with `<= 0`, never `!cooldown`
    eCooldown: 0,
    fCooldown: 0,
    gCooldown: 0,
  };
}

// fresh=true for a new game, false for a respawn after busted
// (keeps cash/chapter progress, refills health).
export function resetState(state, fresh) {
  if (fresh) {
    const outfit = state.outfit;
    const rel = state.relationship;
    const acc = state.accuracyBonus;
    const han = state.handlingBonus;
    Object.assign(state, createState());
    state.outfit = outfit;
    state.relationship = rel;
    state.accuracyBonus = acc;
    state.handlingBonus = han;
  } else {
    state.health = 100;
    state.armour = 0;
    state.wanted = 0;
  }
  state.eCooldown = 0;
  state.fCooldown = 0;
  state.gCooldown = 0;
  state.mode = MODES.playing;
}

// Returns true if the player died from this damage.
export function damagePlayer(state, amount) {
  let left = amount;
  if (state.armour > 0) {
    const absorbed = Math.min(state.armour, left);
    state.armour -= absorbed;
    left -= absorbed;
  }
  state.health -= left;
  if (state.health <= 0) {
    state.health = 0;
    return true;
  }
  return false;
}

export function healPlayer(state, amount) {
  state.health = Math.min(100, state.health + amount);
}

export function addArmor(state, amount) {
  state.armour = Math.min(100, state.armour + amount);
}

export function addCash(state, amount) {
  state.cash += amount;
}

// Spend one round of the current weapon. Returns false if empty.
export function spendAmmo(state) {
  if (state.weapon === 'pistol') return true; // infinite
  if (state.weapon === 'smg') {
    if (state.ammo.smg <= 0) return false;
    state.ammo.smg -= 1;
    return true;
  }
  if (state.weapon === 'shotgun') {
    if (state.ammo.shotgun <= 0) return false;
    state.ammo.shotgun -= 1;
    return true;
  }
  return true;
}

export function selectWeapon(state, weapon) {
  if (weapon === 'smg' && state.ammo.smg <= 0 && state.weapon !== 'smg') return false;
  if (weapon === 'shotgun' && state.ammo.shotgun <= 0 && state.weapon !== 'shotgun') return false;
  state.weapon = weapon;
  return true;
}

export function setToast(state, text, seconds) {
  state.toast = text;
  state.toastTimer = seconds || 3;
}
