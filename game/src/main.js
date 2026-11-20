// Solmar Bay — the game entry (rebuild #14).
// boot() sizes the canvas BEFORE the renderer is created (a
// later resize kills the WebGL context), builds the world, and
// starts the loop. stepGame() ticks the world. handleTaps()
// routes keyboard taps. handleInteract() routes the E key.
// collectDynamicBoxes() gathers everything that moves.
// renderFrame() clears once and draws static + GLB + dynamic.

import { createGame, newGame, showToast, showDialogue, chapterTitle, completionPercent } from './state.js';
import { buildCity, buildStaticBoxes, isBlocked, isOnRoad, districtAt } from './world.js';
import { createCamera, updateCamera, cameraView } from './shots.js';
import { createRenderer, BoxBatch, batchReset, batchTris, pushBox, pushBoxRot, computeViewProj } from './render.js';
import { createInput } from './input.js';
import { createAudio, stationLabel } from './audio.js';
import { createHud, updateHud, drawMinimap } from './hud.js';
import { createWeather, sampleAt, phaseAt } from './weather.js';
import { createAtlasTexture } from './texture.js';
import { parseGlb, pushGlbToBatch } from './gltf.js';
import { stepPlayer, playerBoxes, tryEnterVehicle, exitVehicle, outfitColours } from './player.js';
import { spawnVehicles, stepPlayerCar, stepTraffic, stepCarCollisions, vehicleBoxes, makeVehicle } from './vehicles.js';
import { spawnPeds, stepPeds, pedBoxes } from './pedestrians.js';
import { spawnPolice, stepWanted, stepPolice, bustPlayer, commitCrime, policeList } from './police.js';
import { stepPickups, damagePlayer, punch, shoot, throwBomb, WEAPONS } from './combat.js';
import { startChapter, completeChapter, nextChapter, stepMissions, stepChapter3, startSideJob, stepSideJob } from './missions.js';
import { spawnGangs, stepGangs, gangBoxes, gangInTurf } from './gangs.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { togglePhone, phoneTab, callContact, notifyMessage } from './phone.js';
import { tryGarage, takeOutCar, repaintCar } from './garage.js';
import { spawnLiving, stepLiving, livingBoxes, tryTrain, tryElevator, tryPetDog, trainPosAt } from './living.js';
import { spawnFireService, stepFires, sprayFire, fireBoxes } from './fire.js';
import { spawnCats, stepCats, tryCat, catBoxes } from './cats.js';
import { spawnTraining, stepTraining, tryRange, rangeHit, trySwim, trySlalom, trainingBoxes } from './training.js';
import { spawnActivities, stepActivities, tryFish, tryVending, tryAtm, atmAction } from './activities.js';
import { ROOMS, tryInteriorDoor, tryInteriorCounter, stepInteriors, interiorBoxes } from './interiors.js';
import { nearestFoodShop, tryFoodShop, buyFood, foodSignBoxes } from './food.js';
import { mayaPos, tryDate, dateAte, maybeMayaCall, mayaBoxes } from './dating.js';
import { tryOutfitShop, cycleOutfit, buyOutfit } from './outfit.js';
import { stepEvents, stepEventActive, eventBoxes } from './events.js';
import { stepTaxiCall, stepTaxiFare, startTaxiFare, unstickCalledTaxi } from './taxi.js';

// ---------- GLB barrels ----------
// Three procedural barrels stand in for the GLB until the real
// barrel.glb loads (and forever if it cannot — Node has no file
// to fetch, so the fallback is what the tests see: 36 tris).
function bakeGlbFallback(g) {
  const b = g.renderer.glbBatch;
  batchReset(b);
  const red = [0.85, 0.2, 0.15];
  const spots = [[60, 320], [62, 322], [58, 322]];
  for (const [x, z] of spots) {
    pushBox(b, x, 0, z, 1, 1.2, 1, red);
  }
}

async function loadBarrelGlb(g) {
  try {
    const res = await fetch('./assets/barrel.glb');
    if (!res.ok) return;
    const buf = await res.arrayBuffer();
    const model = parseGlb(new Uint8Array(buf));
    if (!model) return;
    const b = g.renderer.glbBatch;
    batchReset(b);
    const spots = [[60, 320], [62, 322], [58, 322]];
    for (const [x, z] of spots) {
      pushGlbToBatch(b, model, x, 0, z, 1, [0.85, 0.2, 0.15], [0, 0, 1, 1]);
    }
  } catch (e) {
    // No GLB (Node, offline, missing file): the fallback stays.
  }
}

// ---------- boot ----------
export function boot(canvas, doc) {
  // Size the canvas BEFORE the renderer: assigning width/height
  // afterwards resets the WebGL context and kills the program.
  const w = (typeof window !== 'undefined' && window.innerWidth) || canvas.width || 1280;
  const h = (typeof window !== 'undefined' && window.innerHeight) || canvas.height || 720;
  canvas.width = w;
  canvas.height = h;

  const g = createGame();
  g.city = buildCity();
  g.camera = createCamera();
  g.input = createInput();
  g.audio = createAudio();
  g.hud = createHud(doc);
  g.weatherObj = createWeather(g);
  spawnVehicles(g);
  spawnPeds(g);
  spawnPolice(g);
  spawnGangs(g);
  spawnLiving(g);
  spawnFireService(g);
  spawnCats(g);
  spawnTraining(g);
  spawnActivities(g);
  g.canvas = canvas;
  g.doc = doc;
  g.mode = 'menu';

  // Renderer (after sizing). The atlas is a real document-only
  // texture; in Node the renderer keeps its 1x1 white fallback.
  g.renderer = createRenderer(canvas, null);
  if (g.renderer) {
    const tex = createAtlasTexture(g.renderer.gl, doc);
    if (tex) g.renderer.texture = tex;
    buildStaticBoxes(g.city, g.renderer.staticBatch);
    bakeGlbFallback(g);
    loadBarrelGlb(g);
  }

  // Keyboard on the window (the canvas cannot take focus).
  if (typeof window !== 'undefined' && g.input) g.input.attach(window);

  // Title-screen buttons.
  wireButtons(g, doc);

  // Resize: re-create the renderer (the old context is dead once
  // the canvas size changes) and re-bake both static batches so
  // the re-created renderer draws exactly the same world.
  g._onResize = () => {
    const nw = (typeof window !== 'undefined' && window.innerWidth) || canvas.width || 1280;
    const nh = (typeof window !== 'undefined' && window.innerHeight) || canvas.height || 720;
    canvas.width = nw;
    canvas.height = nh;
    g.renderer = createRenderer(canvas, null);
    if (g.renderer) {
      const tex = createAtlasTexture(g.renderer.gl, doc);
      if (tex) g.renderer.texture = tex;
      buildStaticBoxes(g.city, g.renderer.staticBatch);
      bakeGlbFallback(g);
      loadBarrelGlb(g);
    }
  };
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('resize', g._onResize);
  }

  // The game loop (browser only; Node drives stepGame directly).
  g._raf = 0;
  g._lastT = 0;
  if (typeof requestAnimationFrame !== 'undefined') {
    const loop = (t) => {
      const dt = Math.min(0.1, (t - (g._lastT || t)) / 1000 || 0.016);
      g._lastT = t;
      stepGame(g, dt, g.input);
      renderFrame(g, dt);
      g.input.endFrame();
      g._raf = requestAnimationFrame(loop);
    };
    g._raf = requestAnimationFrame(loop);
  }
  return g;
}

function wireButtons(g, doc) {
  if (!doc || typeof doc.getElementById !== 'function') return;
  const on = (id, fn) => {
    const el = doc.getElementById(id);
    if (el && typeof el.addEventListener === 'function') el.addEventListener('click', fn);
  };
  on('btn-new', () => {
    newGame(g);
    startChapter(g, 1);
    g.grace = 5;
  });
  on('btn-continue', () => {
    const s = loadGame(g);
    if (s) {
      g.mode = 'play';
    } else {
      newGame(g);
      startChapter(g, 1);
      g.grace = 5;
    }
  });
  on('btn-resume', () => {
    if (g.mode === 'pause') g.mode = 'play';
  });
  on('btn-pause', () => {
    if (g.mode === 'play') {
      g.mode = 'pause';
      saveGame(g);
    } else if (g.mode === 'pause') {
      g.mode = 'play';
    }
  });
}

// ---------- the tick ----------
export function stepGame(g, dt, input) {
  g.time = (g.time || 0) + dt;
  // The radio sequencer advances every 0.25 s; after 32 steps the
  // song advances to the next track.
  g._songTimer = (g._songTimer || 0) + dt;
  while (g._songTimer >= 0.25) {
    g._songTimer -= 0.25;
    g.songStep = ((g.songStep || 0) + 1) % 32;
    if (g.songStep === 0) g.song = ((g.song || 0) + 1) % 2;
  }
  if (g.mode === 'pause') return; // clock frozen, time still ticks
  if (g.mode !== 'play') return;

  // Clock + weather (120x).
  if (g.weatherObj) g.weatherObj.step(dt, g.rng);
  // Respect unlocks.
  if (!g.unlocks) g.unlocks = { smgUnlocked: false, shotgunUnlocked: false, sportsCarSpawned: false };
  if (g.respect >= 100 && !g.unlocks.smgUnlocked) {
    g.unlocks.smgUnlocked = true;
    g.smgUnlocked = true;
    showToast(g, 'Unlocked: SMG (press 2)');
  }
  if (g.respect >= 250 && !g.unlocks.shotgunUnlocked) {
    g.unlocks.shotgunUnlocked = true;
    g.shotgunUnlocked = true;
    showToast(g, 'Unlocked: Shotgun (press 3)');
  }
  if (g.respect >= 500 && !g.unlocks.sportsCarSpawned) {
    g.unlocks.sportsCarSpawned = true;
    g.cometUnlocked = true;
    const v = makeVehicle('car', g.player.x + 6, g.player.z + 6, 0, [0.85, 0.2, 0.25], 'Solmar Comet');
    v.owned = true;
    g.vehicles.push(v);
    g.ownedCars.push(v);
    showToast(g, 'Unlocked: your own Solmar Comet!');
  }

  stepPlayer(g, dt, input);
  if (g.player.inCar) stepPlayerCar(g, dt, input);
  stepTraffic(g, dt);
  stepCarCollisions(g, dt);
  stepPeds(g, dt);
  stepWanted(g, dt);
  stepPolice(g, dt);
  stepGangs(g, dt);
  stepMissions(g, dt);
  stepChapter3(g, dt);
  stepSideJob(g, dt);
  stepPickups(g, dt);
  stepLiving(g, dt);
  stepFires(g, dt);
  stepCats(g, dt);
  stepTraining(g, dt);
  stepActivities(g, dt);
  stepEvents(g, dt, g.rng);
  stepEventActive(g, dt);
  stepInteriors(g, dt);
  stepTaxiCall(g, dt);
  stepTaxiFare(g, dt);
  dateAte(g, dt);
  if (g.dialogue) {
    g.dialogue.t -= dt;
    if (g.dialogue.t <= 0) g.dialogue = null;
  }
  if (g.toastTimer > 0) g.toastTimer -= dt;
  if (g.cardTimer > 0) g.cardTimer -= dt;
  // Radio: play the current step (a safe no-op in Node).
  if (g.audio && g.audio.radioStep) {
    g.audio.radioStep(g.station || 0, 0, g.songStep || 0);
  }
}

// ---------- keyboard taps ----------
export function handleTaps(g, input) {
  if (!input) return;
  const tap = (k) => input.pressed && input.pressed.has(k);

  // Enter: advance the mode.
  if (tap('Enter')) {
    if (g.mode === 'menu') {
      newGame(g);
      startChapter(g, 1);
      g.grace = 5;
    } else if (g.mode === 'card') {
      g.mode = 'play';
    } else if (g.mode === 'passed') {
      nextChapter(g);
    } else if (g.mode === 'pause') {
      g.mode = 'play';
    } else if (g.mode === 'wasted' || g.mode === 'busted') {
      respawn(g);
    }
  }
  // Escape / P: pause toggle. Always shows the overlay.
  if (tap('Escape') || tap('KeyP')) {
    if (g.mode === 'play') {
      g.mode = 'pause';
      g.menu = 'pause';
      saveGame(g);
    } else if (g.mode === 'pause') {
      g.mode = 'play';
      g.menu = 'main';
    } else if (g.mode === 'menu') {
      g.mode = 'pause';
      g.menu = 'pause';
    }
  }
  // Tab: the phone (preventDefault keeps the browser from moving
  // focus to the Pause button — fix (b)/(h)).
  if (tap('Tab')) {
    if (g.mode === 'play' || g.mode === 'phone') togglePhone(g);
  }
  // R: cycle the radio station.
  if (tap('KeyR')) {
    g.station = ((g.station || 0) + 1) % 4;
    if (g.radio) g.radio.station = g.station;
  }
  // M: mute.
  if (tap('KeyM')) {
    g.muted = !g.muted;
    if (g.audio) g.audio.muted = g.muted;
  }
  // 2 / 3: weapons, gated by the respect unlocks.
  const un = g.unlocks || {};
  if (tap('Digit2') && (un.smgUnlocked || g.smgUnlocked)) g.player.weapon = 1;
  if (tap('Digit3') && (un.shotgunUnlocked || g.shotgunUnlocked)) g.player.weapon = 2;
  if (tap('Digit1')) g.player.weapon = 0;
  // 4: call a taxi.
  if (tap('Digit4')) {
    g._taxiRequested = true;
  }
  // E: interact.
  if (tap('KeyE')) handleInteract(g);
  // F: punch. G: bomb.
  if (tap('KeyF')) punch(g);
  if (tap('KeyG')) throwBomb(g);
  // Mouse click: shoot.
  if (input.mouse && input.mouse.clicked) {
    shoot(g, g.player.x + Math.sin(g.player.heading) * 10, g.player.z + Math.cos(g.player.heading) * 10);
  }
}

function respawn(g) {
  // WASTED costs a 20% hospital fine. BUSTED already paid its
  // fine inside bustPlayer, so it is not charged twice.
  if (g.mode === 'wasted') {
    const fine = Math.floor(g.cash * 0.2);
    g.cash -= fine;
  }
  g.health = 100;
  g.armour = 0;
  g.player.x = -110;
  g.player.z = 150;
  g.player.inCar = null;
  g.mode = 'play';
  g.grace = 5;
  showToast(g, 'You wake up at the hospital.');
}

// ---------- the E key ----------
export function handleInteract(g) {
  const p = g.player;
  // A modal open: E closes it.
  if (g.modal) {
    g.modal = null;
    return true;
  }
  // Inside a room: the counter, or step back out.
  if (p.inside) {
    if (tryInteriorCounter(g)) return true;
    tryInteriorDoor(g);
    return true;
  }
  // Driving a car to the garage door stores it.
  if (p.inCar && tryGarage(g)) return true;
  // In a waiting cab: start the fare.
  if (p.inCar && p.inCar.kind === 'taxi' && g._taxiState === 'waiting') {
    if (startTaxiFare(g)) return true;
  }
  // A room door: step inside.
  const room = tryInteriorDoor(g);
  if (room) return true;
  // Food shop.
  if (tryFoodShop(g)) return true;
  // Outfit shop.
  if (tryOutfitShop(g)) return true;
  // A stray cat.
  if (tryCat(g)) return true;
  // A dog.
  if (tryPetDog(g)) return true;
  // Maya.
  if (tryDate(g)) return true;
  // The shooting range.
  if (tryRange(g)) return true;
  // The swim trial.
  if (trySwim(g)) return true;
  // The slalom.
  if (trySlalom(g)) return true;
  // The elevator.
  if (tryElevator(g)) return true;
  // The train.
  if (tryTrain(g)) return true;
  // A vending machine.
  if (tryVending(g)) return true;
  // An ATM.
  if (tryAtm(g)) return true;
  // Fishing.
  if (tryFish(g)) return true;
  // The garage, on foot.
  if (tryGarage(g)) return true;
  // A car: get in (or out).
  if (p.inCar) {
    exitVehicle(g);
    return true;
  }
  const entered = tryEnterVehicle(g);
  if (entered) {
    // Getting into the called cab starts the fare.
    if (entered === g._taxiCab) {
      startTaxiFare(g);
    }
    return true;
  }
  return false;
}

// ---------- dynamic boxes ----------
export function collectDynamicBoxes(g, batch, camera) {
  let n = 0;
  n += playerBoxes(g, batch, camera);
  for (const v of g.vehicles || []) n += vehicleBoxes(g, v, batch, camera);
  for (const p of g.peds || []) n += pedBoxes(g, p, batch, camera);
  for (const m of g.gangMembers || []) n += gangBoxes(g, m, batch, camera);
  n += livingBoxes(g, batch, camera);
  n += catBoxes(g, batch, camera);
  n += mayaBoxes(g, batch, camera);
  n += trainingBoxes(g, batch, camera);
  n += eventBoxes(g, batch, camera);
  n += fireBoxes(g, batch, camera);
  n += interiorBoxes(g, batch, camera);
  n += foodSignBoxes(g, batch, camera);
  // The mission marker (a floating beacon).
  if (g.missionMarker) {
    pushBox(batch, g.missionMarker.x, 0, g.missionMarker.z, 2, 6, 2, [1, 0.85, 0.2]);
    n += 1;
  }
  // Pickups (cash on the ground).
  for (const pk of g.pickups || []) {
    pushBox(batch, pk.x, 0.1, pk.z, 0.6, 0.1, 0.6, [0.2, 0.8, 0.3]);
    n += 1;
  }
  // Police (cops, cars, roadblocks, the helicopter).
  for (const c of g.cops || []) {
    pushBoxRot(batch, c.x, 0, c.z, 0.6, 1.8, 0.35, c.heading || 0, [0.1, 0.15, 0.5]);
    n += 1;
  }
  for (const c of g.copCars || []) {
    n += vehicleBoxes(g, c, batch, camera);
  }
  for (const rb of g.roadblocks || []) {
    pushBox(batch, rb.x, 0, rb.z, 3, 1, 0.5, [1, 0.4, 0.1]);
    n += 1;
  }
  if (g.heli) {
    const h = g.heli;
    pushBox(batch, h.x, h.y || 80, h.z, 4, 1.5, 2, [0.1, 0.15, 0.5]);
    n += 1;
  }
  // The sun, the moon and the stars (sky objects, drawn far out).
  const s = sampleAt(g.clock);
  if (g.clock >= 17 && g.clock < 19) {
    // Golden-hour sun, low in the west.
    pushBox(batch, -400, 60, -200, 30, 30, 1, [1, 0.8, 0.3]);
    n += 1;
  }
  if (g.clock >= 20 || g.clock < 5) {
    // The moon.
    pushBox(batch, 300, 150, -300, 18, 18, 1, [0.9, 0.95, 1]);
    n += 1;
    // Stars.
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      pushBox(batch, Math.cos(a) * 500, 120 + (i % 5) * 20, -400 + Math.sin(a) * 200, 2, 2, 1, [1, 1, 1]);
      n += 1;
    }
  }
  // Rain drops (visible when it rains) — fix (d).
  if (g.weather === 'rain') {
    for (let i = 0; i < 40; i++) {
      const rx = g.player.x + ((i * 37) % 60) - 30;
      const rz = g.player.z + ((i * 53) % 60) - 30;
      const ry = 2 + ((i * 7 + Math.floor(g.time * 20)) % 12);
      pushBox(batch, rx, ry, rz, 0.1, 1.2, 0.1, [0.7, 0.85, 1]);
      n += 1;
    }
  }
  g._lastDynTris = batchTris(batch);
  return n;
}

// ---------- the frame ----------
export function renderFrame(g, dt) {
  const r = g.renderer;
  if (!r) return;
  // The camera follows the player.
  if (g.camera) updateCamera(g.camera, g.player, dt || 0.016, g.input);
  const cam = g.camera;
  const w = g.canvas ? g.canvas.width : 1280;
  const h = g.canvas ? g.canvas.height : 720;
  const vp = computeViewProj(cam, w, h);
  const s = sampleAt(g.clock);
  const fogNear = 60;
  let fogFar = s.fogFar;
  if (g.weather === 'rain') fogFar = Math.min(fogFar, 200);
  if (g.weather === 'fog') fogFar = Math.min(fogFar, 120);
  // One clear per frame, in beginFrame only.
  r.beginFrame(s.sky);
  r.setView(vp, [cam.x, cam.y, cam.z], fogNear, fogFar, s.sky);
  // Static, GLB, dynamic — in that order (the upload order the
  // render-proof tests rely on).
  r.drawBatch(r.staticBatch);
  r.drawBatch(r.glbBatch);
  const dyn = BoxBatch();
  collectDynamicBoxes(g, dyn, cam);
  r.drawBatch(dyn);
  g._lastDynTris = batchTris(dyn);
  // The HUD (2D, DOM or canvas).
  if (g.hud) updateHud(g, g.hud);
  const mm = g.doc ? g.doc.getElementById('hud-minimap') : null;
  if (mm) drawMinimap(g, mm);
}

// ---------- self-boot ----------
// When the page loads, start the game on #game-canvas.
if (typeof document !== 'undefined') {
  const canvas = document.getElementById('game-canvas');
  if (canvas) boot(canvas, document);
}
