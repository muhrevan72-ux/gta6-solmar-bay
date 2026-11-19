// Solmar Bay — game loop and wiring. Builds the shared `game` object,
// runs the frame loop, owns the menus, and glues every module together.

import { createRenderer } from './render.js';
import { generateCity, buildStaticBoxes, buildWaterBoxes } from './world.js';
import { COL } from './config.js';
import { createInput } from './input.js';
import { createCamera, updateCamera } from './shots.js';
import {
  createState, resetState, damagePlayer, healPlayer, addArmor,
  spendAmmo, setToast, MODES, selectWeapon,
} from './state.js';
import { createPlayer, updatePlayer, drawPlayer } from './player.js';
import { createVehicles, updateVehicles, drawVehicles } from './vehicles.js';
import { createPeds, updatePeds, drawPeds, fleeFrom } from './pedestrians.js';
import { createPolice, updatePolice, drawPolice, getBusted } from './police.js';
import { createMissions, startChapter, updateMissions, drawMissions } from './missions.js';
import {
  createCombat, seedPickups, tryPunch, tryShoot, throwBomb,
  updateCombat, drawCombat, damagePed,
} from './combat.js';
import { createHud, updateHud, showOverlay } from './hud.js';
import { createAudio } from './audio.js';
import { saveGame, loadGame } from './save.js';

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const input = createInput(canvas);
const hud = createHud();
const audio = createAudio();
const city = generateCity();
renderer.bakeStatic(buildStaticBoxes(city));

const game = {
  canvas, renderer, input, hud, audio, city,
  camera: createCamera(),
  state: createState(),
  player: createPlayer(city.spawns.player),
  vehicles: createVehicles(city),
  peds: createPeds(city),
  police: createPolice(),
  missions: createMissions(),
  combat: createCombat(),
  COL,
  time: 0,
  eCooldown: 0,
  gCooldown: 0,
  flashT: 0,
  saveT: 0,
  menuOrbit: 0,
};

// attach cross-module helpers the modules call through `game`
game.peds.fleeFrom = (x, z, r) => fleeFrom(game.peds, x, z, r);
game.combat.damagePed = (g, ped, dmg, cause) => damagePed(g, ped, dmg, cause);
game.toast = (text, seconds) => setToast(game.state, text, seconds);
game.healPlayer = (amount) => healPlayer(game.state, amount);
game.addArmor = (amount) => addArmor(game.state, amount);
game.spendAmmo = () => spendAmmo(game.state);
game.hurtPlayer = (amount, cause) => {
  if (game.state.mode !== 'playing') return;
  if (damagePlayer(game.state, amount)) {
    getBusted(game, cause === 'cop' ? 'Busted by the police' : 'You died');
  }
};
game.save = () => saveGame(game);

seedPickups(game);

// ---- menus ----

function startNewGame() {
  audio.ensure();
  audio.startBass();
  resetState(game.state, true);
  game.player = createPlayer(city.spawns.player);
  game.vehicles = createVehicles(city);
  game.peds = createPeds(city);
  game.peds.fleeFrom = (x, z, r) => fleeFrom(game.peds, x, z, r);
  game.police = createPolice();
  game.missions = createMissions();
  game.combat = createCombat();
  game.combat.damagePed = (g, ped, dmg, cause) => damagePed(g, ped, dmg, cause);
  seedPickups(game);
  game.camera = createCamera();
  startChapter(game, 0);
  showOverlay(hud, null);
  game.state.mode = 'chapter';
}

function continueGame() {
  const data = loadGame();
  if (!data) return;
  audio.ensure();
  audio.startBass();
  resetState(game.state, true);
  game.state.cash = data.cash;
  game.state.chapter = data.chapter;
  game.state.stats = { ...game.state.stats, ...data.stats };
  game.state.weapon = data.weapon || 'pistol';
  game.state.ammo = data.ammo || { smg: 0, shotgun: 0 };
  game.state.bombs = data.bombs ?? 3;
  game.player = createPlayer({ x: data.player.x, z: data.player.z });
  game.vehicles = createVehicles(city);
  game.peds = createPeds(city);
  game.peds.fleeFrom = (x, z, r) => fleeFrom(game.peds, x, z, r);
  game.police = createPolice();
  game.missions = createMissions();
  game.combat = createCombat();
  game.combat.damagePed = (g, ped, dmg, cause) => damagePed(g, ped, dmg, cause);
  seedPickups(game);
  game.camera = createCamera();
  if (data.chapter >= 5) {
    game.state.chapterActive = false;
    game.state.objective = 'Story complete — Solmar Bay is yours. Free roam!';
    game.state.mode = 'playing';
    showOverlay(hud, null);
  } else {
    startChapter(game, data.chapter);
  }
}

function respawnAfterBusted() {
  audio.ensure();
  resetState(game.state, false);
  game.state.mode = 'playing';
  showOverlay(hud, null);
  if (game.state.chapterActive && game.state.chapter < 5) {
    startChapter(game, game.state.chapter);
  } else {
    game.state.objective = 'Free roam — find a side-job marker.';
  }
  game.save();
}

document.getElementById('btn-new').addEventListener('click', startNewGame);
document.getElementById('btn-continue').addEventListener('click', continueGame);
document.getElementById('btn-resume').addEventListener('click', () => {
  game.state.mode = 'playing';
  showOverlay(hud, null);
});
document.getElementById('btn-busted').addEventListener('click', respawnAfterBusted);
document.getElementById('btn-roam').addEventListener('click', () => {
  game.state.mode = 'playing';
  showOverlay(hud, null);
});
document.getElementById('btn-chapter').addEventListener('click', () => {
  if (game.state.mode === 'chapter') game.state.mode = 'playing';
});
document.getElementById('btn-menu-quit').addEventListener('click', () => {
  game.save();
  game.state.mode = 'menu';
  showOverlay(hud, 'menu');
  refreshMenu();
});

function refreshMenu() {
  const data = loadGame();
  hud.menuContinue.style.display = data ? 'inline-block' : 'none';
  document.getElementById('menu-save-info').textContent = data
    ? `Save found: $${data.cash}, chapter ${Math.min(data.chapter + 1, 5)} of 5`
    : 'No save yet — start a new game.';
}
refreshMenu();
showOverlay(hud, 'menu');

// ---- resize ----

function resize() {
  const w = Math.min(window.innerWidth, 1920);
  const h = Math.min(window.innerHeight, 1080);
  canvas.width = w;
  canvas.height = h;
}
window.addEventListener('resize', resize);
resize();

// ---- main loop ----

let lastT = performance.now();
let prevKeys = new Set();
let lastMode = null;

// Keep the visible overlay in sync with the game mode. Modes change
// inside the modules (chapter intros, busted, story complete), so the
// overlay must follow the mode instead of being shown only by buttons.
function syncOverlay() {
  const mode = game.state.mode;
  if (mode === lastMode) return;
  lastMode = mode;
  const map = { menu: 'menu', paused: 'pause', busted: 'busted', chapter: 'chapter', complete: 'complete', playing: null };
  showOverlay(hud, map[mode] ?? null);
  if (mode === 'chapter') {
    hud.chapterTitle.textContent = game.state.chapterTitle;
    hud.chapterText.textContent = game.state.chapterText;
  }
}

function justPressed(code) {
  return input.keys.has(code) && !prevKeys.has(code);
}

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - lastT) / 1000;
  lastT = now;
  if (dt > 0.05) dt = 0.05;
  if (dt <= 0) dt = 0.001;

  const state = game.state;
  const aspect = canvas.width / canvas.height;
  syncOverlay();

  if (state.mode === 'menu') {
    // slow orbit over downtown as a living backdrop
    game.menuOrbit += dt * 0.08;
    const eye = [Math.sin(game.menuOrbit) * 150, 70, Math.cos(game.menuOrbit) * 150];
    renderer.beginFrame(eye, [0, 8, 0], aspect);
    for (const w of buildWaterBoxes(city, game.time)) {
      renderer.water(w.x, w.y, w.z, w.sx, w.sy, w.sz, w.color);
    }
    drawVehicles(renderer, game);
    drawPeds(renderer, game);
    renderer.endFrame();
    input.endFrame();
    prevKeys = new Set(input.keys);
    return;
  }

  if (state.mode === 'chapter') {
    game.missions.introT += dt;
    if (game.missions.introT > 4 || justPressed('Enter')) {
      state.mode = 'playing';
      showOverlay(hud, null);
    }
    // keep rendering the world behind the chapter card
    renderWorld(dt, aspect);
    input.endFrame();
    prevKeys = new Set(input.keys);
    return;
  }

  if (state.mode === 'paused') {
    if (justPressed('Escape') || justPressed('KeyP')) {
      state.mode = 'playing';
      showOverlay(hud, null);
    }
    renderWorld(dt, aspect);
    input.endFrame();
    prevKeys = new Set(input.keys);
    return;
  }

  if (state.mode === 'busted') {
    hud.bustedReason.textContent = state.bustedReason || '';
    renderWorld(dt, aspect);
    input.endFrame();
    prevKeys = new Set(input.keys);
    return;
  }

  if (state.mode === 'complete') {
    hud.completeStats.textContent =
      `Cash $${state.cash} · Kills ${state.stats.kills} · Cars stolen ${state.stats.carsStolen} · ` +
      `Missions ${state.stats.missionsDone} · Side jobs ${state.stats.sideDone} · ` +
      `Driven ${Math.round(state.stats.distanceDriven / 1000)} km`;
    renderWorld(dt, aspect);
    input.endFrame();
    prevKeys = new Set(input.keys);
    return;
  }

  // ---- playing ----
  game.time += dt;
  state.stats.timePlayed += dt;
  if (state.toastTimer > 0) state.toastTimer -= dt;
  if (game.flashT > 0) game.flashT -= dt;

  if (justPressed('Escape') || justPressed('KeyP')) {
    state.mode = 'paused';
    showOverlay(hud, 'pause');
    input.endFrame();
    prevKeys = new Set(input.keys);
    return;
  }
  if (justPressed('KeyM')) {
    audio.setMuted(!audio.muted);
    game.toast(audio.muted ? 'Sound off' : 'Sound on');
  }
  if (justPressed('Digit1')) selectWeapon(state, 'pistol');
  if (justPressed('Digit2')) selectWeapon(state, 'smg');
  if (justPressed('Digit3')) selectWeapon(state, 'shotgun');
  if (justPressed('KeyG') && game.gCooldown <= 0) {
    game.gCooldown = 0.4;
    throwBomb(game);
  }
  if (game.gCooldown > 0) game.gCooldown -= dt;
  if (input.down('KeyF')) tryPunch(game);
  if (input.clicked) tryShoot(game);
  else if (input.mouseDown && state.weapon === 'smg') tryShoot(game);

  updatePlayer(dt, game);
  updateVehicles(dt, game);
  updatePeds(dt, game);
  updatePolice(dt, game);
  updateMissions(dt, game);
  updateCombat(dt, game);

  // engine sound follows the driven vehicle
  const v = game.player.inVehicle;
  if (v) audio.setEngine(v.speed, v.kind === 'plane' ? 72 : v.kind === 'bike' ? 48 : v.kind === 'boat' ? 26 : 38);
  else audio.setEngine(0, 38);

  renderWorld(dt, aspect);
  updateHud(hud, game);

  // explosion flash
  const flash = document.getElementById('flash');
  if (flash) flash.style.opacity = game.flashT > 0 ? String(game.flashT / 0.12 * 0.55) : '0';

  // autosave
  game.saveT += dt;
  if (game.saveT > 15) {
    game.saveT = 0;
    game.save();
  }

  input.endFrame();
  prevKeys = new Set(input.keys);
}

function renderWorld(dt, aspect) {
  const p = game.player;
  const v = p.inVehicle;
  const focus = v ? { x: v.x, y: v.y, z: v.z } : { x: p.x, y: p.y, z: p.z };
  const heading = v ? v.heading : p.heading;
  const mode = v ? (v.kind === 'plane' ? 'fly' : 'drive') : 'foot';
  updateCamera(game.camera, dt, input, focus, heading, mode);
  renderer.beginFrame(game.camera.eye, game.camera.target, aspect);
  drawPlayer(renderer, game);
  drawVehicles(renderer, game);
  drawPeds(renderer, game);
  drawPolice(renderer, game);
  drawCombat(renderer, game);
  drawMissions(renderer, game);
  for (const w of buildWaterBoxes(city, game.time)) {
    renderer.water(w.x, w.y, w.z, w.sx, w.sy, w.sz, w.color);
  }
  renderer.endFrame();
}

requestAnimationFrame(frame);
