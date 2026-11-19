// Solmar Bay — game loop and wiring. Builds the shared `game`
// object, runs the frame loop, owns the menus, and glues every
// module together.
//
// Input rules (play-test, 19 Nov 2026): every tap action (E, F, G,
// Escape/P, M, Digit1-4, Enter) reads `pressedKey` — the `pressed`
// set that records a keydown even if it is released between frames.
// Cooldowns are always gated with `<= 0`, never `!cooldown`.

import { createRenderer } from './render.js';
import { generateCity, buildStaticBoxes, buildWaterBoxes } from './world.js';
import { COL, dist } from './config.js';
import { createInput } from './input.js';
import { createCamera, updateCamera, snapCamera } from './shots.js';
import {
  createState, resetState, damagePlayer, healPlayer, addArmor,
  MODES, selectWeapon,
} from './state.js';
import { createPlayer, updatePlayer, drawPlayer, tryEnterVehicle, exitVehicle } from './player.js';
import { createVehicles, updateVehicles, drawVehicles } from './vehicles.js';
import { createPeds, updatePeds, drawPeds, fleeFrom } from './pedestrians.js';
import { createGangs, updateGangs, drawGangs } from './gangs.js';
import { createPolice, updatePolice, drawPolice, getBusted } from './police.js';
import { createMissions, startChapter, updateMissions, drawMissions } from './missions.js';
import {
  createCombat, seedPickups, tryPunch, tryShoot, throwBomb,
  updateCombat, drawCombat, damageTarget,
} from './combat.js';
import { createFire, updateFire, drawFire } from './fire.js';
import { createTaxi, updateTaxi, drawTaxi } from './taxi.js';
import { createFood, nearestShop, openFoodMenu, closeFoodMenu, buyFood, drawFood } from './food.js';
import { createDating, startDate, updateDating, drawDating } from './dating.js';
import {
  createCats, updateCats, drawCats, nearestCat, nearestDog,
  pickUpCat, putDownCat, petDog,
} from './cats.js';
import { createOutfit, openOutfitMenu, closeOutfitMenu, cycleOutfit, drawOutfit, OUTFIT_PARTS } from './outfit.js';
import {
  createTraining, updateTraining, drawTraining,
  startRange, startSwim, startCourse, checkRangeHit,
} from './training.js';
import { createEvents, updateEvents, drawEvents } from './events.js';
import {
  createLiving, updateLiving, drawLiving, boardTrain, exitTrain,
  toggleElevator,
} from './living.js';
import {
  createHud, updateHud, showOverlay, setChapterCard, setBustedCard,
  setCompleteCard, drawMinimap,
} from './hud.js';
import { createAudio } from './audio.js';
import { saveGame, loadGame } from './save.js';

export function createGame(opts) {
  const o = opts || {};
  const city = generateCity();
  const input = o.input || createInput(typeof window !== 'undefined' ? window : null);
  let renderer = o.renderer || null;
  if (!renderer && o.canvas) {
    try {
      renderer = createRenderer(o.canvas, COL.fog);
      renderer.bakeStatic(buildStaticBoxes(city));
    } catch (e) {
      renderer = null;
    }
  }
  const hud = o.hud || createHud();
  const audio = o.audio || createAudio();

  const game = {
    city, input, renderer, hud, audio,
    canvas: o.canvas || null,
    camera: createCamera(),
    state: createState(),
    player: createPlayer(city.spawns.player),
    vehicles: createVehicles(city),
    peds: createPeds(city),
    gangs: createGangs(),
    police: createPolice(),
    missions: createMissions(),
    combat: createCombat(),
    fire: createFire(),
    taxi: createTaxi(),
    food: createFood(),
    dating: createDating(),
    cats: createCats(city),
    outfit: createOutfit(),
    training: createTraining(),
    events: createEvents(),
    living: createLiving(city),
    COL,
    time: 0,
    flashT: 0,
    saveT: 0,
    menuOrbit: 0,
    lastMode: null,
  };

  // cross-module helpers the modules call through `game`
  game.peds.fleeFrom = (x, z, r) => fleeFrom(game.peds, x, z, r);
  game.combat.damagePed = (g, ped, dmg, cause) => damageTarget(g, { ref: ped, kind: 'ped' }, dmg, cause);
  game.toast = (text, seconds) => setToast(game.state, text, seconds);
  game.healPlayer = (amount) => healPlayer(game.state, amount);
  game.addArmor = (amount) => addArmor(game.state, amount);
  game.hurtPlayer = (amount, cause) => {
    if (game.state.mode !== 'playing') return;
    if (damagePlayer(game.state, amount)) {
      getBusted(game, cause === 'cop' ? 'Busted by the police' : 'You died');
    }
  };
  game.save = () => saveGame(game);

  seedPickups(game);
  return game;
}

// ---- menus ----
export function startNewGame(game) {
  game.audio.ensure();
  game.audio.startBass();
  resetState(game.state, true);
  const city = game.city;
  game.player = createPlayer(city.spawns.player);
  game.vehicles = createVehicles(city);
  game.peds = createPeds(city);
  game.peds.fleeFrom = (x, z, r) => fleeFrom(game.peds, x, z, r);
  game.gangs = createGangs();
  game.police = createPolice();
  game.missions = createMissions();
  game.combat = createCombat();
  game.combat.damagePed = (g, ped, dmg, cause) => damageTarget(g, { ref: ped, kind: 'ped' }, dmg, cause);
  game.fire = createFire();
  game.taxi = createTaxi();
  game.food = createFood();
  game.dating = createDating();
  game.cats = createCats(city);
  game.training = createTraining();
  game.events = createEvents();
  game.living = createLiving(city);
  seedPickups(game);
  game.camera = createCamera();
  snapCamera(game.camera, game.player, game.player.heading);
  startChapter(game, 0);
  showOverlay(game.hud, 'chapter');
}

export function continueGame(game) {
  const data = loadGame();
  if (!data) return false;
  game.audio.ensure();
  game.audio.startBass();
  resetState(game.state, true);
  game.state.cash = data.cash;
  game.state.chapter = data.chapter;
  game.state.stats = { ...game.state.stats, ...data.stats };
  game.state.weapon = data.weapon || 'pistol';
  game.state.ammo = data.ammo || { smg: 0, shotgun: 0 };
  game.state.bombs = data.bombs !== undefined ? data.bombs : 3;
  if (data.outfit) game.state.outfit = data.outfit;
  if (data.relationship) game.state.relationship = data.relationship;
  if (data.accuracyBonus) game.state.accuracyBonus = data.accuracyBonus;
  if (data.handlingBonus) game.state.handlingBonus = data.handlingBonus;
  const city = game.city;
  game.player = createPlayer({ x: data.player.x, z: data.player.z });
  game.vehicles = createVehicles(city);
  game.peds = createPeds(city);
  game.peds.fleeFrom = (x, z, r) => fleeFrom(game.peds, x, z, r);
  game.gangs = createGangs();
  game.police = createPolice();
  game.missions = createMissions();
  game.combat = createCombat();
  game.combat.damagePed = (g, ped, dmg, cause) => damageTarget(g, { ref: ped, kind: 'ped' }, dmg, cause);
  game.fire = createFire();
  game.taxi = createTaxi();
  game.food = createFood();
  game.dating = createDating();
  game.cats = createCats(city);
  game.training = createTraining();
  game.events = createEvents();
  game.living = createLiving(city);
  seedPickups(game);
  game.camera = createCamera();
  snapCamera(game.camera, game.player, game.player.heading);
  if (data.chapter >= 5) {
    game.state.chapterActive = false;
    game.state.objective = 'Story complete — Solmar Bay is yours. Free roam!';
    game.state.mode = 'playing';
    showOverlay(game.hud, null);
  } else {
    startChapter(game, data.chapter);
    showOverlay(game.hud, 'chapter');
  }
  return true;
}

export function respawnAfterBusted(game) {
  game.audio.ensure();
  resetState(game.state, false);
  game.state.mode = 'playing';
  const h = game.city.spawns.hospital;
  game.player.x = h.x;
  game.player.z = h.z;
  game.player.y = 0;
  game.player.inVehicle = null;
  snapCamera(game.camera, game.player, game.player.heading);
  if (game.state.chapterActive && game.state.chapter < 5) {
    game.state.objective = 'Continue the story.';
  } else {
    game.state.objective = 'Free roam — find a side-job marker.';
  }
  showOverlay(game.hud, null);
  game.save();
}

// ---- E interaction dispatcher (priority order) ----
export function interact(game) {
  const p = game.player;
  const state = game.state;
  if (state.eCooldown > 0) return false;
  // 1. get off the train
  if (p.onTrain) {
    state.eCooldown = 0.35;
    return exitTrain(game);
  }
  // 2. elevator ride (already on it)
  if (p.onElevator) {
    state.eCooldown = 0.35;
    return toggleElevator(game);
  }
  // 3. board the train at the station
  if (boardTrain(game)) {
    state.eCooldown = 0.35;
    return true;
  }
  // 4. step onto the elevator platform
  const el = game.city.elevator;
  if (dist(p.x, p.z, el.x, el.z) < 4) {
    p.onElevator = true;
    state.eCooldown = 0.35;
    return toggleElevator(game);
  }
  // 5. put the carried cat down
  if (p.carryingCat) {
    state.eCooldown = 0.2;
    return putDownCat(game);
  }
  // 6. pick up a cat
  const cat = nearestCat(game, p.x, p.z, 2.5);
  if (cat) {
    pickUpCat(game, cat);
    state.eCooldown = 0.2;
    return true;
  }
  // 7. pet a dog
  const dog = nearestDog(game, p.x, p.z, 2.5);
  if (dog) {
    petDog(game, dog);
    state.eCooldown = 0.2;
    return true;
  }
  // 8. food shop menu
  const shop = nearestShop(game, p.x, p.z, 7);
  if (shop) {
    openFoodMenu(game, shop);
    state.eCooldown = 0.2;
    return true;
  }
  // 9. outfit shop menu
  const os = game.city.spawns.outfitShop;
  if (dist(p.x, p.z, os.x, os.z) < 8) {
    openOutfitMenu(game);
    state.eCooldown = 0.2;
    return true;
  }
  // 10. start a date with Maya
  if (!game.dating.active && dist(p.x, p.z, game.dating.gf.x, game.dating.gf.z) < 4) {
    startDate(game);
    state.eCooldown = 0.2;
    return true;
  }
  // 11. shooting range
  const rg = game.city.spawns.range;
  if (dist(p.x, p.z, rg.x, rg.z) < 10 && !game.training.range.active) {
    startRange(game);
    state.eCooldown = 0.2;
    return true;
  }
  // 12. swim challenge
  const buoy = game.city.spawns.buoy;
  if (dist(p.x, p.z, buoy.x, buoy.z) < 8 && !game.training.swim.active) {
    startSwim(game);
    state.eCooldown = 0.2;
    return true;
  }
  // 13. driving course (in a vehicle, at the start cones)
  if (p.inVehicle && dist(p.x, p.z, 100, 250) < 8 && !game.training.course.active) {
    startCourse(game);
    state.eCooldown = 0.2;
    return true;
  }
  // 14. enter / exit a vehicle
  if (p.inVehicle) return exitVehicle(game);
  return tryEnterVehicle(game);
}

// ---- one frame ----
export function stepGame(game, dt) {
  if (dt > 0.05) dt = 0.05;
  if (dt <= 0) dt = 0.001;
  const state = game.state;
  const input = game.input;

  syncOverlay(game);

  if (state.mode === 'menu') {
    game.time += dt;
    game.menuOrbit += dt * 0.08;
    if (input.pressedKey('Enter')) startNewGame(game);
    renderMenuBackdrop(game, dt);
    updateHud(game.hud, game);
    input.endFrame();
    return;
  }

  if (state.mode === 'chapter') {
    game.missions.introT += dt;
    if (game.missions.introT > 4 || input.pressedKey('Enter') || input.pressedKey('Escape')) {
      state.mode = 'playing';
      showOverlay(game.hud, null);
    }
    renderWorld(game, dt, currentAspect(game));
    input.endFrame();
    return;
  }

  if (state.mode === 'paused') {
    if (input.pressedKey('Escape') || input.pressedKey('KeyP')) {
      state.mode = 'playing';
      showOverlay(game.hud, null);
    }
    renderWorld(game, dt, currentAspect(game));
    input.endFrame();
    return;
  }

  if (state.mode === 'busted') {
    if (input.pressedKey('Enter')) respawnAfterBusted(game);
    renderWorld(game, dt, currentAspect(game));
    input.endFrame();
    return;
  }

  if (state.mode === 'complete') {
    if (input.pressedKey('Enter') || input.pressedKey('Escape')) {
      state.mode = 'playing';
      showOverlay(game.hud, null);
    }
    renderWorld(game, dt, currentAspect(game));
    input.endFrame();
    return;
  }

  // ---- playing ----
  game.time += dt;
  state.stats.timePlayed += dt;
  if (state.toastTimer > 0) state.toastTimer -= dt;
  if (game.flashT > 0) game.flashT -= dt;
  if (state.eCooldown > 0) state.eCooldown -= dt;
  if (state.fCooldown > 0) state.fCooldown -= dt;
  if (state.gCooldown > 0) state.gCooldown -= dt;

  if (input.pressedKey('KeyM')) {
    game.audio.setMuted(!game.audio.muted);
    game.toast(game.audio.muted ? 'Sound off' : 'Sound on');
  }

  // Menus take over the number keys while open. Escape closes the open
  // menu instead of pausing: pausing first would trap the menu open
  // (Esc would only toggle pause and the menu could never be left).
  if (game.food.menuOpen) {
    if (input.pressedKey('Digit1')) buyFood(game, 0);
    if (input.pressedKey('Digit2')) buyFood(game, 1);
    if (input.pressedKey('Digit3')) buyFood(game, 2);
    if (input.pressedKey('Escape')) closeFoodMenu(game);
  } else if (game.outfit.menuOpen) {
    if (input.pressedKey('Digit1')) cycleOutfit(game, OUTFIT_PARTS[0]);
    if (input.pressedKey('Digit2')) cycleOutfit(game, OUTFIT_PARTS[1]);
    if (input.pressedKey('Digit3')) cycleOutfit(game, OUTFIT_PARTS[2]);
    if (input.pressedKey('Digit4')) cycleOutfit(game, OUTFIT_PARTS[3]);
    if (input.pressedKey('Escape')) closeOutfitMenu(game);
  } else {
    if (input.pressedKey('Escape') || input.pressedKey('KeyP')) {
      state.mode = 'paused';
      showOverlay(game.hud, 'pause');
      input.endFrame();
      return;
    }
    if (input.pressedKey('Digit1')) selectWeapon(state, 'pistol');
    if (input.pressedKey('Digit2')) selectWeapon(state, 'smg');
    if (input.pressedKey('Digit3')) selectWeapon(state, 'shotgun');
    if (input.pressedKey('KeyG')) throwBomb(game);
    if (input.pressedKey('KeyF')) tryPunch(game);
    if (input.pressedKey('KeyE')) interact(game);
    // parachute: Space while flying high in the plane
    const pv = game.player.inVehicle;
    if (input.pressedKey('Space') && pv && pv.kind === 'plane' && pv.airborne && pv.y > 15) {
      game.player.parachuting = true;
      game.player.parachuteY = pv.y;
      game.player.x = pv.x;
      game.player.z = pv.z;
      game.player.inVehicle = null;
      pv.driver = null;
    }
    if (input.clicked) {
      tryShoot(game);
      checkRangeHit(game);
    } else if (input.mouseDown && state.weapon === 'smg') {
      tryShoot(game);
    }
  }

  updatePlayer(dt, game);
  updateVehicles(dt, game);
  updatePeds(dt, game);
  updateGangs(dt, game);
  updatePolice(dt, game);
  updateMissions(dt, game);
  updateCombat(dt, game);
  updateFire(dt, game);
  updateTaxi(dt, game);
  updateDating(dt, game);
  updateCats(dt, game);
  updateTraining(dt, game);
  updateEvents(dt, game);
  updateLiving(dt, game);

  // engine sound follows the driven vehicle
  const v = game.player.inVehicle;
  if (v) game.audio.setEngine(v.speed, v.kind === 'plane' ? 72 : v.kind === 'bike' ? 48 : v.kind === 'boat' ? 26 : 38);
  else game.audio.setEngine(0, 38);

  renderWorld(game, dt, currentAspect(game));
  updateHud(game.hud, game);

  // autosave
  game.saveT += dt;
  if (game.saveT > 15) {
    game.saveT = 0;
    game.save();
  }

  input.endFrame();
}

function currentAspect(game) {
  if (game.canvas) {
    const c = game.canvas;
    return (c.width || 1280) / (c.height || 720);
  }
  return 1280 / 720;
}

// Keep the visible overlay in sync with the game mode.
function syncOverlay(game) {
  const mode = game.state.mode;
  if (mode === game.lastMode) return;
  game.lastMode = mode;
  const map = { menu: 'menu', paused: 'pause', busted: 'busted', chapter: 'chapter', complete: 'complete', playing: null };
  if (mode === 'chapter') {
    setChapterCard(game.hud, game.state.chapterTitle, game.state.chapterText);
  }
  if (mode === 'busted') {
    setBustedCard(game.hud, game.state.bustedReason);
  }
  if (mode === 'complete') {
    const s = game.state.stats;
    setCompleteCard(game.hud,
      'Cash $' + game.state.cash + ' · Kills ' + s.kills + ' · Cars stolen ' + s.carsStolen +
      ' · Missions ' + s.missionsDone + ' · Side jobs ' + s.sideDone +
      ' · Driven ' + Math.round(s.distanceDriven / 1000) + ' km');
  }
  showOverlay(game.hud, map[mode] || null);
}

function renderWorld(game, dt, aspect) {
  const p = game.player;
  const v = p.inVehicle;
  const focus = v ? { x: v.x, y: v.y, z: v.z } : { x: p.x, y: p.y, z: p.z };
  const heading = v ? v.heading : p.heading;
  const mode = v ? (v.kind === 'plane' && v.airborne ? 'fly' : 'drive') : 'foot';
  updateCamera(game.camera, dt, game.input, focus, heading, mode);
  const r = game.renderer;
  if (!r) return;
  r.beginFrame(game.camera.eye, game.camera.target, aspect);
  drawPlayer(r, game);
  drawVehicles(r, game);
  drawPeds(r, game);
  drawGangs(r, game);
  drawPolice(r, game);
  drawCombat(r, game);
  drawMissions(r, game);
  drawFire(r, game);
  drawTaxi(r, game);
  drawFood(r, game);
  drawDating(r, game);
  drawCats(r, game);
  drawOutfit(r, game);
  drawTraining(r, game);
  drawEvents(r, game);
  drawLiving(r, game);
  for (const w of buildWaterBoxes(game.city, game.time)) {
    r.water(w.x, w.y, w.z, w.sx, w.sy, w.sz, w.color);
  }
  r.endFrame();
}

function renderMenuBackdrop(game, dt) {
  const r = game.renderer;
  if (!r) return;
  const eye = [Math.sin(game.menuOrbit) * 150, 70, Math.cos(game.menuOrbit) * 150];
  r.beginFrame(eye, [0, 8, 0], currentAspect(game));
  drawVehicles(r, game);
  drawPeds(r, game);
  drawGangs(r, game);
  drawLiving(r, game);
  for (const w of buildWaterBoxes(game.city, game.time)) {
    r.water(w.x, w.y, w.z, w.sx, w.sy, w.sz, w.color);
  }
  r.endFrame();
  // the minimap draws behind the menu (never an empty green box)
  if (game.hud.minimap) {
    const ctx = game.hud.minimap.getContext('2d');
    if (ctx) drawMinimap(ctx, game);
  }
  void dt;
}

// ---- browser boot (not run in Node tests) ----
function boot() {
  const canvas = document.getElementById('game');
  const game = createGame({ canvas });

  function resize() {
    canvas.width = Math.min(window.innerWidth, 1920);
    canvas.height = Math.min(window.innerHeight, 1080);
  }
  window.addEventListener('resize', resize);
  resize();

  function bind(id, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  }
  bind('btn-new', () => startNewGame(game));
  bind('btn-continue', () => continueGame(game));
  bind('btn-resume', () => {
    game.state.mode = 'playing';
    showOverlay(game.hud, null);
  });
  bind('btn-busted', () => respawnAfterBusted(game));
  bind('btn-roam', () => {
    game.state.mode = 'playing';
    showOverlay(game.hud, null);
  });
  bind('btn-chapter', () => {
    if (game.state.mode === 'chapter') {
      game.state.mode = 'playing';
      showOverlay(game.hud, null);
    }
  });
  bind('btn-menu-quit', () => {
    game.save();
    game.state.mode = 'menu';
    showOverlay(game.hud, 'menu');
    refreshMenu(game);
  });

  refreshMenu(game);
  showOverlay(game.hud, 'menu');

  let lastT = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = (now - lastT) / 1000;
    lastT = now;
    stepGame(game, dt);
  }
  requestAnimationFrame(frame);
}

export function refreshMenu(game) {
  const data = loadGame();
  const hud = game.hud;
  if (hud.menuContinue) hud.menuContinue.style.display = data ? 'inline-block' : 'none';
  if (hud.menuSaveInfo) {
    hud.menuSaveInfo.textContent = data
      ? 'Save found: $' + data.cash + ', chapter ' + Math.min(data.chapter + 1, 5) + ' of 5'
      : 'No save yet — start a new game.';
  }
}

if (typeof document !== 'undefined' && typeof window !== 'undefined' && !window.__SOLMAR_NO_BOOT) {
  boot();
}
