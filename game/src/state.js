// Solmar Bay — game state (rebuild #13).
import { CHAPTERS } from './config.js';

export function defaultOutfit() {
  return { hair: 0, shirt: 0, pants: 0, shoes: 0 };
}

export function createGame() {
  return {
    cash: 150,
    bank: 0,
    health: 100,
    armour: 0,
    wanted: 0,
    wantedTimer: 0,
    chapter: 1,
    chapterDone: 0,
    chapterStage: 0,
    completion: 0,
    clock: 8,
    day: 1,
    time: 0,
    mode: 'menu',
    menu: null,
    weather: 'clear',
    rain: 0,
    _phase: 'day',
    _spawnGrace: 0,
    player: {
      x: 0, z: 20, y: 0,
      heading: 0, speed: 0,
      weapon: 0, ammo: [Infinity, 90, 12],
      inCar: null, onTrain: false, inside: null,
      eCooldown: 0, shootCooldown: 0, punchCooldown: 0, bombCooldown: 0,
      outfit: defaultOutfit(),
      carryingCat: null, petting: 0,
    },
    bombs: 3,
    respect: 0,
    unlocks: { smgUnlocked: false, shotgunUnlocked: false, sportsCarSpawned: false },
    station: 0, song: 0, songStep: 0, songTimer: 0,
    muted: false,
    toast: '', toastTimer: 0,
    dialogue: null,
    card: null,
    modal: null,
    missionMarker: null,
    missionTimer: 0,
    sideJob: null,
    maya: { rel: 0, onDate: false, dateTimer: 0 },
    messages: [], unread: 0,
    phoneOpen: false, phoneTab: 'map',
    city: null, camera: null, input: null, audio: null, hud: null,
    weatherObj: null, renderer: null,
    vehicles: [], traffic: [],
    peds: [], cops: [], copCars: [], roadblocks: [], heli: null,
    gangMembers: [], pickups: [], fires: [], _fireTimer: 120,
    dogs: [], birds: [], fish: [], train: null, elevator: null,
    cats: [], vending: [], atms: [],
    ownedCars: [],
    stats: { kills: 0, fishCaught: 0, firesOut: 0, fares: 0 },
    _taxiRequested: false, _taxiCab: null, _taxiState: null, _taxiWait: 0,
    event: null, eventTimer: 120,
    _fishing: { active: false, t: 0 },
    _range: { active: false, t: 0, targets: [], hits: 0 },
    _swim: { active: false, reached: false },
    _slalom: { active: false, gates: 0 },
    training: { rangeBest: 0, swimBest: 0, slalomBest: 0 },
    _lastDynTris: 0,
    _bustedApplied: false,
  };
}

export function newGame(g) {
  g.cash = 150;
  g.bank = 0;
  g.health = 100;
  g.armour = 0;
  g.wanted = 0;
  g.wantedTimer = 0;
  g.chapter = 1;
  g.chapterDone = 0;
  g.chapterStage = 0;
  g.completion = 0;
  g.clock = 8;
  g.day = 1;
  g.time = 0;
  g.respect = 0;
  g.bombs = 3;
  g.station = 0;
  g.song = 0;
  g.songStep = 0;
  g.muted = false;
  g.toast = '';
  g.toastTimer = 0;
  g.dialogue = null;
  g.card = null;
  g.modal = null;
  g.missionMarker = null;
  g.sideJob = null;
  g.weather = 'clear';
  g.rain = 0;
  g._spawnGrace = 5;
  g._bustedApplied = false;
  g.unlocks = { smgUnlocked: false, shotgunUnlocked: false, sportsCarSpawned: false };
  g.stats = { kills: 0, fishCaught: 0, firesOut: 0, fares: 0 };
  g.ownedCars = [];
  g.pickups = [];
  g.maya = { rel: 0, onDate: false, dateTimer: 0 };
  g.messages = [];
  g.unread = 0;
  g.phoneOpen = false;
  g.player.x = 0;
  g.player.z = 20;
  g.player.y = 0;
  g.player.heading = 0;
  g.player.speed = 0;
  g.player.weapon = 0;
  g.player.ammo = [Infinity, 90, 12];
  g.player.inCar = null;
  g.player.onTrain = false;
  g.player.inside = null;
  g.player.eCooldown = 0;
  g.player.shootCooldown = 0;
  g.player.punchCooldown = 0;
  g.player.bombCooldown = 0;
  g.player.outfit = defaultOutfit();
  g.player.carryingCat = null;
  g.player.petting = 0;
}

export function addCash(g, amount, reason) {
  g.cash += amount;
  if (amount > 0) showToast(g, `+$${amount} ${reason || ''}`.trim());
}

export function showToast(g, text) {
  g.toast = text;
  g.toastTimer = 3;
}

export function showDialogue(g, name, role, text) {
  g.dialogue = { name, role, text, t: 10 };
}

export function chapterTitle(g) {
  const ch = CHAPTERS[Math.max(0, Math.min(CHAPTERS.length - 1, g.chapter - 1))];
  return `Chapter ${g.chapter} — ${ch.title}`;
}

export function completionPercent(g) {
  return Math.min(100, g.chapterDone * 16);
}
