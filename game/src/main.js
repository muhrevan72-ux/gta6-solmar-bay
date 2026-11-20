// Solmar Bay — entrypoint: boot, loop, input routing, rendering.
//
// BOOT ORDER (round-7/8 fix — keep it): the canvas is sized FIRST,
// then createRenderer runs, then setViewport. Assigning
// canvas.width/height RESETS the WebGL context and destroys the
// shader program, buffers and textures — a renderer created
// before the canvas is sized dies on frame 1 (flat sky, no
// geometry, no errors). On every later window resize the renderer
// is RE-CREATED after the canvas size changes.
//
// RESIZE (round-9 fix, after play-test #7): re-creating the
// renderer also created NEW EMPTY static/glb batches — the old
// batch data lived on the old renderer and was never re-uploaded,
// so the static world vanished after a resize (only dynamic
// objects kept rendering). rebuildStaticBatches() re-bakes the
// static city AND the GLB barrels into the new renderer, and is
// called after the initial renderer creation, after every resize,
// and when the GLB model finishes loading. It is idempotent
// (it resets the batches first) and exposed as
// game.rebuildStaticBatches for the headless tests.
//
// PAUSE (round-9 fix): Escape/KeyP in play mode pauses (and
// saves); Escape/KeyP/Enter in pause mode resumes. updateHud
// shows the #hud-pause overlay while paused, and the HUD pause
// button (#btn-pause) toggles pause as a fallback when the
// browser swallows Escape.

import { createGame, newGame, showToast, showDialogue, completionPercent } from './state.js';
import { createInput } from './input.js';
import { createCamera, updateCamera } from './shots.js';
import { createRenderer, BoxBatch, batchReset, batchTris, pushBox, pushBoxRot, computeViewProj, boxVisible } from './render.js';
import { buildCity, buildStaticBoxes, lightState } from './world.js';
import { createWeather } from './weather.js';
import { createAudio, stationLabel } from './audio.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { createHud, updateHud } from './hud.js';
import { tileUV } from './texture.js';
import { loadGlb, pushGlbToBatch } from './gltf.js';
import { stepPlayer, playerBoxes, tryEnterVehicle, exitVehicle } from './player.js';
import { spawnVehicles, stepPlayerCar, stepTraffic, stepCarCollisions, vehicleBoxes, makeVehicle } from './vehicles.js';
import { spawnPeds, stepPeds, pedBoxes } from './pedestrians.js';
import { spawnPolice, stepPolice, stepWanted, bustPlayer, commitCrime } from './police.js';
import { shoot, punch, throwBomb, stepPickups, WEAPONS } from './combat.js';
import { startChapter, stepMissions, stepChapter3, nextChapter, stepSideJob } from './missions.js';
import { spawnGangs, stepGangs, gangBoxes } from './gangs.js';
import { spawnLiving, stepLiving, livingBoxes, tryTrain, tryElevator, tryPetDog } from './living.js';
import { spawnFireService, stepFires, sprayFire, fireBoxes } from './fire.js';
import { nearestFoodShop, tryFoodShop, buyFood, foodSignBoxes } from './food.js';
import { tryDate, dateAte, maybeMayaCall, mayaBoxes } from './dating.js';
import { spawnCats, stepCats, tryCat, catBoxes } from './cats.js';
import { tryOutfitShop, cycleOutfit, buyOutfit } from './outfit.js';
import { spawnTraining, stepTraining, tryRange, rangeHit, trySwim, trySlalom, trainingBoxes } from './training.js';
import { stepEvents, stepEventActive, eventBoxes } from './events.js';
import { spawnActivities, stepActivities, tryFish, tryVending, tryAtm, atmAction, activityBoxes } from './activities.js';
import { tryInteriorDoor, tryInteriorCounter, stepInteriors, interiorBoxes } from './interiors.js';
import { tryGarage, takeOutCar, repaintCar } from './garage.js';
import { togglePhone, phoneTab, callContact, CONTACTS } from './phone.js';
import { stepTaxiCall, stepTaxiFare, startTaxiFare, unstickCalledTaxi } from './taxi.js';
import { TUNE, COL, SPAWNS, RESPECT } from './config.js';

// ---------- dynamic boxes ----------
// Everything that moves is rebuilt into a fresh batch every frame.
// Static things live in renderer.staticBatch (see rebuildStaticBatches).
export function collectDynamicBoxes(game, b, cam) {
  batchReset(b);
  const uvPlain = tileUV('plain');
  const uvBrick = tileUV('brick');
  const weather = game.weatherObj.sample();
  const neonBoost = weather.neonBoost;
  // Neon signs (~42, culled at 220 m, brightness follows the time of day).
  for (const n of game.city.neon) {
    const d = Math.hypot(n.x - cam.x, n.z - cam.z);
    if (d > 220) continue;
    const boost = Math.min(1.4, neonBoost);
    const col = [Math.min(1.4, n.col[0] * boost), Math.min(1.4, n.col[1] * boost), Math.min(1.4, n.col[2] * boost)];
    pushBox(b, n.x, n.y, n.z, n.w, n.h, 0.4, col, uvPlain);
  }
  // Clouds + wave crests + sun glints.
  for (const c of game.city.clouds) {
    pushBox(b, c.x, c.y, c.z, c.w, c.h, c.d, [0.95, 0.95, 0.98], uvPlain);
  }
  for (const w of game.city.waves) {
    pushBox(b, w.x, w.y + Math.sin(game.time * 2 + w.z) * 0.2, w.z, w.w, w.h, w.d, [0.4, 0.7, 0.9], uvPlain);
  }
  for (let i = 0; i < 4; i++) {
    const gx = -380 + i * 8;
    pushBox(b, gx, 0.5, -200 + i * 100, 2, 0.3, 6, [1, 0.9, 0.6], uvPlain);
  }
  // Rain drops.
  if (game.rain > 0.2) {
    const n = Math.floor(game.rain * 40);
    for (let i = 0; i < n; i++) {
      const rx = cam.x + ((i * 37) % 100) - 50;
      const rz = cam.z + ((i * 53) % 100) - 50;
      pushBox(b, rx, 10 - ((game.time * 20 + i * 7) % 12), rz, 0.1, 1.5, 0.1, [0.7, 0.85, 1], uvPlain);
    }
  }
  // Player.
  if (!game.player.inCar) playerBoxes(game, b);
  // Vehicles (parked + traffic + cop cars).
  for (const v of [...game.vehicles, ...game.traffic, ...game.copCars]) {
    if (boxVisible(cam, v.x, 1, v.z, 6)) vehicleBoxes(game, v, b, cam);
  }
  // Roadblocks.
  for (const rb of game.roadblocks) {
    pushBoxRot(b, rb.x, 0, rb.z, 4, 1, 1, rb.heading, [0.9, 0.2, 0.15], uvPlain);
  }
  // Helicopter.
  if (game.heli) {
    const h = game.heli;
    pushBox(b, h.x, h.y, h.z, 4, 1.5, 8, [0.2, 0.3, 0.5], uvPlain);
    pushBox(b, h.x, h.y + 1, h.z, 8, 0.2, 0.5, [0.7, 0.7, 0.75], uvPlain);
  }
  // Peds, gangs, cops.
  for (const p of game.peds) {
    if (boxVisible(cam, p.x, 1, p.z, 2)) pedBoxes(game, p, b, cam);
  }
  for (const g of game.gangMembers) {
    if (boxVisible(cam, g.x, 1, g.z, 2)) gangBoxes(game, g, b, cam);
  }
  for (const c of game.cops) {
    if (boxVisible(cam, c.x, 1, c.z, 2)) {
      pushBox(b, c.x - 0.15, 0, c.z, 0.28, 0.85, 0.28, [0.1, 0.15, 0.5], uvPlain);
      pushBox(b, c.x + 0.15, 0, c.z, 0.28, 0.85, 0.28, [0.1, 0.15, 0.5], uvPlain);
      pushBox(b, c.x, 0.85, c.z, 0.75, 0.7, 0.4, [0.1, 0.15, 0.5], uvPlain);
      pushBox(b, c.x, 1.55, c.z, 0.45, 0.45, 0.45, [0.95, 0.8, 0.65], uvPlain);
      pushBox(b, c.x, 1.9, c.z, 0.48, 0.15, 0.48, [0.1, 0.15, 0.5], uvPlain);
    }
  }
  // Pickups.
  for (const pk of game.pickups) {
    const col = pk.kind === 'cash' ? [0.2, 0.9, 0.3] : pk.kind === 'health' ? [0.9, 0.2, 0.2] : pk.kind === 'armour' ? [0.2, 0.4, 0.9] : [1, 0.6, 0.1];
    pushBox(b, pk.x, 0.3 + Math.sin(game.time * 4) * 0.1, pk.z, 0.8, 0.4, 0.8, col, uvPlain);
  }
  // Ambient life, fire, cats, Maya, events, training, activities, interiors, food signs.
  livingBoxes(game, b, cam);
  fireBoxes(game, b, cam);
  catBoxes(game, b, cam);
  mayaBoxes(game, b, cam);
  eventBoxes(game, b, cam);
  trainingBoxes(game, b, cam);
  activityBoxes(game, b, cam);
  interiorBoxes(game, b, cam);
  foodSignBoxes(game, b, cam);
  // Traffic-light poles + the light itself (colour follows the cycle).
  for (const l of game.city.lights) {
    const state = lightState(l, game.time);
    const col = state === 'green' ? [0.2, 0.9, 0.3] : state === 'yellow' ? [1, 0.8, 0.1] : [0.9, 0.2, 0.15];
    pushBox(b, l.x + 2, 4.5, l.z, 0.5, 1.2, 0.5, col, uvPlain);
  }
  return b;
}

// ---------- render ----------

export function renderFrame(game) {
  const r = game.renderer;
  if (!r) return;
  const cam = game.camera;
  const weather = game.weatherObj.sample();
  game._phase = weather.phase;
  const vp = computeViewProj(cam, game.canvas.width, game.canvas.height);
  // Fog in METRES (round-9 fix): near 60 m, far from the weather sample.
  r.setCamera(vp, weather.fog, 60, weather.fogFar, [cam.x, cam.y, cam.z]);
  r.beginFrame(weather.sky); // the ONLY gl.clear in the game
  r.drawBatch(r.staticBatch);
  r.drawBatch(r.glbBatch);
  const dyn = BoxBatch();
  collectDynamicBoxes(game, dyn, cam);
  if (batchTris(dyn) > TUNE.batchCap * 12) {
    // Safety valve: never let a runaway dynamic batch kill the frame.
    dyn.tri = TUNE.batchCap * 12;
  }
  r.drawBatch(dyn);
  game._lastDynTris = batchTris(dyn);
}

// ---------- simulation ----------

export function stepGame(game, dt, input) {
  game.time += dt;
  // Toast + dialogue timers always decay.
  if (game.toastTimer > 0) game.toastTimer -= dt;
  if (game.dialogue && game.dialogue.t > 0) game.dialogue.t -= dt;
  // The world keeps running with the phone open, but not on the
  // title screen, on a card, or while paused/busted/wasted.
  const simModes = ['play', 'phone', 'card', 'passed'];
  if (!simModes.includes(game.mode)) {
    updateHud(game, game.hud);
    return;
  }
  game.weatherObj.step(dt);
  stepPlayer(game, dt, input);
  stepPlayerCar(game, dt, input);
  stepTraffic(game, dt);
  stepCarCollisions(game, dt);
  stepPeds(game, dt);
  stepGangs(game, dt);
  stepPolice(game, dt);
  stepWanted(game, dt);
  stepPickups(game, dt);
  stepLiving(game, dt);
  stepCats(game, dt);
  stepFires(game, dt);
  stepTraining(game, dt);
  stepActivities(game, dt);
  stepInteriors(game, dt);
  stepEvents(game, dt);
  stepEventActive(game, dt);
  stepTaxiCall(game, dt);
  stepTaxiFare(game, dt);
  dateAte(game, dt);
  maybeMayaCall(game);
  stepMissions(game, dt);
  stepChapter3(game);
  stepSideJob(game, dt);
  // Respect unlocks.
  for (const u of RESPECT.unlocks) {
    if (game.respect >= u.min && !game.unlocks[u.flag]) {
      game.unlocks[u.flag] = true;
      showToast(game, `Unlocked: ${u.label}!`);
      if (u.flag === 'sportsCarSpawned') {
        // A Solmar Comet appears at the garage, owned by the player.
        const comet = makeVehicle('car', SPAWNS.garage.x, SPAWNS.garage.z + 8, 0, [0.95, 0.75, 0.15], 'Solmar Comet');
        comet.owned = true;
        game.vehicles.push(comet);
      }
    }
  }
  // Radio sequencer: one step per 0.25 s.
  game._radioT = (game._radioT || 0) + dt;
  if (game._radioT > 0.25) {
    game._radioT = 0;
    game.songStep = (game.songStep + 1) % 32;
    if (game.audio) game.audio.radioStep(game.station, game.song, game.songStep);
    if (game.songStep === 0) {
      game.song = (game.song + 1) % 2;
    }
  }
  updateHud(game, game.hud);
}

// ---------- interaction (E key) ----------
// Order matters: garage first when in a car (round-8 fix — the
// old order exited the car before trying the garage, so the
// garage modal was unreachable from a car), then exit the car,
// then interior counter/door, then entering a vehicle (taxi fare
// starts here), then food, outfit, garage, train, elevator,
// cat, dog, fish, vending, ATM, range, swim, slalom, date.
export function handleInteract(game) {
  const p = game.player;
  if (p.inCar) {
    if (tryGarage(game)) return true;
    exitVehicle(game);
    return true;
  }
  if (tryInteriorCounter(game)) return true;
  if (tryInteriorDoor(game)) return true;
  const v = tryEnterVehicle(game);
  if (v) {
    if (v.taxiCalled) startTaxiFare(game);
    else if (!v.owned) {
      commitCrime(game, 'stealCar');
      game.stats.stolen += 1;
      showToast(game, `${v.name} — yours now. The law disagrees.`);
    }
    return true;
  }
  if (tryFoodShop(game)) return true;
  if (tryOutfitShop(game)) return true;
  if (tryGarage(game)) return true;
  if (tryTrain(game)) return true;
  if (tryElevator(game)) return true;
  if (tryCat(game)) return true;
  if (tryPetDog(game)) return true;
  if (tryFish(game)) return true;
  if (tryVending(game)) return true;
  if (tryAtm(game)) return true;
  if (tryRange(game)) return true;
  if (trySwim(game)) return true;
  if (trySlalom(game)) return true;
  if (tryDate(game)) return true;
  return false;
}

// ---------- input routing ----------

export function handleTaps(game, input) {
  const p = game.player;
  // Modal keys first: number keys buy/order, Esc closes.
  if (game.modal) {
    if (input.pressedKey('Escape')) {
      game.modal = null;
      return;
    }
    if (input.pressedKey('Enter')) {
      if (game.modal.kind === 'outfit') buyOutfit(game);
      else game.modal = null;
      return;
    }
    if (game.modal.kind === 'food') {
      if (input.pressedKey('Digit1')) buyFood(game, 0);
      else if (input.pressedKey('Digit2')) buyFood(game, 1);
      else if (input.pressedKey('Digit3')) buyFood(game, 2);
    } else if (game.modal.kind === 'outfit') {
      if (input.pressedKey('Digit1')) cycleOutfit(game, 0);
      else if (input.pressedKey('Digit2')) cycleOutfit(game, 1);
      else if (input.pressedKey('Digit3')) cycleOutfit(game, 2);
      else if (input.pressedKey('Digit4')) cycleOutfit(game, 3);
    } else if (game.modal.kind === 'garage') {
      if (input.pressedKey('Digit1')) takeOutCar(game, 0);
      else if (input.pressedKey('Digit2')) takeOutCar(game, 1);
      else if (input.pressedKey('Digit3')) takeOutCar(game, 2);
      else if (input.pressedKey('KeyR')) repaintCar(game);
    } else if (game.modal.kind === 'atm') {
      if (input.pressedKey('Digit1')) atmAction(game, 0);
      else if (input.pressedKey('Digit2')) atmAction(game, 1);
    }
    return;
  }
  // Global keys.
  if (input.pressedKey('KeyM')) {
    game.muted = !game.muted;
    if (game.audio) game.audio.setMuted(game.muted);
    showToast(game, game.muted ? 'Muted' : 'Sound on');
  }
  if (input.pressedKey('KeyR')) {
    game.station = (game.station + 1) % 4;
    game.song = 0;
    showToast(game, stationLabel(game.station, game.song));
  }
  // Menu / card / passed / busted / wasted.
  if (game.mode === 'menu') {
    if (input.pressedKey('Enter')) {
      newGame(game);
      startChapter(game, 1);
      game.mode = 'card';
    }
    return;
  }
  if (game.mode === 'card' || game.mode === 'passed') {
    if (input.pressedKey('Enter')) {
      if (game.mode === 'passed') nextChapter(game);
      else game.mode = 'play';
    }
    return;
  }
  if (game.mode === 'busted' || game.mode === 'wasted') {
    if (input.pressedKey('Enter')) {
      bustPlayer(game);
    }
    return;
  }
  // PAUSE (round-9 fix): Escape/KeyP pauses from play AND from
  // the phone; Escape/KeyP/Enter resumes from pause. The pause
  // handler also saves, and saveGame is try/catch guarded so it
  // can never throw and kill the loop.
  if (game.mode === 'pause') {
    if (input.pressedKey('Escape') || input.pressedKey('KeyP') || input.pressedKey('Enter')) {
      game.mode = 'play';
      game.menu = null;
    }
    return;
  }
  if (game.mode === 'phone') {
    if (input.pressedKey('Tab') || input.pressedKey('Escape')) {
      togglePhone(game);
      return;
    }
    if (input.pressedKey('Digit1')) callContact(game, CONTACTS[0].id);
    else if (input.pressedKey('Digit2')) callContact(game, CONTACTS[1].id);
    else if (input.pressedKey('Digit3')) callContact(game, CONTACTS[2].id);
    else if (input.pressedKey('Digit4')) callContact(game, CONTACTS[3].id);
    return;
  }
  // Play mode.
  if (game.mode === 'play') {
    if (input.pressedKey('Escape') || input.pressedKey('KeyP')) {
      game.mode = 'pause';
      game.menu = 'pause';
      saveGame(game, game.saveSlot);
      return;
    }
    if (input.pressedKey('Tab')) {
      togglePhone(game);
      return;
    }
    if (input.pressedKey('Digit1') && game.player.ammo[0] !== undefined) game.player.weapon = 0;
    if (input.pressedKey('Digit2') && game.unlocks.smgUnlocked) game.player.weapon = 1;
    if (input.pressedKey('Digit3') && game.unlocks.shotgunUnlocked) game.player.weapon = 2;
    if (input.pressedKey('Digit4')) callContact(game, 'taxi');
    if (input.pressedKey('KeyG')) throwBomb(game);
    if (input.pressedKey('KeyF')) {
      // F punches on foot, sprays fire near a fire.
      if (!punch(game)) sprayFire(game, 0.5);
    }
    if (input.mouse.clicked) {
      const cam = game.camera;
      const tx = p.x + Math.sin(cam.yaw + Math.PI) * 30;
      const tz = p.z + Math.cos(cam.yaw + Math.PI) * 30;
      shoot(game, tx, tz);
      rangeHit(game, tx, tz);
    }
    if (input.pressedKey('KeyE')) handleInteract(game);
  }
}

// ---------- boot ----------

// Rebuild the static batches into the CURRENT renderer. Called
// after the initial renderer creation, after every resize (the
// renderer is re-created, so the old batches are gone), and when
// the GLB model finishes loading. Idempotent: it resets both
// batches first, so calling it twice never duplicates geometry.
export function rebuildStaticBatches(game) {
  const r = game.renderer;
  if (!r) return;
  buildStaticBoxes(game.city, r.staticBatch);
  batchReset(r.glbBatch);
  const uvPlain = tileUV('plain');
  const barrelPos = [[60, 0, 320], [64, 0, 322], [62, 0, 326]];
  if (game._glbModel) {
    for (const [x, y, z] of barrelPos) {
      pushGlbToBatch(r.glbBatch, game._glbModel, x, y, z, 1, [0.85, 0.2, 0.15], uvPlain);
    }
  } else if (game.flags.glbFallback) {
    // Procedural fallback barrels (same positions, same colour).
    for (const [x, y, z] of barrelPos) {
      pushBox(r.glbBatch, x, 0, z, 1.2, 2.4, 1.2, [0.85, 0.2, 0.15], uvPlain);
    }
  }
}

export function boot(canvas, doc) {
  const game = createGame();
  game.canvas = canvas;
  // THE BOOT ORDER (round-7/8 fix): size the canvas FIRST, then
  // create the renderer. Assigning canvas.width/height resets
  // the WebGL context — a renderer created before the canvas is
  // sized dies on frame 1.
  const win = typeof window !== 'undefined' ? window : { innerWidth: 1280, innerHeight: 720 };
  canvas.width = win.innerWidth;
  canvas.height = win.innerHeight;
  game.city = buildCity();
  game.camera = createCamera();
  game.input = createInput();
  game.audio = createAudio();
  game.hud = createHud(doc);
  game.weatherObj = createWeather(game);
  spawnVehicles(game);
  spawnPeds(game);
  spawnPolice(game);
  spawnGangs(game);
  spawnLiving(game);
  spawnFireService(game);
  spawnCats(game);
  spawnTraining(game);
  spawnActivities(game);

  // Create the renderer (needs the sized canvas) and bake the
  // static world into it. The atlas texture is created inside
  // createRenderer from the fresh context (see render.js).
  const makeRenderer = () => {
    const r = createRenderer(canvas, null);
    r.setViewport(canvas.width, canvas.height);
    return r;
  };
  game.renderer = makeRenderer();
  game.rebuildStaticBatches = () => rebuildStaticBatches(game);
  game.rebuildStaticBatches();

  // GLB barrels: load async, then re-bake the glb batch.
  if (typeof fetch !== 'undefined') {
    loadGlb('./assets/barrel.glb').then((model) => {
      if (model) {
        game._glbModel = model;
        game.rebuildStaticBatches();
      } else {
        game.flags.glbFallback = true;
        game.rebuildStaticBatches();
      }
    });
  } else {
    game.flags.glbFallback = true;
    game.rebuildStaticBatches();
  }

  // Resize: re-size the canvas, RE-CREATE the renderer (the old
  // context is dead), then RE-BAKE the static batches (round-9
  // fix — the old handler re-created the renderer but left the
  // new static batch empty, so the world vanished).
  const onResize = () => {
    canvas.width = win.innerWidth;
    canvas.height = win.innerHeight;
    game.renderer = makeRenderer();
    game.rebuildStaticBatches();
  };
  game._onResize = onResize;
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('resize', onResize);
  }

  // Buttons (title screen + pause overlay + HUD pause button).
  const $ = (id) => (doc ? doc.getElementById(id) : null);
  const btnNew = $('btn-new');
  if (btnNew) {
    btnNew.addEventListener('click', () => {
      if (game.audio) game.audio.ensure();
      newGame(game);
      startChapter(game, 1);
      game.mode = 'card';
    });
  }
  const btnContinue = $('btn-continue');
  if (btnContinue) {
    btnContinue.addEventListener('click', () => {
      if (game.audio) game.audio.ensure();
      if (hasSave(game.saveSlot)) {
        loadGame(game, game.saveSlot);
        game.mode = 'play';
      } else {
        newGame(game);
        startChapter(game, 1);
        game.mode = 'card';
      }
    });
  }
  const btnMute = $('btn-mute');
  if (btnMute) {
    btnMute.addEventListener('click', () => {
      game.muted = !game.muted;
      if (game.audio) game.audio.setMuted(game.muted);
      btnMute.textContent = `Mute: ${game.muted ? 'on' : 'off'} (M)`;
    });
  }
  // Pause overlay: Resume button (round-9 fix — a clickable way
  // back into the game even if the browser swallows Escape).
  const btnResume = $('btn-resume');
  if (btnResume) {
    btnResume.addEventListener('click', () => {
      if (game.mode === 'pause') {
        game.mode = 'play';
        game.menu = null;
      }
    });
  }
  // HUD pause button: toggles pause from play (fallback for
  // browsers that swallow Escape).
  const btnPause = $('btn-pause');
  if (btnPause) {
    btnPause.addEventListener('click', () => {
      if (game.mode === 'play') {
        game.mode = 'pause';
        game.menu = 'pause';
        saveGame(game, game.saveSlot);
      } else if (game.mode === 'pause') {
        game.mode = 'play';
        game.menu = null;
      }
    });
  }
  // Phone tabs.
  const tabC = $('phone-tab-contacts');
  if (tabC) tabC.addEventListener('click', () => phoneTab(game, 'contacts'));
  const tabM = $('phone-tab-messages');
  if (tabM) tabM.addEventListener('click', () => phoneTab(game, 'messages'));
  const tabMap = $('phone-tab-map');
  if (tabMap) tabMap.addEventListener('click', () => phoneTab(game, 'map'));

  game.input.attach(canvas);
  updateCamera(game.camera, { x: game.player.x, y: 0, z: game.player.z }, 0.016, null);

  // Main loop.
  let last = 0;
  const loop = (t) => {
    const dt = Math.min(0.05, (t - last) / 1000 || 0.016);
    last = t;
    handleTaps(game, game.input);
    stepGame(game, dt, game.input);
    updateCamera(game.camera, { x: game.player.x, y: game.player.y || 0, z: game.player.z }, dt, game.input);
    renderFrame(game);
    game.input.endFrame();
    if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(loop);
  };
  if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(loop);
  return game;
}

// Auto-boot in the browser.
if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  const canvas = document.getElementById('game-canvas');
  if (canvas) {
    try {
      window.__solmarGame = boot(canvas, document);
    } catch (e) {
      const err = document.getElementById('hud-err');
      if (err) {
        err.style.display = 'block';
        err.textContent = 'Failed to start: ' + e.message;
      }
      throw e;
    }
  }
}
