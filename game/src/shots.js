// The screenshot scenes behind ?shot=chase|drive|beach|title. Each one
// stages the real game — a fresh state, the player placed, the mission
// started, the police spawned — then plays the real rules forward for a
// fixed number of steps, so the frame is what a short game really looks
// like. The parent takes the screenshots in a desktop browser from the
// staged page and writes the files into screenshots/.
import { STEP } from './config.js';
import { makeCar } from './vehicles.js';
import { startMission } from './missions.js';
import { ensurePolice, updatePolice, updateWanted } from './police.js';
import { updateTraffic } from './vehicles.js';
import { updatePeds } from './pedestrians.js';
import { updatePlayerCar } from './vehicles.js';
import { resetGameState } from './state.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './hud.js';
import { mulberry32 } from './config.js';

const SIM_SECONDS = 2;

function settle(state, seconds, drive) {
  const rng = mulberry32(99);
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (drive && state.player.car) {
      updatePlayerCar(state.player.car, { up: true, down: false, left: false, right: false, handbrake: false }, STEP, state.world);
    }
    updateTraffic(state.world, state.cars, STEP, state.player.x, state.player.y, rng);
    updatePeds(state.world, state.peds, STEP, null, rng);
    if (state.wanted > 0) {
      ensurePolice(state, state.world, rng);
      updatePolice(state, state.world, STEP);
      updateWanted(state, STEP);
    }
    state.time += STEP;
  }
}

function givePlayerCar(state, x, y, angle, speed) {
  const car = state.cars.find((c) => c.kind === 'parked') || makeCar('parked', x, y, angle);
  car.kind = 'player';
  car.driver = 'player';
  car.route = null;
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.speed = speed;
  car.hp = 100;
  if (!state.cars.includes(car)) state.cars.push(car);
  state.player.onFoot = false;
  state.player.car = car;
  state.player.x = x;
  state.player.y = y;
  state.player.angle = angle;
  return car;
}

function stageChase(state) {
  resetGameState(state, mulberry32(7));
  const p = state.world.points.downtown;
  givePlayerCar(state, p.x - 300, p.y, 0, 430);
  startMission(state, 2); // Getaway: wanted 3, lose the cops.
  // Three patrol cars right behind, already at speed.
  const offsets = [[-260, -46], [-330, 30], [-200, 90]];
  for (const [dx, dy] of offsets) {
    const car = makeCar('police', p.x - 300 + dx, p.y + dy, 0, '#2f6fd2');
    car.driver = 'npc';
    car.hp = 120;
    car.speed = 500;
    state.cars.push(car);
  }
  settle(state, SIM_SECONDS, true);
  return { screen: SCREEN_PLAY };
}

function stageDrive(state) {
  resetGameState(state, mulberry32(21));
  const p = state.world.points.downtown;
  givePlayerCar(state, p.x, p.y, 0, 320);
  startMission(state, 0); // First Wheels…
  state.mission.step = 1; // …past the steal, driving to the garage.
  settle(state, 1.2, true);
  return { screen: SCREEN_PLAY };
}

function stageBeach(state) {
  resetGameState(state, mulberry32(33));
  const p = state.world.points.beach;
  state.player.x = p.x + 30;
  state.player.y = p.y - 320;
  state.player.angle = Math.PI / 2;
  state.camera.x = state.player.x;
  state.camera.y = state.player.y;
  startMission(state, 3); // Night Run: first fare at the beach road.
  settle(state, 1, false);
  return { screen: SCREEN_PLAY };
}

function stageTitle(state) {
  resetGameState(state, mulberry32(55));
  const p = state.world.points.downtown;
  state.camera.x = p.x;
  state.camera.y = p.y;
  settle(state, 5, false);
  return { screen: SCREEN_TITLE };
}

/**
 * Set the game to the named scene (chase, drive, beach; any other name
 * is the title) and return the screen to draw over it.
 */
export function stageShot(name, state) {
  if (name === 'chase') return stageChase(state);
  if (name === 'drive') return stageDrive(state);
  if (name === 'beach') return stageBeach(state);
  return stageTitle(state);
}
