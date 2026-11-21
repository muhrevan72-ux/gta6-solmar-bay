// Solmar Bay — the game loop, input routing, and rendering.
// The loop calls handleTaps BEFORE stepping the game each frame,
// so taps (Enter, Tab, Escape, E, W) are read on the frame they
// happen instead of being swallowed by the step.

import { createGame, newGame, chapterTitle, completionPercent, addCash, showToast, showDialogue } from './state.js';
import { createInput } from './input.js';
import { createRenderer, computeViewProj, BoxBatch, batchReset, batchTris, pushBox } from './render.js';
import { buildCity, buildStaticBoxes, isBlocked, districtAt } from './world.js';
import { createCamera, updateCamera } from './shots.js';
import { createWeather, sampleAt } from './weather.js';
import { createAudio, stationLabel } from './audio.js';
import { createHud, updateHud, drawMinimap } from './hud.js';
import { buildAtlasCanvas, createAtlasTexture } from './texture.js';
import { spawnVehicles, stepPlayerCar, stepTraffic, stepCarCollisions, tryEnterVehicle, exitVehicle, vehicleBoxes, makeVehicle } from './vehicles.js';
import { spawnPeds, stepPeds, pedBoxes } from './pedestrians.js';
import { spawnPolice, stepPolice, stepWanted, bustPlayer, policeList } from './police.js';
import { spawnGangs, stepGangs, gangBoxes } from './gangs.js';
import { shoot, punch, throwBomb, stepPickups, WEAPONS } from './combat.js';
import { startChapter, stepMissions, nextChapter, startSideJob, stepSideJob } from './missions.js';
import { stepPlayer, playerBoxes } from './player.js';
import { spawnLiving, stepLiving, livingBoxes, tryPetDog, tryTrain, tryElevator, trainPosAt } from './living.js';
import { spawnCats, stepCats, tryCat, catBoxes } from './cats.js';
import { spawnActivities, stepActivities, tryFish, tryVending, tryAtm, atmAction } from './activities.js';
import { tryInteriorDoor, tryInteriorCounter, stepInteriors, interiorBoxes, ROOMS } from './interiors.js';
import { tryFoodShop, buyFood, foodSignBoxes } from './food.js';
import { tryDate, mayaBoxes, maybeMayaCall } from './dating.js';
import { tryOutfitShop, cycleOutfit, buyOutfit } from './outfit.js';
import { spawnTraining, stepTraining, tryRange, trySwim, trySlalom, trainingBoxes } from './training.js';
import { stepEvents, stepEventActive, eventBoxes } from './events.js';
import { spawnFireService, stepFires, sprayFire, fireBoxes } from './fire.js';
import { stepTaxiCall, stepTaxiFare, startTaxiFare, unstickCalledTaxi } from './taxi.js';
import { tryGarage, takeOutCar } from './garage.js';
import { saveGame, loadGame } from './save.js';
import { togglePhone, callContact } from './phone.js';
import { CHAPTERS, RESPECT, SPAWNS } from './config.js';

// 3 procedural barrels (the GLB fallback — no .glb file).
function buildGlbFallback(g) {
  const b = g.renderer.glbBatch;
  batchReset(b);
  const plain = [0, 0, 1, 1];
  const spots = [[-252, 196], [-246, 200], [-250, 206]];
  for (const [x, z] of spots) {
    pushBox(b, x, 0.45, z, 1.2, 1.8, 1.2, [0.85, 0.2, 0.15], plain);
  }
}

export function boot(canvas, doc) {
  const g = createGame();
  g.canvas = canvas;
  g.doc = doc;
  // Size the canvas BEFORE creating the renderer — resizing a
  // canvas kills its GL context.
  const win = (typeof globalThis !== 'undefined') ? globalThis.window : null;
  const w = win && win.innerWidth ? win.innerWidth : 1280;
  const h = win && win.innerHeight ? win.innerHeight : 720;
  canvas.width = w;
  canvas.height = h;
  g.city = buildCity();
  g.camera = createCamera();
  g.input = createInput();
  g.audio = createAudio();
  g.hud = createHud(doc);
  g.weatherObj = createWeather(g);
  const atlas = createAtlasTexture(null);
  g.renderer = createRenderer(canvas, atlas);
  buildStaticBoxes(g.city, g.renderer.staticBatch);
  buildGlbFallback(g);
  spawnVehicles(g);
  spawnPeds(g);
  spawnPolice(g);
  spawnGangs(g);
  spawnLiving(g);
  spawnCats(g);
  spawnActivities(g);
  spawnTraining(g);
  spawnFireService(g);
  // Buttons.
  if (doc) {
    const on = (id, fn) => {
      const el = doc.getElementById(id);
      if (el && el.addEventListener) el.addEventListener('click', fn);
    };
    on('btn-new', () => { newGame(g); startChapter(g, 1); });
    on('btn-continue', () => { loadGame(g, 1); g.mode = 'play'; });
    on('btn-resume', () => { g.mode = 'play'; });
    on('btn-pause', () => { togglePause(g); });
  }
  g._onResize = () => {
    const nw = win && win.innerWidth ? win.innerWidth : 1280;
    const nh = win && win.innerHeight ? win.innerHeight : 720;
    canvas.width = nw;
    canvas.height = nh;
    g.renderer = createRenderer(canvas, createAtlasTexture(null));
    buildStaticBoxes(g.city, g.renderer.staticBatch);
    buildGlbFallback(g);
    if (g.renderer.gl) g.renderer.gl.viewport(0, 0, nw, nh);
  };
  g.mode = 'menu';
  return g;
}

// Pause / resume. If the phone is open, the Pause button closes
// it instead of pausing (the phone must never trap the game).
export function togglePause(g) {
  if (g.phoneOpen) {
    togglePhone(g);
    return;
  }
  if (g.mode === 'play') {
    g.mode = 'pause';
    g.menu = 'pause';
    saveGame(g, 1);
  } else if (g.mode === 'pause') {
    g.mode = 'play';
  }
}

// Unproject a screen point onto the ground plane (y = 0).
function screenToGround(g, sx, sy) {
  const cam = g.camera;
  if (!cam || !g.canvas) return null;
  const w = g.canvas.width, h = g.canvas.height;
  const nx = (sx / w) * 2 - 1;
  const ny = 1 - (sy / h) * 2;
  const fov = ((cam.fov || 60) * Math.PI) / 180;
  const tanF = Math.tan(fov / 2);
  const aspect = w / h;
  let fx = cam.tx - cam.x, fy = cam.ty - cam.y, fz = cam.tz - cam.z;
  const fl = Math.hypot(fx, fy, fz) || 1;
  fx /= fl; fy /= fl; fz /= fl;
  let rx = -fz, ry = 0, rz = fx;
  const rl = Math.hypot(rx, ry, rz) || 1;
  rx /= rl; ry /= rl; rz /= rl;
  const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
  let dx = fx + rx * (nx * tanF * aspect) + ux * (ny * tanF);
  let dy = fy + ry * (nx * tanF * aspect) + uy * (ny * tanF);
  let dz = fz + rz * (nx * tanF * aspect) + uz * (ny * tanF);
  const dl = Math.hypot(dx, dy, dz) || 1;
  dx /= dl; dy /= dl; dz /= dl;
  if (dy >= -0.001) return null;
  const t = -cam.y / dy;
  return { x: cam.x + dx * t, z: cam.z + dz * t };
}

export function handleInteract(g) {
  const p = g.player;
  if (p.inCar) {
    if (Math.hypot(p.x - SPAWNS.garageDoor.x, p.z - SPAWNS.garageDoor.z) < 8) {
      tryGarage(g);
    } else {
      exitVehicle(g);
    }
    return;
  }
  // Inside a room: the counter first, then the door out.
  if (p.inside) {
    if (tryInteriorCounter(g)) return;
    tryInteriorDoor(g);
    return;
  }
  // On foot: the car-enter check runs FIRST so a nearby car
  // always wins the E press over shops and activities.
  if (tryEnterVehicle(g)) {
    if (g._taxiCab && p.inCar === g._taxiCab) startTaxiFare(g);
    return;
  }
  if (tryGarage(g)) return;
  if (tryFoodShop(g)) return;
  if (tryInteriorDoor(g)) return;
  if (tryOutfitShop(g)) return;
  if (tryVending(g)) return;
  if (tryAtm(g)) return;
  if (tryCat(g)) return;
  if (tryPetDog(g)) return;
  if (tryTrain(g)) return;
  if (tryElevator(g)) return;
  if (tryDate(g)) return;
  if (tryFish(g)) return;
  if (tryRange(g)) return;
  if (trySwim(g)) return;
  if (trySlalom(g)) return;
}

export function handleTaps(g, input) {
  const mode = g.mode;
  if (mode === 'menu') {
    if (input.pressedKey('Enter')) { newGame(g); startChapter(g, 1); }
    else if (input.pressedKey('KeyM')) { g.muted = !g.muted; if (g.audio) g.audio.setMuted(g.muted); }
    return;
  }
  if (mode === 'card') {
    if (input.pressedKey('Enter') || input.pressedKey('Escape')) { g.mode = 'play'; g.card = null; }
    return;
  }
  if (mode === 'passed') {
    if (input.pressedKey('Enter')) nextChapter(g);
    return;
  }
  if (mode === 'busted') {
    if (input.pressedKey('Enter')) {
      g.player.x = SPAWNS.hospital.x;
      g.player.z = SPAWNS.hospital.z;
      g.mode = 'play';
    }
    return;
  }
  if (mode === 'wasted') {
    if (input.pressedKey('Enter')) {
      const fine = Math.floor(g.cash * 0.2);
      g.cash -= fine;
      g.health = 100;
      if (g.player.inCar) { g.player.inCar.driver = null; g.player.inCar = null; }
      g.player.x = SPAWNS.hospital.x;
      g.player.z = SPAWNS.hospital.z;
      g.mode = 'play';
    }
    return;
  }
  if (mode === 'pause') {
    if (input.pressedKey('Enter') || input.pressedKey('Escape') || input.pressedKey('KeyP')) g.mode = 'play';
    return;
  }
  if (mode === 'phone') {
    if (input.pressedKey('Tab') || input.pressedKey('Escape')) togglePhone(g);
    return;
  }
  // mode === 'play'
  if (input.pressedKey('Escape') || input.pressedKey('KeyP')) {
    g.mode = 'pause';
    g.menu = 'pause';
    saveGame(g, 1);
    return;
  }
  if (input.pressedKey('Tab')) { togglePhone(g); return; }
  if (input.pressedKey('KeyE')) handleInteract(g);
  if (input.pressedKey('KeyR')) { g.station = (g.station + 1) % 4; g.song = 0; g.songStep = 0; }
  if (input.pressedKey('KeyM')) { g.muted = !g.muted; if (g.audio) g.audio.setMuted(g.muted); }
  if (input.pressedKey('Digit1')) g.player.weapon = 0;
  if (input.pressedKey('Digit2') && g.unlocks.smgUnlocked) g.player.weapon = 1;
  if (input.pressedKey('Digit3') && g.unlocks.shotgunUnlocked) g.player.weapon = 2;
  if (input.pressedKey('Digit4')) g._taxiRequested = true;
  if (input.pressedKey('KeyF')) punch(g);
  if (input.pressedKey('KeyG')) throwBomb(g);
  if (input.mouse && input.mouse.clicked) {
    const aim = screenToGround(g, input.mouse.x, input.mouse.y);
    if (aim) shoot(g, aim.x, aim.z);
  }
  // Modal shortcuts.
  if (g.modal) {
    if (input.pressedKey('Escape')) { g.modal = null; return; }
    if (g.modal.kind === 'food') {
      if (input.pressedKey('Digit1')) buyFood(g, 0);
      else if (input.pressedKey('Digit2')) buyFood(g, 1);
      else if (input.pressedKey('Digit3')) buyFood(g, 2);
    } else if (g.modal.kind === 'atm') {
      if (input.pressedKey('Digit1')) atmAction(g, 0);
      else if (input.pressedKey('Digit2')) atmAction(g, 1);
    } else if (g.modal.kind === 'outfit') {
      if (input.pressedKey('Digit1')) cycleOutfit(g, 'hair');
      else if (input.pressedKey('Digit2')) cycleOutfit(g, 'shirt');
      else if (input.pressedKey('Digit3')) cycleOutfit(g, 'pants');
      else if (input.pressedKey('Digit4')) cycleOutfit(g, 'shoes');
      else if (input.pressedKey('Enter')) buyOutfit(g);
    } else if (g.modal.kind === 'garage') {
      if (input.pressedKey('Digit1')) takeOutCar(g, 0);
    }
  }
}

function checkUnlocks(g) {
  for (const u of RESPECT.unlocks) {
    if (g.respect >= u.min && !g.unlocks[u.flag]) {
      g.unlocks[u.flag] = true;
      showToast(g, u.label);
      if (u.flag === 'sportsCarSpawned') {
        const car = makeVehicle('car', 30, 20, 0, [0.9, 0.2, 0.2], 'Solmar Comet');
        car.owned = true;
        g.vehicles.push(car);
        g.ownedCars.push(car);
      }
    }
  }
}

export function stepGame(g, dt, input) {
  g.time += dt;
  if (g.toastTimer > 0) g.toastTimer -= dt;
  if (g.dialogue && g.dialogue.t > 0) g.dialogue.t -= dt;
  if (g.mode !== 'play' && g.mode !== 'phone') return;
  if (g.weatherObj) g.weatherObj.step(dt);
  stepPlayer(g, dt, input);
  if (g.player.inCar) stepPlayerCar(g, dt, input);
  stepTraffic(g, dt);
  stepCarCollisions(g, dt);
  stepPeds(g, dt);
  stepPolice(g, dt);
  stepWanted(g, dt);
  stepGangs(g, dt);
  stepMissions(g, dt);
  stepSideJob(g, dt);
  stepPickups(g, dt);
  stepLiving(g, dt);
  stepCats(g, dt);
  stepActivities(g, dt);
  stepTraining(g, dt);
  stepInteriors(g, dt);
  stepEvents(g, dt);
  stepEventActive(g, dt);
  stepFires(g, dt);
  stepTaxiCall(g, dt);
  stepTaxiFare(g, dt);
  // Radio sequencer: a step every 0.25 s; 32 steps per song.
  g._songTimer += dt;
  while (g._songTimer >= 0.25) {
    g._songTimer -= 0.25;
    g.songStep++;
    if (g.songStep >= 32) {
      g.songStep = 0;
      g.song = (g.song + 1) % 2;
    }
    if (g.audio) g.audio.radioStep(g.station, g.song, g.songStep);
  }
  checkUnlocks(g);
  // Camera follows the player (or the car).
  if (g.camera) {
    const t = g.player.inCar
      ? { x: g.player.inCar.x, y: 1.5, z: g.player.inCar.z }
      : { x: g.player.x, y: 1.5, z: g.player.z };
    updateCamera(g.camera, t, dt, input);
  }
  // The player rides the train.
  if (g.player.onTrain && g.train) {
    const tp = trainPosAt(g.train.a);
    g.player.x = tp.x;
    g.player.z = tp.z;
  }
}

// Draw a foot cop (navy) as a ped-like figure.
function drawCop(g, cop, batch) {
  const navy = [0.1, 0.15, 0.5];
  pushBox(batch, cop.x - 0.14, 0, cop.z, 0.24, 0.85, 0.24, [0.05, 0.05, 0.1]);
  pushBox(batch, cop.x + 0.14, 0, cop.z, 0.24, 0.85, 0.24, [0.05, 0.05, 0.1]);
  pushBox(batch, cop.x, 0.85, cop.z, 0.62, 0.65, 0.36, navy);
  pushBox(batch, cop.x - 0.4, 0.9, cop.z, 0.2, 0.6, 0.2, navy);
  pushBox(batch, cop.x + 0.4, 0.9, cop.z, 0.2, 0.6, 0.2, navy);
  pushBox(batch, cop.x, 1.5, cop.z, 0.42, 0.42, 0.42, [0.9, 0.75, 0.6]);
  pushBox(batch, cop.x, 1.86, cop.z, 0.44, 0.16, 0.44, navy);
  pushBox(batch, cop.x, 1.0, cop.z + 0.25, 0.12, 0.12, 0.45, [0.15, 0.15, 0.18]);
}

// The dynamic batch: everything that moves, culled to ~150 m
// around the camera so it stays under the 1600-box cap.
export function collectDynamicBoxes(g, batch, camera) {
  batchReset(batch);
  const cam = camera || g.camera;
  const cx = cam ? cam.tx : g.player.x;
  const cz = cam ? cam.tz : g.player.z;
  const near = (x, z, r) => Math.hypot(x - cx, z - cz) < r;
  const plain = [0, 0, 1, 1];
  if (!g.player.inCar) playerBoxes(g, batch);
  for (const v of g.vehicles) {
    if (near(v.x, v.z, 150)) vehicleBoxes(g, v, batch, cam);
  }
  for (const v of g.traffic) {
    if (near(v.x, v.z, 150)) vehicleBoxes(g, v, batch, cam);
  }
  for (const p of g.peds) {
    if (!p.dead && near(p.x, p.z, 120)) pedBoxes(g, p, batch, cam);
  }
  for (const c of g.cops) {
    if (!c.dead && near(c.x, c.z, 120)) drawCop(g, c, batch);
  }
  for (const m of g.gangMembers) {
    if (!m.dead && near(m.x, m.z, 120)) gangBoxes(g, m, batch, cam);
  }
  livingBoxes(g, batch);
  catBoxes(g, batch);
  mayaBoxes(g, batch);
  interiorBoxes(g, batch);
  foodSignBoxes(g, batch);
  trainingBoxes(g, batch);
  eventBoxes(g, batch);
  fireBoxes(g, batch);
  // Cop cars + roadblocks + helicopter.
  for (const cc of g.copCars) {
    if (near(cc.x, cc.z, 150)) {
      pushBox(batch, cc.x, 0.55, cc.z, 2.4, 0.9, 5.0, [0.1, 0.15, 0.5], plain);
    }
  }
  for (const rb of g.roadblocks) {
    if (near(rb.x, rb.z, 150)) {
      pushBox(batch, rb.x, 0, rb.z, 3, 1.2, 0.5, [0.9, 0.3, 0.1], plain);
    }
  }
  if (g.heli) {
    pushBox(batch, g.heli.x, g.heli.y, g.heli.z, 6, 2, 3, [0.1, 0.15, 0.5], plain);
  }
  // Sun at golden hour / sunset.
  const sample = g.weatherObj ? g.weatherObj.sample() : sampleAt(g.clock);
  if (sample.phase === 'golden' || sample.phase === 'sunset') {
    pushBox(batch, g.player.x + 100, 80, g.player.z - 100, 20, 20, 1, [1, 0.8, 0.3], plain);
  }
  // Rain drops.
  if (g.weather === 'rain') {
    for (let i = 0; i < 20; i++) {
      const rx = g.player.x + ((i * 37) % 40) - 20;
      const rz = g.player.z + ((i * 53) % 40) - 20;
      pushBox(batch, rx, 10 + (i % 5), rz, 0.1, 2, 0.1, [0.7, 0.85, 0.9], plain);
    }
  }
  // Neon signs, boosted by the time of day.
  const boost = sample.neonBoost || 1;
  for (const n of g.city.neon) {
    if (!near(n.x, n.z, 150)) continue;
    const col = [Math.min(1, n.col[0] * boost), Math.min(1, n.col[1] * boost), Math.min(1, n.col[2] * boost)];
    pushBox(batch, n.x, n.y, n.z, 2, 1, 0.3, col, plain);
  }
  // Clouds.
  for (const cl of g.city.clouds) {
    if (near(cl.x, cl.z, 200)) pushBox(batch, cl.x, cl.y, cl.z, cl.s, 2, cl.s * 0.6, [1, 1, 1], plain);
  }
  g._lastDynTris = batchTris(batch);
  return batch;
}

export function renderFrame(g) {
  const r = g.renderer;
  if (!r || !r.gl) return;
  const sample = g.weatherObj ? g.weatherObj.sample() : sampleAt(g.clock);
  r.gl.viewport(0, 0, g.canvas.width, g.canvas.height);
  r.beginFrame(sample.sky);
  const cam = g.camera;
  const vp = computeViewProj(cam, g.canvas.width, g.canvas.height);
  r.setView(vp, [cam.x, cam.y, cam.z], sample.fogNear, sample.fogFar);
  const dyn = BoxBatch();
  collectDynamicBoxes(g, dyn, cam);
  r.drawBatch(r.staticBatch);
  r.drawBatch(dyn);
  r.drawBatch(r.glbBatch);
  if (g.hud) {
    updateHud(g, g.hud);
    drawMinimap(g, g.hud);
  }
}

// The browser loop: taps first, then step, then render.
export function startLoop(g) {
  let last = 0;
  const tick = (now) => {
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    handleTaps(g, g.input);
    stepGame(g, dt, g.input);
    renderFrame(g);
    g.input.endFrame();
    if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(tick);
  };
  if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(tick);
  return tick;
}

// Auto-boot when loaded as a module in a browser page.
if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  const cv = document.getElementById('game-canvas');
  if (cv) {
    const game = boot(cv, document);
    startLoop(game);
    window.addEventListener('resize', () => { if (game._onResize) game._onResize(); });
  }
}
