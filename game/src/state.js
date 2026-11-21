// Solmar Bay — game state, reset, cash, toasts, dialogue.
// Written fresh for rebuild #18.

import { CHAPTERS, SPAWNS, OUTFIT, respectLevel } from './config.js';

export function defaultOutfit() {
  return { hair: 0, shirt: 0, pants: 0, shoes: 0 };
}

export function createGame() {
  const g = {
    mode: 'menu',
    menu: null,
    cash: 150,
    bank: 0,
    health: 100,
    armour: 0,
    wanted: 0,
    wantedTimer: 0,
    chapter: 1,
    chapterDone: 0,
    completion: 0,
    respect: 0,
    clock: 8,
    day: 1,
    time: 0,
    weather: 'clear',
    rain: 0,
    _phase: 'day',
    station: 0,
    song: 0,
    songStep: 0,
    _songTimer: 0,
    muted: false,
    bombs: 3,
    stats: { kills: 0, fishCaught: 0, fares: 0, firesOut: 0, dates: 0 },
    unlocks: { smgUnlocked: false, shotgunUnlocked: false, sportsCarSpawned: false },
    ownedCars: [],
    toast: '',
    toastTimer: 0,
    dialogue: null,
    card: null,
    modal: null,
    missionMarker: null,
    missionStage: 0,
    chapterStage: 0,
    sideJob: null,
    phoneOpen: false,
    phoneTab: 'messages',
    messages: [],
    unread: 0,
    maya: { x: -300, z: 60, rel: 0, onDate: false, _dateTimer: 0 },
    eventTimer: 300,
    event: null,
    _fireTimer: 120,
    _taxiRequested: false,
    _taxiCab: null,
    _taxiState: null,
    _taxiWaitT: 0,
    _fishing: { active: false, t: 0 },
    _range: { active: false, targets: [], hits: 0, t: 0 },
    _swim: { active: false, reached: false },
    _slalom: { active: false, gates: 0, next: 0 },
    _lastDynTris: 0,
    player: {
      x: SPAWNS.player.x, z: SPAWNS.player.z, y: 0,
      heading: 0, speed: 0,
      inCar: null, onTrain: false, inside: null,
      weapon: 0, ammo: [Infinity, 0, 0],
      shootCooldown: 0, punchCooldown: 0, eCooldown: 0,
      outfit: defaultOutfit(),
      carryingCat: null, petting: 0,
    },
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
    train: null,
    elevator: null,
    fires: [],
    vending: [],
    atms: [],
    training: { rangeBest: 0, rangeScore: 0, swimBest: 0, slalomBest: 0 },
    city: null,
    camera: null,
    input: null,
    audio: null,
    hud: null,
    weatherObj: null,
    renderer: null,
    canvas: null,
    doc: null,
  };
  return g;
}

// Start a brand-new game: reset the run state and wipe the world
// entities (the caller re-spawns them with respawnWorld).
export function newGame(g) {
  g.cash = 150;
  g.bank = 0;
  g.health = 100;
  g.armour = 0;
  g.wanted = 0;
  g.wantedTimer = 0;
  g.chapter = 1;
  g.chapterDone = 0;
  g.completion = 0;
  g.respect = 0;
  g.clock = 8;
  g.day = 1;
  g.time = 0;
  g.weather = 'clear';
  g.rain = 0;
  g.station = 0;
  g.song = 0;
  g.songStep = 0;
  g._songTimer = 0;
  g.muted = false;
  g.bombs = 3;
  g.stats = { kills: 0, fishCaught: 0, fares: 0, firesOut: 0, dates: 0 };
  g.unlocks = { smgUnlocked: false, shotgunUnlocked: false, sportsCarSpawned: false };
  g.ownedCars = [];
  g.toast = '';
  g.toastTimer = 0;
  g.dialogue = null;
  g.card = null;
  g.modal = null;
  g.missionMarker = null;
  g.missionStage = 0;
  g.chapterStage = 0;
  g.sideJob = null;
  g.phoneOpen = false;
  g.phoneTab = 'messages';
  g.messages = [];
  g.unread = 0;
  g.maya = { x: -300, z: 60, rel: 0, onDate: false, _dateTimer: 0 };
  g.eventTimer = 300;
  g.event = null;
  g._fireTimer = 120;
  g._taxiRequested = false;
  g._taxiCab = null;
  g._taxiState = null;
  g._taxiWaitT = 0;
  g._fishing = { active: false, t: 0 };
  g._range = { active: false, targets: [], hits: 0, t: 0 };
  g._swim = { active: false, reached: false };
  g._slalom = { active: false, gates: 0, next: 0 };
  g.player = {
    x: SPAWNS.player.x, z: SPAWNS.player.z, y: 0,
    heading: 0, speed: 0,
    inCar: null, onTrain: false, inside: null,
    weapon: 0, ammo: [Infinity, 0, 0],
    shootCooldown: 0, punchCooldown: 0, eCooldown: 0,
    outfit: defaultOutfit(),
    carryingCat: null, petting: 0,
  };
  g.vehicles = [];
  g.traffic = [];
  g.peds = [];
  g.cops = [];
  g.copCars = [];
  g.roadblocks = [];
  g.heli = null;
  g.gangMembers = [];
  g.dogs = [];
  g.birds = [];
  g.fish = [];
  g.cats = [];
  g.train = null;
  g.elevator = null;
  g.fires = [];
  g.vending = [];
  g.atms = [];
  g.training = { rangeBest: 0, rangeScore: 0, swimBest: 0, slalomBest: 0 };
  return g;
}

export function addCash(g, amount, reason) {
  g.cash += amount;
  const sign = amount >= 0 ? '+' : '';
  showToast(g, `${sign}$${amount}${reason ? ' ' + reason : ''}`);
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
  const ch = CHAPTERS[g.chapter - 1];
  return ch ? ch.title : 'Free Roam';
}

export function completionPercent(g) {
  return g.chapterDone * 16;
}

export { OUTFIT, respectLevel };
