// Solmar Bay — game state.
//
// createGame builds the whole state object (no rendering, no DOM) so
// the logic suites can drive it headlessly. newGame resets a run.
// Toasts and dialogues are timed text the HUD reads each frame.

import { CHAPTERS } from './config.js';

export function defaultOutfit() {
  return { hair: 0, shirt: 0, pants: 0, shoes: 0 };
}

export function createGame() {
  return {
    // Run state.
    mode: 'menu', // menu | card | play | pause | passed | phone | busted | wasted
    menu: null, // which menu overlay is open ('pause' while paused)
    chapter: 1,
    chapterDone: 0,
    chapterStage: 0,
    completion: 0,
    cash: 150,
    bank: 0,
    health: 100,
    armour: 0,
    wanted: 0,
    wantedTimer: 0,
    respect: 0,
    clock: 8, // game hour, 0..24
    day: 1,
    time: 0, // real seconds since boot; keeps ticking in pause
    weather: 'clear',
    rain: 0, // 0..1, eases toward the weather's target
    // Player.
    player: {
      x: 0, z: 20, y: 0,
      heading: 0, // radians, 0 = facing +z
      speed: 0,
      health: 100,
      weapon: 0, // 0 pistol, 1 SMG, 2 shotgun
      ammo: [Infinity, 120, 24],
      inCar: null,
      onTrain: false,
      inside: null, // room id while indoors
      carryingCat: null,
      petting: 0,
      outfit: defaultOutfit(),
      shootCooldown: 0,
      punchCooldown: 0,
      bombCooldown: 0,
      eCooldown: 0,
    },
    bombs: 3,
    ownedCars: [],
    unlocks: { smgUnlocked: false, shotgunUnlocked: false, sportsCarSpawned: false },
    // World (filled in by the spawners).
    city: null,
    camera: null,
    input: null,
    audio: null,
    hud: null,
    renderer: null,
    weatherObj: null,
    vehicles: [],
    traffic: [],
    copCars: [],
    roadblocks: [],
    heli: null,
    cops: [],
    peds: [],
    gangMembers: [],
    dogs: [],
    birds: [],
    fish: [],
    train: null,
    elevator: null,
    cats: [],
    vending: [],
    atms: [],
    fires: [],
    // Missions and jobs.
    card: null, // {title, text} shown on the chapter/passed card
    missionMarker: null, // {x, z, label}
    missionTimer: 0,
    sideJob: null,
    modal: null, // {kind, title, lines}
    // Phone.
    phoneOpen: false,
    phoneTab: 'contacts',
    messages: [],
    unread: 0,
    maya: { x: -300, z: 60, rel: 0, onDate: false, dateT: 0 },
    // Radio.
    station: 0,
    song: 0,
    songStep: 0,
    muted: false,
    // Timers and flags the systems own.
    toast: '',
    toastTimer: 0,
    dialogue: null, // {name, role, text, t}
    pickups: [],
    stats: { kills: 0, fishCaught: 0, fares: 0, firesOut: 0 },
    event: null,
    eventTimer: 240,
    _phase: 'day',
    _songT: 0,
    _taxiRequested: false,
    _taxiCab: null,
    _taxiState: null,
    _taxiWait: 0,
    _fireTimer: 120,
    _fishing: { active: false, t: 0 },
    _range: { active: false, targets: [], hits: 0, t: 0 },
    _swim: { active: false, reached: false },
    _slalom: { active: false, gates: 0 },
    _mayaCallCd: 0,
    _lastDynTris: 0,
  };
}

// A fresh run: money, health, wanted and chapter back to the start.
// The world itself is rebuilt by the caller (boot / spawners).
export function newGame(g) {
  g.cash = 150;
  g.bank = 0;
  g.health = 100;
  g.armour = 0;
  g.wanted = 0;
  g.wantedTimer = 0;
  g.respect = 0;
  g.chapter = 1;
  g.chapterDone = 0;
  g.chapterStage = 0;
  g.completion = 0;
  g.clock = 8;
  g.day = 1;
  g.bombs = 3;
  g.ownedCars = [];
  g.unlocks = { smgUnlocked: false, shotgunUnlocked: false, sportsCarSpawned: false };
  g.player.x = 0;
  g.player.z = 20;
  g.player.y = 0;
  g.player.heading = 0;
  g.player.speed = 0;
  g.player.weapon = 0;
  g.player.ammo = [Infinity, 120, 24];
  g.player.inCar = null;
  g.player.onTrain = false;
  g.player.inside = null;
  g.player.carryingCat = null;
  g.player.outfit = defaultOutfit();
  g.player.shootCooldown = 0;
  g.player.punchCooldown = 0;
  g.player.bombCooldown = 0;
  g.player.eCooldown = 0;
  g.maya = { x: -300, z: 60, rel: 0, onDate: false, dateT: 0 };
  g.messages = [];
  g.unread = 0;
  g.pickups = [];
  g.stats = { kills: 0, fishCaught: 0, fares: 0, firesOut: 0 };
  g.missionMarker = null;
  g.missionTimer = 0;
  g.sideJob = null;
  g.modal = null;
  g.card = null;
  g.station = 0;
  g.song = 0;
  g.songStep = 0;
  g._taxiRequested = false;
  g._taxiCab = null;
  g._taxiState = null;
  g._taxiWait = 0;
}

// Earn (or spend) cash. A gain always toasts its reason so the player
// can audit where money came from; a spend stays quiet.
export function addCash(g, amount, reason) {
  g.cash += amount;
  if (amount >= 0) {
    const why = reason ? ` ${reason}` : '';
    showToast(g, `+$${amount}${why}`);
  }
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

// 16% per finished chapter (80% after all five; the last 20% is the
// free-roam life: dates, cats, fires, fares and the rest).
export function completionPercent(g) {
  return Math.min(100, g.chapterDone * 16);
}
