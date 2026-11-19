// Solmar Bay — game loop, wiring, and the E-interaction dispatcher.
// createGame builds the whole game (Node-safe: no DOM/WebGL needed);
// stepGame advances one frame; the browser loop at the bottom only
// runs when `document` exists.

import { TUNE, OUTFIT } from './config.js';
import { showToast, addCash } from './state.js';
import { createInput } from './input.js';
import { createState, resetState } from './state.js';
import { buildCity, inWater } from './world.js';
import { createRenderer } from './render.js';
import { createCamera, snapCamera, updateCamera, cameraView } from './shots.js';
import { createPlayer, resetPlayer, updatePlayer, playerBoxes } from './player.js';
import { createVehicles, updateVehicles, updateDriven, tryEnterVehicle, exitVehicle, vehicleBoxes, nearestVehicle } from './vehicles.js';
import { createPedestrians, updatePedestrians, pedBoxes } from './pedestrians.js';
import { createPolice, updatePolice, commitCrime, bustPlayer, respawnAfterBusted, heliBoxes } from './police.js';
import { createMissions, startChapter, updateMissions, missionMarker, startSideJob, completionPct, SIDE_MARKERS } from './missions.js';
import { createCombat, updateCombat, punch, shoot, throwBomb, damagePlayer, WEAPONS, spawnPickup } from './combat.js';
import { createGangs, updateGangs, gangBoxes } from './gangs.js';
import { createFire, updateFire, fireBoxes } from './fire.js';
import { createTaxi, updateTaxi, taxiMarker } from './taxi.js';
import { createFood, nearestFoodShop, buyFood, foodBoxes, showFoodMenu } from './food.js';
import { createDating, updateDating, startDate, datingMarker, mayaBoxes } from './dating.js';
import { createCats, updateCats, interactCat, interactDog, catBoxes, dogBoxes } from './cats.js';
import { createOutfit, buyOutfitPart, outfitBoxes, showOutfitMenu } from './outfit.js';
import { createTraining, updateTraining, startRange, startSwimChallenge, startCourse, targetBoxes, rangeBoxes, hitTarget as hitTargetFn } from './training.js';
import { createEvents, updateEvents, eventMarker } from './events.js';
import { createWeather, updateWeather, currentSky, weatherBoxes, neonBoxes } from './weather.js';
import { createPhone, togglePhone, handlePhoneKeys } from './phone.js';
import { createGarage, nearGarageDoor, storeCar, showGarageMenu, handleGarageKeys } from './garage.js';
import { createActivities, updateActivities, activitiesBoxes, nearestMachine, nearestAtm, nearFishingSpot, startFishing, buySnack, openAtm, handleAtmKeys, showAtmMenu } from './activities.js';
import { nearestInteriorDoor, enterInterior, interiorInteract, clampToRoom } from './interiors.js';
import { createLiving, initLivingAmbience, boardTrain, exitTrain, toggleElevator, updateLiving, livingBoxes, nearestTrainCar, trainAtStation } from './living.js';
import { createHud, updateHud, drawMinimap, showMenu, hideMenu } from './hud.js';
import { createAudio } from './audio.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { dist2, clamp } from './config.js';

export function createGame(opts) {
  const o = opts || {};
  const city = buildCity();
  const state = createState();
  const input = o.input || createInput(o.keyTarget || null, o.canvas || null);
  const game = {
    city,
    state,
    input,
    camera: createCamera(),
    player: createPlayer(city),
    vehicles: createVehicles(city),
    peds: createPedestrians(city),
    police: createPolice(),
    missions: createMissions(),
    combat: createCombat(),
    gangs: createGangs(),
    fire: createFire(),
    taxi: createTaxi(),
    food: createFood(),
    dating: createDating(),
    cats: createCats(),
    outfit: createOutfit(),
    training: createTraining(),
    events: createEvents(),
    weather: createWeather(),
    phone: createPhone(),
    garage: createGarage(),
    activities: createActivities(),
    living: createLiving(city),
    hud: createHud(o.document || null),
    audio: createAudio(),
    render: createRenderer(o.canvas || null),
    configOutfit: OUTFIT,
    _respawnPed: false,
    _pickupSeedT: 0,
    waterT: 0,
  };
  // wire cross-system methods the modules call through `game`
  game.police.bustPlayer = (g, reason, kind) => bustPlayer(g, reason, kind);
  game.combat.damagePlayer = (g, amount) => damagePlayer(g, amount);
  game.training.hitTarget = (g, target, damage) => {
    // training.js hitTarget is imported above via the module binding
    hitTargetFn(g, target, damage);
  };
  initLivingAmbience(game.living);
  seedPickups(game);
  return game;
}

function seedPickups(game) {
  // weapon + health pickups on roads/streets (never inside buildings)
  spawnPickup(game, 60, 0, 'smg');
  spawnPickup(game, -200, 0, 'shotgun');
  spawnPickup(game, 100, -100, 'health');
  spawnPickup(game, -100, 200, 'health');
  spawnPickup(game, 0, -200, 'armour');
  spawnPickup(game, 200, 100, 'wrench');
  spawnPickup(game, -300, 200, 'health');
}

// ---- game flow ----
export function startGame(game, fresh) {
  const state = game.state;
  resetState(state, fresh);
  resetPlayer(game.player, game.city, !fresh);
  game.player.outfit = { ...state.outfit };
  game.missions = createMissions();
  game.combat.bombs = 3;
  state.mode = 'chapter';
  state.chapterIntroShown = false;
  startChapter(game, fresh ? 1 : state.chapter);
  snapCamera(game.camera, game.player, 0);
  // NOTE: no hideMenu here — startChapter just showed the chapter
  // intro card, and hiding it again left the player staring at a
  // frozen world with no card at all (play-test issue 4). The card
  // replaces the title menu; Enter dismisses it in stepGame.
  if (game.audio) game.audio.ensure();
  saveGame(game);
}

export function continueGame(game) {
  const saved = loadGame();
  if (!saved) {
    startGame(game, true);
    return;
  }
  startGame(game, false);
  const state = game.state;
  state.cash = saved.cash;
  state.bank = saved.bank || 0;
  state.chapter = saved.chapter;
  state.health = saved.health;
  state.armour = saved.armour || 0;
  state.respect = saved.respect || 0;
  state.flags = saved.flags || {};
  state.relationship = saved.relationship || 0;
  state.outfit = saved.outfit || { hair: 0, shirt: 0, pants: 0, shoes: 0 };
  game.player.outfit = { ...state.outfit };
  if (saved.garage && Array.isArray(saved.garage.owned)) {
    // owned cars survive a reload (stale vehicle ids are dropped;
    // takeOutCar spawns a fresh vehicle for each entry)
    game.garage.owned = saved.garage.owned.map((o) => ({ ...o, vehId: null }));
    game.garage.selected = game.garage.owned.length - 1;
  }
  if (saved.x !== undefined) {
    game.player.x = saved.x;
    game.player.z = saved.z;
  }
  startChapter(game, state.chapter);
  saveGame(game); // persist the restored state (startGame saved the reset one)
}

// ---- E interaction dispatcher (priority order, round-4 spec) ----
// train -> elevator -> cat -> dog -> food -> outfit -> dating ->
// range -> swim -> course -> vehicle.
export function interact(game) {
  const p = game.player;
  if (p.eCooldown > 0) return false;
  // in a vehicle: store it in the garage (if stopped at the door),
  // jump out of the plane mid-air, or just get out
  if (p.inVehicle) {
    const veh = p.inVehicle;
    if (veh.type === 'plane' && veh.altitude > 10) {
      exitVehicle(game);
      p.falling = 1;
      p.y = veh.altitude;
      showToast(game.state, 'You jumped! Press SPACE to open the parachute.', 3);
      return true;
    }
    if ((veh.type === 'car' || veh.type === 'bike') && nearGarageDoor(game)) {
      return storeCar(game);
    }
    return exitVehicle(game);
  }
  // inside a shop interior: counter opens the shop menu, door exits
  if (game.state.interior) return interiorInteract(game);
  if (p.onTrain) return exitTrain(game);
  if (p.onElevator) return toggleElevator(game);
  // board the train at the station
  if (trainAtStation(game.living)) {
    const near = nearestTrainCar(game.living, p.x, p.z);
    if (near.dist < 8) return boardTrain(game);
  }
  // glass elevator on the tallest tower
  if (dist2(p.x, p.z, 50, 76) < 25) return toggleElevator(game);
  // cats, then dogs
  if (interactCat(game)) return true;
  if (interactDog(game)) return true;
  // shop interiors (E at a shop door steps inside)
  const interiorDef = nearestInteriorDoor(game);
  if (interiorDef) return enterInterior(game, interiorDef);
  // food shop menu
  const shop = nearestFoodShop(game);
  if (shop) {
    game.food.openShop = shop;
    showFoodMenu(game, shop);
    return true;
  }
  // outfit shop menu
  if (dist2(p.x, p.z, game.outfit.shop.x, game.outfit.shop.z) < 25) {
    game.outfit.open = true;
    showOutfitMenu(game);
    return true;
  }
  // dating: Maya at the beach house
  if (!game.dating.onDate && dist2(p.x, p.z, -310, 120) < 25) {
    return startDate(game);
  }
  // garage menu (on foot at the door)
  if (nearGarageDoor(game)) {
    showGarageMenu(game);
    return true;
  }
  // side activities: vending machine, ATM, fishing at the pier
  if (nearestMachine(game)) {
    buySnack(game);
    return true;
  }
  if (nearestAtm(game)) return openAtm(game);
  if (nearFishingSpot(game)) return startFishing(game);
  // shooting range
  if (dist2(p.x, p.z, 260, 260) < 100) {
    startRange(game);
    return true;
  }
  // swim challenge (while swimming)
  if (p.swimming) {
    startSwimChallenge(game);
    return true;
  }
  // driving course
  if (dist2(p.x, p.z, 0, -350) < 100) {
    startCourse(game);
    return true;
  }
  // side-job markers (single source of truth: missions.js SIDE_MARKERS)
  for (const id of Object.keys(SIDE_MARKERS)) {
    const sm = SIDE_MARKERS[id];
    if (dist2(p.x, p.z, sm.x, sm.z) < 64) {
      return startSideJob(game, id);
    }
  }
  // finally: enter the nearest vehicle
  return !!tryEnterVehicle(game);
}

function handleMenuKeys(game) {
  const input = game.input;
  if (game.food.openShop) {
    if (input.pressedKey('Digit1')) buyFood(game, 0);
    if (input.pressedKey('Digit2')) buyFood(game, 1);
    if (input.pressedKey('Digit3')) buyFood(game, 2);
    return true;
  }
  if (game.outfit.open) {
    if (input.pressedKey('Digit1')) buyOutfitPart(game, 'hair');
    if (input.pressedKey('Digit2')) buyOutfitPart(game, 'shirt');
    if (input.pressedKey('Digit3')) buyOutfitPart(game, 'pants');
    if (input.pressedKey('Digit4')) buyOutfitPart(game, 'shoes');
    return true;
  }
  if (game.garage.open) {
    handleGarageKeys(game);
    return true;
  }
  if (game.activities.atmOpen) {
    handleAtmKeys(game);
    return true;
  }
  return false;
}

function closeMenus(game) {
  game.food.openShop = null;
  game.outfit.open = false;
  game.garage.open = false;
  game.activities.atmOpen = false;
  hideMenu(game.hud);
}

// ---- one frame ----
export function stepGame(game, dt) {
  dt = Math.min(dt, 0.05);
  const state = game.state;
  const input = game.input;
  state.time += dt;
  if (state.toastT > 0) state.toastT -= dt;
  game.waterT += dt;

  // --- menus / chapter card / pause / busted ---
  if (state.mode === 'menu') {
    // slow orbit behind the title; minimap draws behind the menu
    game.camera.targetYaw += dt * 0.05;
    updateCamera(game.camera, { x: game.player.x, y: 0, z: game.player.z, heading: 0, speed: 0 }, null, dt);
    drawMinimap(game);
    input.endFrame();
    return;
  }
  if (state.mode === 'chapter') {
    if (input.pressedKey('Escape') || input.pressedKey('Enter')) {
      state.mode = 'playing';
      hideMenu(game.hud);
    }
    input.endFrame();
    return;
  }
  // the mission-passed screen: Enter/Escape dismisses it and starts
  // the next chapter's intro card (or free roam after chapter 5)
  if (state.mode === 'missionpassed') {
    if (input.pressedKey('Enter') || input.pressedKey('Escape')) {
      hideMenu(game.hud);
      const next = game.missions.nextChapter || 6;
      if (next > 5) {
        state.mode = 'playing';
        showToast(state, 'You beat the story! Solmar Bay is yours. Side jobs still pay.', 6);
      } else {
        startChapter(game, next);
      }
    }
    input.endFrame();
    return;
  }
  if (state.mode === 'paused') {
    if (input.pressedKey('Escape') || input.pressedKey('KeyP')) {
      state.mode = 'playing';
      hideMenu(game.hud);
    }
    input.endFrame();
    return;
  }
  if (state.mode === 'busted') {
    if (input.pressedKey('Enter')) {
      respawnAfterBusted(game);
      snapCamera(game.camera, game.player, game.player.heading);
      hideMenu(game.hud);
    }
    input.endFrame();
    return;
  }

  // --- playing ---
  // cooldowns decay every frame, on foot AND in a vehicle (a cooldown
  // that only decays on foot can never expire while driving)
  game.player.eCooldown = Math.max(0, game.player.eCooldown - dt);
  // Escape / P: close the phone first, then a menu, then pause
  if (input.pressedKey('Escape') || input.pressedKey('KeyP')) {
    if (game.phone.open) {
      togglePhone(game);
    } else if (game.food.openShop || game.outfit.open || game.garage.open || game.activities.atmOpen) {
      closeMenus(game);
    } else {
      state.mode = 'paused';
      showMenu(game.hud, 'Paused', 'Solmar Bay is waiting for you.<br>Save slot 1 · ' + completionPct(game) + '% complete.', 'Esc to resume. M to mute.');
      saveGame(game);
    }
    input.endFrame();
    return;
  }
  // Tab: toggle the phone (not while a shop menu is open)
  if (input.pressedKey('Tab') && !game.food.openShop && !game.outfit.open && !game.garage.open && !game.activities.atmOpen) {
    togglePhone(game);
  }
  // menu keys (food / outfit / garage / ATM) eat the digits while a menu is open
  if ((game.food.openShop || game.outfit.open || game.garage.open || game.activities.atmOpen) && handleMenuKeys(game)) {
    if (game.food.openShop) showFoodMenu(game, game.food.openShop);
    if (game.outfit.open) showOutfitMenu(game);
    if (game.garage.open) showGarageMenu(game);
    if (game.activities.atmOpen) showAtmMenu(game);
    input.endFrame();
    return;
  }
  // mute
  if (input.pressedKey('KeyM') && game.audio) {
    game.audio.muted = !game.audio.muted;
  }
  // R: change radio station (works with the phone open or closed)
  if (input.pressedKey('KeyR') && game.audio) {
    const now = game.audio.nextStation();
    showToast(state, 'Radio: ' + now.station + ' — "' + now.song.title + '" by ' + now.song.artist, 2);
  }
  // phone open: digits go to the phone, E/F/G/shooting are blocked
  if (game.phone.open) {
    handlePhoneKeys(game);
  } else {
    // weapon switching
    if (input.pressedKey('Digit1')) game.combat.weapon = 0;
    if (input.pressedKey('Digit2') && game.combat.owned[1]) game.combat.weapon = 1;
    if (input.pressedKey('Digit3') && game.combat.owned[2]) game.combat.weapon = 2;
    // parachute
    if (input.pressedKey('Space') && game.player.falling > 0 && !game.player.parachute) {
      game.player.parachute = true;
      game.player.falling = 0;
      showToast(state, 'Parachute open! Steer with WASD.', 2);
    }
    // tap actions via pressedKey (never down() for one-shots)
    if (input.pressedKey('KeyE')) interact(game);
    if (input.pressedKey('KeyF') && !game.player.inVehicle) punch(game);
    if (input.pressedKey('KeyG') && !game.player.inVehicle) throwBomb(game);
    if (input.mouse && input.mouse.clicked) shoot(game);
  }

  // world updates
  updateWeather(game, dt);
  updateActivities(game, dt);
  if (game.player.inVehicle) updateDriven(game, dt);
  else updatePlayer(game, dt);
  if (game.state.interior) clampToRoom(game);
  updateVehicles(game, dt);
  updatePedestrians(game, dt);
  if (game.state.interior) {
    // safe inside a shop: the police and the gangs wait outside
  } else {
    updatePolice(game, dt);
    updateGangs(game, dt);
  }
  updateMissions(game, dt);
  updateCombat(game, dt);
  updateFire(game, dt);
  updateTaxi(game, dt);
  updateDating(game, dt);
  updateCats(game, dt);
  updateTraining(game, dt);
  updateEvents(game, dt);
  updateLiving(game, dt);

  // camera follows the player (or the vehicle)
  const follow = {
    x: game.player.x,
    y: game.player.y || 0,
    z: game.player.z,
    heading: game.player.heading,
    speed: game.player.speed || 0,
  };
  updateCamera(game.camera, follow, game.input.mouse, dt);

  // audio
  if (game.audio) {
    game.audio.engine(game.player.inVehicle ? Math.abs(game.player.inVehicle.speed || 0) : 0);
    game.audio.music(dt);
  }

  // HUD + minimap
  updateHud(game);
  input.endFrame();
}

// ---- dynamic boxes for one rendered frame (capped) ----
export function collectDynamicBoxes(game) {
  const boxes = [];
  // Cheap frustum + distance culling (graphics pass): a box is
  // skipped when it is clearly behind the camera (dot product of the
  // camera forward with the direction to the box < -0.3 * distance)
  // or beyond the fog (fogFar + 100, where nothing is visible
  // anyway). The margin is deliberately wide so nothing at the
  // screen edge is ever culled.
  const cam = game.camera || null;
  let fx = 0, fy = 0, fz = -1;
  let ex = 0, ey = 0, ez = 0;
  let cullDist = 800;
  if (cam && cam.eye && cam.center) {
    ex = cam.eye[0]; ey = cam.eye[1]; ez = cam.eye[2];
    fx = cam.center[0] - ex; fy = cam.center[1] - ey; fz = cam.center[2] - ez;
    const fl = Math.hypot(fx, fy, fz) || 1;
    fx /= fl; fy /= fl; fz /= fl;
    if (game.weather) cullDist = currentSky(game.weather).fogFar + 100;
  }
  const visible = (b) => {
    if (!cam) return true;
    const dx = b.x - ex, dy = (b.y || 0) - ey, dz = b.z - ez;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > cullDist * cullDist) return false;
    const d = Math.sqrt(d2) || 1;
    return (fx * dx + fy * dy + fz * dz) / d > -0.3;
  };
  const push = (list) => {
    for (const b of list) {
      if (boxes.length >= TUNE.batchCap) return;
      if (visible(b)) boxes.push(b);
    }
  };
  if (!game.player.inVehicle) push(playerBoxes(game));
  for (const v of game.vehicles.list) {
    if (v.driver === 'traffic' || v.driver === 'player' || v.driver === 'parked' || v.driver === 'cop' || v.driver === 'roadblock') {
      push(vehicleBoxes(v));
    }
  }
  // far peds (over 150 units) drop their arms: 5 boxes instead of 7
  // (sitters only have 4 boxes, so the slice needs a length check)
  for (const ped of game.peds) {
    if (!ped.alive) continue;
    const all = pedBoxes(ped);
    const far = Math.hypot(ped.x - game.player.x, ped.z - game.player.z) > 150;
    push(all.length >= 7 && far ? [all[0], all[1], all[2], all[5], all[6]] : all);
  }
  if (game.gangs) for (const m of game.gangs.members) if (m.alive) push(gangBoxes(m));
  if (game.police) {
    push(heliBoxes(game));
    for (const c of game.police.footCops) {
      push([
        { x: c.x, y: 1.2, z: c.z, sx: 0.9, sy: 0.8, sz: 0.5, c: [0.1, 0.15, 0.35] },
        { x: c.x, y: 1.85, z: c.z, sx: 0.6, sy: 0.55, sz: 0.55, c: [0.85, 0.65, 0.5] },
        { x: c.x, y: 2.15, z: c.z, sx: 0.64, sy: 0.2, sz: 0.6, c: [0.1, 0.15, 0.35] },
      ]);
    }
  }
  if (game.cats) {
    for (const cat of game.cats.list) push(catBoxes(cat));
    for (const dog of game.cats.dogs) push(dogBoxes(dog));
  }
  if (game.fire) for (const f of game.fire.fires) push(fireBoxes(f));
  if (game.dating) push(mayaBoxes(game));
  if (game.training) {
    for (const t of game.training.targets) push(targetBoxes(t));
    push(rangeBoxes());
  }
  if (game.food) for (const s of game.food.shops) push(foodBoxes(s));
  if (game.outfit) push(outfitBoxes(game.outfit.shop));
  if (game.combat) {
    for (const d of game.combat.cashDrops) {
      push([{ x: d.x, y: 0.5, z: d.z, sx: 0.9, sy: 0.5, sz: 0.6, c: [0.2, 0.85, 0.3] }]);
    }
    for (const pk of game.combat.pickups) {
      const c = pk.kind === 'health' ? [1, 0.3, 0.3] : pk.kind === 'armour' ? [0.3, 0.5, 1] : pk.kind === 'wrench' ? [0.9, 0.9, 0.9] : [0.2, 0.2, 0.2];
      push([{ x: pk.x, y: 0.6, z: pk.z, sx: 1.0, sy: 1.0, sz: 1.0, c }]);
    }
    for (const b of game.combat.bombsActive) {
      push([{ x: b.x, y: b.y, z: b.z, sx: 0.6, sy: 0.6, sz: 0.6, c: [0.15, 0.15, 0.15] }]);
    }
  }
  if (game.living) push(livingBoxes(game));
  if (game.weather) push(weatherBoxes(game));
  if (game.activities) push(activitiesBoxes(game));
  if (game.city && game.city.neon) push(neonBoxes(game));
  if (game.events) {
    for (const pp of game.events.partyPeds) {
      push([{ x: pp.x, y: 1.2, z: pp.z, sx: 0.9, sy: 0.8, sz: 0.5, c: [0.95, 0.5, 0.7] }]);
    }
  }
  return boxes;
}

// ---- browser bootstrap (only when document exists) ----
if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  const canvas = document.getElementById('game');
  const game = createGame({ document, canvas });
  window.__solmar = game;
  const btnNew = document.getElementById('btn-new');
  const btnContinue = document.getElementById('btn-continue');
  const btnResume = document.getElementById('btn-resume');
  if (btnNew) btnNew.addEventListener('click', () => startGame(game, true));
  if (btnContinue) btnContinue.addEventListener('click', () => continueGame(game));
  if (btnResume) btnResume.addEventListener('click', () => {
    game.state.mode = 'playing';
    hideMenu(game.hud);
  });
  // title screen content
  const has = hasSave();
  if (btnContinue) btnContinue.style.display = has ? 'inline-block' : 'none';
  showMenu(game.hud, 'SOLMAR BAY', 'A voxel open-world crime game.<br>Steal cars, run missions, dodge the cops, live the Vice City life — original, nothing from Rockstar.<br><br>WASD move &nbsp;·&nbsp; Shift run &nbsp;·&nbsp; E interact / enter car &nbsp;·&nbsp; F punch &nbsp;·&nbsp; G bomb &nbsp;·&nbsp; Click shoot &nbsp;·&nbsp; 1/2/3 weapons &nbsp;·&nbsp; Space handbrake / parachute &nbsp;·&nbsp; Esc pause &nbsp;·&nbsp; M mute', 'New Game or Continue to start.');
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    stepGame(game, dt);
    if (game.state.mode !== 'menu' || true) {
      // render every frame (menu too, so the city shows behind it)
      const view = cameraView(game.camera);
      const dyn = collectDynamicBoxes(game);
      const waterY = Math.sin(game.waterT * 0.8) * 0.15;
      game.render.setWater(game.city.waterBoxes.map((b) => ({ ...b, y: b.y + waterY })));
      // the sky drives the fog colour and density (day/night + weather)
      const sky = currentSky(game.weather);
      if (game.render.setFogColor) game.render.setFogColor(sky.sky);
      game.render.draw(view, dyn, sky.fogNear, sky.fogFar);
    }
    requestAnimationFrame(frame);
  }
  game.render.setStatic(game.city.boxes);
  game.render.setWater(game.city.waterBoxes);
  requestAnimationFrame(frame);
}
