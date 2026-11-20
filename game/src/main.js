// Solmar Bay — boot + game loop + wiring.
//
// THE BOOT-ORDER FIX (play-test #6, round 7): the old boot()
// called createRenderer(canvas) FIRST, then ran resize() which
// sets canvas.width/height. In WebGL, assigning canvas.width or
// canvas.height RESETS the rendering context and DESTROYS the
// shader program, buffers and textures. The resize ran
// synchronously at boot, before the first frame — so the program
// was dead from frame 1: beginFrame's clear still worked (flat
// sky colour changing with time of day) but draw() silently drew
// nothing, with no errors, while HUD (DOM) and minimap (2D
// canvas) kept working. Round 5 had NO resize at all (fixed
// 1280x720 canvas) and rendered perfectly in play-tests #3/#4;
// rounds 6 and 7 (both createRenderer-then-resize) both failed
// with flat sky. THE FIX, done here:
//   1. boot() sets the canvas size FIRST, THEN createRenderer.
//   2. The resize handler re-creates the renderer after every
//      canvas resize, because every resize kills the context.
// A headless regression test proves the order (see
// /tmp/test-render7.mjs): it FAILS on the old order and PASSES
// on this one.

import { createGame, newGame, showToast, showDialogue, completionPercent } from './state.js';
import { buildCity, buildStaticBoxes, districtAt } from './world.js';
import { createRenderer, computeViewProj, BoxBatch, boxVisible } from './render.js';
import { createCamera, updateCamera } from './shots.js';
import { createInput } from './input.js';
import { createWeather } from './weather.js';
import { createAudio } from './audio.js';
import { createHud, updateHud } from './hud.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { stepPlayer, tryEnterVehicle, exitVehicle, playerBoxes } from './player.js';
import { spawnVehicles, stepPlayerCar, stepTraffic, stepCarCollisions, vehicleBoxes } from './vehicles.js';
import { spawnPeds, stepPeds, pedBoxes } from './pedestrians.js';
import { spawnPolice, stepPolice, commitCrime, respawnAfterBusted } from './police.js';
import { stepPickups, shoot, punch, throwBomb, weaponName } from './combat.js';
import { startChapter, stepMissions, nextChapter } from './missions.js';
import { spawnGangs, stepGangs, gangBoxes } from './gangs.js';
import { spawnLiving, stepLiving, tryTrain, tryElevator, tryPetDog, livingBoxes } from './living.js';
import { spawnFireService, stepFires, sprayFire, fireBoxes } from './fire.js';
import { tryFoodShop, buyFood } from './food.js';
import { tryDate, dateAte, maybeMayaCall, mayaBoxes } from './dating.js';
import { spawnCats, stepCats, tryCat, catBoxes } from './cats.js';
import { tryOutfitShop, cycleOutfit, buyOutfit } from './outfit.js';
import { spawnTraining, stepTraining, tryRange, trySwim, trySlalom, trainingBoxes, rangeHit } from './training.js';
import { stepEvents, eventBoxes } from './events.js';
import { spawnActivities, stepActivities, tryFish, tryVending, tryAtm, activityBoxes } from './activities.js';
import { tryInteriorDoor, tryInteriorCounter, stepInteriors, interiorBoxes, isInside } from './interiors.js';
import { tryGarage, takeOutCar, repaintCar } from './garage.js';
import { togglePhone, phoneTab, callContact, notifyMessage } from './phone.js';
import { stepTaxiCall, stepTaxiFare, startTaxiFare } from './taxi.js';
import { loadGlb, pushGlbToBatch } from './gltf.js';
import { TUNE, dist } from './config.js';

// ---------- dynamic boxes ----------

// Collect every moving thing into `out` (box specs). The
// round-7 rebuild kept the neon/cloud/wave data but DROPPED
// these draw calls — they are restored here and MUST stay:
// neon signs (~42), clouds (10), ocean wave crests (12) and sun
// glints are drawn every frame, culled by distance.
export function collectDynamicBoxes(game, out) {
  const p = game.player;
  const cam = game.camera;
  const sample = game.weatherObj ? game.weatherObj.sample() : { neon: 1, sky: [0.55, 0.78, 0.95] };
  const neonBoost = Math.min(1.4, sample.neon);
  const push = (box) => {
    if (out.length >= TUNE.batchCap) return;
    out.push(box);
  };
  const near = (x, z, d) => boxVisible(cam, x, 0, z, d);

  // Neon signs: dynamic, culled at 220 m, colour x boost (clamped 1.4).
  for (const n of game.city.neon) {
    if (!near(n.x, n.z, 220)) continue;
    push({
      x: n.x, y: n.y, z: n.z, w: n.w, h: 1.1, d: 0.4,
      c: [Math.min(1.4, n.c[0] * neonBoost), Math.min(1.4, n.c[1] * neonBoost), Math.min(1.4, n.c[2] * neonBoost)],
    });
  }
  // Ocean wave crests: drift + bob with game time.
  for (const wv of game.city.waves) {
    if (!near(wv.x, wv.z, 200)) continue;
    const bob = Math.sin(game.time * 1.2 + wv.phase) * 0.3;
    push({ x: wv.x + Math.sin(game.time * 0.3 + wv.phase) * 2, y: 0.1 + bob, z: wv.z, w: 6, h: 0.4, d: 1.2, c: [0.7, 0.9, 1.0] });
  }
  // Sun glints: 4 bright patches drifting over the western water.
  for (let i = 0; i < 4; i++) {
    const gx = -360 + ((game.time * 2 + i * 40) % 60);
    const gz = -200 + i * 130;
    push({ x: gx, y: 0.15, z: gz, w: 5, h: 0.2, d: 5, c: [1.4, 1.2, 0.7] });
  }
  // Rain drops (visible when raining).
  if (game.rain > 0.2) {
    for (let i = 0; i < 40; i++) {
      const rx = p.x + ((i * 37 + game.time * 40) % 80) - 40;
      const rz = p.z + ((i * 53) % 80) - 40;
      push({ x: rx, y: 8 - ((game.time * 30 + i * 7) % 8), z: rz, w: 0.15, h: 1.2, d: 0.15, c: [0.7, 0.8, 0.95] });
    }
  }
  // Player (on foot, not inside, not on the train/elevator).
  if (!p.inCar && !p.inside && !p.onTrain && !p.onElevator) {
    playerBoxes(game, out, 0);
  }
  // Vehicles (parked + traffic + cop cars + roadblocks).
  for (const v of game.vehicles) {
    if (v === p.inCar || near(v.x, v.z, 160)) vehicleBoxes(game, v, out);
  }
  for (const car of game.copCars) {
    if (near(car.x, car.z, 160)) {
      vehicleBoxes(game, { ...car, kind: 'cop', colour: [0.15, 0.2, 0.35], name: 'Police Cruiser' }, out);
    }
  }
  for (const rb of game.roadblocks) {
    push({ x: rb.x, y: 0.35, z: rb.z, w: 2, h: 1.3, d: 4.4, c: [0.15, 0.2, 0.35] });
  }
  // Helicopter.
  if (game.heli) {
    const h = game.heli;
    push({ x: h.x, y: h.y, z: h.z, w: 6, h: 1.6, d: 2.4, c: [0.2, 0.25, 0.35] });
    push({ x: h.x, y: h.y + 1.2, z: h.z, w: 8, h: 0.2, d: 0.5, c: [0.3, 0.3, 0.35] });
    if (h.spotlight) {
      push({ x: h.x, y: 0.1, z: h.z, w: 6, h: 0.2, d: 6, c: [1.4, 1.4, 1.0] });
    }
  }
  // Peds, gang members, foot cops.
  for (const ped of game.peds) if (near(ped.x, ped.z, 120)) pedBoxes(game, ped, out);
  for (const gm of game.gangMembers) if (near(gm.x, gm.z, 120)) gangBoxes(game, gm, out);
  for (const cop of game.cops) {
    if (!near(cop.x, cop.z, 120)) continue;
    push({ x: cop.x, y: 0.85, z: cop.z, w: 0.8, h: 0.8, d: 0.45, c: [0.15, 0.2, 0.4] });
    push({ x: cop.x, y: 1.65, z: cop.z, w: 0.58, h: 0.55, d: 0.5, c: [0.9, 0.75, 0.6] });
    push({ x: cop.x, y: 1.95, z: cop.z, w: 0.6, h: 0.25, d: 0.55, c: [0.15, 0.2, 0.4] });
  }
  // Ground pickups (cash glints gold, health green, armour blue).
  for (const pk of game.pickups) {
    if (!near(pk.x, pk.z, 120)) continue;
    const col = pk.kind === 'cash' ? [1.3, 1.1, 0.2] : pk.kind === 'health' ? [0.3, 1.2, 0.3] : pk.kind === 'armour' ? [0.3, 0.6, 1.3] : [1.2, 0.8, 0.2];
    push({ x: pk.x, y: 0.2 + Math.sin(game.time * 3 + pk.x) * 0.15, z: pk.z, w: 0.8, h: 0.5, d: 0.8, c: col });
  }
  // Ambient life: clouds (tinted by sky), dogs, birds, fish,
  // train, elevator car.
  livingBoxes(game, out, sample.sky);
  // Fires, cats, Maya, events, training, activities, interiors.
  fireBoxes(game, out);
  catBoxes(game, out);
  mayaBoxes(game, out);
  eventBoxes(game, out);
  trainingBoxes(game, out);
  activityBoxes(game, out);
  interiorBoxes(game, out);
  // Food shop signs.
  for (const s of game.city.shops) {
    if (!near(s.x, s.z, 160)) continue;
    push({ x: s.x, y: 5.2, z: s.z - 1, w: 8, h: 1.4, d: 0.5, c: [1.2, 1.2, 1.2] });
  }
  return out;
}

// ---------- one frame ----------

export function renderFrame(game) {
  const r = game.renderer;
  if (!r) return;
  const canvas = r.canvas;
  const sample = game.weatherObj.sample();
  const vp = computeViewProj(game.camera, canvas.width / Math.max(1, canvas.height));
  r.setCamera(vp, sample.fog, 0.55, sample.fogFar);
  // THE FRAME RULE: beginFrame is the only clear, once per frame.
  r.beginFrame(sample.sky);
  r.drawBatch(r.staticBatch);
  r.drawBatch(r.glbBatch);
  const dyn = [];
  collectDynamicBoxes(game, dyn);
  const b = r.batch;
  b.reset();
  for (const box of dyn) b.pushBox(box.x, box.y, box.z, box.w, box.h, box.d, box.c, box.tile || 'plain');
  r.drawBatch(b);
}

// ---------- game step ----------

export function stepGame(game, dt, input) {
  game.time += dt;
  game.flags.bombTimer = Math.max(0, (game.flags.bombTimer || 0) - dt);
  game.flags.bombJustWentOff = game.flags.bombTimer > 0;
  // Toast + dialogue timers.
  if (game.toastTimer > 0) game.toastTimer -= dt;
  if (game.dialogue && game.dialogue.t > 0) game.dialogue.t -= dt;
  game.weatherObj.update(dt);
  // The world keeps running while the phone is open (round-5
  // flaky test: peds must keep walking with the phone open).
  const simModes = ['play', 'phone', 'card', 'passed'];
  if (simModes.includes(game.mode)) {
    stepPlayer(game, dt, game.mode === 'play' ? input : null);
    if (game.player.inCar) stepPlayerCar(game, dt, game.mode === 'play' ? input : null);
    stepTraffic(game, dt);
    stepPeds(game, dt);
    stepGangs(game, dt);
    stepPolice(game, dt);
    stepMissions(game, dt);
    stepLiving(game, dt);
    stepCats(game, dt); // cats wander (and carried cats follow the player)
    stepFires(game, dt);
    stepTraining(game, dt);
    stepEvents(game, dt);
    stepActivities(game, dt);
    stepInteriors(game, dt);
    stepPickups(game, dt);
    stepCarCollisions(game);
    stepTaxiCall(game, dt);
    stepTaxiFare(game, dt);
    maybeMayaCall(game);
    // Fire truck spraying (hold F in the truck).
    if (game.mode === 'play' && input && input.downKey('KeyF') && game.player.inCar && game.player.inCar.kind === 'firetruck') {
      sprayFire(game, dt);
    }
  }
  // Camera follows the player (or the car) in every mode.
  const target = game.player.inCar || game.player;
  updateCamera(game.camera, target, dt, game.mode === 'play' ? input : null);
  if (game.audio) game.audio.update(dt);
  if (game.hud) updateHud(game.hud, game);
}

// ---------- input routing (tap actions) ----------

export function handleTaps(game, input) {
  if (!input) return;
  const p = game.player;
  // Modal open: number keys choose, Enter confirms, Esc closes.
  if (game.modal) {
    if (input.pressedKey('Escape')) {
      game.modal = null;
      return;
    }
    if (game.modal.kind === 'food') {
      let bought = false;
      if (input.pressedKey('Digit1')) bought = buyFood(game, 0);
      else if (input.pressedKey('Digit2')) bought = buyFood(game, 1);
      else if (input.pressedKey('Digit3')) bought = buyFood(game, 2);
      if (bought) dateAte(game);
    } else if (game.modal.kind === 'outfit') {
      if (input.pressedKey('Digit1')) cycleOutfit(game, 0);
      else if (input.pressedKey('Digit2')) cycleOutfit(game, 1);
      else if (input.pressedKey('Digit3')) cycleOutfit(game, 2);
      else if (input.pressedKey('Digit4')) cycleOutfit(game, 3);
      else if (input.pressedKey('Enter')) buyOutfit(game);
    } else if (game.modal.kind === 'garage') {
      if (input.pressedKey('Digit0')) repaintCar(game);
      for (let i = 1; i <= 9; i++) {
        if (input.pressedKey('Digit' + i)) takeOutCar(game, i - 1);
      }
    }
    return;
  }
  // Global keys.
  if (input.pressedKey('KeyM')) {
    game.audio && game.audio.setMuted(!game.muted);
  }
  if (input.pressedKey('KeyR') && game.mode === 'play' && game.audio) {
    showToast(game, 'Radio: ' + game.audio.nextStation());
  }
  // Mode-specific keys.
  if (game.mode === 'menu') {
    if (input.pressedKey('Enter')) {
      newGame(game);
      startChapter(game, 1);
    }
    return;
  }
  if (game.mode === 'card') {
    if (input.pressedKey('Enter') || input.pressedKey('Escape')) {
      game.mode = 'play';
      game.card = null;
    }
    return;
  }
  if (game.mode === 'passed') {
    if (input.pressedKey('Enter') || input.pressedKey('Escape')) nextChapter(game);
    return;
  }
  if (game.mode === 'busted' || game.mode === 'wasted') {
    if (input.pressedKey('Enter')) respawnAfterBusted(game);
    return;
  }
  if (game.mode === 'pause') {
    if (input.pressedKey('Escape') || input.pressedKey('KeyP') || input.pressedKey('Enter')) {
      game.mode = 'play';
      game.menu = null;
    }
    return;
  }
  if (game.mode === 'phone') {
    if (input.pressedKey('Tab') || input.pressedKey('Escape')) togglePhone(game);
    else if (input.pressedKey('Digit1')) phoneTab(game, 'contacts');
    else if (input.pressedKey('Digit2')) phoneTab(game, 'messages');
    else if (input.pressedKey('Digit3')) phoneTab(game, 'map');
    else if (input.pressedKey('Digit4')) callContact(game, '4');
    else if (input.pressedKey('Digit5')) callContact(game, '5');
    else if (input.pressedKey('Digit6')) callContact(game, '6');
    return;
  }
  if (game.mode !== 'play') return;
  // Play mode.
  if (input.pressedKey('Escape') || input.pressedKey('KeyP')) {
    game.mode = 'pause';
    game.menu = 'pause';
    saveGame(game);
    return;
  }
  if (input.pressedKey('Tab')) {
    togglePhone(game);
    return;
  }
  if (input.pressedKey('Digit1')) p.weapon = 0;
  if (input.pressedKey('Digit2') && game.unlocks.smgUnlocked) p.weapon = 1;
  if (input.pressedKey('Digit3') && game.unlocks.shotgunUnlocked) p.weapon = 2;
  if (input.pressedKey('KeyG')) {
    if (throwBomb(game)) game.flags.bombTimer = 2;
  }
  if (input.pressedKey('KeyF') && !p.inCar) punch(game);
  if (input.mouse.clicked && !p.inCar && !p.inside) {
    // Shoot toward the screen centre: aim at the point the
    // camera looks at, 30 m ahead of the player.
    const tx = p.x + Math.sin(p.heading) * 30;
    const tz = p.z + Math.cos(p.heading) * 30;
    if (shoot(game, tx, tz)) rangeHit(game, tx, tz);
  }
  if (input.pressedKey('KeyE')) handleInteract(game);
}

function handleInteract(game) {
  const p = game.player;
  // The garage first: E at the garage door (in the car) stores the
  // car and opens the garage — it must NOT fall through to the
  // exit-car branch below, or the garage modal is unreachable
  // via E (round-8 QA: E only ever exited the car at the door).
  if (p.inCar && tryGarage(game)) return;
  // Exit the car first.
  if (p.inCar) {
    exitVehicle(game);
    return;
  }
  // Interiors: door in/out, then counter.
  if (p.inside) {
    if (tryInteriorCounter(game)) return;
    tryInteriorDoor(game);
    return;
  }
  if (tryInteriorDoor(game)) return;
  // Vehicles.
  const entered = tryEnterVehicle(game);
  if (entered) {
    // Boarding a taxi starts the fare job.
    if (entered.kind === 'taxi' || entered.kind === 'taxiCalled') startTaxiFare(game);
    return;
  }
  // Shops + services (nearest first).
  if (tryFoodShop(game)) return;
  if (tryOutfitShop(game)) return;
  if (tryGarage(game)) return;
  if (tryTrain(game)) return;
  if (tryElevator(game)) return;
  if (tryCat(game)) return;
  if (tryPetDog(game)) return;
  if (tryFish(game)) return;
  if (tryVending(game)) return;
  if (tryAtm(game)) return;
  if (tryRange(game)) return;
  if (trySwim(game)) return;
  if (trySlalom(game)) return;
  if (tryDate(game)) return;
}

// ---------- boot ----------

// Boot the game in a browser (or a headless test env). `env`
// lets tests inject a fake document/window/canvas.
//
// ORDER MATTERS (play-test #6): the canvas is sized FIRST,
// then the renderer is created. Assigning canvas.width/height
// resets the WebGL context, so creating the renderer before
// sizing destroys it before the first frame.
export function boot(game, env = {}) {
  const doc = env.document || (typeof document !== 'undefined' ? document : null);
  const win = env.window || (typeof window !== 'undefined' ? window : null);
  if (!doc || !win) return null;
  const canvas = doc.getElementById('game-canvas');
  if (!canvas) return null;

  // 1. SIZE THE CANVAS FIRST.
  canvas.width = win.innerWidth;
  canvas.height = win.innerHeight;
  // 2. NOW create the renderer (shaders, buffers, atlas).
  game.renderer = createRenderer(canvas);
  if (game.renderer) game.renderer.setViewport(canvas.width, canvas.height);
  // 3. Resize re-creates the renderer: every canvas resize kills
  // the context again, so the program/buffers/textures must be
  // rebuilt, not just the viewport.
  const onResize = () => {
    canvas.width = win.innerWidth;
    canvas.height = win.innerHeight;
    game.renderer = createRenderer(canvas);
    if (game.renderer) game.renderer.setViewport(canvas.width, canvas.height);
  };
  win.addEventListener('resize', onResize);
  game._onResize = onResize;

  // World + systems.
  game.city = buildCity(1337);
  game.camera = createCamera();
  game.input = createInput();
  game.input.attach(canvas);
  game.weatherObj = createWeather(game);
  game.audio = createAudio(game);
  game.hud = createHud(game, doc);
  game.policeCommit = (type) => commitCrime(game, type);
  spawnVehicles(game);
  spawnPeds(game);
  spawnGangs(game);
  spawnLiving(game);
  spawnCats(game);
  spawnFireService(game);
  spawnTraining(game);
  spawnActivities(game);
  spawnPolice(game);
  if (game.renderer) buildStaticBoxes(game.city, game.renderer.staticBatch);
  // The GLB barrel: 3 red drums on the harbour dock. If the
  // model fails to load, procedural boxes take its place.
  loadGlb('assets/barrel.glb', (model) => {
    if (!game.renderer) return;
    if (model) {
      pushGlbToBatch(game.renderer.glbBatch, model, 60, 0, 320, 1, [0.85, 0.2, 0.15]);
      pushGlbToBatch(game.renderer.glbBatch, model, 64, 0, 322, 1, [0.85, 0.2, 0.15]);
      pushGlbToBatch(game.renderer.glbBatch, model, 62, 0, 326, 1, [0.85, 0.2, 0.15]);
    } else {
      game.flags.glbFallback = true;
    }
  });

  // Menu buttons (static HTML — the JS only wires clicks).
  const wire = (id, fn) => {
    const el = doc.getElementById(id);
    if (el && el.addEventListener) el.addEventListener('click', fn);
  };
  wire('btn-new', () => {
    game.audio && game.audio.ensure();
    newGame(game);
    startChapter(game, 1);
  });
  wire('btn-continue', () => {
    game.audio && game.audio.ensure();
    if (loadGame(game)) {
      game.mode = 'play';
      showToast(game, 'Welcome back to Solmar Bay');
    } else {
      newGame(game);
      startChapter(game, 1);
    }
  });
  wire('btn-mute', () => game.audio && game.audio.setMuted(!game.muted));

  // The loop.
  let last = 0;
  const loop = (t) => {
    const dt = Math.min(0.05, (t - last) / 1000 || 0.016);
    last = t;
    handleTaps(game, game.input);
    stepGame(game, dt, game.input);
    renderFrame(game);
    game.input.endFrame();
    if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(loop);
  };
  if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(loop);
  return game;
}

// Auto-boot when loaded as a module in a real page.
if (typeof document !== 'undefined' && document.getElementById && document.getElementById('game-canvas')) {
  const game = createGame();
  boot(game);
  // Error overlay: surface real errors instead of failing silent.
  window.addEventListener('error', (e) => {
    const el = document.getElementById('hud-err');
    if (el) {
      el.style.display = 'block';
      el.textContent = 'Error: ' + (e.message || e.error);
    }
  });
}
