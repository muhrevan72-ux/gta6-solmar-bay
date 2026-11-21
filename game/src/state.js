// Solmar Bay — game state.
//
// createGame builds the whole state object with sane defaults; newGame
// resets a run back to chapter 1. Everything else in the game reads
// and writes this one object, so a saved game is just a slice of it.

import { CHAPTERS, SPAWNS } from './config.js';

// Deterministic seeded RNG (mulberry32). The city generator uses it so
// the same seed always builds the same city.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
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
  const title = ch ? ch.title : 'Free Roam';
  return `Chapter ${g.chapter} — ${title}`;
}

export function completionPercent(g) {
  return Math.min(100, g.chapterDone * 16);
}

export function createGame() {
  return {
    // Run state.
    mode: 'menu',
    menu: null,
    card: null,
    modal: null,
    dialogue: null,
    toast: '',
    toastTimer: 0,
    cash: 150,
    bank: 0,
    health: 100,
    armour: 0,
    wanted: 0,
    respect: 0,
    completion: 0,
    chapter: 1,
    chapterDone: 0,
    chapterStage: 0,
    missionTimer: 0,
    missionMarker: null,
    sideJob: null,
    clock: 8,
    day: 1,
    time: 0,
    _phase: 'day',
    weather: 'clear',
    rain: 0,
    station: 0,
    song: 0,
    songStep: 0,
    muted: false,
    bombs: 3,
    pickups: [],
    stats: { kills: 0, fishCaught: 0, firesOut: 0, fares: 0 },
    unlocks: { smgUnlocked: false, shotgunUnlocked: false, sportsCarSpawned: false },
    ownedCars: [],

    // Player.
    player: {
      x: SPAWNS.player.x,
      z: SPAWNS.player.z,
      heading: 0,
      weapon: 0,
      ammo: [Infinity, 120, 24, 60],
      inCar: null,
      shootCooldown: 0,
      punchCooldown: 0,
      bombCooldown: 0,
      eCooldown: 0,
      outfit: defaultOutfit(),
      speed: 0,
      inside: null,
      carryingCat: null,
      petting: 0,
      onTrain: false,
    },

    // World populations (filled by the spawn functions).
    city: null,
    inside: null,
    vehicles: [],
    traffic: [],
    peds: [],
    cops: [],
    copCars: [],
    roadblocks: [],
    heli: null,
    gangMembers: [],
    dogs: [],
    birds: [],
    fish: [],
    cats: [],
    train: { a: 0, cars: 3 },
    elevator: { y: 0, targetY: 0 },
    vending: [],
    atms: [],
    fires: [],
    _fireTimer: 120,
    event: null,
    eventTimer: 120,

    // Phone and social.
    phoneOpen: false,
    phoneTab: 'messages',
    messages: [],
    unread: 0,
    maya: { rel: 0, onDate: false, x: -300, z: 60 },

    // Mini-games and jobs.
    _taxiRequested: false,
    _taxiCab: null,
    _taxiState: null,
    _fishing: { active: false, t: 0 },
    _range: { active: false, targets: [], t: 0, hits: 0 },
    _swim: { active: false, reached: false },
    _slalom: { active: false, gates: 0 },

    // Training records.
    training: { rangeBest: 0, rangeScore: 0, swimBest: 0, slalomBest: 0 },

    // Engine handles (wired up by boot / the harness).
    camera: null,
    input: null,
    audio: null,
    hud: null,
    weatherObj: null,
    renderer: null,
    _lastDynTris: 0,
    _onResize: null,
  };
}

export function newGame(g) {
  g.cash = 150;
  g.bank = 0;
  g.health = 100;
  g.armour = 0;
  g.wanted = 0;
  g.respect = 0;
  g.completion = 0;
  g.chapter = 1;
  g.chapterDone = 0;
  g.chapterStage = 0;
  g.missionTimer = 0;
  g.missionMarker = null;
  g.sideJob = null;
  g.clock = 8;
  g.day = 1;
  g.time = 0;
  g._phase = 'day';
  g.weather = 'clear';
  g.rain = 0;
  g.station = 0;
  g.song = 0;
  g.songStep = 0;
  g.bombs = 3;
  g.pickups = [];
  g.stats = { kills: 0, fishCaught: 0, firesOut: 0, fares: 0 };
  g.unlocks = { smgUnlocked: false, shotgunUnlocked: false, sportsCarSpawned: false };
  g.ownedCars = [];
  g.vehicles = [];
  g.traffic = [];
  g.inside = null;
  g.peds = [];
  g.cops = [];
  g.copCars = [];
  g.roadblocks = [];
  g.heli = null;
  g.gangMembers = [];
  g.fires = [];
  g._fireTimer = 120;
  g.event = null;
  g.eventTimer = 120;
  g._taxiRequested = false;
  g._taxiCab = null;
  g._taxiState = null;
  g._fishing = { active: false, t: 0 };
  g._range = { active: false, targets: [], t: 0, hits: 0 };
  g._swim = { active: false, reached: false };
  g._slalom = { active: false, gates: 0 };
  g.training = { rangeBest: 0, rangeScore: 0, swimBest: 0, slalomBest: 0 };
  g.maya = { rel: 0, onDate: false, x: -300, z: 60 };
  g.phoneOpen = false;
  g.phoneTab = 'messages';
  g.messages = [];
  g.unread = 0;
  g.modal = null;
  g.dialogue = null;
  g.toast = '';
  g.toastTimer = 0;
  const p = g.player;
  p.x = SPAWNS.player.x;
  p.z = SPAWNS.player.z;
  p.heading = 0;
  p.weapon = 0;
  p.ammo = [Infinity, 120, 24, 60];
  p.inCar = null;
  p.shootCooldown = 0;
  p.punchCooldown = 0;
  p.bombCooldown = 0;
  p.eCooldown = 0;
  p.outfit = defaultOutfit();
  p.speed = 0;
  p.inside = null;
  p.carryingCat = null;
  p.petting = 0;
  p.onTrain = false;
  return g;
}

export function addCash(g, amount, reason) {
  g.cash += amount;
  const sign = amount >= 0 ? '+' : '-';
  // Callers pass the reason with its own dash ('— test job'); only add
  // one when the reason does not already start with a dash.
  const suffix = !reason
    ? ''
    : reason.startsWith('—') || reason.startsWith('-')
      ? ' ' + reason
      : ' — ' + reason;
  showToast(g, `${sign}$${Math.abs(amount)}${suffix}`);
  return g.cash;
}

export function showToast(g, text) {
  g.toast = text;
  g.toastTimer = 3;
}

export function showDialogue(g, name, role, text) {
  g.dialogue = { name, role, text, t: 10 };
}
