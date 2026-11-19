// The one shared game state: everything the loop, the renderer, the
// HUD and the screenshot scenes read. main.js creates it; shots.js
// creates it too, so the two never drift apart.
import { TUNING } from './config.js';
import { makeMissionState } from './missions.js';
import { makePickups } from './combat.js';
import { makePlayer } from './player.js';
import { spawnParkedCars, spawnTrafficCars } from './vehicles.js';
import { spawnPeds } from './pedestrians.js';
import { createCamera } from './render.js';
import { mulberry32 } from './config.js';

export function createGameState(world, rng) {
  const random = rng || mulberry32(20261119);
  const player = makePlayer(world.spawn.x, world.spawn.y);
  const state = {
    world,
    player,
    cars: [],
    peds: [],
    cops: [],
    pickups: [],
    particles: [],
    events: [],
    cash: 0,
    wanted: 0,
    wantedTimer: 0,
    wantedDecayT: 0,
    mission: makeMissionState(),
    camera: createCamera(),
    time: 0,
    mode: 'title',
    banner: '',
    bannerT: 0,
    marker: null,
    stats: { carsStolen: 0, pedsHit: 0, missionsDone: 0, busted: 0 },
    saveT: 0,
  };
  state.cars.push(...spawnParkedCars(world, random, 14, world.spawn.x, world.spawn.y, 200));
  state.cars.push(...spawnTrafficCars(world, random, 14, world.spawn.x, world.spawn.y, 300));
  state.peds.push(...spawnPeds(world, random, 24, world.spawn.x, world.spawn.y, 150));
  state.pickups.push(...makePickups(world, random));
  state.camera.x = player.x;
  state.camera.y = player.y;
  return state;
}

// Put a fresh state back at the garage with a clean sheet, keeping the
// world's layout. Used by New Game and by the screenshot scenes.
export function resetGameState(state, rng) {
  const world = state.world;
  const fresh = createGameState(world, rng);
  for (const key of Object.keys(fresh)) state[key] = fresh[key];
  state.player.health = TUNING.maxHealth;
  return state;
}

export function addParticles(state, x, y, count, color, speed) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const v = (speed || 90) * (0.4 + Math.random() * 0.8);
    state.particles.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: 0.5 + Math.random() * 0.5,
      maxLife: 1,
      color,
      size: 2 + Math.random() * 4,
    });
  }
}

export function updateParticles(state, dt) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const p = state.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) state.particles.splice(i, 1);
  }
}
