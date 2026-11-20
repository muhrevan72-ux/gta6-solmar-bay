// Solmar Bay — fire service.
//
// Fires break out in random buildings. The fire truck is parked
// at the fire station; drive it (or walk) to a fire and spray
// water (hold F near the flames). Each fire put out pays $150
// and +15 respect. Unattended fires spread slowly.

import { makeRng, SPAWNS, TUNE } from './config.js';
import { pushBox } from './render.js';
import { tileUV } from './texture.js';
import { dist } from './config.js';
import { addCash, showToast } from './state.js';
import { makeVehicle } from './vehicles.js';

export function spawnFireService(game) {
  game.fires = [];
  game._fireTimer = 60;
  // The fire truck at the station.
  const truck = makeVehicle('car', SPAWNS.fireStation.x + 10, SPAWNS.fireStation.z, 0, [0.85, 0.2, 0.15], 'Fire Truck');
  game.vehicles.push(truck);
}

export function stepFires(game, dt) {
  // NB: `|| 60` would treat a 0 timer as "unset" and reset it to
  // 60, so a fire could never break out — default only when the
  // timer is truly undefined.
  game._fireTimer = (game._fireTimer === undefined ? 60 : game._fireTimer) - dt;
  if (game._fireTimer <= 0) {
    game._fireTimer = 90 + Math.random() * 90;
    const b = game.city.buildings[Math.floor(Math.random() * game.city.buildings.length)];
    if (b && !game.fires.some((f) => f.x === b.x && f.z === b.z)) {
      game.fires.push({ x: b.x, z: b.z, hp: 100, spread: 0 });
      showToast(game, `Fire reported near ${b.label || 'a building'}!`);
    }
  }
  for (const f of game.fires) {
    f.spread += dt;
    // A fire grows until it is sprayed.
    f.hp = Math.min(150, f.hp + dt * 0.5);
  }
  game.fires = game.fires.filter((f) => f.hp > 0);
}

// Spray water at the nearest fire within 8 m. Hold F near flames.
export function sprayFire(game, dt) {
  const p = game.player;
  for (const f of game.fires) {
    const d = dist(f.x, f.z, p.x, p.z);
    if (d < 8) {
      f.hp -= 40 * dt;
      if (f.hp <= 0) {
        game.stats.firesOut += 1;
        addCash(game, TUNE.fireReward, '— fire put out');
        game.respect += 15;
        showToast(game, `Fire out! +$${TUNE.fireReward} · +15 respect`);
      }
      return true;
    }
  }
  return false;
}

// Fire boxes: orange/red flickering flames + smoke.
export function fireBoxes(game, b, cam) {
  const uv = tileUV('plain');
  const flick = 0.8 + Math.sin(game.time * 12) * 0.2;
  for (const f of game.fires) {
    const h = 2 + (f.hp / 100) * 3;
    pushBox(b, f.x, 0, f.z, 2, h * flick, 2, [1, 0.45 * flick, 0.1], uv);
    pushBox(b, f.x + 1, 0, f.z, 1.2, h * 0.7 * flick, 1.2, [1, 0.7, 0.1], uv);
    pushBox(b, f.x, h, f.z, 2.5, 1.5, 2.5, [0.3, 0.3, 0.3], uv); // smoke
  }
  return game.fires.length;
}
