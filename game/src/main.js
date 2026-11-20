// Solmar Bay — entrypoint: boot, input dispatch, game loop, render (rebuild #13).
//
// The three round-12 play-test fixes live here:
//   (a) SELF-BOOT: the page loads only main.js; a guarded self-boot at
//       the bottom calls boot() when the game canvas exists. The guard
//       keeps plain-Node imports from auto-booting.
//   (b) KEYBOARD ON THE WINDOW: input.attach() puts keydown/keyup on
//       the window (a <canvas> is not focusable, so canvas listeners
//       never see real keyboard input); mouse stays on the canvas.
//   (c) WASTED: gang damage to 0 HP sets the WASTED card, the card
//       overlay shows in wasted/busted too, and a 5 s spawn grace
//       timer (set on new game and on respawn) shields the player.
//   (d) PAUSE: Enter/Escape/KeyP and the Resume button resume; the
//       pause button stays clickable above the overlay (z-index 19
//       in index.html); pausing saves the game.
import { createGame, newGame, showToast } from './state.js';
import { buildCity, buildStaticBoxes } from './world.js';
import { createCamera, updateCamera, computeViewProj } from './shots.js';
import { createWeather, sampleAt } from './weather.js';
import { createInput } from './input.js';
import { createRenderer, BoxBatch, batchReset, batchTris, pushBox } from './render.js';
import { createAudio } from './audio.js';
import { createHud, updateHud, drawMinimap } from './hud.js';
import { parseGlb, pushGlbToBatch, pushFallbackBarrels } from './gltf.js';
import { tileUV } from './texture.js';
import { stepPlayer, tryEnterVehicle, exitVehicle, playerBoxes } from './player.js';
import { spawnVehicles, stepTraffic, stepPlayerCar, vehicleBoxes, makeVehicle } from './vehicles.js';
import { spawnPeds, stepPeds, pedBoxes } from './pedestrians.js';
import { spawnPolice, stepPolice, stepWanted } from './police.js';
import { shoot, punch, throwBomb, stepPickups } from './combat.js';
import { startChapter, nextChapter, stepMissions, stepSideJob } from './missions.js';
import { spawnGangs, stepGangs, gangBoxes } from './gangs.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { togglePhone, callContact, CONTACTS } from './phone.js';
import { tryGarage, takeOutCar } from './garage.js';
import { spawnLiving, stepLiving, livingBoxes, tryPetDog, tryElevator, tryTrain } from './living.js';
import { spawnActivities, stepActivities, tryFish, tryVending, tryAtm, atmAction } from './activities.js';
import { tryInteriorDoor, tryInteriorCounter, stepInteriors, interiorBoxes } from './interiors.js';
import { tryFoodShop, buyFood, foodSignBoxes } from './food.js';
import { tryDate, dateAte, mayaBoxes } from './dating.js';
import { spawnCats, stepCats, tryCat, catBoxes } from './cats.js';
import { tryOutfitShop, cycleOutfit, buyOutfit } from './outfit.js';
import { spawnTraining, stepTraining, tryRange, trySwim, trySlalom, trainingBoxes } from './training.js';
import { stepEvents, stepEventActive, eventBoxes } from './events.js';
import { spawnFireService, stepFires, sprayFire, fireBoxes } from './fire.js';
import { stepTaxiCall, startTaxiFare, stepTaxiFare } from './taxi.js';
import { SPAWNS } from './config.js';

const BARREL_SPOTS = [[8, 28], [10, 28], [9, 30]];
const BARREL_COL = [0.55, 0.4, 0.25];

// Rebuild the renderer's static + GLB batches from the game state.
// Deterministic: the same city always bakes byte-identical batches,
// so a resize re-creates the renderer without changing the world.
function bakeBatches(g, renderer) {
  batchReset(renderer.staticBatch);
  buildStaticBoxes(g.city, renderer.staticBatch);
  batchReset(renderer.glbBatch);
  const uv = tileUV('plain');
  if (g._glbModel) {
    for (const [x, z] of BARREL_SPOTS) {
      pushGlbToBatch(renderer.glbBatch, g._glbModel, x, 0, z, 1, BARREL_COL, uv);
    }
  } else {
    pushFallbackBarrels(renderer.glbBatch, BARREL_SPOTS.map(([x, z]) => [x, 1, z]), BARREL_COL, uv);
  }
}

// The real barrel model is fetched after boot; until it arrives (or
// if the fetch fails, as in Node) the procedural fallback barrels
// stay in the GLB batch.
function loadBarrelGlb(g) {
  if (typeof fetch === 'undefined') return;
  let p;
  try {
    p = fetch('game/assets/barrel.glb');
  } catch (e) {
    return;
  }
  if (!p || typeof p.then !== 'function') return;
  p.then((r) => {
    if (!r.ok) throw new Error('no barrel.glb');
    return r.arrayBuffer();
  }).then((buf) => {
    const model = parseGlb(new Uint8Array(buf));
    if (!model) return;
    g._glbModel = model;
    if (g.renderer) bakeBatches(g, g.renderer);
  }).catch(() => { /* fallback barrels stay */ });
}

export function boot(canvas, doc) {
  const g = createGame();
  g.city = buildCity();
  g.camera = createCamera();
  g.input = createInput();
  g.audio = createAudio();
  g.weatherObj = createWeather(g);
  g.hud = createHud(doc);
  g._canvas = canvas;
  g._doc = doc;
  g._glbModel = null;
  // Size the canvas BEFORE creating the renderer: assigning
  // canvas.width/height kills the WebGL context, so a renderer
  // made first would be dead on arrival (boot-order regression).
  const w = (typeof window !== 'undefined' && window.innerWidth) || canvas.width || 1280;
  const h = (typeof window !== 'undefined' && window.innerHeight) || canvas.height || 720;
  canvas.width = w;
  canvas.height = h;
  g.renderer = createRenderer(canvas, doc);
  if (g.renderer) {
    g.renderer.rebuildStaticBatches = () => bakeBatches(g, g.renderer);
    bakeBatches(g, g.renderer);
  }
  spawnVehicles(g);
  spawnPeds(g);
  spawnPolice(g);
  spawnGangs(g);
  spawnLiving(g);
  spawnFireService(g);
  spawnCats(g);
  spawnTraining(g);
  spawnActivities(g);
  // Keyboard listeners go on the window (see input.js); mouse on
  // the canvas. In Node there is no window and attach() is a no-op
  // except for building the handlers (injectTap still works).
  g.input.attach(canvas);
  // Menu / pause buttons (real listeners; headless docs record them).
  if (doc) {
    const btnNew = doc.getElementById('btn-new');
    if (btnNew && btnNew.addEventListener) {
      btnNew.addEventListener('click', () => { newGame(g); g.menu = null; startChapter(g, 1); });
    }
    const btnContinue = doc.getElementById('btn-continue');
    if (btnContinue && btnContinue.addEventListener) {
      btnContinue.addEventListener('click', () => {
        if (hasSave()) { loadGame(g); g.menu = null; g.mode = 'play'; }
      });
    }
    const btnResume = doc.getElementById('btn-resume');
    if (btnResume && btnResume.addEventListener) {
      btnResume.addEventListener('click', () => { if (g.mode === 'pause') { g.mode = 'play'; g.menu = null; } });
    }
    const btnPause = doc.getElementById('btn-pause');
    if (btnPause && btnPause.addEventListener) {
      btnPause.addEventListener('click', () => {
        if (g.mode === 'play') { saveGame(g); g.mode = 'pause'; g.menu = 'pause'; }
        else if (g.mode === 'pause') { g.mode = 'play'; g.menu = null; }
      });
    }
  }
  // Resize: the old context dies when the canvas is resized, so a
  // fresh renderer is created and the batches are re-baked
  // identically (static + GLB byte-equal after resize).
  g._onResize = () => {
    if (typeof window === 'undefined') return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    g.renderer = createRenderer(canvas, doc);
    if (!g.renderer) return;
    g.renderer.rebuildStaticBatches = () => bakeBatches(g, g.renderer);
    bakeBatches(g, g.renderer);
  };
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('resize', g._onResize);
  }
  loadBarrelGlb(g);
  g.mode = 'menu';
  updateHud(g, g.hud);
  // Browser game loop. Node has no requestAnimationFrame, so the
  // headless suites drive handleTaps/stepGame/renderFrame directly.
  if (typeof requestAnimationFrame !== 'undefined') {
    let last = 0;
    const loop = (t) => {
      const dt = Math.min(0.05, last ? (t - last) / 1000 : 0.016);
      last = t;
      handleTaps(g, g.input);
      stepGame(g, dt, g.input);
      renderFrame(g);
      g.input.endFrame();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  return g;
}

// ---------- interactions (E key) ----------
export function handleInteract(g) {
  const p = g.player;
  if (p.inCar) {
    // At the garage door, E stores the car first (round-8 fix) —
    // it must not just exit the car and leave it on the street.
    if (tryGarage(g)) return true;
    exitVehicle(g);
    return true;
  }
  const v = tryEnterVehicle(g);
  if (v) {
    if (v === g._taxiCab) startTaxiFare(g);
    return true;
  }
  if (tryGarage(g)) return true;
  if (tryInteriorDoor(g)) return true;
  if (tryInteriorCounter(g)) return true;
  if (tryFoodShop(g)) return true;
  if (tryOutfitShop(g)) return true;
  if (tryDate(g)) return true;
  if (tryCat(g)) return true;
  if (tryPetDog(g)) return true;
  if (tryVending(g)) return true;
  if (tryAtm(g)) return true;
  if (tryElevator(g)) return true;
  if (tryTrain(g)) return true;
  if (tryFish(g)) return true;
  if (tryRange(g)) return true;
  if (trySwim(g)) return true;
  if (trySlalom(g)) return true;
  return false;
}

function toggleMute(g) {
  g.muted = !g.muted;
  if (g.audio) g.audio.setMuted(g.muted);
}

function respawnAfterWasted(g) {
  const fine = Math.floor(g.cash * 0.2);
  g.cash -= fine;
  g.wanted = 0;
  g.health = 100;
  if (g.player.inCar) {
    g.player.inCar.driver = null;
    g.player.inCar = null;
  }
  g.player.x = SPAWNS.hospital.x;
  g.player.z = SPAWNS.hospital.z;
  g._spawnGrace = 5;
  g.mode = 'play';
  g.card = null;
}

// ---------- tap / key dispatch ----------
export function handleTaps(g, input) {
  const inp = input || g.input;
  if (!inp) return;
  const pressed = inp.pressed;
  const has = (code) => pressed.has(code);

  if (g.mode === 'menu') {
    if (has('Enter') || has('Space')) {
      newGame(g);
      g.menu = null;
      startChapter(g, 1);
    } else if (has('KeyM')) {
      toggleMute(g);
    }
    return;
  }
  if (g.mode === 'card') {
    if (has('Enter') || has('Space')) g.mode = 'play';
    return;
  }
  if (g.mode === 'passed') {
    if (has('Enter') || has('Space')) nextChapter(g);
    return;
  }
  if (g.mode === 'wasted') {
    if (has('Enter') || has('Space')) respawnAfterWasted(g);
    return;
  }
  if (g.mode === 'busted') {
    if (has('Enter') || has('Space')) {
      // bustPlayer() already applied the fine + hospital respawn;
      // only apply them here when the busted screen was reached
      // without it (so the fine is never charged twice).
      if (!g._bustedApplied) {
        const fine = Math.floor(g.cash * 0.2);
        g.cash -= fine;
        g.wanted = 0;
        g.health = 100;
        if (g.player.inCar) {
          g.player.inCar.driver = null;
          g.player.inCar = null;
        }
        g.player.x = SPAWNS.hospital.x;
        g.player.z = SPAWNS.hospital.z;
      }
      g._bustedApplied = false;
      g._spawnGrace = 5;
      g.mode = 'play';
      g.card = null;
    }
    return;
  }
  if (g.mode === 'pause') {
    if (has('Enter') || has('Escape') || has('KeyP')) {
      g.mode = 'play';
      g.menu = null;
    }
    return;
  }
  if (g.mode === 'phone') {
    if (has('Tab') || has('Escape')) togglePhone(g);
    else {
      for (let i = 0; i < 4; i++) {
        if (has('Digit' + (i + 1))) callContact(g, CONTACTS[i].id);
      }
    }
    return;
  }
  if (g.mode !== 'play') return;

  // A modal eats the number keys (and Escape closes it).
  if (g.modal) {
    if (has('Escape')) { g.modal = null; return; }
    const kind = g.modal.kind;
    for (let i = 0; i < 4; i++) {
      if (!has('Digit' + (i + 1))) continue;
      if (kind === 'food') buyFood(g, i);
      else if (kind === 'outfit') cycleOutfit(g, i);
      else if (kind === 'atm') atmAction(g, i);
      else if (kind === 'garage') takeOutCar(g, i);
    }
    if (has('Enter') && kind === 'outfit') buyOutfit(g);
    return;
  }

  if (has('Escape') || has('KeyP')) {
    saveGame(g);
    g.mode = 'pause';
    g.menu = 'pause';
    return;
  }
  if (has('Tab')) { togglePhone(g); return; }
  if (has('KeyR')) g.station = (g.station + 1) % 4;
  if (has('KeyM')) toggleMute(g);
  if (has('Digit1')) g.player.weapon = 0;
  if (has('Digit2') && g.unlocks.smgUnlocked) g.player.weapon = 1;
  if (has('Digit3') && g.unlocks.shotgunUnlocked) g.player.weapon = 2;
  if (has('Digit4')) g._taxiRequested = true;
  if (has('KeyE')) handleInteract(g);
  if (has('KeyF')) punch(g);
  if (has('KeyG')) throwBomb(g);
  if (has('KeyH')) sprayFire(g, 0.5);
  if (inp.mouse && inp.mouse.clicked) {
    // Click to shoot: fire 40 m ahead along the camera's forward.
    const cam = g.camera;
    if (cam) {
      const fx = cam.tx - cam.x, fz = cam.tz - cam.z;
      const fl = Math.hypot(fx, fz) || 1;
      shoot(g, g.player.x + (fx / fl) * 40, g.player.z + (fz / fl) * 40);
    }
  }
}

// ---------- simulation step ----------
export function stepGame(g, dt, input) {
  g.time += dt;
  // The world freezes outside play mode (pause, menu, cards,
  // phone); only the master clock keeps ticking.
  if (g.mode !== 'play') return;
  const inp = input || g.input;

  if (g.weatherObj) g.weatherObj.step(dt);
  else {
    g.clock += dt / 30;
    if (g.clock >= 24) { g.clock -= 24; g.day += 1; }
  }
  if (g._spawnGrace > 0) g._spawnGrace = Math.max(0, g._spawnGrace - dt);
  if (g.toastTimer > 0) {
    g.toastTimer -= dt;
    if (g.toastTimer <= 0) g.toast = '';
  }
  if (g.dialogue) {
    g.dialogue.t -= dt;
    if (g.dialogue.t <= 0) g.dialogue = null;
  }
  // Radio sequencer: one step every 0.25 s, 32 steps per song.
  g.songTimer += dt;
  while (g.songTimer >= 0.25) {
    g.songTimer -= 0.25;
    g.songStep += 1;
    if (g.songStep >= 32) {
      g.songStep = 0;
      g.song = (g.song + 1) % 2;
    }
    if (g.audio) g.audio.radioStep(g.station, g.song, g.songStep);
  }
  // Respect unlocks (fire once each).
  if (g.respect >= 100 && !g.unlocks.smgUnlocked) {
    g.unlocks.smgUnlocked = true;
    showToast(g, 'Unlocked: SMG (press 2)');
  }
  if (g.respect >= 250 && !g.unlocks.shotgunUnlocked) {
    g.unlocks.shotgunUnlocked = true;
    showToast(g, 'Unlocked: Shotgun (press 3)');
  }
  if (g.respect >= 500 && !g.unlocks.sportsCarSpawned) {
    g.unlocks.sportsCarSpawned = true;
    const comet = makeVehicle('car', SPAWNS.garageDoor.x + 6, SPAWNS.garageDoor.z, 0, [0.9, 0.1, 0.2], 'Solmar Comet');
    comet.owned = true;
    g.vehicles.push(comet);
    showToast(g, 'Unlocked: Solmar Comet at the garage');
  }

  stepPlayer(g, dt, inp);
  stepPlayerCar(g, dt, inp);
  stepTraffic(g, dt);
  stepPeds(g, dt);
  stepWanted(g, dt);
  stepPolice(g, dt);
  stepGangs(g, dt);
  stepLiving(g, dt);
  stepCats(g, dt);
  stepFires(g, dt);
  stepEvents(g, dt);
  stepEventActive(g, dt);
  stepActivities(g, dt);
  stepTraining(g, dt);
  stepMissions(g, dt);
  stepSideJob(g, dt);
  stepPickups(g, dt);
  stepTaxiCall(g, dt);
  stepTaxiFare(g, dt);
  dateAte(g, dt);
  if (inp && inp.down && inp.down.has('KeyH')) sprayFire(g, dt);
  if (g.camera) updateCamera(g.camera, { x: g.player.x, y: 0, z: g.player.z }, dt, inp);
}

// ---------- dynamic batch ----------
function copBoxes(g, c, b) {
  const plain = [0, 0, 1, 1];
  const navy = [0.1, 0.15, 0.5];
  const skin = [0.85, 0.65, 0.5];
  let n = 0;
  const box = (x, y, z, w, h, d, col) => { pushBox(b, x, y, z, w, h, d, col, plain); n++; };
  box(c.x - 0.14, 0.2, c.z, 0.2, 0.6, 0.2, navy);
  box(c.x + 0.14, 0.2, c.z, 0.2, 0.6, 0.2, navy);
  box(c.x, 0.8, c.z, 0.6, 0.6, 0.3, navy);
  box(c.x - 0.42, 0.8, c.z, 0.18, 0.55, 0.18, navy);
  box(c.x + 0.42, 0.8, c.z, 0.18, 0.55, 0.18, navy);
  box(c.x, 1.4, c.z, 0.36, 0.36, 0.36, skin);
  box(c.x, 1.72, c.z, 0.38, 0.16, 0.38, navy);
  box(c.x, 0, c.z, 0.55, 0.2, 0.3, [0.1, 0.1, 0.1]);
  return n;
}

export function collectDynamicBoxes(g, b, cam) {
  const c = cam || g.camera;
  const plain = [0, 0, 1, 1];
  if (!g.player.inCar) playerBoxes(g, b, c);
  for (const v of g.vehicles) vehicleBoxes(g, v, b, c);
  for (const v of g.traffic) vehicleBoxes(g, v, b, c);
  for (const v of g.copCars) vehicleBoxes(g, v, b, c);
  for (const p of g.peds) pedBoxes(g, p, b, c);
  for (const m of g.gangMembers) gangBoxes(g, m, b, c);
  for (const cop of g.cops) copBoxes(g, cop, b);
  for (const pk of g.pickups) {
    pushBox(b, pk.x, 0.3, pk.z, 0.6, 0.2, 0.6, [0.2, 0.9, 0.3], plain);
  }
  for (const rb of g.roadblocks) {
    pushBox(b, rb.x, 0.6, rb.z, 4, 1.2, 0.5, [0.9, 0.5, 0.1], plain);
  }
  if (g.heli) {
    pushBox(b, g.heli.x, g.heli.y, g.heli.z, 3, 1.5, 5, [0.1, 0.15, 0.5], plain);
    pushBox(b, g.heli.x, g.heli.y + 1, g.heli.z, 8, 0.15, 0.6, [0.2, 0.2, 0.2], plain);
  }
  mayaBoxes(g, b, c);
  catBoxes(g, b, c);
  livingBoxes(g, b, c);
  fireBoxes(g, b, c);
  trainingBoxes(g, b, c);
  eventBoxes(g, b, c);
  interiorBoxes(g, b, c);
  foodSignBoxes(g, b, c);
  return b;
}

// ---------- frame ----------
// renderFrame draws the camera AS IT IS. The camera is advanced by
// stepGame (the browser loop calls stepGame, then renderFrame); a
// frame must not move it, or a headless render would snap the
// camera onto the traffic light at the (0,0) intersection and the
// near geometry would survive even the old NDC-depth fog model.
export function renderFrame(g) {
  const r = g.renderer;
  if (!r || !r.gl) return;
  const cam = g.camera;
  const s = sampleAt(g.clock);
  let fogFar = s.fogFar;
  if (g.weather === 'rain') fogFar = Math.min(fogFar, 200);
  if (g.weather === 'fog') fogFar = Math.min(fogFar, 120);
  const fogRange = [60, fogFar];
  const sky = s.sky;
  const w = g._canvas ? g._canvas.width : 1280;
  const h = g._canvas ? g._canvas.height : 720;
  const vp = computeViewProj(cam, w, h);
  const camPos = cam ? [cam.x, cam.y, cam.z] : [0, 0, 0];
  r.beginFrame(sky); // the single clear of the frame
  r.drawBatch(r.staticBatch, vp, camPos, fogRange, sky);
  r.drawBatch(r.glbBatch, vp, camPos, fogRange, sky);
  batchReset(r.dynBatch);
  collectDynamicBoxes(g, r.dynBatch, cam);
  g._lastDynTris = batchTris(r.dynBatch);
  r.drawBatch(r.dynBatch, vp, camPos, fogRange, sky);
  if (g.hud) {
    updateHud(g, g.hud);
    drawMinimap(g, g.hud);
  }
}

// ---------- self-boot (browser only) ----------
// The page loads only main.js; nothing else calls boot(). The guard
// keeps plain-Node imports (tests, main.ts) from auto-booting.
if (typeof document !== 'undefined') {
  const canvas = document.getElementById('game-canvas');
  if (canvas) boot(canvas, document);
}
