// Solmar Bay — game state (rebuild #15).
// The game object IS the state: cash, health, chapter, the player
// and the world lists all live directly on it, and `g` points back
// at itself so both `game.cash` and `game.g.cash` read the same
// thing (the boot path and the logic-only path share this shape).

import { SPAWNS, CHAPTERS } from './config.js';

// Deterministic RNG (mulberry32) so a seeded run replays.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function defaultOutfit() {
  return { hair: 0, shirt: 0, pants: 0, shoes: 0 };
}

export function chapterTitle(g) {
  const ch = CHAPTERS[g.chapter - 1];
  return ch ? ch.title : 'Free Roam';
}

export function completionPercent(g) {
  return (g.chapterDone || 0) * 16;
}

export function showToast(g, text) {
  g.toast = text;
  g.toastTimer = 3;
}

export function showDialogue(g, name, role, text) {
  g.dialogue = { name, role, text, t: 10 };
  g.dialogueTimer = 10;
}

export function addCash(g, amount, label) {
  g.cash += amount;
  showToast(g, `+$${amount}${label ? ' ' + label : ''}`);
}

// Reset the state to a fresh game. Keeps the object identity (and
// the `g` self-reference) so anything holding the game keeps working.
export function newGame(g) {
  g.mode = 'menu';
  g.cash = 150;
  g.bank = 0;
  g.health = 100;
  g.armour = 0;
  g.wanted = 0;
  g.chapter = 1;
  g.chapterDone = 0;
  g.completion = 0;
  g.clock = 8;
  g.day = 1;
  g.time = 0;
  g.respect = 0;
  g.bombs = 3;
  g.station = 0;
  g.muted = false;
  g.rain = 0;
  g.toast = '';
  g.toastTimer = 0;
  g.dialogue = '';
  g.dialogueTimer = 0;
  g.paused = false;
  g.phoneOpen = false;
  g.phoneTab = 'messages';
  g.modal = null;
  g.card = null;
  g.menu = 'main';
  g.ownedCars = [];
  // The outfit lives on the player (g.player.outfit); g.outfit is
  // the same object so either access reads the same wardrobe.
  const outfit = defaultOutfit();
  g.outfit = outfit;
  g.smgUnlocked = false;
  g.shotgunUnlocked = false;
  g.cometUnlocked = false;
  g.unlocks = { smgUnlocked: false, shotgunUnlocked: false, sportsCarSpawned: false };
  g.player = {
    x: SPAWNS.player.x, z: SPAWNS.player.z,
    y: 0, heading: 0, speed: 0,
    weapon: 0, ammo: [Infinity, 0, 0, 0],
    inCar: null, onTrain: false, carryingCat: null,
    graceTimer: 0, shootCooldown: 0, punchCooldown: 0, bombCooldown: 0,
    damageCooldown: 0, onDate: false, dateTimer: 0,
    outfit,
  };
  g.stats = { kills: 0, fishCaught: 0, firesOut: 0, fares: 0 };
  g.g = g;
  return g;
}

export function createGame() {
  const g = {
    rng: mulberry32(1337),
    vehicles: [], peds: [], cops: [], copCars: [], roadblocks: [], heli: null,
    gangMembers: [], living: [], cats: [], fires: [], activities: [],
    pickups: [], wantedTimer: 0,
    train: { cars: 3, a: 0, angle: 0 },
    maya: { x: -300, z: 60, rel: 0, onDate: false, dateTimer: 0 },
    messages: [], unread: 0,
    radio: { station: 0, songStep: 0, muted: false },
    city: null, camera: null, input: null, audio: null, hud: null,
    renderer: null, weatherObj: null, weather: 'clear',
    mission: null, sideJob: null, event: null, eventTimer: 120,
    fireTimer: 150, taxiState: null,
    _taxiRequested: false, _taxiCab: null,
  };
  newGame(g);
  return g;
}
