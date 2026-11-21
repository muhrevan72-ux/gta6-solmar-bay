// Solmar Bay — the game state object and its helpers.
// createGame builds a fresh state; newGame resets an existing
// one back to the start (same fields, fresh values).

import { CHAPTERS, SPAWNS } from './config.js';

export function defaultOutfit() {
  return { hair: 0, shirt: 0, pants: 0, shoes: 0 };
}

export function createGame() {
  const g = {
    // economy + progression
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
    mode: 'menu',
    menu: null,
    card: null,
    modal: null,
    toast: '',
    toastTimer: 0,
    dialogue: null,
    // world + weather
    weather: 'clear',
    rain: 0,
    _phase: 'day',
    city: null,
    camera: null,
    input: null,
    audio: null,
    hud: null,
    renderer: null,
    weatherObj: null,
    // player
    player: {
      x: SPAWNS.player.x,
      z: SPAWNS.player.z,
      heading: 0,
      speed: 0,
      weapon: 0,
      ammo: [Infinity, 120, 24],
      inCar: null,
      eCooldown: 0,
      shootCooldown: 0,
      punchCooldown: 0,
      bombCooldown: 0,
      outfit: defaultOutfit(),
      carryingCat: null,
      petting: 0,
      onTrain: false,
      inside: null,
      bob: 0,
      swim: false,
    },
    bombs: 3,
    station: 0,
    song: 0,
    songStep: 0,
    _songTimer: 0,
    muted: false,
    unlocks: { smgUnlocked: false, shotgunUnlocked: false, sportsCarSpawned: false },
    stats: { kills: 0, fares: 0, firesOut: 0, fishCaught: 0 },
    // entities (filled by the spawn functions)
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
    vending: [],
    atms: [],
    fires: [],
    _fireTimer: 120,
    ownedCars: [],
    pickups: [],
    // missions
    missionMarker: null,
    missionTimer: 0,
    chapterStage: 0,
    sideJob: null,
    // phone + contacts
    phoneOpen: false,
    phoneTab: 'contacts',
    messages: [],
    unread: 0,
    maya: { rel: 0, onDate: false, dateT: 0 },
    _taxiRequested: false,
    _taxiCab: null,
    _taxiState: null,
    _taxiWait: 0,
    // activities
    _fishing: { active: false, t: 0 },
    _range: { active: false, targets: [], hits: 0, t: 0 },
    _swim: { active: false, reached: false },
    _slalom: { active: false, gates: 0 },
    training: { rangeScore: 0, rangeBest: 0 },
    // events
    event: null,
    eventTimer: 180,
    _turfWarned: null,
    _lastDynTris: 0,
  };
  return g;
}

export function newGame(g) {
  const fresh = createGame();
  // Keep the live subsystems (renderer, city, input, audio, hud)
  // but reset every progress field to its fresh value.
  const keep = {
    city: g.city, camera: g.camera, input: g.input,
    audio: g.audio, hud: g.hud, renderer: g.renderer,
    weatherObj: g.weatherObj,
  };
  for (const k of Object.keys(fresh)) {
    if (!(k in keep)) g[k] = fresh[k];
  }
  Object.assign(g, keep);
  g.mode = 'menu';
  return g;
}

export function addCash(g, amount, reason) {
  g.cash += amount;
  if (amount > 0) {
    g.toast = `+$${amount}${reason ? ' ' + reason : ''}`;
    g.toastTimer = 3;
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

// Armour absorbs damage first; what is left hits health.
// Health 0 means wasted.
export function damagePlayer(g, amount) {
  let dmg = amount;
  if (g.armour > 0) {
    const absorbed = Math.min(g.armour, dmg);
    g.armour -= absorbed;
    dmg -= absorbed;
  }
  g.health -= dmg;
  if (g.health <= 0) {
    g.health = 0;
    g.mode = 'wasted';
  }
}

export function chapterTitle(g) {
  const c = CHAPTERS[Math.max(0, Math.min(CHAPTERS.length - 1, g.chapter - 1))];
  return `Chapter ${g.chapter} — ${c.title}`;
}

// Completion is 80% story (16% per chapter) plus side progress.
export function completionPercent(g) {
  const story = Math.min(5, g.chapterDone || 0) * 16;
  return Math.min(100, story);
}
