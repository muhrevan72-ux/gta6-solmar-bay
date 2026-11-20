// Solmar Bay — boot, the frame loop, the game step, input handling
// and the dynamic (per-frame) geometry.
// Boot order matters: the canvas is sized FIRST, then the renderer
// is created. Assigning canvas.width/height AFTER the renderer
// exists resets the WebGL context and kills the shader program,
// buffers and textures — the round-6/7 flat-sky bug.

import { createGame, newGame, addCash, chapterTitle, completionPercent } from './state.js';
import { createInput } from './input.js';
import { buildCity, buildStaticBoxes, isBlocked, districtAt } from './world.js';
import { createRenderer, BoxBatch, batchReset, batchTris, pushBox, computeViewProj, boxVisible } from './render.js';
import { createAtlasTexture } from './texture.js';
import { parseGlb, pushGlbToBatch } from './gltf.js';
import { createCamera, updateCamera } from './shots.js';
import { createWeather, sampleAt, phaseAt } from './weather.js';
import { createAudio } from './audio.js';
import { createHud, updateHud, drawMinimap } from './hud.js';
import { stepPlayer, tryEnterVehicle, exitVehicle, playerBoxes } from './player.js';
import { spawnVehicles, stepPlayerCar, stepTraffic, stepCarCollisions, vehicleBoxes, makeVehicle } from './vehicles.js';
import { spawnPeds, stepPeds, pedBoxes } from './pedestrians.js';
import { spawnPolice, commitCrime, stepWanted, stepPolice, bustPlayer, policeList } from './police.js';
import { WEAPONS, shoot, punch, throwBomb, stepPickups, damagePlayer } from './combat.js';
import { startChapter, completeChapter, nextChapter, stepMissions, startSideJob, stepSideJob } from './missions.js';
import { spawnGangs, stepGangs, gangBoxes } from './gangs.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { togglePhone, phoneTab, callContact, notifyMessage } from './phone.js';
import { tryGarage, takeOutCar, repaintCar } from './garage.js';
import { spawnLiving, stepLiving, livingBoxes, tryPetDog, tryElevator, tryTrain } from './living.js';
import { spawnActivities, tryFish, stepActivities, tryVending, tryAtm, atmAction } from './activities.js';
import { tryInteriorDoor, tryInteriorCounter, stepInteriors, interiorBoxes } from './interiors.js';
import { tryFoodShop, buyFood, foodSignBoxes } from './food.js';
import { tryDate, dateAte, maybeMayaCall, mayaBoxes } from './dating.js';
import { spawnCats, tryCat, stepCats, catBoxes } from './cats.js';
import { tryOutfitShop, cycleOutfit, buyOutfit } from './outfit.js';
import { spawnTraining, tryRange, rangeHit, stepTraining, trySwim, trySlalom, trainingBoxes } from './training.js';
import { stepEvents, stepEventActive, eventBoxes } from './events.js';
import { spawnFireService, stepFires, sprayFire, fireBoxes } from './fire.js';
import { stepTaxiCall, startTaxiFare, stepTaxiFare, unstickCalledTaxi } from './taxi.js';
import { TUNE, SPAWNS } from './config.js';

// The three dock barrels (GLB when available, procedural fallback).
const GLB_BARRELS = [[-230, 230], [-233, 233], [-227, 233]];

function bakeGlbBatch(game) {
  const batch = game.renderer.glbBatch;
  batchReset(batch);
  if (game._glbModel) {
    for (const [x, z] of GLB_BARRELS) {
      pushGlbToBatch(batch, game._glbModel, x, 0, z, 1, [0.85, 0.2, 0.15]);
    }
  } else {
    for (const [x, z] of GLB_BARRELS) {
      pushBox(batch, x, 0, z, 1.4, 2, 1.4, [0.85, 0.2, 0.15]);
    }
  }
}

// Re-bake the static + GLB batches (after a resize, which re-creates
// the renderer and loses every buffer).
export function rebuildStaticBatches(game) {
  batchReset(game.renderer.staticBatch);
  buildStaticBoxes(game.city, game.renderer.staticBatch);
  bakeGlbBatch(game);
}

// Respect unlocks: SMG at 100, shotgun at 250, a free sports car at
// 500. Each fires once.
function checkUnlocks(game) {
  const r = game.respect || 0;
  const u = game.unlocks;
  if (r >= 100 && !u.smgUnlocked) {
    u.smgUnlocked = true;
    game.toast = 'SMG unlocked! (press 2)';
    game.toastTimer = 3;
  }
  if (r >= 250 && !u.shotgunUnlocked) {
    u.shotgunUnlocked = true;
    game.toast = 'Shotgun unlocked! (press 3)';
    game.toastTimer = 3;
  }
  if (r >= 500 && !u.sportsCarSpawned) {
    u.sportsCarSpawned = true;
    const comet = makeVehicle('sports', game.player.x + 5, game.player.z, 0, [0.9, 0.2, 0.2], 'Solmar Comet');
    comet.owned = true;
    game.vehicles.push(comet);
    game.toast = 'A Solmar Comet is yours! Check the garage.';
    game.toastTimer = 3;
  }
}

export function boot(canvas, doc) {
  // 1. Size the canvas FIRST. This must happen before the renderer
  // is created, or the context reset kills the program. The canvas
  // is looked up by id when the caller does not hand one in.
  const canvasEl = canvas || (doc && doc.getElementById('game-canvas'));
  canvasEl.width = canvasEl.width || 1280;
  canvasEl.height = canvasEl.height || 720;
  canvas = canvasEl;
  const game = createGame();
  game.canvas = canvas;
  game.doc = doc;
  game.city = buildCity();
  game.camera = createCamera();
  game.input = createInput();
  game.audio = createAudio();
  game.hud = createHud(doc);
  // The weather OBJECT lives on weatherObj; `weather` is the string
  // condition ('clear' / 'rain' / 'fog').
  game.weatherObj = createWeather(game);
  game._lastDynTris = 0;
  game._radioTimer = 0;
  game._glbModel = null;

  // 2. Create the renderer (after the canvas is sized).
  game.renderer = createRenderer(canvas);
  // 3. Bake the static city geometry.
  buildStaticBoxes(game.city, game.renderer.staticBatch);
  // 4. The GLB barrels: procedural fallback now (36 tris), replaced
  // by the real model when the fetch resolves.
  bakeGlbBatch(game);
  // 5. Spawn the world.
  spawnVehicles(game);
  spawnPeds(game);
  spawnPolice(game);
  spawnGangs(game);
  spawnLiving(game);
  spawnCats(game);
  spawnTraining(game);
  spawnActivities(game);
  spawnFireService(game);

  // 6. Load the GLB barrel model (async; the fallback stays if the
  // fetch fails, e.g. in headless tests).
  if (typeof fetch !== 'undefined') {
    fetch('assets/barrel.glb')
      .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('no glb'))))
      .then(buf => parseGlb(new Uint8Array(buf)))
      .then(model => {
        if (model) {
          game._glbModel = model;
          bakeGlbBatch(game);
        }
      })
      .catch(() => { /* the procedural barrels stay */ });
  }

  // 7. Resize handling: the canvas is resized (which resets the
  // context), so re-create the renderer and re-bake everything.
  // The size comes from the window when there is one.
  game._onResize = () => {
    const w = (typeof window !== 'undefined' && window.innerWidth) || canvas.width;
    const h = (typeof window !== 'undefined' && window.innerHeight) || canvas.height;
    canvas.width = w;
    canvas.height = h;
    game.renderer = createRenderer(canvas);
    rebuildStaticBatches(game);
  };
  if (doc && doc.defaultView && doc.defaultView.addEventListener) {
    doc.defaultView.addEventListener('resize', () => {
      canvas.width = canvas.clientWidth || canvas.width;
      canvas.height = canvas.clientHeight || canvas.height;
      game._onResize();
    });
  }
  if (game.input && game.input.attach) game.input.attach(canvas);

  // 8. Wire the menu buttons.
  const wire = (id, fn) => {
    const el = doc ? doc.getElementById(id) : null;
    if (el && el.addEventListener) el.addEventListener('click', fn);
  };
  wire('btn-new', () => {
    newGame(game);
    startChapter(game, 1);
  });
  wire('btn-continue', () => {
    const save = loadGame(game, 1);
    if (save) {
      game.mode = 'play';
    } else {
      newGame(game);
      startChapter(game, 1);
    }
  });
  wire('btn-resume', () => {
    if (game.mode === 'pause') {
      game.mode = 'play';
      game.menu = null;
    }
  });
  wire('btn-pause', () => {
    if (game.mode === 'play') {
      game.mode = 'pause';
      game.menu = 'pause';
      saveGame(game, 1);
    } else if (game.mode === 'pause') {
      game.mode = 'play';
      game.menu = null;
    }
  });

  // 9. The frame loop (browser only; headless tests drive the game
  // by calling stepGame/renderFrame directly).
  if (typeof requestAnimationFrame !== 'undefined') {
    let last = 0;
    const loop = (t) => {
      const dt = Math.min(0.05, last ? (t - last) / 1000 : 0.016);
      last = t;
      handleTaps(game, game.input);
      stepGame(game, dt, game.input);
      renderFrame(game);
      game.input.endFrame();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  return game;
}

// ---------- the frame ----------
export function renderFrame(game) {
  const renderer = game.renderer;
  const gl = renderer.gl;
  if (!gl) return;
  const weather = game.weatherObj ? game.weatherObj.sample() : sampleAt(game.clock);
  const sky = weather.sky;
  const fogRange = [weather.fogNear, weather.fogFar];
  const fogColor = weather.fog;
  // The camera follows the player.
  updateCamera(game.camera, game.player, 0.016, null);
  const cam = game.camera;
  const vp = computeViewProj(cam, game.canvas.width, game.canvas.height);
  const camPos = [cam.x, cam.y, cam.z];
  // Exactly one clear per frame, here and nowhere else.
  renderer.beginFrame(sky);
  renderer.drawBatch(renderer.staticBatch, vp, camPos, fogRange, fogColor);
  // The dynamic batch is rebuilt every frame.
  batchReset(renderer.dynamicBatch);
  collectDynamicBoxes(game, renderer.dynamicBatch, cam);
  game._lastDynTris = batchTris(renderer.dynamicBatch);
  renderer.drawBatch(renderer.dynamicBatch, vp, camPos, fogRange, fogColor);
  renderer.drawBatch(renderer.glbBatch, vp, camPos, fogRange, fogColor);
  updateHud(game, game.hud);
  drawMinimap(game, game.hud);
}

// ---------- the step ----------
export function stepGame(game, dt, input) {
  // game.time always ticks, even while paused.
  game.time = (game.time || 0) + dt;
  // Toast and dialogue timers.
  if (game.toastTimer > 0) {
    game.toastTimer -= dt;
    if (game.toastTimer <= 0) game.toast = '';
  }
  if (game.dialogue && game.dialogue.t > 0) {
    game.dialogue.t -= dt;
    if (game.dialogue.t <= 0) game.dialogue = null;
  }
  if (game.mode !== 'play') return;
  // The clock runs 120x in play mode.
  if (game.weatherObj) game.weatherObj.step(dt, Math.random);
  game._phase = phaseAt(game.clock);
  // Radio sequencer: a step every 0.25 s; the song advances at 32.
  game._radioTimer = (game._radioTimer || 0) + dt;
  while (game._radioTimer >= 0.25) {
    game._radioTimer -= 0.25;
    game.songStep = (game.songStep || 0) + 1;
    if (game.songStep >= 32) {
      game.songStep = 0;
      game.song = ((game.song || 0) + 1) % 2;
    }
    if (game.audio) game.audio.radioStep(game.station, game.song, game.songStep);
  }
  // The camera follows the player; on foot, the player turns to
  // face the camera direction while moving.
  const moving = input && (input.downKey('KeyW') || input.downKey('KeyA') || input.downKey('KeyS') || input.downKey('KeyD'));
  updateCamera(game.camera, game.player, dt, input);
  if (moving && !game.player.inCar) game.player.heading = game.camera.yaw;
  stepPlayer(game, dt, input);
  stepTraffic(game, dt);
  stepCarCollisions(game);
  stepPeds(game, dt);
  stepPolice(game, dt);
  stepWanted(game, dt);
  stepGangs(game, dt);
  stepLiving(game, dt);
  stepCats(game, dt);
  stepFires(game, dt);
  stepEvents(game, dt, Math.random);
  stepEventActive(game, dt);
  stepActivities(game, dt);
  stepTraining(game, dt);
  stepTaxiCall(game, dt);
  stepTaxiFare(game, dt);
  stepPickups(game, dt);
  stepMissions(game, dt);
  stepSideJob(game, dt);
  dateAte(game, dt);
  stepInteriors(game, dt);
  checkUnlocks(game);
}

// ---------- input ----------
export function handleInteract(game) {
  // Garage first: E in a car at the garage stores the car.
  if (tryGarage(game)) return true;
  // E in a car exits it (when not at the garage).
  if (game.player.inCar) {
    exitVehicle(game);
    return true;
  }
  // E near a car enters it; entering the called taxi starts a fare.
  const car = tryEnterVehicle(game);
  if (car) {
    if (game._taxiCab === car) startTaxiFare(game);
    return true;
  }
  // Shop and room doors.
  if (tryInteriorDoor(game)) return true;
  if (tryInteriorCounter(game)) return true;
  if (tryFoodShop(game)) return true;
  if (tryOutfitShop(game)) return true;
  // Animals and activities.
  if (tryCat(game)) return true;
  if (tryPetDog(game)) return true;
  if (tryRange(game)) return true;
  if (trySwim(game)) return true;
  if (trySlalom(game)) return true;
  if (tryVending(game)) return true;
  if (tryAtm(game)) return true;
  if (tryElevator(game)) return true;
  if (tryTrain(game)) return true;
  if (tryFish(game)) return true;
  if (tryDate(game)) return true;
  return false;
}

export function handleTaps(game, input) {
  if (!input) return;
  // Mute works from the menu too.
  if (input.pressedKey('KeyM')) {
    if (game.audio) game.audio.setMuted(!game.audio.muted);
    game.muted = game.audio ? game.audio.muted : !game.muted;
  }
  const mode = game.mode;
  if (mode === 'menu') {
    if (input.pressedKey('Enter')) {
      newGame(game);
      startChapter(game, 1);
    }
    return;
  }
  if (mode === 'pause') {
    if (input.pressedKey('Enter') || input.pressedKey('Escape') || input.pressedKey('KeyP')) {
      game.mode = 'play';
      game.menu = null;
    }
    return;
  }
  if (mode === 'card') {
    if (input.pressedKey('Enter')) game.mode = 'play';
    return;
  }
  if (mode === 'passed') {
    if (input.pressedKey('Enter')) nextChapter(game);
    return;
  }
  if (mode === 'busted') {
    if (input.pressedKey('Enter')) {
      // Respawn at the hospital. The 20% fine was already applied
      // by bustPlayer — do NOT fine twice.
      game.player.x = SPAWNS.hospital.x;
      game.player.z = SPAWNS.hospital.z;
      game.player.heading = 0;
      game.health = 100;
      game.mode = 'play';
      game.card = null;
    }
    return;
  }
  if (mode === 'wasted') {
    if (input.pressedKey('Enter')) {
      // Respawn at the hospital with a 20% fine.
      const fine = Math.floor(game.cash * 0.2);
      game.cash -= fine;
      game.wanted = 0;
      game.health = 100;
      game.player.x = SPAWNS.hospital.x;
      game.player.z = SPAWNS.hospital.z;
      game.player.heading = 0;
      if (game.player.inCar) {
        game.player.inCar.driver = null;
        game.player.inCar = null;
      }
      game.mode = 'play';
      game.card = null;
    }
    return;
  }
  if (mode === 'phone') {
    if (input.pressedKey('Tab')) togglePhone(game);
    return;
  }
  // Play mode.
  if (input.pressedKey('Escape') || input.pressedKey('KeyP')) {
    game.mode = 'pause';
    game.menu = 'pause';
    saveGame(game, 1);
    return;
  }
  if (input.pressedKey('KeyR')) {
    game.station = ((game.station || 0) + 1) % 4;
    game.song = 0;
    game.songStep = 0;
  }
  if (input.pressedKey('Digit2') && game.unlocks.smgUnlocked) game.player.weapon = 1;
  if (input.pressedKey('Digit3') && game.unlocks.shotgunUnlocked) game.player.weapon = 2;
  if (input.pressedKey('Digit1')) game.player.weapon = 0;
  if (input.pressedKey('Digit4')) {
    game._taxiRequested = true;
  }
  if (input.pressedKey('Tab')) togglePhone(game);
  if (input.pressedKey('KeyE') && (game.player.eCooldown || 0) <= 0) {
    game.player.eCooldown = 0.3;
    handleInteract(game);
  }
  if (input.pressedKey('KeyF')) punch(game);
  if (input.pressedKey('KeyG')) throwBomb(game);
  if (input.mouse && input.mouse.clicked) {
    shoot(game);
  }
}

// ---------- dynamic geometry ----------
export function collectDynamicBoxes(game, batch, cam) {
  const cap = TUNE.batchCap;
  const over = () => batchTris(batch) / 12 >= cap;
  // The player.
  playerBoxes(game, batch, cam);
  // Vehicles, traffic and cop cars.
  for (const v of game.vehicles || []) {
    if (over()) break;
    vehicleBoxes(game, v, batch, cam);
  }
  for (const v of game.traffic || []) {
    if (over()) break;
    vehicleBoxes(game, v, batch, cam);
  }
  for (const v of game.copCars || []) {
    if (over()) break;
    vehicleBoxes(game, v, batch, cam);
  }
  // The police on foot (navy, so the batch carries [0.1,0.15,0.5]
  // whenever a cop is near the player).
  for (const cop of game.cops || []) {
    if (over()) break;
    pushBox(batch, cop.x - 0.18, 0, cop.z, 0.32, 0.8, 0.32, [0.1, 0.15, 0.5]);
    pushBox(batch, cop.x + 0.18, 0, cop.z, 0.32, 0.8, 0.32, [0.1, 0.15, 0.5]);
    pushBox(batch, cop.x, 0.8, cop.z, 0.7, 0.6, 0.4, [0.1, 0.15, 0.5]);
    pushBox(batch, cop.x - 0.5, 0.85, cop.z, 0.22, 0.55, 0.22, [0.1, 0.15, 0.5]);
    pushBox(batch, cop.x + 0.5, 0.85, cop.z, 0.22, 0.55, 0.22, [0.1, 0.15, 0.5]);
    pushBox(batch, cop.x, 1.4, cop.z, 0.45, 0.4, 0.4, [0.9, 0.75, 0.6]);
    pushBox(batch, cop.x, 1.75, cop.z, 0.48, 0.15, 0.42, [0.1, 0.15, 0.5]);
  }
  // Peds, gangs, Maya, cats, living things.
  for (const p of game.peds || []) {
    if (over()) break;
    pedBoxes(game, p, batch, cam);
  }
  for (const m of game.gangMembers || []) {
    if (over()) break;
    gangBoxes(game, m, batch, cam);
  }
  mayaBoxes(game, batch, cam);
  catBoxes(game, batch, cam);
  livingBoxes(game, batch, cam);
  // The helicopter.
  if (game.heli) {
    pushBox(batch, game.heli.x, game.heli.y, game.heli.z, 4, 1.5, 2, [0.1, 0.15, 0.5]);
    pushBox(batch, game.heli.x, game.heli.y + 1.2, game.heli.z, 6, 0.2, 0.4, [0.15, 0.15, 0.2]);
  }
  // Fires, events, food signs, training props.
  fireBoxes(game, batch, cam);
  eventBoxes(game, batch, cam);
  foodSignBoxes(game, batch, cam);
  trainingBoxes(game, batch, cam);
  // Interiors: only the room the player is in.
  if (game.player.inside) interiorBoxes(game, batch, cam);
  return batchTris(batch);
}
