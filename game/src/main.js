// Solmar Bay — game loop, wiring, menus, interaction dispatcher.
//
// createGame() assembles every subsystem (pure — no DOM at import
// time, so headless tests can drive it). stepGame(game, dt) runs one
// frame. boot(canvas) is the browser entry: renderer, input, HUD
// DOM, requestAnimationFrame.
//
// E-interaction priority (on foot, phone closed): interior counter /
// door → carried cat → cat pickup → dog pet → food shop → interior
// door → garage door → vehicle → train → elevator → side-job marker
// → Maya (date) → fishing → vending → ATM → taxi stand.

import { TUNE, COL, dist2 } from './config.js';
import { newGameState, showToast, showMenu, hideMenu, stepToasts } from './state.js';
import { createInput, attachInput, isDown, pressedKey, endFrame } from './input.js';
import { BoxBatch, createRenderer, mat4Perspective, mat4LookAt, mat4Multiply, boxVisible } from './render.js';
import { generateCity, clearSpot } from './world.js';
import { createAudio, createRadio, advanceRadio, nextStation, playBlip, setMuted } from './audio.js';
import { stepPlayer, playerBoxes } from './player.js';
import { createVehicles, stepVehicles, nearestVehicle, enterVehicle, vehicleBoxes } from './vehicles.js';
import { createPeds, stepPeds, pedBoxes } from './pedestrians.js';
import { createPolice, stepPolice, respawnAfterBusted } from './police.js';
import { createGangs, stepGangs, gangBoxes } from './gangs.js';
import { createCombat, stepCombat, seedPickups, pickupBoxes } from './combat.js';
import {
  createMissions, startChapter, dismissPassedCard, stepMissions, stepSideJob,
  startSideJob, SIDE_MARKERS, SPOTS, completionPct,
} from './missions.js';
import { createTaxi, stepTaxi, startFare, dispatchTaxi } from './taxi.js';
import { createFire, stepFire, fireBoxes } from './fire.js';
import { nearestFoodShop, quickBuyFood, foodShopBoxes } from './food.js';
import { createDating, stepDating, startDate, mayaBoxes } from './dating.js';
import { createOutfit, cyclePart, buyCurrent } from './outfit.js';
import { createTraining, initTraining, stepTraining, trainingBoxes } from './training.js';
import { createEvents, stepEvents, eventBoxes } from './events.js';
import { createCats, stepCats, nearestCat, pickupCat, putDownCat, catBoxes } from './cats.js';
import { createLiving, stepLiving, nearestDog, petDog, boardTrain, livingBoxes, trainPosition } from './living.js';
import { createWeather, stepWeather, weatherSample, rainBoxes } from './weather.js';
import { createPhone, notifyPhone, togglePhone, callContact } from './phone.js';
import { createGarage, storeCar, takeCar, repaint, GARAGE_DOOR } from './garage.js';
import {
  createActivities, stepActivities, startFishing, nearestVending, buySnack,
  nearestAtm, atmDeposit, atmWithdraw, activityBoxes,
} from './activities.js';
import {
  createInteriors, nearestDoor, enterInterior, exitInterior, counterPoint,
  roomDoorPoint, clampToRoom, interiorBoxes,
} from './interiors.js';
import { updateHud, drawMinimap, HUD_IDS } from './hud.js';
import { createCamera, orbitCamera, followCamera, cameraTarget } from './shots.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { loadGLB, addGLBToBatch } from './gltf.js';

export function createGame(seed) {
  const rng = seed === undefined ? Math.random : (() => {
    let s = seed;
    return () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
  })();
  const city = generateCity(1337);
  const game = {
    time: 0,
    state: newGameState(),
    input: createInput(),
    city,
    camera: createCamera(),
    audio: createAudio(),
    radio: createRadio(),
    vehicles: createVehicles(city, rng),
    peds: createPeds(city, rng),
    police: createPolice(),
    gangs: createGangs(),
    combat: createCombat(),
    missions: createMissions(),
    taxi: createTaxi(),
    fire: createFire(),
    dating: createDating(),
    outfit: createOutfit(),
    training: createTraining(),
    events: createEvents(),
    cats: createCats(city, rng),
    living: createLiving(city, rng),
    weather: createWeather(),
    phone: createPhone(),
    garage: createGarage(),
    activities: createActivities(),
    interiors: createInteriors(),
    renderer: null,
    glbBatch: null, // GLB props, filled in async by loadGLBProps.
    hudEls: null,
    saveT: 0,
  };
  initTraining(game);
  seedPickups(game);
  return game;
}

// ---- game flow ----

// New game. Order matters: hideMenu BEFORE startChapter, and never
// touch the intro card after startChapter shows it (the round-4 bug
// was startGame hiding the card it had just shown).
export function startGame(game) {
  game.state = newGameState();
  game.state.mode = 'play';
  game.missions = createMissions();
  game.police = createPolice();
  game.combat = createCombat();
  seedPickups(game);
  const spawn = game.city.spawns.player;
  game.state.player.x = spawn.x;
  game.state.player.z = spawn.z;
  hideMenu(game.state);
  startChapter(game, 1);
}

export function continueGame(game) {
  const loaded = loadGame(game);
  if (!loaded) {
    startGame(game);
    return false;
  }
  game.state.mode = 'play';
  // Show the current chapter's intro card (without resetting
  // progress), then re-save — the old code overwrote the save with
  // reset values before restoring, so continue re-saves after.
  startChapter(game, Math.min(5, game.state.chapter));
  saveGame(game);
  return true;
}

function dismissCard(game) {
  game.state.hud.card = null;
  game.state.mode = 'play';
}

// ---- E interaction dispatcher ----
export function handleInteract(game) {
  const s = game.state;
  const p = s.player;
  // Inside an interior: counter opens the menu, door leaves.
  if (game.interiors.inside) {
    const cp = counterPoint();
    const dp = roomDoorPoint();
    if (dist2(p.x, p.z, cp.x, cp.z) < 9) {
      const it = game.interiors.inside;
      if (it.kind === 'food') {
        const shop = { name: it.shop };
        quickBuyFood(game, shop);
      } else {
        game.outfit.menuOpen = true;
        showToast(s, 'Outfit shop — keys 1-4 cycle parts, 5 buys.', 3);
      }
      return true;
    }
    if (dist2(p.x, p.z, dp.x, dp.z) < 9) {
      exitInterior(game);
      return true;
    }
    return false;
  }
  // Carried cat: put it down.
  if (p.carryingCat) {
    putDownCat(game);
    return true;
  }
  // Cat pickup.
  const cat = nearestCat(game, p.x, p.z, 3);
  if (cat) {
    pickupCat(game, cat);
    return true;
  }
  // Dog pet.
  const dog = nearestDog(game, p.x, p.z, 3);
  if (dog) {
    petDog(game, dog);
    return true;
  }
  // Food shop (front, 5 m).
  const shop = nearestFoodShop(game, p.x, p.z, 5);
  if (shop) {
    quickBuyFood(game, shop);
    return true;
  }
  // Interior door (4 m).
  const door = nearestDoor(game, p.x, p.z, 4);
  if (door) {
    enterInterior(game, door);
    return true;
  }
  // Garage door.
  if (dist2(p.x, p.z, GARAGE_DOOR.x, GARAGE_DOOR.z) < 20) {
    if (p.inCar) {
      storeCar(game);
    } else {
      game.garage.menuOpen = !game.garage.menuOpen;
      showToast(s, game.garage.menuOpen ? 'Garage — keys 1-9 take a car out, 0 repaints ($50).' : 'Garage closed.', 3);
    }
    return true;
  }
  // Vehicle.
  const v = nearestVehicle(game, p.x, p.z, 4.5);
  if (v) {
    enterVehicle(game, v);
    // The cab that was dispatched to the player: getting in starts
    // the shift — pick up the passenger at the taxi stand.
    if (v === game.taxi.arrived) {
      game.taxi.arrived = null;
      startFare(game);
      showToast(s, 'Pick up your passenger at the taxi stand.', 3);
    }
    return true;
  }
  // Train at the station.
  const tp = trainPosition(game.living.train.s);
  if (dist2(p.x, p.z, tp.x, tp.z) < 20 && dist2(tp.x, tp.z, -320, 0) < 2500) {
    if (boardTrain(game)) return true;
  }
  // Elevator platform.
  const el = game.city.elevator;
  if (el && dist2(p.x, p.z, el.x, el.z) < 9) {
    game.living.elevator.riding = true;
    game.living.elevator.dir = 1;
    p.onElevator = true;
    showToast(s, 'Elevator going up...', 2);
    return true;
  }
  // Side-job markers.
  for (const [id, mk] of Object.entries(SIDE_MARKERS)) {
    if (dist2(p.x, p.z, mk.x, mk.z) < 25) {
      if (startSideJob(game, id)) return true;
    }
  }
  // Maya (date).
  if (dist2(p.x, p.z, game.dating.maya.x, game.dating.maya.z) < 16) {
    if (startDate(game)) return true;
  }
  // Fishing at the pier.
  if (dist2(p.x, p.z, -330, 100) < 100) {
    if (startFishing(game)) return true;
  }
  // Vending machine.
  if (nearestVending(game, p.x, p.z, 3)) {
    buySnack(game);
    return true;
  }
  // ATM.
  if (nearestAtm(game, p.x, p.z, 3)) {
    if (s.cash >= 50) atmDeposit(game, 50);
    else if (s.bank >= 50) atmWithdraw(game, 50);
    else showToast(s, 'ATM: no $50 to move.', 2);
    return true;
  }
  // Taxi stand: start a fare.
  if (dist2(p.x, p.z, SPOTS.taxiStand.x, SPOTS.taxiStand.z) < 25) {
    if (startFare(game)) return true;
  }
  return false;
}

// ---- one frame ----
export function stepGame(game, dt) {
  dt = Math.min(dt, 0.05);
  game.time += dt;
  const s = game.state;
  const input = game.input;

  // --- menu keys (work in every mode) ---
  if (pressedKey(input, 'Enter') || pressedKey(input, 'NumpadEnter')) {
    if (s.mode === 'menu') {
      startGame(game);
    } else if (s.hud.card) {
      dismissCard(game);
    } else if (s.mode === 'passed') {
      dismissPassedCard(game);
    } else if (s.mode === 'busted' || s.mode === 'wasted') {
      respawnAfterBusted(game);
    } else if (s.mode === 'pause') {
      s.mode = 'play';
      hideMenu(s);
    }
  }
  // Escape advances the chapter-intro card (not only Enter/timeout),
  // closes the phone before pausing, and pauses/resumes.
  if (pressedKey(input, 'Escape')) {
    if (game.phone.open) {
      game.phone.open = false;
    } else if (game.outfit.menuOpen) {
      game.outfit.menuOpen = false;
    } else if (game.garage.menuOpen) {
      game.garage.menuOpen = false;
    } else if (s.hud.card) {
      dismissCard(game);
    } else if (s.mode === 'play') {
      s.mode = 'pause';
      showMenu(s, 'PAUSED', 'Solmar Bay is waiting.<br>Save slot 1 · ' + completionPct(game) + '% complete', 'Press Enter to continue, Esc to resume.');
    } else if (s.mode === 'pause') {
      s.mode = 'play';
      hideMenu(s);
    }
  }
  // Tab toggles the phone; R cycles the radio; M mutes.
  if (pressedKey(input, 'Tab') && s.mode === 'play') {
    togglePhone(game);
    if (game.phone.open && game.phone.tab === 'messages') {
      game.phone.unread = 0;
    }
  }
  if (pressedKey(input, 'KeyR') && s.mode === 'play') {
    const now = nextStation(game.radio);
    showToast(s, now.station + ' ' + now.freq + ' — ' + now.song, 2);
  }
  if (pressedKey(input, 'KeyM')) {
    setMuted(game.audio, !game.audio.muted);
    showToast(s, game.audio.muted ? 'Sound muted.' : 'Sound on.', 1.5);
  }
  // Outfit menu keys (1-4 cycle parts, 5 buys).
  if (game.outfit.menuOpen) {
    if (pressedKey(input, 'Digit1')) cyclePart(game, 0);
    if (pressedKey(input, 'Digit2')) cyclePart(game, 1);
    if (pressedKey(input, 'Digit3')) cyclePart(game, 2);
    if (pressedKey(input, 'Digit4')) cyclePart(game, 3);
    if (pressedKey(input, 'Digit5')) buyCurrent(game);
  }
  // Garage menu keys (1-9 take a car out, 0 repaints).
  if (game.garage.menuOpen) {
    for (let i = 1; i <= 9; i++) {
      if (pressedKey(input, 'Digit' + i)) takeCar(game, i - 1);
    }
    if (pressedKey(input, 'Digit0')) repaint(game);
  }
  // Phone: a taxi call from the contacts dispatches a cab to the
  // player (it drives over, parks, and E enters it).
  if (game.phone.pendingTaxi) {
    game.phone.pendingTaxi = false;
    dispatchTaxi(game);
  }

  // --- ambient world (runs in menu too, behind the title) ---
  stepWeather(game, dt);
  advanceRadio(game.radio, game.audio, dt);
  stepLiving(game, dt);
  // Traffic lights cycle: green 8s, yellow 2s, red 8s.
  for (const tl of game.city.lights) {
    tl.t += dt;
    const cyc = tl.t % 18;
    tl.state = cyc < 8 ? 'green' : cyc < 10 ? 'yellow' : 'red';
  }

  if (s.mode === 'menu') {
    // Title screen: the city idles behind the menu; draw the minimap
    // behind it (never an empty green box).
    stepPeds(game, dt);
    stepVehicles(game, dt);
    orbitCamera(game.camera, input);
    followCamera(game.camera, { x: s.player.x, y: 0, z: s.player.z }, dt, false);
    endFrame(input, dt);
    return;
  }
  if (s.mode !== 'play') {
    // Card / passed / busted / wasted / pause: world frozen.
    endFrame(input, dt);
    return;
  }

  // --- full play step ---
  orbitCamera(game.camera, input);
  stepPlayer(game, dt);
  // E (on foot, phone closed) goes through the dispatcher.
  if (!s.player.inCar && pressedKey(input, 'KeyE') && input.eCooldown <= 0 && !game.phone.open) {
    input.eCooldown = 0.4;
    handleInteract(game);
  }
  stepVehicles(game, dt);
  stepPeds(game, dt);
  if (!game.interiors.inside) {
    stepPolice(game, dt);
    stepGangs(game, dt);
  }
  stepMissions(game, dt);
  stepSideJob(game, dt);
  stepCombat(game, dt);
  stepTaxi(game, dt);
  stepFire(game, dt);
  stepDating(game, dt);
  stepTraining(game, dt);
  stepEvents(game, dt);
  stepCats(game, dt);
  stepActivities(game, dt);
  clampToRoom(game);
  stepToasts(s, dt);
  // Camera follows the player (or the car).
  const focus = { x: s.player.x, y: s.player.inCar && s.player.inCar.flying ? s.player.inCar.altitude : 0, z: s.player.z };
  followCamera(game.camera, focus, dt, !!s.player.inCar);
  // Autosave every 20 s.
  game.saveT += dt;
  if (game.saveT > 20) {
    game.saveT = 0;
    saveGame(game);
  }
  endFrame(input, dt);
}

function completionPctOf(game) {
  return completionPct(game);
}

// ---- rendering: gather every dynamic box into one batch ----
export function collectDynamicBoxes(game) {
  const batch = new BoxBatch();
  const s = game.state;
  const cam = game.camera;
  const wSample = weatherSample(game.weather);
  const neonBoost = wSample.neon;
  const far = 220;
  // Vehicles (culled; near ones get the full detail pass).
  for (const v of game.vehicles.list) {
    if (boxVisible(v.x, v.z, cam, far)) vehicleBoxes(v, batch, dist2(v.x, v.z, s.player.x, s.player.z) < 80 * 80);
  }
  // Peds: far ones use LOD (5 boxes instead of 7).
  for (const p of game.peds.list) {
    if (p.hp <= 0) continue;
    const d = dist2(p.x, p.z, s.player.x, s.player.z);
    if (d > far * far) continue;
    pedBoxes(p, batch, d > 120 * 120);
    if (p.gang) gangBoxes(p, batch);
  }
  // Player (not while driving — the car is drawn instead).
  if (!s.player.inCar && !s.player.onTrain) playerBoxes(game, batch);
  // Police: foot cops, helicopter, roadblocks.
  for (const c of game.police.cops) {
    if (boxVisible(c.x, c.z, cam, far)) {
      batch.pushBoxRot(c.x, 0.45, c.z, 0.6, 0.9, 0.35, [0.1, 0.15, 0.35], c.heading);
      batch.pushBoxRot(c.x, 1.25, c.z, 0.8, 0.75, 0.42, [0.1, 0.15, 0.35], c.heading);
      batch.pushBoxRot(c.x, 1.95, c.z, 0.52, 0.52, 0.48, [0.95, 0.8, 0.65], c.heading);
      batch.pushBoxRot(c.x, 2.2, c.z, 0.54, 0.18, 0.5, [0.1, 0.15, 0.35], c.heading);
      // Cap brim (visual overhaul — same treatment as peds).
      batch.pushBoxRot(c.x, 2.12, c.z, 0.56, 0.1, 0.56, [0.05, 0.08, 0.18], c.heading);
    }
  }
  const heli = game.police.heli;
  if (heli) {
    batch.pushBoxRot(heli.x, heli.y, heli.z, 3, 1.6, 6, [0.15, 0.2, 0.3], heli.heading);
    batch.pushBoxRot(heli.x, heli.y + 1, heli.z, 0.6, 0.6, 0.6, [0.4, 0.65, 0.85], heli.heading);
    // Spinning rotor.
    const ra = heli.rotor;
    batch.pushBox(heli.x + Math.sin(ra) * 3, heli.y + 1.4, heli.z + Math.cos(ra) * 3, 7, 0.15, 0.4, [0.2, 0.2, 0.22]);
    // Spotlight cone + ground pool.
    batch.pushBox(heli.x, heli.y - 20, heli.z, 2, 40, 2, [1.0, 0.95, 0.7], 0.35);
    batch.pushBox(s.player.x, 0.1, s.player.z, 8, 0.1, 8, [1.0, 0.95, 0.7], 0.5);
  }
  for (const rb of game.police.roadblocks) {
    for (const v of rb.cars) vehicleBoxes(v, batch);
  }
  // Pickups, fires, events, training, food signs, activities.
  pickupBoxes(game, batch);
  fireBoxes(game, batch);
  eventBoxes(game, batch);
  trainingBoxes(game, batch);
  foodShopBoxes(game, batch);
  activityBoxes(game, batch);
  // Cats, dogs, train, fish, birds, clouds, elevator.
  catBoxes(game, batch);
  livingBoxes(game, batch);
  mayaBoxes(game, batch);
  // Interiors (only when inside).
  interiorBoxes(game, batch);
  // Neon signs: drawn dynamically with the time-of-day boost so they
  // glow at sunset/night (values above 1.0 read as a glow).
  for (const n of game.city.neon) {
    if (!boxVisible(n.x, n.z, cam, far)) continue;
    const c = [Math.min(1.4, n.c[0] * neonBoost), Math.min(1.4, n.c[1] * neonBoost), Math.min(1.4, n.c[2] * neonBoost)];
    batch.pushBox(n.x, n.y, n.z, n.sx, n.sy, n.sz, c);
  }
  // Rain drops.
  rainBoxes(game, batch);
  // Ocean wave crests: drift and bob with the game time.
  for (const wv of game.city.waves) {
    const x = wv.x + Math.sin(game.time * 0.3 + wv.phase) * 4;
    const y = 0.2 + Math.sin(game.time * 0.8 + wv.phase) * 0.3;
    batch.pushBox(x, y, wv.z, 6, 0.4, 1.5, [0.6, 0.8, 0.95]);
  }
  // Sun glint on the water: bright streaks drifting with time (a
  // cheap specular stand-in — there is no PBR pipeline, see the
  // renderer evaluation in the visual-overhaul report).
  for (let i = 0; i < 4; i++) {
    const gx = -385 + ((game.time * 6 + i * 47) % 40); // stays over the water (x < -340)
    const gz = -260 + i * 130;
    batch.pushFlat(gx, 0.15, gz, 14, 1.2, [1.0, 0.9, 0.6]);
  }
  return batch;
}

// ---- browser rendering + boot ----
export function renderFrame(game) {
  const r = game.renderer;
  if (!r) return;
  const wSample = weatherSample(game.weather);
  r.setSky(wSample.sky);
  const cam = game.camera;
  const focus = { x: game.state.player.x, y: 0, z: game.state.player.z };
  const target = cameraTarget(cam, focus);
  const view = mat4LookAt([cam.x, cam.y, cam.z], target, [0, 1, 0]);
  const proj = mat4Perspective(1.1, 1280 / 720, 0.1, 900);
  const vp = mat4Multiply(proj, view);
  const dyn = collectDynamicBoxes(game);
  r.draw(game.city.staticBatch, vp, wSample.fog, wSample.near, wSample.far);
  if (game.glbBatch) r.draw(game.glbBatch, vp, wSample.fog, wSample.near, wSample.far);
  r.draw(dyn, vp, wSample.fog, wSample.near, wSample.far);
}

// GLB props (visual overhaul): three red oil drums from the CC0
// Poly Haven Barrel_01 model (game/assets/barrel.glb), standing on
// the dock sidewalk next to the harbour containers. The model is
// 0.88 m tall in metres already, so scale 1. Loading is async and
// never blocks the game: if the fetch or parse fails, the same spots
// get procedural box barrels instead, so the dock is never empty.
export const BARREL_SPOTS = [[311, -80, 0.3], [312, -65, 1.2], [311, -130, 2.1]];
export const BARREL_COLOR = [0.65, 0.12, 0.08];
export function buildBarrelBatch(model) {
  const batch = new BoxBatch();
  if (model) {
    for (const [x, z, yaw] of BARREL_SPOTS) {
      addGLBToBatch(batch, model, { x, z, yaw, scale: 1, color: BARREL_COLOR });
    }
  } else {
    for (const [x, z] of BARREL_SPOTS) {
      batch.pushBox(x, 0.45, z, 0.6, 0.9, 0.6, BARREL_COLOR);
      batch.pushBox(x, 0.95, z, 0.5, 0.1, 0.5, [0.4, 0.08, 0.05]);
    }
  }
  return batch;
}
export async function loadGLBProps(game) {
  const model = await loadGLB('assets/barrel.glb');
  game.glbBatch = buildBarrelBatch(model);
}

export function boot(canvas) {
  const game = createGame();
  game.renderer = createRenderer(canvas);
  attachInput(game.input, canvas);
  // GLB props load in the background; the game starts without them.
  loadGLBProps(game);
  // HUD element lookup.
  const els = {};
  if (typeof document !== 'undefined') {
    for (const id of HUD_IDS) els[id] = document.getElementById(id);
    game.hudEls = els;
    // Title screen buttons.
    const newBtn = document.getElementById('btn-new');
    if (newBtn) newBtn.addEventListener('click', () => startGame(game));
    const contBtn = document.getElementById('btn-continue');
    if (contBtn) {
      contBtn.style.display = hasSave() ? 'inline-block' : 'none';
      contBtn.addEventListener('click', () => continueGame(game));
    }
    // Phone panel tabs + contacts.
    const phoneEl = els['hud-phone'];
    if (phoneEl) {
      phoneEl.addEventListener('click', (e) => {
        const tab = e.target.getAttribute && e.target.getAttribute('data-tab');
        if (tab) game.phone.tab = tab;
        const contact = e.target.getAttribute && e.target.getAttribute('data-contact');
        if (contact) callContact(game, contact);
      });
    }
  }
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    stepGame(game, dt);
    renderFrame(game);
    updateHud(game, els);
    const mm = els['hud-minimap'];
    if (mm && mm.getContext) {
      const ctx = mm.getContext('2d');
      drawMinimap(ctx, game, mm.width, mm.height);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return game;
}
