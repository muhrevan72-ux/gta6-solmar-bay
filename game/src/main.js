// Solmar Bay — the game shell.
//
// boot() wires the whole game: canvas sized before the renderer,
// city built, world spawned, chapter 1 card shown as the very first
// screen. The loop calls handleTaps BEFORE stepping the game each
// frame, so the keyboard works in the real browser. stepGame runs the
// world (clock, weather, actors, missions); renderFrame draws it.

import { SPAWNS, STATIONS, RESPECT } from './config.js';
import { createGame, newGame, chapterTitle, showToast } from './state.js';
import { buildCity, buildStaticBoxes } from './world.js';
import { createCamera, updateCamera, computeViewProj } from './shots.js';
import { createWeather, sampleAt, phaseAt } from './weather.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createHud, updateHud } from './hud.js';
import { createRenderer, BoxBatch, batchReset, batchTris, bakeGlbBatch, pushBox } from './render.js';
import { buildAtlasCanvas } from './texture.js';
import { parseGlb, pushGlbToBatch } from './gltf.js';
import { stepPlayer, playerBoxes, tryEnterVehicle, exitVehicle } from './player.js';
import { spawnVehicles, makeVehicle, stepPlayerCar, stepTraffic, stepCarCollisions, vehicleBoxes, nearestEnterableVehicle } from './vehicles.js';
import { spawnPeds, stepPeds, pedBoxes } from './pedestrians.js';
import { spawnPolice, stepPolice, stepWanted, bustPlayer, policeBoxes, roadblockBoxes, heliBoxes } from './police.js';
import { spawnGangs, stepGangs, gangBoxes } from './gangs.js';
import { spawnLiving, stepLiving, livingBoxes, tryTrain, tryElevator, tryPetDog } from './living.js';
import { spawnFireService, stepFires, sprayFire, fireBoxes } from './fire.js';
import { spawnCats, stepCats, tryCat, catBoxes } from './cats.js';
import { spawnTraining, stepTraining, tryRange, trySwim, trySlalom, trainingBoxes } from './training.js';
import { spawnActivities, stepActivities, tryFish, tryVending, tryAtm, activitiesBoxes } from './activities.js';
import { tryInteriorDoor, tryCounter, stepInteriors, interiorBoxes } from './interiors.js';
import { togglePhone, callContact } from './phone.js';
import { tryGarage } from './garage.js';
import { tryFoodShop, foodSignBoxes } from './food.js';
import { tryOutfitShop } from './outfit.js';
import { spawnEvents, stepEvents, eventBoxes } from './events.js';
import { stepTaxiCall, stepTaxiFare, startTaxiFare } from './taxi.js';
import { tryDate, dateAte, mayaBoxes } from './dating.js';
import { startChapter, nextChapter, stepMissions, stepSideJob } from './missions.js';
import { shoot, punch, throwBomb, stepPickups } from './combat.js';
import { saveGame, loadGame } from './save.js';

// ---------- boot ----------
export function boot(canvas, doc) {
  const g = createGame();

  // Size the canvas BEFORE creating the renderer: assigning width or
  // height kills any existing WebGL context.
  const win = typeof globalThis !== 'undefined' ? globalThis.window : null;
  const w = (win && win.innerWidth) || 1280;
  const h = (win && win.innerHeight) || 720;
  canvas.width = w;
  canvas.height = h;

  const atlasCanvas = buildAtlasCanvas();
  g.renderer = createRenderer(canvas, atlasCanvas);
  g.city = buildCity();
  g.camera = createCamera();
  g.input = createInput();
  g.audio = createAudio();
  g.hud = createHud(doc);
  g.weatherObj = createWeather(g);
  buildStaticBoxes(g.city, g.renderer.staticBatch);

  // The GLB model does not exist in the entry; the fetch fails and the
  // fallback re-bakes the procedural barrels. The harness waits for
  // this rejection to settle before testing.
  try {
    if (typeof fetch === 'function') {
      fetch('barrel.glb')
        .then((res) => {
          if (!res.ok) throw new Error('glb missing');
          return res.arrayBuffer();
        })
        .then((buf) => {
          const model = parseGlb(buf);
          if (model) {
            batchReset(g.renderer.glbBatch);
            pushGlbToBatch(g.renderer.glbBatch, model, -280, 0, 170, 1, [0.85, 0.2, 0.15], [0, 0, 1, 1]);
          }
        })
        .catch(() => {
          bakeGlbBatch(g.renderer.glbBatch);
        });
    }
  } catch {
    // No fetch available; the synchronous fallback barrels stand.
  }

  // A fresh run: reset the run, spawn the whole world, and show the
  // Chapter 1 card as the first screen — never a title menu first,
  // even when a save exists.
  newGame(g);
  respawnWorld(g);
  startChapter(g, 1);

  // Resize: the canvas assignment kills the old GL context, so the
  // renderer is rebuilt and the static batch re-baked identically.
  g._onResize = () => {
    const win2 = typeof globalThis !== 'undefined' ? globalThis.window : null;
    const nw = (win2 && win2.innerWidth) || canvas.width;
    const nh = (win2 && win2.innerHeight) || canvas.height;
    canvas.width = nw;
    canvas.height = nh;
    g.renderer = createRenderer(canvas, buildAtlasCanvas());
    buildStaticBoxes(g.city, g.renderer.staticBatch);
    updateHud(g, g.hud);
  };
  if (win && typeof win.addEventListener === 'function') {
    win.addEventListener('resize', g._onResize);
  }

  // Menu buttons. Listeners go through addEventListener so the
  // recorded-listener test docs (and real browsers) can fire them.
  const el = g.hud && g.hud.el ? g.hud.el : {};
  const onClick = (node, fn) => {
    if (!node) return;
    if (typeof node.addEventListener === 'function') node.addEventListener('click', fn);
  };
  onClick(el.btnNew, () => {
    newGame(g);
    respawnWorld(g);
    startChapter(g, 1);
  });
  onClick(el.btnContinue, () => {
    loadGame(g, 1);
    g.mode = 'play';
    g.card = null;
    g.menu = null;
  });
  onClick(el.btnResume, () => {
    g.mode = 'play';
    g.menu = null;
  });
  onClick(el.btnPause, () => {
    togglePause(g);
  });

  // The game loop: taps first, then the step, then the frame.
  if (typeof requestAnimationFrame === 'function') {
    let last = 0;
    const loop = (t) => {
      const dt = Math.min(0.1, (t - last) / 1000 || 0.016);
      last = t;
      handleTaps(g, g.input);
      stepGame(g, dt, g.input);
      renderFrame(g);
      if (g.input) g.input.endFrame();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  return g;
}

function togglePause(g) {
  if (g.mode === 'phone') {
    togglePhone(g);
    return;
  }
  if (g.mode === 'play') {
    g.mode = 'pause';
    g.menu = 'pause';
    saveGame(g);
  } else if (g.mode === 'pause') {
    g.mode = 'play';
    g.menu = null;
  }
}

// ---------- input ----------
const TAP_KEYS = new Set([
  'Enter', 'Escape', 'Tab', 'KeyE', 'KeyF', 'KeyG', 'KeyR', 'KeyM', 'KeyP',
  'Digit1', 'Digit2', 'Digit3', 'Digit4',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
]);

export function handleTaps(g, input) {
  if (!input || !input.pressed) return;
  const pressed = [...input.pressed];
  for (const code of pressed) {
    if (!TAP_KEYS.has(code)) continue;
    input.pressed.delete(code);
    if (code === 'Enter') {
      if (g.mode === 'menu') {
        newGame(g);
        respawnWorld(g);
        startChapter(g, 1);
      } else if (g.mode === 'card') {
        g.mode = 'play';
        g.card = null;
      } else if (g.mode === 'passed') {
        nextChapter(g);
      } else if (g.mode === 'busted' || g.mode === 'wasted') {
        bustPlayer(g);
      } else if (g.mode === 'pause') {
        g.mode = 'play';
        g.menu = null;
      }
    } else if (code === 'Escape') {
      if (g.mode === 'card') {
        // Escape hatch: the title menu, without ever making it first.
        g.mode = 'menu';
        g.menu = 'main';
      } else if (g.mode === 'phone') {
        togglePhone(g);
      } else if (g.mode === 'play' || g.mode === 'pause') {
        togglePause(g);
      }
    } else if (code === 'Tab') {
      if (g.mode === 'play' || g.mode === 'phone') {
        togglePhone(g);
      }
    } else if (code === 'KeyE') {
      if (g.mode === 'play') {
        handleInteract(g);
      }
    } else if (code === 'KeyF') {
      if (g.mode === 'play') {
        punch(g);
      }
    } else if (code === 'KeyG') {
      if (g.mode === 'play') {
        throwBomb(g);
      }
    } else if (code === 'KeyR') {
      g.station = (g.station + 1) % STATIONS.length;
      g.song = 0;
      g.songStep = 0;
      if (g.audio) g.audio.sfx('click');
    } else if (code === 'KeyM') {
      g.muted = !g.muted;
      if (g.audio) g.audio.setMuted(g.muted);
    } else if (code === 'KeyP') {
      if (g.mode === 'play' || g.mode === 'pause') {
        togglePause(g);
      }
    } else if (code === 'Digit1') {
      if (g.mode === 'play') g.player.weapon = 0;
    } else if (code === 'Digit2') {
      if (g.mode === 'play' && g.unlocks.smgUnlocked) g.player.weapon = 1;
    } else if (code === 'Digit3') {
      if (g.mode === 'play' && g.unlocks.shotgunUnlocked) g.player.weapon = 2;
    } else if (code === 'Digit4') {
      if (g.mode === 'play') {
        g._taxiRequested = true;
        callContact(g, 'taxi');
      }
    }
    // Arrow keys: consumed, no action (movement uses WASD).
  }
  // A mouse click shoots in the direction the camera faces.
  if (input.mouse && input.mouse.clicked && g.mode === 'play' && !g.player.inCar) {
    const cam = g.camera;
    const yaw = cam ? cam.yaw : Math.PI;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    shoot(g, g.player.x + fx * 30, g.player.z + fz * 30);
    input.mouse.clicked = false;
  }
}

// The interact chain. The car-enter check runs FIRST.
export function handleInteract(g) {
  const p = g.player;
  if (p.inCar) {
    // Driving to the garage door stores the car instead of just exiting.
    if (Math.hypot(p.x - SPAWNS.garageDoor.x, p.z - SPAWNS.garageDoor.z) <= 6) {
      if (tryGarage(g)) return true;
    }
    return exitVehicle(g);
  }
  // 1. Get in a car.
  const v = tryEnterVehicle(g);
  if (v) {
    if (v === g._taxiCab) startTaxiFare(g);
    return true;
  }
  // 2. Inside a room: the counter first, otherwise step back out.
  if (g.inside) {
    if (tryCounter(g)) return true;
    tryInteriorDoor(g);
    return true;
  }
  // 3. Walk through a shop door.
  if (tryInteriorDoor(g)) return true;
  // 4. Shops and street services.
  if (tryFoodShop(g)) return true;
  if (tryOutfitShop(g)) return true;
  if (tryGarage(g)) return true;
  if (tryVending(g)) return true;
  if (tryAtm(g)) return true;
  // 5. Animals and the world.
  if (tryCat(g)) return true;
  if (tryPetDog(g)) return true;
  if (tryElevator(g)) return true;
  if (tryTrain(g)) return true;
  if (tryFish(g)) return true;
  if (tryRange(g)) return true;
  if (tryDate(g)) return true;
  if (sprayFire(g)) return true;
  return false;
}

// ---------- stepping ----------
function checkRespectUnlocks(g) {
  for (const u of RESPECT.unlocks) {
    if (g.respect >= u.min && !g.unlocks[u.flag]) {
      g.unlocks[u.flag] = true;
      if (u.flag === 'sportsCarSpawned') {
        const comet = makeVehicle('car', 180, -120, 0, [0.85, 0.2, 0.25], 'Solmar Comet');
        comet.owned = true;
        g.vehicles.push(comet);
        showToast(g, 'Respect 500 — a Solmar Comet of your own is parked at the crossroads!');
      } else if (u.flag === 'smgUnlocked') {
        showToast(g, 'Respect 100 — SMG unlocked! Press 2 to equip it.');
      } else if (u.flag === 'shotgunUnlocked') {
        showToast(g, 'Respect 250 — Shotgun unlocked! Press 3 to equip it.');
      }
    }
  }
}

export function stepGame(g, dt, input) {
  // Game time always ticks, even when paused.
  g.time += dt;
  if (g.mode === 'pause' || g.mode === 'menu' || g.mode === 'card' || g.mode === 'passed' || g.mode === 'busted' || g.mode === 'wasted') {
    return;
  }
  const playing = g.mode === 'play';
  const inPhone = g.mode === 'phone';

  // Clock, weather, rain (the weather step owns the 120x clock).
  if (g.weatherObj) {
    g.weatherObj.step(dt);
  } else {
    g.clock += dt / 30;
    if (g.clock >= 24) {
      g.clock -= 24;
      g.day += 1;
    }
  }
  g._phase = phaseAt(g.clock);

  // Respect unlocks fire once when a threshold is crossed: SMG at 100,
  // shotgun at 250, and a Comet of your own at 500.
  checkRespectUnlocks(g);

  // Timers.
  if (g.toastTimer > 0) {
    g.toastTimer = Math.max(0, g.toastTimer - dt);
    if (g.toastTimer === 0) g.toast = '';
  }
  if (g.dialogue && g.dialogue.t > 0) {
    g.dialogue.t -= dt;
    if (g.dialogue.t <= 0) g.dialogue = null;
  }

  // Radio sequencer: a step every 0.25 s, 32 steps per song.
  g._songTimer = (g._songTimer || 0) + dt;
  while (g._songTimer >= 0.25) {
    g._songTimer -= 0.25;
    g.songStep += 1;
    if (g.songStep >= 32) {
      g.songStep = 0;
      g.song = (g.song + 1) % 2;
    }
    if (g.audio) g.audio.radioStep(g.station, g.song, g.songStep);
  }

  // The player and the car move only when actually playing; the world
  // keeps living while the phone is open.
  if (playing) {
    stepPlayer(g, dt, input);
    stepPlayerCar(g, dt, input);
    if (g.camera) {
      updateCamera(g.camera, { x: g.player.x, z: g.player.z }, dt, input);
    }
    stepMissions(g, dt);
    stepSideJob(g, dt);
    stepPickups(g, dt);
    // Dinner at 21:00 ends a date.
    if (g.maya && g.maya.onDate && g.clock >= 21) {
      dateAte(g, 21);
    }
  }

  stepPeds(g, dt);
  stepPolice(g, dt);
  stepWanted(g, dt);
  stepGangs(g, dt);
  stepLiving(g, dt);
  stepFires(g, dt);
  stepCats(g, dt);
  stepTraining(g, dt);
  stepActivities(g, dt);
  stepEvents(g, dt);
  stepInteriors(g, dt);
  stepTraffic(g, dt);
  stepCarCollisions(g, dt);
  stepTaxiCall(g, dt);
  stepTaxiFare(g, dt);

  // A bust or a death closes the phone so the card is what you see.
  if ((g.mode === 'busted' || g.mode === 'wasted') && g.phoneOpen) {
    g.phoneOpen = false;
  }
  if (g.audio && g.player.inCar) {
    g.audio.engine(Math.abs(g.player.inCar.speed || 0));
  }
}

// Re-spawn every world entity, exactly as at boot. The spawns are
// seeded, so the result is identical to the boot-time world.
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
  spawnEvents(g);
  g._taxiRequested = false;
  g._taxiCab = null;
  g._taxiState = null;
  return g;
}

// ---------- rendering ----------
export function renderFrame(g) {
  if (!g.renderer) return;
  const canvas = g.renderer.canvas;
  const w = canvas ? canvas.width : 1280;
  const h = canvas ? canvas.height : 720;
  updateHud(g, g.hud);

  const cam = g.camera;
  const vp = cam ? computeViewProj(cam, w, h) : [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const camPos = cam ? [cam.x, cam.y, cam.z] : [0, 4, 6];
  const s = g.weatherObj ? g.weatherObj.sample() : sampleAt(g.clock);
  g.renderer.setFrame(vp, camPos, [s.fogNear, s.fogFar], s.fog || [0.7, 0.75, 0.85]);

  const dyn = BoxBatch();
  collectDynamicBoxes(g, dyn, cam);
  g._lastDynTris = batchTris(dyn);

  g.renderer.beginFrame(s.sky || [0.45, 0.65, 0.9]);
  g.renderer.drawBatch(g.renderer.staticBatch);
  g.renderer.drawBatch(dyn);
  g.renderer.drawBatch(g.renderer.glbBatch);
}

// Everything that moves, drawn into the dynamic batch.
export function collectDynamicBoxes(g, b, camera) {
  const phase = g._phase || phaseAt(g.clock);
  const p = g.player;

  playerBoxes(g, b, camera);
  for (const v of g.vehicles) vehicleBoxes(g, v, b, camera);
  for (const t of g.traffic) vehicleBoxes(g, t, b, camera);
  for (const ped of g.peds) pedBoxes(g, ped, b, camera);
  for (const cop of g.cops) policeBoxes(g, cop, b, camera);
  for (const car of g.copCars) vehicleBoxes(g, car, b, camera);
  for (const rb of g.roadblocks) roadblockBoxes(g, rb, b, camera);
  heliBoxes(g, b, camera);
  for (const m of g.gangMembers) gangBoxes(g, m, b, camera);
  livingBoxes(g, b, camera);
  catBoxes(g, b, camera);
  fireBoxes(g, b, camera);
  eventBoxes(g, b, camera);
  trainingBoxes(g, b, camera);
  activitiesBoxes(g, b, camera);
  interiorBoxes(g, b, camera);
  foodSignBoxes(g, b, camera);
  mayaBoxes(g, b, camera);

  // Cash pickups.
  for (const pickup of g.pickups || []) {
    pushBox(b, pickup.x, 0.2, pickup.z, 0.5, 0.15, 0.3, [0.2, 0.9, 0.3], [0, 0, 1, 1]);
  }
  // The mission marker floats gold above its spot.
  if (g.missionMarker) {
    pushBox(b, g.missionMarker.x, 3, g.missionMarker.z, 0.8, 2.4, 0.8, [0.95, 0.75, 0.1], [0, 0, 1, 1]);
  }
  // Golden hour (and sunset) puts a warm sun in the sky.
  if (phase === 'golden' || phase === 'sunset') {
    pushBox(b, p.x + 60, 70, p.z - 150, 12, 12, 1, [1, 0.85, 0.3], [0, 0, 1, 1]);
  }
  // Rain: drops around the player.
  if (g.weather === 'rain' || g.rain > 0.5) {
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const r = 8 + (i % 5) * 6;
      const y = 2 + ((g.time * 3 + i * 1.7) % 8);
      pushBox(b, p.x + Math.cos(a) * r, y, p.z + Math.sin(a) * r, 0.12, 0.6, 0.12, [0.7, 0.85, 0.95], [0, 0, 1, 1]);
    }
  }
  return batchTris(b);
}

// ---------- browser entrypoint ----------
// When main.js is loaded as the page's module script, start the game.
// (In Node / the test harness there is no document, so nothing runs.)
if (typeof document !== 'undefined' && document.getElementById) {
  const canvas = document.getElementById('game-canvas');
  if (canvas) {
    boot(canvas, document);
  }
}
