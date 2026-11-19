// Solmar Bay — firefighters: red fire truck, fire station, fires.
//
// Fires spawn (a burning car or building corner, with smoke + flame
// boxes). Firefighter side job: drive the truck near a fire and hold
// E to spray; extinguishing pays $150 + 15 respect.

import { TUNE, dist2 } from './config.js';
import { addCash, addRespect, showToast } from './state.js';
import { clearSpot } from './world.js';

export function createFire() {
  return {
    fires: [], // {x, z, t, hp}
    spawnT: 45, // seconds until the next fire
    spraying: 0,
  };
}

function spawnFire(game) {
  const city = game.city;
  for (let tries = 0; tries < 20; tries++) {
    const x = -300 + Math.random() * 600;
    const z = -300 + Math.random() * 600;
    if (!clearSpot(city, x, z, 2)) continue;
    if (dist2(x, z, game.state.player.x, game.state.player.z) < 2500) continue;
    game.fire.fires.push({ x, z, t: 0, hp: 100 });
    showToast(game.state, 'Fire reported! Grab the fire truck and put it out ($150).', 4);
    return true;
  }
  return false;
}

export function stepFire(game, dt) {
  const f = game.fire;
  f.spawnT -= dt;
  if (f.spawnT <= 0) {
    f.spawnT = 60 + Math.random() * 60;
    if (f.fires.length < 3) spawnFire(game);
  }
  const p = game.state.player;
  const inTruck = p.inCar && p.inCar.type === 'fire';
  for (let i = f.fires.length - 1; i >= 0; i--) {
    const fire = f.fires[i];
    fire.t += dt;
    // Spray: hold E while in the fire truck near the fire. (E is a
    // tap key, so the spray runs while the truck is near and the
    // player holds the key down.)
    if (inTruck && dist2(p.x, p.z, fire.x, fire.z) < 144) {
      if (game.input.down.has('KeyE')) {
        fire.hp -= 40 * dt;
        f.spraying = 0.2;
      }
    }
    if (fire.hp <= 0) {
      addCash(game.state, TUNE.fireReward);
      addRespect(game.state, 15);
      game.state.stats.fires++;
      showToast(game.state, 'Fire out! +$' + TUNE.fireReward + ' +15 REP', 3);
      f.fires.splice(i, 1);
    } else if (fire.t > 180) {
      // Burns itself out.
      f.fires.splice(i, 1);
    }
  }
  if (f.spraying > 0) f.spraying -= dt;
}

export function fireBoxes(game, out) {
  for (const fire of game.fire.fires) {
    // Flame (flickering orange/yellow) + smoke (grey, rising).
    const flick = 0.8 + Math.sin(fire.t * 9) * 0.3;
    out.pushBox(fire.x, 1.2, fire.z, 2.4, 2.4 * flick, 2.4, [1.0, 0.45, 0.1]);
    out.pushBox(fire.x, 2.6, fire.z, 1.6, 1.6, 1.6, [1.0, 0.8, 0.2]);
    out.pushBox(fire.x, 4.5 + Math.sin(fire.t * 2) * 0.5, fire.z, 2, 2, 2, [0.35, 0.35, 0.38]);
  }
  if (game.fire.spraying > 0) {
    const p = game.state.player;
    out.pushBox(p.x + Math.sin(p.heading) * 6, 1, p.z + Math.cos(p.heading) * 6, 1.5, 1.5, 1.5, [0.6, 0.8, 1.0]);
  }
}
