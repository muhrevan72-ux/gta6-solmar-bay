// Solmar Bay — the integration hub.
//
// boot() sizes the canvas FIRST and only then creates the renderer
// (the round-8 bug was the reverse order: resizing after the
// renderer was built killed the context). stepGame ticks every
// system; renderFrame draws exactly three batches with one clear;
// handleTaps routes keys by mode. The resize handler re-creates the
// renderer and re-bakes the static + GLB batches byte-identically.

import { createGame, newGame, showToast } from './state.js';
import { createInput } from './input.js';
import {
  createRenderer, BoxBatch, batchReset, batchTris, pushBox, boxVisible, computeViewProj,
} from './render.js';
import { buildAtlasCanvas, createAtlasTexture } from './texture.js';
import { parseGlb, pushGlbToBatch } from './gltf.js';
import { createCamera, updateCamera } from './shots.js';
import { buildCity, buildStaticBoxes } from './world.js';
import { createWeather } from './weather.js';
import { stepPlayer, tryEnterVehicle, exitVehicle, playerBoxes } from './player.js';
import { spawnVehicles, stepPlayerCar, stepTraffic, stepCarCollisions, vehicleBoxes, makeVehicle } from './vehicles.js';
import { spawnPeds, stepPeds, pedBoxes } from './pedestrians.js';
import { spawnPolice, stepPolice, stepWanted, bustPlayer } from './police.js';
import { shoot, punch, throwBomb, stepPickups, WEAPONS } from './combat.js';
import { startChapter, nextChapter, stepMissions } from './missions.js';
import { spawnGangs, stepGangs, gangBoxes } from './gangs.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { createAudio, stationLabel } from './audio.js';
import { createHud, updateHud, drawMinimap } from './hud.js';
import { togglePhone } from './phone.js';
import { tryGarage } from './garage.js';
import { spawnLiving, stepLiving, livingBoxes, tryTrain, tryElevator, tryPetDog } from './living.js';
import { spawnActivities, stepActivities, tryFish, tryVending, tryAtm, atmAction } from './activities.js';
import { tryInteriorDoor, tryInteriorCounter, stepInteriors, interiorBoxes } from './interiors.js';
import { tryFoodShop, buyFood, foodSignBoxes } from './food.js';
import { tryDate, dateAte, maybeMayaCall, mayaBoxes } from './dating.js';
import { spawnCats, stepCats, tryCat, catBoxes } from './cats.js';
import { tryOutfitShop, cycleOutfit, buyOutfit } from './outfit.js';
import { spawnTraining, stepTraining, tryRange, rangeHit, trySwim, trySlalom, trainingBoxes } from './training.js';
import { stepEvents, stepEventActive, eventBoxes } from './events.js';
import { spawnFireService, stepFires, sprayFire, fireBoxes } from './fire.js';
import { stepTaxiCall, stepTaxiFare, startTaxiFare, unstickCalledTaxi } from './taxi.js';
import { RESPECT, STATIONS, SONG_STEPS, SPAWNS, COL } from './config.js';

// ---- baking (deterministic, so a resize re-bakes identically) ----
function bakeStatic(game) {
  const b = game.renderer.staticBatch;
  batchReset(b);
  buildStaticBoxes(game.city, b);
  return b;
}

// The GLB batch: the real barrel model when it loaded, else three
// procedural fallback barrels (3 x 12 tris = 36).
function bakeGlb(game) {
  const b = game.renderer.glbBatch;
  batchReset(b);
  if (game._glbModel) {
    for (const [x, z] of [[-240, 180], [-236, 184], [-244, 184]]) {
      pushGlbToBatch(b, game._glbModel, x, 0.45, z, 1, COL.barrelRed, [0, 0, 1, 1]);
    }
  } else {
    for (const [x, z] of [[-240, 180], [-236, 184], [-244, 184]]) {
      pushBox(b, x, 0.45, z, 1, 1.1, 1, COL.barrelRed, [0, 0, 1, 1]);
    }
  }
  return b;
}

// ---- boot ----
// Size the canvas FIRST, then create the renderer. (Reversing the
// order kills the context: assigning canvas.width resets it.)
export function boot(canvas, doc) {
  const win = (typeof globalThis !== 'undefined' && globalThis.window) || null;
  const w = (win && win.innerWidth) || 1280;
  const h = (win && win.innerHeight) || 720;
  canvas.width = w;
  canvas.height = h;

  const game = createGame();
  game.canvas = canvas;
  game.doc = doc || null;

  const atlasCanvas = buildAtlasCanvas();
  const atlas = createAtlasTexture(atlasCanvas);
  game.renderer = createRenderer(canvas, atlas);

  game.city = buildCity();
  game.camera = createCamera();
  game.input = createInput();
  game.input.attach(canvas);
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

  // Bake the world, then the barrels (fallback first; the real GLB
  // re-bakes the batch when its fetch resolves).
  bakeStatic(game);
  game._glbModel = null;
  bakeGlb(game);
  loadBarrelGlb(game);

  // The camera starts behind the player.
  updateCamera(game.camera, game.player, 1);

  // Title-screen buttons.
  if (doc) {
    const on = (id, fn) => {
      const el = doc.getElementById(id);
      if (el && el.addEventListener) el.addEventListener('click', fn);
    };
    on('btn-new', () => {
      newGame(game);
      startChapter(game, 1);
    });
    on('btn-continue', () => {
      if (loadGame(game, 1)) game.mode = 'play';
    });
    on('btn-resume', () => {
      game.mode = 'play';
      game.menu = null;
    });
    on('btn-pause', () => {
      // A toggle: pause from play, resume from pause.
      if (game.mode === 'play') {
        game.mode = 'pause';
        game.menu = 'pause';
        saveGame(game, 1);
      } else if (game.mode === 'pause') {
        game.mode = 'play';
        game.menu = null;
      }
    });
  }

  // Resize: re-size the canvas (kills the old context), build a
  // fresh renderer, and re-bake both batches identically.
  game._onResize = () => {
    const win2 = (typeof globalThis !== 'undefined' && globalThis.window) || null;
    const w2 = (win2 && win2.innerWidth) || 1280;
    const h2 = (win2 && win2.innerHeight) || 720;
    canvas.width = w2;
    canvas.height = h2;
    game.renderer = createRenderer(canvas, atlas);
    bakeStatic(game);
    bakeGlb(game);
  };
  if (win && win.addEventListener) {
    win.addEventListener('resize', () => game._onResize());
  }

  game.mode = 'menu';
  return game;
}

// Fetch the barrel GLB in the background; a failure keeps the
// procedural fallback (Node has no server to fetch from).
async function loadBarrelGlb(game) {
  try {
    if (typeof fetch !== 'function') return;
    const res = await fetch('assets/barrel.glb');
    if (!res || !res.ok) return;
    const buf = await res.arrayBuffer();
    const model = parseGlb(new Uint8Array(buf));
    if (!model) return;
    game._glbModel = model;
    if (game.renderer) bakeGlb(game);
  } catch {
    // Keep the fallback barrels.
  }
}

// ---- one frame ----
// Exactly one clear (beginFrame) and three draws: static, dynamic,
// GLB. Fog comes from the weather in metres (fogNear 60).
export function renderFrame(game) {
  const r = game.renderer;
  if (!r) return;
  const sample = game.weatherObj ? game.weatherObj.sample() : { sky: [0.45, 0.7, 0.95], fogNear: 60, fogFar: 420 };
  game._phase = sample.phase;
  const vp = computeViewProj(game.camera, game.canvas.width, game.canvas.height);
  const camPos = [game.camera.x, game.camera.y, game.camera.z];
  const fog = [sample.fogNear, sample.fogFar];

  r.beginFrame(sample.sky);
  r.drawBatch(game.renderer.staticBatch, vp, camPos, fog, sample.fog);
  const dyn = new BoxBatch();
  collectDynamicBoxes(game, dyn, game.camera);
  game._lastDynTris = batchTris(dyn);
  r.drawBatch(dyn, vp, camPos, fog, sample.fog);
  r.drawBatch(game.renderer.glbBatch, vp, camPos, fog, sample.fog);
}

// ---- the dynamic batch ----
// Everything that moves, culled against the camera. The total stays
// under the 1600-box batch cap.
export function collectDynamicBoxes(game, b, camera) {
  const cam = camera || game.camera;
  let boxes = 0;
  const push = (fn) => {
    const before = batchTris(b);
    const n = fn();
    boxes += n;
    return n;
  };
  // The player (always, even in menu — the title screen shows them).
  push(() => playerBoxes(game, b));
  // Vehicles + traffic + cop cars.
  for (const v of game.vehicles || []) {
    if (cam && !boxVisible(cam, v.x, v.y || 0, v.z, 8)) continue;
    push(() => vehicleBoxes(game, v, b, cam));
  }
  for (const v of game.traffic || []) {
    if (cam && !boxVisible(cam, v.x, v.y || 0, v.z, 8)) continue;
    push(() => vehicleBoxes(game, v, b, cam));
  }
  for (const v of game.copCars || []) {
    if (cam && !boxVisible(cam, v.x, v.y || 0, v.z, 8)) continue;
    push(() => vehicleBoxes(game, v, b, cam));
  }
  // Peds.
  for (const p of game.peds || []) {
    if (cam && !boxVisible(cam, p.x, 0, p.z, 4)) continue;
    push(() => pedBoxes(game, p, b, cam));
  }
  // Foot cops (navy uniforms).
  for (const c of game.cops || []) {
    if (cam && !boxVisible(cam, c.x, 0, c.z, 4)) continue;
    push(() => copBoxes(game, c, b));
  }
  // Gangs.
  for (const m of game.gangMembers || []) {
    if (cam && !boxVisible(cam, m.x, 0, m.z, 4)) continue;
    push(() => gangBoxes(game, m, b, cam));
  }
  // Ambient life, cats, Maya.
  push(() => livingBoxes(game, b, cam));
  push(() => catBoxes(game, b, cam));
  push(() => mayaBoxes(game, b, cam));
  // Fires, training props, events, food signs, interiors.
  push(() => fireBoxes(game, b, cam));
  push(() => trainingBoxes(game, b, cam));
  push(() => eventBoxes(game, b, cam));
  push(() => foodSignBoxes(game, b, cam));
  push(() => interiorBoxes(game, b, cam));
  // The helicopter.
  if (game.heli) {
    push(() => {
      pushBox(b, game.heli.x, game.heli.y, game.heli.z, 6, 2, 2, [0.15, 0.2, 0.4]);
      pushBox(b, game.heli.x, game.heli.y + 1.2, game.heli.z, 8, 0.3, 0.5, [0.1, 0.1, 0.12]);
      return 2;
    });
  }
  // Roadblocks.
  for (const rb of game.roadblocks || []) {
    push(() => {
      pushBox(b, rb.x, 0, rb.z, 3, 1, 0.5, [0.9, 0.4, 0.1]);
      return 1;
    });
  }
  return boxes;
}

// A foot cop: navy uniform, cap and badge.
function copBoxes(game, c, b) {
  const navy = COL.copNavy;
  let n = 0;
  const put = (x, y, z, w, h, d, col) => { pushBox(b, x, y, z, w, h, d, col); n++; };
  put(c.x, 1.5, c.z, 0.42, 0.42, 0.42, [0.85, 0.65, 0.5]); // head
  put(c.x, 1.88, c.z, 0.44, 0.14, 0.44, navy); // cap
  put(c.x, 0.9, c.z, 0.62, 0.62, 0.36, navy); // torso
  put(c.x - 0.38, 0.9, c.z, 0.2, 0.6, 0.2, navy); // arm
  put(c.x + 0.38, 0.9, c.z, 0.2, 0.6, 0.2, navy); // arm
  put(c.x - 0.15, 0.3, c.z, 0.24, 0.6, 0.24, [0.15, 0.15, 0.2]); // leg
  put(c.x + 0.15, 0.3, c.z, 0.24, 0.6, 0.24, [0.15, 0.15, 0.2]); // leg
  put(c.x, 1.1, c.z + 0.2, 0.15, 0.15, 0.05, [0.95, 0.8, 0.2]); // badge
  return n;
}

// ---- the game step ----
// game.time always advances; in pause the clock and the world freeze.
export function stepGame(game, dt, input) {
  game.time = (game.time || 0) + dt;
  if (game.mode === 'pause') return;
  if (game.mode !== 'play') return;

  // Weather + clock (120x).
  if (game.weatherObj) game.weatherObj.step(dt, Math.random);
  game._phase = game.weatherObj ? game.weatherObj.sample().phase : game._phase;

  // The player (on foot or driving).
  stepPlayer(game, dt, input);
  if (game.player.inCar) stepPlayerCar(game, dt, input);
  stepTraffic(game, dt);
  stepCarCollisions(game, dt);
  stepPeds(game, dt);
  stepPolice(game, dt);
  stepWanted(game, dt);
  stepGangs(game, dt);
  stepMissions(game, dt);
  stepLiving(game, dt);
  stepFires(game, dt);
  stepCats(game, dt);
  stepTraining(game, dt);
  stepActivities(game, dt);
  stepEvents(game, dt, Math.random);
  stepEventActive(game, dt);
  stepTaxiCall(game, dt);
  stepTaxiFare(game, dt);
  stepPickups(game, dt);
  stepInteriors(game, dt);
  dateAte(game, dt);
  maybeMayaCall(game);

  // The radio sequencer: a step every 0.25 s, a new song at step 32.
  game._songT = (game._songT || 0) + dt;
  while (game._songT >= 0.25) {
    game._songT -= 0.25;
    game.songStep = (game.songStep || 0) + 1;
    if (game.songStep >= SONG_STEPS) {
      game.songStep = 0;
      game.song = ((game.song || 0) + 1) % 2;
    }
    if (game.audio) game.audio.radioStep(game.station || 0, game.song || 0, game.songStep);
  }

  // Respect unlocks: SMG at 100, shotgun at 250, a Comet at 500.
  const rep = game.respect || 0;
  if (rep >= 100 && !game.unlocks.smgUnlocked) game.unlocks.smgUnlocked = true;
  if (rep >= 250 && !game.unlocks.shotgunUnlocked) game.unlocks.shotgunUnlocked = true;
  if (rep >= 500 && !game.unlocks.sportsCarSpawned) {
    game.unlocks.sportsCarSpawned = true;
    const comet = makeVehicle('sports', SPAWNS.garageDoor.x + 6, SPAWNS.garageDoor.z, 0, [0.9, 0.2, 0.2], 'Solmar Comet');
    comet.owned = true;
    game.vehicles.push(comet);
    showToast(game, 'A Solmar Comet is waiting at the garage');
  }

  // Timers decay.
  if (game.toastTimer > 0) game.toastTimer = Math.max(0, game.toastTimer - dt);
  if (game.dialogue && game.dialogue.t > 0) game.dialogue.t = Math.max(0, game.dialogue.t - dt);
  if (game._mayaCallCd > 0) game._mayaCallCd = Math.max(0, game._mayaCallCd - dt);

  // The camera trails the player.
  if (game.camera) updateCamera(game.camera, game.player, dt);
}

// ---- input routing ----
export function handleTaps(game, input) {
  const pressed = input.pressed;
  const mode = game.mode;

  if (mode === 'menu') {
    if (pressed.has('Enter')) {
      newGame(game);
      startChapter(game, 1);
    } else if (pressed.has('KeyM')) {
      game.muted = !game.muted;
      if (game.audio) game.audio.setMuted(game.muted);
    }
    return;
  }
  if (mode === 'card') {
    if (pressed.has('Enter')) game.mode = 'play';
    return;
  }
  if (mode === 'passed') {
    if (pressed.has('Enter')) {
      if ((game.chapter || 1) < 5) nextChapter(game);
      else game.mode = 'play';
    }
    return;
  }
  if (mode === 'busted' || mode === 'wasted') {
    if (pressed.has('Enter')) bustPlayer(game);
    return;
  }
  if (mode === 'pause') {
    if (pressed.has('Enter') || pressed.has('Escape') || pressed.has('KeyP')) {
      game.mode = 'play';
      game.menu = null;
    }
    return;
  }
  if (mode === 'phone') {
    if (pressed.has('Tab') || pressed.has('Escape')) {
      game.phoneOpen = false;
      game.mode = 'play';
    }
    return;
  }
  if (mode !== 'play') return;

  // Play mode.
  if (pressed.has('Escape') || pressed.has('KeyP')) {
    game.mode = 'pause';
    game.menu = 'pause';
    saveGame(game, 1);
    return;
  }
  if (pressed.has('Enter')) {
    // Advance a card/dialogue, or respawn after busted/wasted.
    if (game.mode === 'busted' || game.mode === 'wasted') bustPlayer(game);
    return;
  }
  if (pressed.has('KeyE')) handleInteract(game);
  if (pressed.has('KeyF')) punch(game);
  if (pressed.has('KeyG')) throwBomb(game);
  if (pressed.has('KeyR')) {
    game.station = ((game.station || 0) + 1) % STATIONS.length;
    game.song = 0;
    game.songStep = 0;
  }
  if (pressed.has('KeyM')) {
    game.muted = !game.muted;
    if (game.audio) game.audio.setMuted(game.muted);
  }
  if (pressed.has('Digit1')) game.player.weapon = 0;
  if (pressed.has('Digit2') && game.unlocks.smgUnlocked) game.player.weapon = 1;
  if (pressed.has('Digit3') && game.unlocks.shotgunUnlocked) game.player.weapon = 2;
  if (pressed.has('Digit4')) game._taxiRequested = true;
  if (pressed.has('Tab')) togglePhone(game);
  if (input.mouse && input.mouse.clicked) {
    // Click to shoot: aim at the click's world point on the ground.
    const aim = clickAim(game, input);
    if (aim) shoot(game, aim.x, aim.z);
  }
}

// Where a mouse click lands on the ground plane (y = 0).
function clickAim(game, input) {
  const cam = game.camera;
  if (!cam) return null;
  const w = game.canvas ? game.canvas.width : 1280;
  const h = game.canvas ? game.canvas.height : 720;
  const nx = ((input.mouse.x || w / 2) / w) * 2 - 1;
  const ny = 1 - ((input.mouse.y || h / 2) / h) * 2;
  const vp = computeViewProj(cam, w, h);
  // Invert the view-projection roughly: shoot a ray from the eye
  // through the NDC point and intersect y = 0.
  const inv = invertVP(vp);
  if (!inv) return { x: cam.tx, z: cam.tz };
  const near = applyMat(inv, nx, ny, -1);
  const far = applyMat(inv, nx, ny, 1);
  const dx = far[0] - near[0];
  const dy = far[1] - near[1];
  const dz = far[2] - near[2];
  if (Math.abs(dy) < 0.001) return { x: cam.tx, z: cam.tz };
  const t = -near[1] / dy;
  if (t < 0) return { x: cam.tx, z: cam.tz };
  return { x: near[0] + dx * t, z: near[2] + dz * t };
}

// A small 4x4 inverse (Gauss-Jordan) for the click ray.
function invertVP(m) {
  const a = [...m];
  const inv = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (let col = 0; col < 4; col++) {
    let pivot = col;
    for (let r = col + 1; r < 4; r++) {
      if (Math.abs(a[r * 4 + col]) > Math.abs(a[pivot * 4 + col])) pivot = r;
    }
    if (Math.abs(a[pivot * 4 + col]) < 1e-9) return null;
    if (pivot !== col) {
      for (let k = 0; k < 4; k++) {
        [a[col * 4 + k], a[pivot * 4 + k]] = [a[pivot * 4 + k], a[col * 4 + k]];
        [inv[col * 4 + k], inv[pivot * 4 + k]] = [inv[pivot * 4 + k], inv[col * 4 + k]];
      }
    }
    const d = a[col * 4 + col];
    for (let k = 0; k < 4; k++) { a[col * 4 + k] /= d; inv[col * 4 + k] /= d; }
    for (let r = 0; r < 4; r++) {
      if (r === col) continue;
      const f = a[r * 4 + col];
      for (let k = 0; k < 4; k++) { a[r * 4 + k] -= f * a[col * 4 + k]; inv[r * 4 + k] -= f * inv[col * 4 + k]; }
    }
  }
  return inv;
}

function applyMat(m, x, y, z) {
  const w = m[3] * x + m[7] * y + m[11] * z + m[15];
  return [
    (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
    (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
    (m[2] * x + m[6] * y + m[10] * z + m[14]) / w,
  ];
}

// ---- E (interact) ----
// In a car: the garage door stores the car first, else step out.
// On foot: garage, interiors, food, outfit, cats, dogs, the train,
// the elevator and activities — then step into a vehicle.
export function handleInteract(game) {
  const p = game.player;
  if (p.inCar) {
    if (tryGarage(game)) return;
    exitVehicle(game);
    return;
  }
  if (tryGarage(game)) return;
  const door = tryInteriorDoor(game);
  if (door) return;
  if (tryInteriorCounter(game)) return;
  if (tryFoodShop(game)) return;
  if (tryOutfitShop(game)) return;
  if (tryCat(game)) return;
  if (tryPetDog(game)) return;
  if (tryTrain(game)) return;
  if (tryElevator(game)) return;
  if (tryFish(game)) return;
  if (tryVending(game)) return;
  if (tryAtm(game)) return;
  // Step into the nearest vehicle (a called taxi starts its fare).
  const v = tryEnterVehicle(game);
  if (v && v === game._taxiCab) startTaxiFare(game);
}

// ---- browser entry ----
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;
    const game = boot(canvas, document);
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      handleTaps(game, game.input);
      stepGame(game, dt, game.input);
      renderFrame(game);
      game.input.endFrame();
      updateHud(game, game.hud);
      drawMinimap(game, game.hud);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
}
