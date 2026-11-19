// Solmar Bay — fire: fires break out in the city, the player
// extinguishes them (E near a fire with the fire truck nearby, or
// just E near a fire) for $150 + 15 respect per fire.
//
// A fire is a flickering orange/red box stack with smoke. The fire
// station is at (150, 132); the fire truck is parked there.

import { TUNE, COL } from './config.js';
import { showToast, addCash, addRespect } from './state.js';

export function createFire(city) {
  return {
    fires: [], // {x, z, size, t}
    spawnT: 30, // seconds until the next fire
    truck: { x: 150, z: 132, heading: 0 },
  };
}

export function stepFire(game, dt) {
  const f = game.fire;
  const s = game.state;
  // A new fire every ~60-90 s, max 3 at once.
  f.spawnT -= dt;
  if (f.spawnT <= 0) {
    f.spawnT = 60 + Math.random() * 30;
    if (f.fires.length < 3) {
      const b = game.city.buildings[Math.floor(Math.random() * game.city.buildings.length)];
      f.fires.push({ x: b.x, z: b.z, size: 2 + Math.random() * 2, t: 0 });
      const label = b.kind.startsWith('shop') ? 'a shop' : b.kind === 'tower' ? 'a tower' : 'a ' + b.kind;
      showToast(s, 'A fire broke out in ' + label + '! Put it out for $150.', 5);
    }
  }
  for (const fire of f.fires) fire.t += dt;
}

// Extinguish: E within 5 m of a fire. Called from main.js's E
// dispatcher (not from stepFire) so E is consumed exactly once.
export function tryFire(game) {
  const f = game.fire;
  const s = game.state;
  const p = s.player;
  let putOut = false;
  for (let i = f.fires.length - 1; i >= 0; i--) {
    const fire = f.fires[i];
    if (Math.hypot(fire.x - p.x, fire.z - p.z) < 5) {
      f.fires.splice(i, 1);
      addCash(s, TUNE.fireReward);
      addRespect(s, 15);
      s.stats.fires++;
      showToast(s, 'Fire out! +$' + TUNE.fireReward + ', +15 REP', 4);
      putOut = true;
    }
  }
  return putOut;
}

export function fireBoxes(game, out) {
  const f = game.fire;
  for (const fire of f.fires) {
    const flicker = 0.8 + Math.sin(fire.t * 12) * 0.2;
    out.pushBox(fire.x, 1, fire.z, fire.size, 2 * flicker, fire.size, [1, 0.4 * flicker, 0.1]);
    out.pushBox(fire.x + 0.5, 2.5, fire.z, fire.size * 0.6, 1.5, fire.size * 0.6, [1, 0.6, 0.1]);
    // Smoke.
    out.pushBox(fire.x, 4.5 + Math.sin(fire.t * 2) * 0.3, fire.z, 1.5, 1.5, 1.5, [0.3, 0.3, 0.3]);
  }
  // Fire truck at the station.
  const t = f.truck;
  out.pushBoxRot(t.x, 0.8, t.z, 2.2, 1.6, 5, [0.9, 0.1, 0.1], t.heading);
  out.pushBoxRot(t.x, 1.8, t.z + 1, 2.0, 0.8, 2, [0.9, 0.1, 0.1], t.heading);
  out.pushBoxRot(t.x, 1.9, t.z + 2.2, 1.8, 0.4, 0.1, [0.8, 0.8, 0.9], t.heading);
  out.pushFlat(t.x, 0.06, t.z, 2.6, 5.4, [0, 0, 0], t.heading);
}
