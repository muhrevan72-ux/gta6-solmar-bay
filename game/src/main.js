// Solmar Bay — boot and the one loop: input is read every frame, the
// city advances in fixed 1/60 s steps (several in a slow frame, none in
// a fast one), and the renderer paints what is there. The game moves
// between four screens: title, play, paused and busted.
//
// ?shot=chase|drive|beach|title (with &seed=N) stages that scene instead
// of running the loop, paints it twice and sets window.__shotReady for
// a screenshot. window.SOLMAR exposes the live state and a few staging
// helpers for the same job.
import { STEP, TUNING, VIEW_H, VIEW_W } from './config.js';
import { createWorld } from './world.js';
import { addParticles, createGameState, resetGameState, updateParticles } from './state.js';
import {
  ACTION_CONFIRM, ACTION_INTERACT, ACTION_MUTE, ACTION_NEW, ACTION_PAUSE, ACTION_PUNCH, createInput,
} from './input.js';
import { exitCar, punch, tryEnterCar, updateOnFoot } from './player.js';
import { resolveCarCollisions, updatePlayerCar, updateTraffic } from './vehicles.js';
import { knockDown, pedsHitByCar, updatePeds } from './pedestrians.js';
import { ensurePolice, updatePolice, updateWanted, wantedGain } from './police.js';
import { currentMission, missionMarker, startMission, updateMissions } from './missions.js';
import { checkBusted, updatePickups } from './combat.js';
import { createAudio } from './audio.js';
import {
  SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE,
  drawBusted, drawHud, drawPaused, drawTitle,
} from './hud.js';
import { drawScene, updateCamera } from './render.js';
import { clearSave, hasSave, loadGame, saveGame } from './save.js';
import { stageShot } from './shots.js';
import { makeCar } from './vehicles.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const context = canvas.getContext('2d');
const world = createWorld();
const state = createGameState(world);
const audio = createAudio();

function announce(message) {
  status.textContent = message;
}

function applySave(data) {
  state.cash = data.cash;
  state.player.x = data.playerX;
  state.player.y = data.playerY;
  state.player.health = data.health;
  state.player.armor = data.armor;
  state.stats = { ...state.stats, ...data.stats };
  state.mission.index = data.missionIndex;
  state.mission.phase = data.missionIndex >= 5 ? 'done' : 'idle';
  state.camera.x = data.playerX;
  state.camera.y = data.playerY;
}

function startGame(useSave) {
  const data = useSave ? loadGame() : null;
  resetGameState(state);
  if (data) applySave(data);
  state.mode = SCREEN_PLAY;
  state.time = 0;
  audio.init();
  announce('Playing Solmar Bay. Steal a car, lose the cops, run the missions.');
}

function syncFrame() {
  state.marker = missionMarker(state);
  const focusX = state.player.car ? state.player.car.x : state.player.x;
  const focusY = state.player.car ? state.player.car.y : state.player.y;
  updateCamera(state.camera, focusX, focusY, STEP);
}

function paint() {
  drawScene(context, state, state.camera);
  if (state.mode === SCREEN_TITLE) {
    const data = loadGame();
    drawTitle(context, hasSave(), data ? data.cash : 0);
  } else {
    drawHud(context, state);
    if (state.mode === SCREEN_PAUSED) drawPaused(context);
    else if (state.mode === SCREEN_BUSTED) drawBusted(context, state.lastFine || 0);
  }
}

function stepPlaying(dt) {
  state.time += dt;
  const player = state.player;
  const input = state.input;
  const move = input.move();

  if (player.onFoot) {
    updateOnFoot(player, move, input.run(), dt, world);
  } else if (player.car) {
    const drive = input.drive();
    const result = updatePlayerCar(player.car, drive, dt, world);
    if (result.crashed) {
      state.camera.shake = 0.7;
      audio.crash();
      addParticles(state, player.car.x, player.car.y, 8, '#888888', 120);
    }
    if (player.car.hp <= 0) {
      state.banner = 'Your car is wrecked — get out and find another.';
      state.bannerT = 3;
      exitCar(state, world);
    }
  }

  // Traffic, pedestrians, and the police answer the player's heat.
  updateTraffic(world, state.cars, dt, player.x, player.y, Math.random);
  const danger = player.car && Math.abs(player.car.speed) > 150
    ? { x: player.car.x, y: player.car.y }
    : null;
  updatePeds(world, state.peds, dt, danger, Math.random);
  ensurePolice(state, world, Math.random);
  const policeResult = updatePolice(state, world, dt);
  if (policeResult === 'busted') {
    player.health = 0; // checkBusted below does the hospital trip.
  }
  updateWanted(state, dt);

  // Car-on-car crashes, and the player running peds over.
  for (const event of resolveCarCollisions(state.cars)) {
    if (!event.hard) continue;
    state.camera.shake = 0.6;
    audio.crash();
    const involvesPlayer = event.a === player.car || event.b === player.car;
    const involvesPolice = event.a.kind === 'police' || event.b.kind === 'police';
    if (involvesPlayer && involvesPolice) wantedGain(state, 1);
    if (involvesPlayer) addParticles(state, player.car.x, player.car.y, 10, '#bbbbbb', 140);
  }
  if (player.car) {
    for (const ped of pedsHitByCar(state.peds, player.car)) {
      knockDown(ped, 5);
      state.stats.pedsHit += 1;
      wantedGain(state, 1);
      audio.thud();
      state.camera.shake = 0.5;
      addParticles(state, ped.x, ped.y, 8, '#c23b2e', 100);
    }
  }

  updateMissions(state, dt);
  updatePickups(state, dt, Math.random);
  for (const event of state.events.splice(0)) {
    if (event.type === 'pickup') audio.pickup();
  }
  if (state.mission.bannerT > 0 && state.mission.banner.startsWith('Mission complete')) {
    // The jingle plays once per completion, on the frame it lands.
    if (!state._jingled) {
      audio.jingle();
      state._jingled = true;
      saveGame(state);
    }
  } else if (state.mission.bannerT <= 0) {
    state._jingled = false;
  }

  if (checkBusted(state)) {
    state.mode = SCREEN_BUSTED;
    audio.fail();
    announce('Busted. You wake up at the hospital.');
  }

  updateParticles(state, dt);
  if (state.bannerT > 0) state.bannerT -= dt;
  if (state.saveT > 0) state.saveT -= dt;
  else {
    state.saveT = 15;
    saveGame(state);
  }

  const speed01 = player.car ? Math.abs(player.car.speed) / TUNING.carMaxSpeed : 0;
  audio.update(dt, speed01, state.wanted);
  syncFrame();
}

function stepTitle(dt) {
  state.time += dt;
  updateTraffic(world, state.cars, dt, state.camera.x, state.camera.y, Math.random);
  updatePeds(world, state.peds, dt, null, Math.random);
  // A slow pan over downtown behind the title panel. No camera follow
  // here: the pan is the shot, so syncFrame's follow would fight it.
  const p = world.points.downtown;
  state.camera.x = p.x + Math.sin(state.time * 0.05) * 320;
  state.camera.y = p.y + Math.cos(state.time * 0.04) * 180;
  state.marker = null;
}

function handleActions() {
  const actions = state.input.takeActions();
  if (actions & ACTION_MUTE) {
    audio.setMuted(!audio.isMuted());
    return;
  }
  if (state.mode === SCREEN_TITLE) {
    if (actions & ACTION_NEW) {
      clearSave();
      startGame(false);
    } else if (actions & ACTION_CONFIRM) {
      startGame(hasSave());
    }
    return;
  }
  if (state.mode === SCREEN_BUSTED) {
    if (actions & ACTION_CONFIRM) {
      state.mode = SCREEN_PLAY;
      announce('Playing Solmar Bay.');
    }
    return;
  }
  if (state.mode === SCREEN_PAUSED) {
    if (actions & ACTION_PAUSE || actions & ACTION_CONFIRM) {
      state.mode = SCREEN_PLAY;
      announce('Playing.');
    }
    return;
  }
  // Playing.
  if (actions & ACTION_PAUSE) {
    state.mode = SCREEN_PAUSED;
    saveGame(state);
    announce('Paused.');
    return;
  }
  if (actions & ACTION_INTERACT) {
    const player = state.player;
    if (player.onFoot) {
      const entered = tryEnterCar(state);
      if (entered) {
        audio.blip();
        if (entered.stolen) {
          state.stats.carsStolen += 1;
          wantedGain(state, 1);
          state.banner = 'Car stolen — the law noticed.';
          state.bannerT = 3;
        }
      }
    } else {
      exitCar(state, world);
    }
  }
  if (actions & ACTION_PUNCH) {
    const targets = [...state.peds, ...state.cops];
    const hit = punch(state, targets);
    if (hit.length > 0) {
      audio.thud();
      for (const target of hit) {
        if (state.cops.includes(target)) {
          target.downT = 3;
          target.grabT = 0;
          wantedGain(state, 1);
        } else {
          knockDown(target, 4);
        }
      }
    }
  }
  if (actions & ACTION_CONFIRM) {
    const mission = currentMission(state);
    if (mission && state.mission.phase === 'idle') {
      startMission(state, state.mission.index);
      audio.blip();
    }
  }
}

function runShot(name) {
  const scene = stageShot(name, state);
  state.mode = scene.screen;
  state.input = { move: () => ({ x: 0, y: 0 }), drive: () => ({}), run: () => false, takeActions: () => 0 };
  if (scene.screen === SCREEN_TITLE) state.marker = null;
  else syncFrame();
  let painted = 0;
  function paintShot() {
    paint();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paintShot);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paintShot);
}

function runGame() {
  state.input = createInput(canvas);
  let accumulator = 0;
  let last = performance.now();

  // Staging helpers for screenshots and testing, part of the game itself.
  window.SOLMAR = {
    state,
    teleport(x, y) {
      state.player.x = x;
      state.player.y = y;
      state.camera.x = x;
      state.camera.y = y;
    },
    setWanted(n) { state.wanted = n; },
    startMission(i) { startMission(state, i); },
    giveCash(n) { state.cash += n; },
    spawnChase() {
      state.wanted = Math.max(state.wanted, 3);
      for (let i = 0; i < 3; i += 1) {
        const car = makeCar('police', state.player.x - 240 - i * 70, state.player.y + (i - 1) * 60, 0, '#2f6fd2');
        car.driver = 'npc';
        car.hp = 120;
        car.speed = 480;
        state.cars.push(car);
      }
    },
  };

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (state.mode === SCREEN_TITLE || state.mode === SCREEN_PLAY) {
      while (accumulator >= STEP && (state.mode === SCREEN_TITLE || state.mode === SCREEN_PLAY)) {
        if (state.mode === SCREEN_TITLE) stepTitle(STEP);
        else stepPlaying(STEP);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    paint();
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.mode === SCREEN_PLAY) {
      state.mode = SCREEN_PAUSED;
      saveGame(state);
      announce('Paused.');
    }
  });

  announce('Solmar Bay. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
