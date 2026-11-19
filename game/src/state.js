// Solmar Bay — the shared game state: cash, health, wanted, progress,
// stats and the mode machine (menu / playing / paused / busted / chapter).

export function createState() {
  return {
    mode: 'menu', // menu | playing | paused | busted | chapter | gameover
    cash: 150,
    bank: 0, // ATM balance
    health: 100,
    armour: 0,
    wanted: 0,
    chapter: 1,
    chapterStep: 0,
    chapterIntroShown: false,
    time: 0, // seconds in-game
    dayTime: 0.3, // 0..1 across the sunset
    interior: null, // { key, name, returnX, returnZ } while inside a shop
    stats: {
      carsStolen: 0,
      pedsKilled: 0,
      copsKilled: 0,
      missionsDone: 0,
      sideJobsDone: 0,
      cashEarned: 0,
      distanceDriven: 0,
      catsPet: 0,
      firesOut: 0,
      faresDone: 0,
    },
    // chapter/mission runtime fields, filled by missions.js
    mission: null,
    sideJob: null,
    toast: '',
    toastT: 0,
    // respect: grows with missions and side jobs, unlocks gear
    respect: 0,
    // dating / outfit / events runtime
    relationship: 0,
    outfit: { hair: 0, shirt: 0, pants: 0, shoes: 0 },
    flags: {},
  };
}

export function resetState(state, fresh) {
  state.mode = 'playing';
  state.health = 100;
  state.armour = 0;
  state.wanted = 0;
  state.chapterStep = 0;
  state.chapterIntroShown = false;
  state.mission = null;
  state.sideJob = null;
  state.toast = '';
  state.toastT = 0;
  if (fresh) {
    state.cash = 150;
    state.bank = 0;
    state.chapter = 1;
    state.time = 0;
    state.interior = null;
    state.respect = 0;
    state.relationship = 0;
    state.outfit = { hair: 0, shirt: 0, pants: 0, shoes: 0 };
    state.flags = {};
    state.stats = {
      carsStolen: 0,
      pedsKilled: 0,
      copsKilled: 0,
      missionsDone: 0,
      sideJobsDone: 0,
      cashEarned: 0,
      distanceDriven: 0,
      catsPet: 0,
      firesOut: 0,
      faresDone: 0,
    };
  }
}

export function addCash(state, amount) {
  state.cash += amount;
  if (amount > 0) state.stats.cashEarned += amount;
}

// Respect grows with missions and side jobs; levels and unlocks
// live in config.js (RESPECT). Returns the new total.
export function addRespect(state, amount) {
  state.respect = (state.respect || 0) + amount;
  return state.respect;
}

// The respect level for a total: the highest level whose min is met.
export function respectLevel(rep, levels) {
  let level = levels[0];
  for (const l of levels) {
    if (rep >= l.min) level = l;
  }
  return level;
}

export function showToast(state, text, seconds) {
  state.toast = text;
  state.toastT = seconds || 3;
}
