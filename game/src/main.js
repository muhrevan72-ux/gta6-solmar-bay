// Solmar Bay — main: game assembly, the frame loop, the mode
// machine, and the interaction dispatchers.
//
// Modes: menu → chapter → play → pause | busted | wasted | passed.
// The title screen is static HTML; the mode machine only flips
// display, never innerHTML (see hud.js).
//
// The E dispatcher (play mode, on foot) checks, in order: fire,
// interior door, food menu, garage, side activity, cat, date, side
// job marker, training marker, train, elevator, then entering a car.
// E while the phone is open does nothing. Every branch is gated by
// pressedKey('KeyE') && eCooldown <= 0 — never `!eCooldown`.

import { TUNE, SIDE_MARKERS, GARAGE_DOOR, BARREL_SPOTS, BARREL_COLOR } from './config.js';
import { newGameState, showToast, showMenu, hideMenu, addCash, stepToasts } from './state.js';
import { createInput, attachInput, pressedKey, endFrame } from './input.js';
import { createAudio, createRadio, nextStation, advanceRadio, engineHum, setMuted, playJingle } from './audio.js';
import { createWeather, weatherSample, stepWeather, rainBoxes } from './weather.js';
import { createRenderer, BoxBatch } from './render.js';
import { generateCity } from './world.js';
import { createCamera, followCamera } from './shots.js';
import { createPlayer, stepPlayer, playerBoxes, collectPickups } from './player.js';
import { createVehicles, spawnTraffic, stepVehicles, tryEnterCar, exitVehicle, vehicleBoxes } from './vehicles.js';
import { createPedestrians, stepPedestrians, pedBoxes } from './pedestrians.js';
import { createGangs, stepGangs, gangBoxes } from './gangs.js';
import { createPolice, stepPolice, policeBoxes } from './police.js';
import { createCombat, stepCombat } from './combat.js';
import { createMissions, startChapter, advanceChapter, stepMissions, startSideJob } from './missions.js';
import { createTaxi, stepTaxi, stepTaxiFare } from './taxi.js';
import { createFire, stepFire, tryFire, fireBoxes } from './fire.js';
import { createFood, foodShopNear, openFoodMenu, closeFoodMenu, buyFood, foodBoxes } from './food.js';
import { createDating, stepDating, tryDate, datingBoxes } from './dating.js';
import { createOutfit, buyOutfit, outfitBoxes } from './outfit.js';
import { createTraining, stepTraining, startRange, startTrial, trainingBoxes } from './training.js';
import { createEvents, stepEvents, eventBoxes } from './events.js';
import { createCats, stepCats, tryCat, catBoxes } from './cats.js';
import { createLiving, stepLiving, tryTrain, tryElevator, livingBoxes } from './living.js';
import { createPhone, togglePhone, phoneDigit, renderPhone } from './phone.js';
import { createGarage, tryGarage, garageDigit, garageBoxes } from './garage.js';
import { createActivities, stepActivities, tryActivity, atmDigit, activityBoxes } from './activities.js';
import { stepInteriors, tryInteriorDoor, tryInteriorCounter, interiorBoxes, isInside, createInteriors } from './interiors.js';
import { loadGLB, addGLBToBatch } from './gltf.js';
import { updateHud } from './hud.js';
import { saveGame, loadGame, hasSave } from './save.js';

export function createGame() {
  const city = generateCity(1337);
  const state = newGameState();
  state.player = createPlayer(city.spawns.player);
  const game = {
    state,
    city,
    input: createInput(),
    camera: createCamera(),
    weather: createWeather(),
    audio: createAudio(),
    radio: createRadio(),
    combat: createCombat(),
    police: createPolice(),
    missions: createMissions(),
    taxi: createTaxi(),
    fire: createFire(city),
    food: createFood(),
    dating: createDating(),
    outfit: createOutfit(),
    training: createTraining(),
    events: createEvents(),
    cats: createCats(city),
    living: createLiving(city),
    phone: createPhone(),
    garage: createGarage(),
    activities: createActivities(),
    interiors: createInteriors(),
    peds: createPedestrians(city),
    gangs: createGangs(city),
    vehicles: createVehicles(city),
    pickups: [],
    sideJob: null,
    glbModel: null,
    glbBatch: null,
    dom: null,
    renderer: null,
    canvas: null,
    time: 0,
    saveT: 0,
  };
  spawnTraffic(game);
  return game;
}

// ---- flow: new game / continue / pause / resume ----

export function startNewGame(game) {
  const city = game.city;
  const state = newGameState();
  state.player = createPlayer(city.spawns.player);
  game.state = state;
  game.missions = createMissions();
  game.police = createPolice();
  game.combat = createCombat();
  game.phone = createPhone();
  game.food = createFood();
  game.garage = createGarage();
  game.activities = createActivities();
  game.outfit = createOutfit();
  game.pickups = [];
  game.sideJob = null;
  startChapter(game, 1);
}

export function continueGame(game) {
  if (loadGame(game)) {
    game.state.mode = 'play';
    showToast(game.state, 'Welcome back to Solmar Bay.', 4);
  } else {
    startNewGame(game);
  }
}

export function pauseGame(game) {
  const s = game.state;
  if (s.mode !== 'play') return;
  const pct = completionPct(game);
  showMenu(s, 'PAUSED', 'Save slot 1 · ' + pct + '% complete. Cash $' + s.cash + ' · REP ' + s.respect + '.', 'Press Enter or Esc to resume.');
  s.mode = 'pause';
  saveGame(game);
}

export function resumeGame(game) {
  const s = game.state;
  hideMenu(s);
  s.mode = 'play';
}

function completionPct(game) {
  const s = game.state;
  const story = Math.min(5, s.chapter - 1) * 12;
  const side = Math.min(20, s.stats.sideJobsDone * 4);
  const garage = Math.min(8, s.ownedCars.length * 2);
  const rep = Math.min(12, Math.floor(s.respect / 100));
  return Math.min(100, story + side + garage + rep);
}

// ---- the E dispatcher (play mode, on foot) ----

function handleInteract(game) {
  const s = game.state;
  const p = s.player;
  const inp = game.input;
  if (!pressedKey(inp, 'KeyE') || inp.eCooldown > 0) return;
  if (game.phone.open) return; // blocked while the phone is open
  if (p.inCar) {
    // In a car: store it in the garage, or get out.
    if (Math.hypot(p.x - GARAGE_DOOR.x, p.z - GARAGE_DOOR.z) < 6) {
      if (tryGarage(game)) { inp.eCooldown = 0.5; return; }
    }
    exitVehicle(game);
    inp.eCooldown = 0.5;
    return;
  }
  // 1. Fire.
  if (tryFire(game)) { inp.eCooldown = 0.5; return; }
  // 2. Interior door (enter / exit) and interior counter.
  if (isInside(game)) {
    if (tryInteriorCounter(game)) { inp.eCooldown = 0.5; return; }
    if (tryInteriorDoor(game)) { inp.eCooldown = 0.5; return; }
    return;
  }
  if (tryInteriorDoor(game)) { inp.eCooldown = 0.5; return; }
  // 3. Food menu.
  const shop = foodShopNear(game, p.x, p.z);
  if (shop) { openFoodMenu(game, shop); inp.eCooldown = 0.5; return; }
  // 4. Garage.
  if (tryGarage(game)) { inp.eCooldown = 0.5; return; }
  // 5. Side activities (fishing / vending / ATM).
  if (tryActivity(game)) { inp.eCooldown = 0.5; return; }
  // 6. Cat.
  if (tryCat(game)) { inp.eCooldown = 0.5; return; }
  // 7. Date NPC.
  if (tryDate(game)) { inp.eCooldown = 0.5; return; }
  // 8. Side-job markers.
  for (const m of SIDE_MARKERS) {
    if (Math.hypot(p.x - m.x, p.z - m.z) < 5 && !game.sideJob) {
      startSideJob(game, m.kind);
      inp.eCooldown = 0.5;
      return;
    }
  }
  // 9. Training markers.
  if (Math.hypot(p.x - 0, p.z + 350) < 6) { startRange(game); inp.eCooldown = 0.5; return; }
  if (Math.hypot(p.x - 100, p.z + 350) < 6) { startTrial(game); inp.eCooldown = 0.5; return; }
  // 10. Train / elevator.
  if (tryTrain(game)) { inp.eCooldown = 0.5; return; }
  if (tryElevator(game)) { inp.eCooldown = 0.5; return; }
  // 11. Enter a car.
  if (tryEnterCar(game)) return;
}

// ---- digit keys (context-sensitive) ----

function handleDigits(game) {
  const s = game.state;
  const inp = game.input;
  const digits = ['Digit0', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9'];
  for (let i = 0; i < digits.length; i++) {
    if (!pressedKey(inp, digits[i])) continue;
    if (game.phone.open) {
      if (i === 4 || i === 5 || i === 6) phoneDigit(game, i);
      else if (i >= 1 && i <= 3) game.phone.tab = ['contacts', 'messages', 'map'][i - 1];
      return;
    }
    if (game.food.menuOpen) { buyFood(game, i - 1); return; }
    if (game.garage.menuOpen) { garageDigit(game, i); return; }
    if (game.activities.atmOpen) { atmDigit(game, i); return; }
    if (game.outfit.menuOpen) {
      const cats = ['hair', 'shirt', 'pants', 'shoes'];
      if (i >= 1 && i <= 4) buyOutfit(game, cats[i - 1]);
      return;
    }
    // Otherwise the digit is a weapon switch (combat.js) or nothing.
  }
}

// ---- the frame update ----

export function stepGame(game, dt) {
  game.time += dt;
  const s = game.state;
  const inp = game.input;
  // Camera follows the player in every mode (the menu is an attract
  // mode over the live city).
  if (s.mode === 'menu') {
    game.camera.targetYaw += dt * 0.05;
  }
  followCamera(game, dt);
  if (s.mode === 'menu') {
    stepWeather(game, dt);
    if (pressedKey(inp, 'Enter')) startNewGame(game);
  } else if (s.mode === 'chapter') {
    stepWeather(game, dt);
    if (pressedKey(inp, 'Enter') || pressedKey(inp, 'Escape')) {
      s.mode = 'play';
      s.hud.card = null;
    }
  } else if (s.mode === 'play') {
    stepPlay(game, dt);
  } else if (s.mode === 'pause') {
    if (pressedKey(inp, 'Enter') || pressedKey(inp, 'Escape') || pressedKey(inp, 'KeyP')) {
      resumeGame(game);
    }
  } else if (s.mode === 'busted' || s.mode === 'wasted') {
    if (pressedKey(inp, 'Enter')) {
      hideMenu(s);
      s.mode = 'play';
    }
  } else if (s.mode === 'passed') {
    if (pressedKey(inp, 'Enter')) advanceChapter(game);
  }
  // Mute toggle (every mode).
  if (pressedKey(inp, 'KeyM')) {
    setMuted(game.audio, !game.audio.muted);
    showToast(s, game.audio.muted ? 'Muted' : 'Sound on', 2);
  }
  stepToasts(s, dt);
  endFrame(inp, dt);
}

function stepPlay(game, dt) {
  const s = game.state;
  const inp = game.input;
  // Phone toggle (Tab). Esc closes the phone before pausing.
  if (pressedKey(inp, 'Tab')) togglePhone(game);
  if (game.phone.open) {
    if (pressedKey(inp, 'Escape')) togglePhone(game);
    handleDigits(game);
    stepWeather(game, dt);
    stepPedestrians(game, dt);
    stepGangs(game, dt);
    stepVehicles(game, dt);
    stepTaxi(game, dt);
    stepLiving(game, dt);
    stepEvents(game, dt);
    // The world keeps running while the phone is open; E/F/G and
    // weapon switching are blocked (combat.js guards on phone.open).
    stepToasts(s, dt);
    return;
  }
  // Menus: Esc closes them before pausing.
  if (pressedKey(inp, 'Escape') || pressedKey(inp, 'KeyP')) {
    if (game.food.menuOpen) { closeFoodMenu(game); return; }
    if (game.garage.menuOpen) { game.garage.menuOpen = false; return; }
    if (game.activities.atmOpen) { game.activities.atmOpen = false; return; }
    if (game.outfit.menuOpen) { game.outfit.menuOpen = false; return; }
    pauseGame(game);
    return;
  }
  // Radio: R cycles stations.
  if (pressedKey(inp, 'KeyR')) {
    const r = nextStation(game.radio);
    showToast(s, 'Radio: ' + r.station + ' — ' + r.song, 3);
  }
  stepWeather(game, dt);
  stepPlayer(game, dt);
  stepVehicles(game, dt);
  stepPedestrians(game, dt);
  stepGangs(game, dt);
  stepPolice(game, dt);
  stepCombat(game, dt);
  stepMissions(game, dt);
  stepTaxi(game, dt);
  stepTaxiFare(game, dt);
  stepFire(game, dt);
  stepDating(game, dt);
  stepTraining(game, dt);
  stepEvents(game, dt);
  stepCats(game, dt);
  stepLiving(game, dt);
  stepActivities(game, dt);
  stepInteriors(game, dt);
  collectPickups(game);
  advanceRadio(game.radio, game.audio, dt);
  engineHum(game.audio, s.player.inCar ? Math.abs(s.player.inCar.speed) / TUNE.carMaxSpeed : 0);
  handleInteract(game);
  handleDigits(game);
  // Auto-save every 60 s.
  game.saveT += dt;
  if (game.saveT > 60) {
    game.saveT = 0;
    saveGame(game);
  }
}

// ---- rendering: one frame, one clear ----

export function collectDynamicBoxes(game, out) {
  playerBoxes(game, out);
  vehicleBoxes(game, out, true);
  pedBoxes(game, out, true);
  gangBoxes(game, out);
  policeBoxes(game, out);
  datingBoxes(game, out);
  catBoxes(game, out);
  livingBoxes(game, out);
  fireBoxes(game, out);
  foodBoxes(game, out);
  trainingBoxes(game, out);
  eventBoxes(game, out);
  activityBoxes(game, out);
  garageBoxes(game, out);
  outfitBoxes(game, out);
  interiorBoxes(game, out);
  rainBoxes(game, out);
}

export function renderFrame(game) {
  const r = game.renderer;
  if (!r || !r.gl) return;
  const w = weatherSample(game.weather);
  r.beginFrame(w.sky, w.fog, w.near, w.far);
  r.draw(game.city.staticBatch);
  if (game.glbBatch) r.draw(game.glbBatch);
  const dyn = new BoxBatch();
  collectDynamicBoxes(game, dyn);
  r.draw(dyn);
  updateHud(game);
  if (game.dom && game.dom.phone) renderPhone(game, game.dom.phone);
}

// ---- boot (browser only) ----

export function boot(game) {
  if (typeof document === 'undefined') return false;
  const canvas = document.getElementById('game');
  if (!canvas) return false;
  game.canvas = canvas;
  game.renderer = createRenderer(canvas);
  game.dom = {
    menu: document.getElementById('hud-menu'),
    modal: document.getElementById('hud-modal'),
    card: document.getElementById('hud-card'),
    cardInner: document.querySelector('#hud-card .card-inner'),
    toast: document.getElementById('toast'),
    dialogue: document.getElementById('dialogue'),
    cash: document.getElementById('hud-cash'),
    health: document.getElementById('hud-health'),
    wanted: document.getElementById('hud-wanted'),
    weapons: document.getElementById('hud-weapons'),
    bombs: document.getElementById('hud-bombs'),
    clock: document.getElementById('hud-clock'),
    radio: document.getElementById('hud-radio'),
    respect: document.getElementById('hud-respect'),
    location: document.getElementById('hud-location'),
    mission: document.getElementById('hud-mission'),
    police: document.getElementById('hud-police'),
    car: document.getElementById('hud-car'),
    minimap: document.getElementById('hud-minimap'),
    phone: document.getElementById('hud-phone'),
    err: document.getElementById('err'),
  };
  const btnNew = document.getElementById('btn-new');
  const btnContinue = document.getElementById('btn-continue');
  if (btnNew) btnNew.onclick = () => startNewGame(game);
  if (btnContinue) {
    btnContinue.onclick = () => continueGame(game);
    if (!hasSave()) btnContinue.style.display = 'none';
  }
  attachInput(game.input, canvas);
  // GLB barrels: procedural fallback immediately, replaced by the
  // real model when it loads (async, never blocking).
  const fallback = new BoxBatch();
  for (const [x, z, yaw] of BARREL_SPOTS) {
    fallback.pushBox(x, 0.5, z, 0.8, 1, 0.8, BARREL_COLOR);
  }
  game.glbBatch = fallback;
  loadGLB('assets/barrel.glb').then((model) => {
    if (!model) return; // fallback barrels stay
    game.glbModel = model;
    const batch = new BoxBatch();
    let total = 0;
    for (const [x, z, yaw] of BARREL_SPOTS) {
      total += addGLBToBatch(batch, model, { x, z, yaw, scale: 1, color: BARREL_COLOR });
    }
    game.glbTriangles = total;
    game.glbBatch = batch;
  });
  // Visible error overlay (never a silent failure).
  window.addEventListener('error', (e) => {
    if (game.dom.err) {
      game.dom.err.style.display = 'block';
      game.dom.err.textContent = 'Error: ' + e.message;
    }
  });
  // Resize the canvas to the window.
  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (game.renderer.gl) {
      game.renderer.gl.viewport(0, 0, canvas.width, canvas.height);
    }
  };
  window.addEventListener('resize', resize);
  resize();
  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    stepGame(game, dt);
    renderFrame(game);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  return true;
}

// The browser entry point (index.html loads this module and calls it).
if (typeof document !== 'undefined') {
  const game = createGame();
  boot(game);
}
