// Solmar Bay — game state: creation, reset, cash, toasts, chapters.
// Pure logic; no DOM, no rendering.

import { CHAPTERS, respectLevel } from './config.js';

export function defaultOutfit() {
  return { hair: 0, shirt: 0, pants: 0, shoes: 0 };
}

export function createGame() {
  const g = {
    cash: 150,
    health: 100,
    armour: 0,
    wanted: 0,
    wantedTimer: 0,
    chapter: 1,
    chapterDone: 0,
    chapterStage: 0,
    clock: 8,
    day: 1,
    time: 0,
    mode: 'menu',
    menu: null,
    bombs: 3,
    bank: 0,
    respect: 0,
    completion: 0,
    station: 0,
    song: 0,
    songStep: 0,
    songTimer: 0,
    muted: false,
    weather: 'clear',
    rain: 0,
    toast: '',
    toastTimer: 0,
    dialogue: null,
    card: null,
    modal: null,
    missionMarker: null,
    missionTimer: 0,
    sideJob: null,
    player: {
      x: 0, z: 20, y: 0, heading: 0, speed: 0,
      weapon: 0, ammo: [Infinity, 120, 12],
      inCar: null, eCooldown: 0, shootCooldown: 0,
      punchCooldown: 0, bombCooldown: 0,
      outfit: defaultOutfit(),
      carryingCat: null, petting: 0, onTrain: false, inside: null,
    },
    city: null,
    camera: null,
    input: null,
    audio: null,
    hud: null,
    weatherObj: null,
    renderer: null,
    vehicles: [],
    traffic: [],
    copCars: [],
    cops: [],
    roadblocks: [],
    heli: null,
    peds: [],
    gangMembers: [],
    dogs: [],
    birds: [],
    fish: [],
    cats: [],
    train: null,
    elevator: null,
    vending: [],
    atms: [],
    fires: [],
    _fireTimer: 120,
    _fishing: null,
    _range: null,
    _swim: null,
    _slalom: null,
    event: null,
    eventTimer: 120,
    pickups: [],
    stats: { kills: 0, fishCaught: 0, firesOut: 0, fares: 0 },
    maya: { rel: 0, onDate: false, dateTimer: 0 },
    messages: [],
    unread: 0,
    phoneOpen: false,
    phoneTab: 'contacts',
    ownedCars: [],
    unlocks: { smgUnlocked: false, shotgunUnlocked: false, sportsCarSpawned: false },
    _taxiRequested: false,
    _taxiCab: null,
    _taxiState: null,
    _phase: 'day',
    _lastDynTris: 0,
  };
  return g;
}

export function newGame(g) {
  g.cash = 150;
  g.health = 100;
  g.armour = 0;
  g.wanted = 0;
  g.wantedTimer = 0;
  g.chapter = 1;
  g.chapterDone = 0;
  g.chapterStage = 0;
  g.clock = 8;
  g.day = 1;
  g.bombs = 3;
  g.bank = 0;
  g.respect = 0;
  g.completion = 0;
  g.station = 0;
  g.song = 0;
  g.songStep = 0;
  g.player.x = 0;
  g.player.z = 20;
  g.player.y = 0;
  g.player.heading = 0;
  g.player.speed = 0;
  g.player.weapon = 0;
  g.player.ammo = [Infinity, 120, 12];
  g.player.inCar = null;
  g.player.eCooldown = 0;
  g.player.shootCooldown = 0;
  g.player.punchCooldown = 0;
  g.player.bombCooldown = 0;
  g.player.outfit = defaultOutfit();
  g.player.carryingCat = null;
  g.player.petting = 0;
  g.player.onTrain = false;
  g.player.inside = null;
  g.pickups = [];
  g.stats = { kills: 0, fishCaught: 0, firesOut: 0, fares: 0 };
  g.maya = { rel: 0, onDate: false, dateTimer: 0 };
  g.messages = [];
  g.unread = 0;
  g.phoneOpen = false;
  g.ownedCars = [];
  g.unlocks = { smgUnlocked: false, shotgunUnlocked: false, sportsCarSpawned: false };
  g._taxiRequested = false;
  g._taxiCab = null;
  g._taxiState = null;
  g.modal = null;
  g.missionMarker = null;
  g.sideJob = null;
  g.dialogue = null;
}

export function addCash(g, amount, reason) {
  g.cash += amount;
  const sign = amount >= 0 ? '+' : '-';
  const text = `${sign}$${Math.abs(amount)}${reason ? ' ' + reason : ''}`;
  g.toast = text;
  g.toastTimer = 3;
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
  if (!c) return `Chapter ${g.chapter}`;
  return `Chapter ${g.chapter} — ${c.title}`;
}

export function completionPercent(g) {
  return Math.min(100, Math.round((g.chapterDone / 5) * 80 + (g.respect >= 1000 ? 20 : 0)));
}
