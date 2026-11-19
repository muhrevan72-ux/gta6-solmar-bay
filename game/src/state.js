// Solmar Bay — the mutable game state. Pure data: no DOM, no WebGL,
// no localStorage here, so headless tests can drive it directly.
// Every system reads and writes this one object (via `game.state`).

import { RESPECT, TUNE } from './config.js';

export function newGameState() {
  return {
    // flow
    mode: 'menu', // menu | chapter | play | pause | busted | wasted | passed
    chapter: 1,
    chapterIntroShown: false,
    // player economy + body
    cash: 150,
    bank: 0,
    health: 100,
    armour: 0,
    bombs: 3,
    // wanted
    wanted: 0,
    // respect
    respect: 0,
    // weapons
    weapons: { pistol: true, smg: false, shotgun: false },
    weapon: 'pistol',
    ammo: { pistol: Infinity, smg: 0, shotgun: 0 },
    // outfit (indices into OUTFIT tables)
    outfit: { hair: 0, shirt: 0, pants: 0, shoes: 0 },
    // garage / ownership
    ownedCars: [],
    // one-time flags (respect unlocks, pickups taken, intro seen)
    flags: {},
    // clock: seconds since day 1, 06:00. Day length in TUNE.dayLengthSec.
    day: 1,
    clock: 6 * 3600,
    // stats
    stats: { kills: 0, copKills: 0, missionsDone: 0, sideJobsDone: 0, fares: 0, fires: 0, cashEarned: 0 },
    // player body (on foot)
    player: {
      x: -50, z: 0, heading: 0,
      vx: 0, vz: 0,
      speed: 0,
      bob: 0, // walk-cycle phase
      lean: 0,
      inCar: null, // vehicle object or null
      swimming: false,
      carryingCat: null,
      onTrain: false,
      onElevator: false,
    },
    // UI state (pure data; hud.js renders it)
    hud: {
      toasts: [], // {text, t}
      menu: null, // {title, body, hint} or null — the modal (pause/busted/wasted/passed)
      dialogue: null, // {name, role, text, t}
      card: null, // chapter intro card {title, text, t} or null
    },
  };
}

export function resetStateForNewGame(s) {
  const fresh = newGameState();
  fresh.mode = 'play';
  return fresh;
}

export function addCash(s, n) {
  s.cash += n;
  if (n > 0) s.stats.cashEarned += n;
}

export function addRespect(s, n) {
  s.respect += n;
  // Unlocks spawn once, tracked in flags.
  for (const u of RESPECT.unlocks) {
    if (s.respect >= u.min && !s.flags[u.flag]) {
      s.flags[u.flag] = true;
      showToast(s, 'RESPECT — unlocked: ' + u.label, 5);
    }
  }
}

export function showToast(s, text, dur) {
  s.hud.toasts.push({ text, t: dur || 3 });
  if (s.hud.toasts.length > 4) s.hud.toasts.shift();
}

export function stepToasts(s, dt) {
  for (const t of s.hud.toasts) t.t -= dt;
  s.hud.toasts = s.hud.toasts.filter((t) => t.t > 0);
  if (s.hud.dialogue) {
    s.hud.dialogue.t -= dt;
    if (s.hud.dialogue.t <= 0) s.hud.dialogue = null;
  }
}

export function showDialogue(s, name, role, text, dur) {
  s.hud.dialogue = { name, role, text, t: dur || 10 };
}

// Show the MODAL overlay (pause / busted / wasted / mission passed).
// This is a separate DOM element from the title screen (#hud-menu):
// the title screen is static HTML and is never overwritten by this.
export function showMenu(s, title, body, hint) {
  s.hud.menu = { title, body, hint: hint || 'Press Enter to continue.' };
}

export function hideMenu(s) {
  s.hud.menu = null;
}

export function damagePlayer(s, n) {
  // Armour absorbs first.
  let rest = n;
  if (s.armour > 0) {
    const absorbed = Math.min(s.armour, rest);
    s.armour -= absorbed;
    rest -= absorbed;
  }
  s.health -= rest;
  if (s.health < 0) s.health = 0;
}

export function healPlayer(s, n) {
  s.health = Math.min(100, s.health + n);
}

export function completionPct(s) {
  // story 60 (12 per chapter) + side jobs 20 + garage 8 + respect 12
  const story = Math.min(5, s.chapter - 1) * 12;
  const side = Math.min(20, s.stats.sideJobsDone * 4);
  const garage = Math.min(8, s.ownedCars.length * 2);
  const rep = Math.min(12, Math.floor(s.respect / 100));
  return Math.min(100, story + side + garage + rep);
}

export { TUNE };
