// Solmar Bay — game state.
//
// One plain object holds everything the systems mutate. createGame
// builds a fresh game; newGame/continueGame reset the parts that
// must not leak between sessions (cooldowns to 0, wanted to 0).
// Nothing here touches the DOM or WebGL, so headless tests can
// drive the whole game through this state.

import { TUNE, SPAWNS, CHAPTERS } from './config.js';

export function defaultOutfit() {
  return { hair: 0, shirt: 0, pants: 0, shoes: 0 };
}

export function createGame() {
  const g = {
    // Mode machine: 'menu' | 'card' | 'play' | 'pause' | 'phone' |
    // 'busted' | 'wasted' | 'passed' | 'interior'.
    mode: 'menu',
    prevMode: 'menu',
    time: 0, // seconds since boot (real time)
    paused: false,
    // Player economy + status.
    cash: 150,
    bank: 0,
    health: 100,
    armour: 0,
    wanted: 0,
    wantedTimer: 0,
    respect: 0,
    bombs: 3,
    // Story progress.
    chapter: 1,
    chapterStage: 0,
    chapterDone: 0, // chapters completed
    completion: 0, // percent
    missionTimer: 0,
    missionMarker: null, // {x, z, label}
    sideJob: null,
    // World + time.
    day: 1,
    clock: 8, // hours, 0..24 — the game starts at 08:00
    weather: 'clear', // clear | rain | fog
    weatherTimer: 120,
    rain: 0, // 0..1 rain intensity
    // The player.
    player: {
      x: SPAWNS.player.x,
      z: SPAWNS.player.z,
      y: 0,
      heading: 0,
      vx: 0,
      vz: 0,
      speed: 0,
      inCar: null, // vehicle object or null
      swimming: false,
      carryingCat: null,
      petting: 0,
      weapon: 0, // 0 pistol, 1 smg, 2 shotgun
      ammo: [Infinity, 0, 0],
      eCooldown: 0,
      punchCooldown: 0,
      bombCooldown: 0,
      shootCooldown: 0,
      inside: null, // interior id when inside a shop room
      onTrain: false,
      onElevator: false,
      outfit: defaultOutfit(),
    },
    // Collections the systems fill in.
    city: null, // built by world.js
    vehicles: [],
    traffic: [],
    peds: [],
    gangMembers: [],
    cops: [],
    copCars: [],
    heli: null,
    roadblocks: [],
    pickups: [], // cash/health/armour/repair drops on the ground
    fires: [],
    cats: [],
    dogs: [],
    birds: [],
    fish: [],
    train: null,
    elevator: null,
    // Owned cars (garage) + unlocks.
    ownedCars: [],
    unlocks: { smgUnlocked: false, shotgunUnlocked: false, sportsCarSpawned: false },
    // Radio + audio state.
    station: 0,
    song: 0,
    songStep: 0,
    muted: false,
    // Phone.
    phoneOpen: false,
    phoneTab: 'contacts',
    messages: [],
    unread: 0,
    // Dating.
    maya: { rel: 0, onDate: false, stage: 0 },
    // Events.
    event: null, // {id, label, x, z, t}
    eventTimer: 180,
    // Training scores.
    training: { rangeScore: 0, rangeBest: 0, swimBest: 0, slalomBest: 0 },
    // Stats + save.
    stats: { kills: 0, stolen: 0, fares: 0, firesOut: 0, fishCaught: 0 },
    saveSlot: 1,
    // HUD bits the renderer/DOM read.
    toast: '',
    toastTimer: 0,
    dialogue: null, // {name, role, text, t}
    card: null, // chapter intro card {title, text}
    modal: null, // {title, lines[], kind}
    menu: null, // pause menu selection
    bustedBy: '',
    // Renderer (set by main.js boot).
    renderer: null,
    camera: null,
    input: null,
    audio: null,
    hud: null,
    // Flags for tests / debugging.
    flags: {},
  };
  return g;
}

// Fresh start: cash, health, chapter 1, clean slate.
export function newGame(g) {
  g.cash = 150;
  g.bank = 0;
  g.health = 100;
  g.armour = 0;
  g.wanted = 0;
  g.wantedTimer = 0;
  g.respect = 0;
  g.bombs = 3;
  g.chapter = 1;
  g.chapterStage = 0;
  g.chapterDone = 0;
  g.completion = 0;
  g.missionTimer = 0;
  g.missionMarker = null;
  g.sideJob = null;
  g.day = 1;
  g.clock = 8;
  g.weather = 'clear';
  g.weatherTimer = 120;
  g.rain = 0;
  g.player.x = SPAWNS.player.x;
  g.player.z = SPAWNS.player.z;
  g.player.y = 0;
  g.player.heading = 0;
  g.player.vx = 0;
  g.player.vz = 0;
  g.player.inCar = null;
  g.player.swimming = false;
  g.player.carryingCat = null;
  g.player.weapon = 0;
  g.player.ammo = [Infinity, 0, 0];
  g.player.eCooldown = 0;
  g.player.punchCooldown = 0;
  g.player.bombCooldown = 0;
  g.player.shootCooldown = 0;
  g.player.inside = null;
  g.player.onTrain = false;
  g.player.onElevator = false;
  g.player.outfit = defaultOutfit();
  g.pickups = [];
  g.fires = [];
  g.ownedCars = [];
  g.unlocks = { smgUnlocked: false, shotgunUnlocked: false, sportsCarSpawned: false };
  g.station = 0;
  g.song = 0;
  g.songStep = 0;
  g.phoneOpen = false;
  g.messages = [];
  g.unread = 0;
  g.maya = { rel: 0, onDate: false, stage: 0 };
  g.event = null;
  g.eventTimer = 180;
  g.training = { rangeScore: 0, rangeBest: 0, swimBest: 0, slalomBest: 0 };
  g.stats = { kills: 0, stolen: 0, fares: 0, firesOut: 0, fishCaught: 0 };
  g.toast = '';
  g.toastTimer = 0;
  g.dialogue = null;
  g.card = null;
  g.modal = null;
  g.menu = null;
  g.flags = {};
}

// Add cash and always tell the player where it came from. Every
// income path in the game must go through here (or show its own
// toast) — silent income was a real bug in round 4.
export function addCash(g, amount, why) {
  g.cash += amount;
  if (why) showToast(g, `+$${amount} ${why}`);
  return g.cash;
}

export function showToast(g, text) {
  g.toast = text;
  g.toastTimer = 3;
}

export function showDialogue(g, name, role, text) {
  g.dialogue = { name, role, text, t: 10 };
}

export function chapterTitle(g) {
  const c = CHAPTERS[g.chapter - 1];
  return c ? c.title : 'Free Roam';
}

export function completionPercent(g) {
  // 5 chapters + side content: chapters are 80%, the rest is free.
  const base = (g.chapterDone / CHAPTERS.length) * 80;
  const extra = Math.min(20, g.stats.fares * 2 + g.stats.firesOut * 2 + g.stats.fishCaught);
  return Math.min(100, Math.round(base + extra));
}

export { TUNE };
