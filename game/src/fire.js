// Solmar Bay — firefighters.
//
// Fires spawn on random cars/buildings (smoke + flame). The fire
// truck is drivable; park near a fire and hold the spray key
// (F) to extinguish it. Each fire out pays $150 and +15 respect.
// Firefighter NPCs hang out at the fire station.

import { TUNE, SPAWNS, dist, makeRng } from './config.js';
import { addCash, showToast } from './state.js';

export function spawnFireService(game) {
  game.fires = [];
  game.fireTimer = 90;
  game.firefighters = [];
  for (let i = 0; i < 3; i++) {
    game.firefighters.push({
      x: SPAWNS.fireStation.x - 10 + i * 8,
      z: SPAWNS.fireStation.z + 20,
      heading: 0, hp: 100,
    });
  }
}

export function stepFires(game, dt) {
  game.fireTimer -= dt;
  if (game.fireTimer <= 0) {
    game.fireTimer = 90 + Math.random() * 90;
    // A fire starts on a random parked car or a building edge.
    const spots = game.vehicles.filter((v) => v.parked && !v.wrecked);
    if (spots.length > 0 && game.fires.length < 3) {
      const v = spots[Math.floor(Math.random() * spots.length)];
      game.fires.push({ x: v.x, z: v.z, t: 120, size: 2 });
      showToast(game, 'Fire reported! Grab the fire truck (F to spray)');
    }
  }
  for (const f of [...game.fires]) {
    f.t -= dt;
    if (f.t <= 0) {
      game.fires.splice(game.fires.indexOf(f), 1);
      showToast(game, 'A fire burned out on its own');
    }
  }
}

// Spray water (hold F near a fire while in the fire truck).
// Returns true when a fire was extinguished this frame.
export function sprayFire(game, dt) {
  const p = game.player;
  const truck = p.inCar && p.inCar.kind === 'firetruck' ? p.inCar : null;
  if (!truck) return false;
  for (const f of [...game.fires]) {
    if (dist(truck.x, truck.z, f.x, f.z) < 14) {
      f.t -= dt * 4; // spraying drains the fire fast
      if (f.t <= 0) {
        game.fires.splice(game.fires.indexOf(f), 1);
        addCash(game, TUNE.fireReward, 'fire out');
        game.respect += 15;
        game.stats.firesOut += 1;
        return true;
      }
    }
  }
  return false;
}

// Draw fires: flame boxes + smoke boxes, flickering with time.
export function fireBoxes(game, out) {
  for (const f of game.fires) {
    const fl = 1 + Math.sin(game.time * 9 + f.x) * 0.3;
    out.push({ x: f.x, y: 0, z: f.z, w: f.size * fl, h: 2.2 * fl, d: f.size * fl, c: [1.3, 0.5, 0.1] });
    out.push({ x: f.x + 0.5, y: 1.5, z: f.z, w: f.size * 0.7, h: 2 * fl, d: f.size * 0.7, c: [1.3, 0.9, 0.2] });
    out.push({ x: f.x, y: 3, z: f.z, w: 1.4, h: 1.6, d: 1.4, c: [0.35, 0.35, 0.36] });
  }
  for (const ff of game.firefighters) {
    out.push({ x: ff.x, y: 0.85, z: ff.z, w: 0.8, h: 0.8, d: 0.45, c: [0.85, 0.2, 0.15] });
    out.push({ x: ff.x, y: 1.65, z: ff.z, w: 0.58, h: 0.55, d: 0.5, c: [0.95, 0.8, 0.65] });
    out.push({ x: ff.x, y: 1.9, z: ff.z, w: 0.6, h: 0.2, d: 0.55, c: [0.9, 0.15, 0.15] });
  }
  return out;
}
