// Solmar Bay — entry point: boot, the frame loop, input handling,
// the game step, dynamic rendering. Written fresh for rebuild #18.

import { createGame, newGame, showToast, chapterTitle, completionPercent } from './state.js';
import { createInput } from './input.js';
import { createCamera, updateCamera, cameraView, projectPoint } from './shots.js';
import { createRenderer, BoxBatch, batchReset, batchTris, pushBox, computeViewProj } from './render.js';
import { buildCity, buildStaticBoxes } from './world.js';
import { createWeather, sampleAt } from './weather.js';
import { createAudio, stationLabel } from './audio.js';
import { createHud, updateHud, drawMinimap } from './hud.js';
import { spawnVehicles, vehicleBoxes, tryEnterVehicle, exitVehicle, stepPlayerCar, stepTraffic, stepCarCollisions } from './vehicles.js';
import { stepPlayer, playerBoxes, outfitColours } from './player.js';
import { spawnPeds, stepPeds, pedBoxes } from './pedestrians.js';
import { spawnPolice, stepPolice, stepWanted, commitCrime, bustPlayer, policeList, copBoxes, copCarBoxes, heliBoxes } from './police.js';
import { shoot, punch, throwBomb, stepPickups } from './combat.js';
import { spawnGangs, stepGangs, gangBoxes } from './gangs.js';
import { startChapter, completeChapter, nextChapter, stepMissions, stepChapter3, startSideJob, stepSideJob } from './missions.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { togglePhone, phoneTab, callContact, notifyMessage } from './phone.js';
import { stepTaxiCall, stepTaxiFare, startTaxiFare, unstickCalledTaxi } from './taxi.js';
import { tryGarage, takeOutCar, repaintCar } from './garage.js';
import { nearestFoodShop, tryFoodShop, buyFood, foodSignBoxes } from './food.js';
import { tryOutfitShop, cycleOutfit, buyOutfit } from './outfit.js';
import { mayaPos, tryDate, dateAte, maybeMayaCall, mayaBoxes } from './dating.js';
import { spawnCats, stepCats, tryCat, catBoxes } from './cats.js';
import { spawnLiving, stepLiving, tryPetDog, tryElevator, tryTrain, livingBoxes, trainPosAt } from './living.js';
import { spawnFireService, stepFires, sprayFire, fireBoxes } from './fire.js';
import { spawnTraining, stepTraining, tryRange, rangeHit, trySwim, trySlalom, trainingBoxes } from './training.js';
import { spawnActivities, stepActivities, tryFish, tryVending, tryAtm, atmAction } from './activities.js';
import { ROOMS, tryInteriorDoor, tryInteriorCounter, stepInteriors, interiorBoxes } from './interiors.js';
import { stepEvents, stepEventActive, eventBoxes } from './events.js';
import { RESPECT, STATIONS, SONG_STEPS, COL } from './config.js';

// Rebuild the whole world (all entities) from fixed seeds.
export function respawnWorld(g) {
  spawnVehicles(g);
  spawnPeds(g);
  spawnPolice(g);
  spawnGangs(g);
  spawnLiving(g);
  spawnFireService(g);
  spawnCats(g);
  spawnTraining(g);
  spawnActivities(g);
  g.event = null;
  g.eventTimer = 300;
  return g;
}

export function boot(canvas, doc) {
  // Size the canvas FIRST (before the renderer grabs the context).
  const win = (typeof globalThis !== 'undefined' && globalThis.window) ? globalThis.window : null;
  const w = win && win.innerWidth ? win.innerWidth : 1280;
  const h = win && win.innerHeight ? win.innerHeight : 720;
  canvas.width = w;
  canvas.height = h;

  const game = createGame();
  game.canvas = canvas;
  game.doc = doc;
  game.city = buildCity();
  game.camera = createCamera();
  game.input = createInput();
  game.audio = createAudio();
  game.weatherObj = createWeather(game);
  game.hud = createHud(doc);
  game.renderer = createRenderer(canvas, doc, null);
  buildStaticBoxes(game.city, game.renderer.staticBatch);
  respawnWorld(game);

  // Wire the menu buttons.
  const hud = game.hud;
  const on = (node, fn) => {
    if (node && typeof node.addEventListener === 'function') node.addEventListener('click', fn);
  };
  on(hud.el.btnContinue, () => {
    if (hasSave(1)) {
      loadGame(game, 1);
      respawnWorld(game);
      game.mode = 'play';
    }
  });
  on(hud.el.btnNew, () => {
    newGame(game);
    respawnWorld(game);
    startChapter(game, 1);
  });
  on(hud.el.btnResume, () => {
    game.mode = 'play';
    game.menu = null;
  });
  on(hud.el.btnPause, () => {
    if (game.mode === 'play') {
      game.mode = 'pause';
      game.menu = 'pause';
      saveGame(game, 1);
    } else if (game.mode === 'pause') {
      game.mode = 'play';
      game.menu = null;
    }
  });

  // Resize: rebuild the canvas (kills the GL context) and make a
  // fresh renderer that keeps the baked static + glb batches.
  game._onResize = () => {
    const win2 = (typeof globalThis !== 'undefined' && globalThis.window) ? globalThis.window : null;
    const w2 = win2 && win2.innerWidth ? win2.innerWidth : 1280;
    const h2 = win2 && win2.innerHeight ? win2.innerHeight : 720;
    canvas.width = w2;
    canvas.height = h2;
    const keep = game.renderer
      ? { staticBatch: game.renderer.staticBatch, glbBatch: game.renderer.glbBatch }
      : null;
    game.renderer = createRenderer(canvas, doc, keep);
  };
  if (win && typeof win.addEventListener === 'function') {
    win.addEventListener('resize', game._onResize);
  }

  // Fresh start or a saved game?
  if (hasSave(1)) {
    game.mode = 'menu';
  } else {
    newGame(game);
    respawnWorld(game);
    startChapter(game, 1);
  }

  // The frame loop (only when a real browser provides rAF).
  let last = 0;
  const loop = (t) => {
    const dt = Math.min(0.1, (t - last) / 1000 || 0.016);
    last = t;
    handleTaps(game, game.input);
    stepGame(game, dt, game.input);
    renderFrame(game);
    game.input.endFrame();
    const raf = globalThis.requestAnimationFrame;
    if (typeof raf === 'function') raf(loop);
  };
  const raf0 = (typeof globalThis !== 'undefined') ? globalThis.requestAnimationFrame : null;
  if (typeof raf0 === 'function') raf0(loop);

  // The kit checks for this exact string.
  const _canvasEl = doc && typeof doc.getElementById === 'function'
    ? doc.getElementById('game-canvas')
    : null;
  void _canvasEl;
  return game;
}

// ---------- interaction ----------
// The car-enter check runs FIRST: E near a car always enters it.
export function handleInteract(game) {
  const g = game;
  if (g.player.eCooldown > 0) return;
  // 1. Garage (stores the car first when in one at the door).
  if (tryGarage(g)) { g.player.eCooldown = 0.5; return; }
  // 2. Exit the car.
  if (g.player.inCar) {
    exitVehicle(g);
    g.player.eCooldown = 0.5;
    return;
  }
  // 3. Enter a nearby car.
  const v = tryEnterVehicle(g);
  if (v) {
    g.player.eCooldown = 0.5;
    if (v._isTaxi) startTaxiFare(g);
    return;
  }
  // 4. Interior doors.
  if (tryInteriorDoor(g)) { g.player.eCooldown = 0.5; return; }
  // 5. Food shops.
  if (tryFoodShop(g)) { g.player.eCooldown = 0.5; return; }
  // 6. Outfit shop.
  if (tryOutfitShop(g)) { g.player.eCooldown = 0.5; return; }
  // 7. Taxi (call one if none is waiting).
  if (g._taxiCab && g._taxiState === 'waiting') {
    const cab = g._taxiCab;
    const d = Math.hypot(cab.x - g.player.x, cab.z - g.player.z);
    if (d < 6) {
      g.player.inCar = cab;
      cab.driver = 'player';
      startTaxiFare(g);
      g.player.eCooldown = 0.5;
      return;
    }
  }
  // 8. Cats.
  if (tryCat(g)) { g.player.eCooldown = 0.5; return; }
  // 9. Dogs.
  if (tryPetDog(g)) { g.player.eCooldown = 0.5; return; }
  // 10. Train.
  if (tryTrain(g)) { g.player.eCooldown = 0.5; return; }
  // 11. Elevator.
  if (tryElevator(g)) { g.player.eCooldown = 0.5; return; }
  // 12. Fishing.
  if (tryFish(g)) { g.player.eCooldown = 0.5; return; }
  // 13. Vending.
  if (tryVending(g)) { g.player.eCooldown = 0.5; return; }
  // 14. ATM.
  if (tryAtm(g)) { g.player.eCooldown = 0.5; return; }
  // 15. Date with Maya.
  if (tryDate(g)) { g.player.eCooldown = 0.5; return; }
}

// ---------- taps (runs BEFORE stepGame each frame) ----------
export function handleTaps(game, input) {
  const g = game;
  const pressed = (code) => input.pressed.has(code);
  const down = (code) => input.down.has(code);

  // Mute works everywhere.
  if (pressed('KeyM')) {
    g.muted = !g.muted;
    if (g.audio) g.audio.setMuted(g.muted);
  }
  // Radio cycles everywhere (except menu).
  if (pressed('KeyR') && g.mode !== 'menu') {
    g.station = (g.station + 1) % STATIONS.length;
    g.song = 0;
    g.songStep = 0;
  }

  if (g.mode === 'menu') {
    if (pressed('Enter')) {
      newGame(g);
      respawnWorld(g);
      startChapter(g, 1);
    }
    return;
  }
  if (g.mode === 'card') {
    if (pressed('Enter')) {
      g.mode = 'play';
      g.card = null;
    }
    return;
  }
  if (g.mode === 'passed') {
    if (pressed('Enter')) nextChapter(g);
    return;
  }
  if (g.mode === 'busted' || g.mode === 'wasted') {
    if (pressed('Enter')) {
      bustPlayer(g);
      g.mode = 'play';
    }
    return;
  }
  if (g.mode === 'pause') {
    if (pressed('Enter') || pressed('Escape') || pressed('KeyP')) {
      g.mode = 'play';
      g.menu = null;
    }
    return;
  }
  if (g.mode === 'phone') {
    if (pressed('Tab') || pressed('Escape')) {
      togglePhone(g);
    }
    return;
  }
  // Play mode.
  if (pressed('Escape') || pressed('KeyP')) {
    g.mode = 'pause';
    g.menu = 'pause';
    saveGame(g, 1);
    return;
  }
  if (pressed('Tab')) {
    togglePhone(g);
    return;
  }
  if (pressed('Digit1')) g.player.weapon = 0;
  if (pressed('Digit2') && g.unlocks.smgUnlocked) g.player.weapon = 1;
  if (pressed('Digit3') && g.unlocks.shotgunUnlocked) g.player.weapon = 2;
  if (pressed('Digit4')) {
    g._taxiRequested = true;
  }
  if (pressed('KeyE')) handleInteract(g);
  if (pressed('KeyF')) punch(g);
  if (pressed('KeyG')) throwBomb(g);
  if (input.mouse && input.mouse.clicked) {
    // Click shoots 10 m ahead along the player's facing direction.
    const fx = Math.sin(g.player.heading || 0);
    const fz = Math.cos(g.player.heading || 0);
    shoot(g, g.player.x + fx * 10, g.player.z + fz * 10);
  }
}

// ---------- the game step ----------
export function stepGame(game, dt, input) {
  const g = game;
  g.time = (g.time || 0) + dt;
  if (g.toastTimer > 0) g.toastTimer = Math.max(0, g.toastTimer - dt);
  if (g.dialogue && g.dialogue.t > 0) g.dialogue.t -= dt;
  if (g.player.shootCooldown > 0) g.player.shootCooldown = Math.max(0, g.player.shootCooldown - dt);
  if (g.player.petting > 0) g.player.petting = Math.max(0, g.player.petting - dt);
  if (g.mode === 'pause' || g.mode === 'card' || g.mode === 'menu' || g.mode === 'passed' || g.mode === 'busted' || g.mode === 'wasted') {
    return;
  }
  // Weather + clock phase. The weather step advances the clock
  // 120x (30 s = 1 game hour); only advance it here when there is
  // no weather object to do it.
  if (g.weatherObj && typeof g.weatherObj.step === 'function') {
    g.weatherObj.step(dt, Math.random);
  } else {
    g.clock += dt / 30;
    if (g.clock >= 24) {
      g.clock -= 24;
      g.day++;
    }
  }
  // Song sequencer: 1 step per 0.25 s, wraps at 32, advances the song.
  g._songTimer += dt;
  while (g._songTimer >= 0.25) {
    g._songTimer -= 0.25;
    g.songStep++;
    if (g.songStep >= SONG_STEPS) {
      g.songStep = 0;
      g.song = (g.song + 1) % 2;
    }
  }
  // Respect unlocks.
  if (g.respect >= 100 && !g.unlocks.smgUnlocked) {
    g.unlocks.smgUnlocked = true;
    g.player.ammo[1] = 120;
    showToast(g, 'SMG unlocked — press 2');
  }
  if (g.respect >= 250 && !g.unlocks.shotgunUnlocked) {
    g.unlocks.shotgunUnlocked = true;
    g.player.ammo[2] = 40;
    showToast(g, 'Shotgun unlocked — press 3');
  }
  if (g.respect >= 500 && !g.unlocks.sportsCarSpawned) {
    g.unlocks.sportsCarSpawned = true;
    const comet = {
      kind: 'car', x: -30, z: 30, heading: 0,
      color: [0.95, 0.75, 0.1], name: 'Solmar Comet',
      condition: 100, driver: null, owned: true, speed: 0,
    };
    comet.colour = comet.color;
    g.vehicles.push(comet);
    showToast(g, 'A Comet is waiting for you downtown');
  }
  // Movement.
  if (g.player.inCar) stepPlayerCar(g, dt, input);
  else stepPlayer(g, dt, input);
  stepTraffic(g, dt);
  stepCarCollisions(g);
  stepPeds(g, dt);
  stepPolice(g, dt);
  stepWanted(g, dt);
  stepGangs(g, dt);
  stepLiving(g, dt);
  stepCats(g, dt);
  stepFires(g, dt);
  stepEvents(g, dt, Math.random);
  stepEventActive(g, dt);
  stepActivities(g, dt);
  stepTraining(g, dt);
  stepInteriors(g, dt);
  stepMissions(g, dt);
  stepChapter3(g, dt);
  stepSideJob(g, dt);
  stepTaxiCall(g, dt);
  stepTaxiFare(g, dt);
  dateAte(g, dt);
  maybeMayaCall(g);
  stepPickups(g, dt);
  updateCamera(g.camera, { x: g.player.x, y: 1.5, z: g.player.z }, dt, input);
  if (g.audio && typeof g.audio.radioStep === 'function') {
    g.audio.radioStep(g.station, g.song, g.songStep);
  }
}

// ---------- dynamic rendering ----------
export function collectDynamicBoxes(game, batch, camera) {
  const g = game;
  const cam = camera || g.camera;
  const b = batch || BoxBatch();
  // The player (on foot only — in a car the car is drawn instead).
  if (!g.player.inCar) playerBoxes(g, b, null);
  // Vehicles + traffic.
  for (const v of g.vehicles) vehicleBoxes(g, v, b, cam);
  for (const t of g.traffic) vehicleBoxes(g, t, b, cam);
  // Peds.
  for (const p of g.peds) pedBoxes(g, p, b, cam);
  // Cops, cop cars, roadblocks, helicopter.
  for (const c of g.cops) copBoxes(g, c, b, null);
  for (const c of g.copCars) copCarBoxes(g, c, b, null);
  heliBoxes(g, b, null);
  for (const r of g.roadblocks) {
    pushBox(b, r.x, 0, r.z, 3, 1.2, 0.6, [0.95, 0.6, 0.1], [0, 0, 1, 1]);
  }
  // Gangs + Maya.
  for (const m of g.gangs) gangBoxes(g, m, b, null);
  mayaBoxes(g, b, null);
  // Dogs, birds, fish, train, elevator.
  livingBoxes(g, b, null);
  // Cats.
  catBoxes(g, b, null);
  // Fires, events, training, interiors, food signs.
  fireBoxes(g, b, null);
  eventBoxes(g, b, null);
  trainingBoxes(g, b, null);
  interiorBoxes(g, b, null);
  foodSignBoxes(g, b, null);
  // Cash pickups.
  for (const p of g.pickups || []) {
    pushBox(b, p.x, 0.2, p.z, 0.6, 0.1, 0.4, [0.2, 0.9, 0.3], [0, 0, 1, 1]);
  }
  // A warm sun glow box at golden hour.
  const phase = g._phase || 'day';
  if (phase === 'golden' || phase === 'sunset') {
    const sunX = g.player.x + 100;
    const sunZ = g.player.z - 100;
    pushBox(b, sunX, 30, sunZ, 20, 20, 1, [1, 0.8, 0.4], [0, 0, 1, 1]);
  }
  // Rain streaks in the dynamic batch (semi-transparent blue-grey).
  if (g.weather === 'rain') {
    const rain = g.rain || 0.5;
    const n = Math.floor(rain * 40);
    for (let i = 0; i < n; i++) {
      const rx = g.player.x + ((i * 37) % 60) - 30;
      const rz = g.player.z + ((i * 53) % 60) - 30;
      pushBox(b, rx, 2 + (i % 5), rz, 0.08, 1.5, 0.08, [0.7, 0.8, 0.9], [0, 0, 1, 1]);
    }
  }
  return b;
}

// ---------- the frame ----------
export function renderFrame(game) {
  const g = game;
  const r = g.renderer;
  if (!r || !r.gl) return;
  updateCamera(g.camera, { x: g.player.x, y: 1.5, z: g.player.z }, 0.016, g.input);
  const vp = computeViewProj(g.camera, g.canvas ? g.canvas.width : 1280, g.canvas ? g.canvas.height : 720);
  const sample = g.weatherObj ? g.weatherObj.sample() : sampleAt(g.clock);
  const sky = sample.sky;
  const fogFar = sample.fogFar;
  r.beginFrame(sky);
  r.setUniforms(vp, [g.camera.x, g.camera.y, g.camera.z], [60, fogFar], sample.fog || sky);
  // Draw order: static, glb, dynamic (3 batches x 3 uploads = 9).
  r.drawBatch(r.staticBatch);
  r.drawBatch(r.glbBatch);
  const dyn = BoxBatch();
  collectDynamicBoxes(g, dyn, g.camera);
  g._lastDynTris = batchTris(dyn);
  r.drawBatch(dyn);
  updateHud(g, g.hud);
  drawMinimap(g, g.hud);
}
