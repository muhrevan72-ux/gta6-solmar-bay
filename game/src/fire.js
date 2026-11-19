// Solmar Bay — firefighters: fires spawn around the city, the red
// fire truck (drivable) carries the spray, and holding F near a fire
// while in the truck extinguishes it for $150 a fire.

import { dist2 } from './config.js';
import { addCash, addRespect, showToast } from './state.js';
import { checkRespectUnlocks } from './missions.js';

export function createFire() {
  return {
    fires: [], // { x, z, hp, t }
    spawnT: 20,
    sprayT: 0,
  };
}

export function spawnFire(game, x, z) {
  game.fire.fires.push({ x, z, hp: 100, t: 0 });
}

export function updateFire(game, dt) {
  const fire = game.fire;
  // a new fire every ~45 seconds, up to 3 at once
  fire.spawnT -= dt;
  if (fire.spawnT <= 0) {
    fire.spawnT = 45;
    if (fire.fires.length < 3) {
      const x = -250 + Math.random() * 500;
      const z = -250 + Math.random() * 500;
      spawnFire(game, x, z);
      showToast(game.state, 'Fire reported! Grab the fire truck.', 3);
    }
  }
  // spraying: hold F while in the fire truck near a fire
  const p = game.player;
  const spraying = p.inVehicle && p.inVehicle.type === 'fire' && game.input.down('KeyF');
  if (spraying) {
    fire.sprayT += dt;
    for (let i = fire.fires.length - 1; i >= 0; i--) {
      const f = fire.fires[i];
      if (dist2(p.x, p.z, f.x, f.z) < 144) {
        f.hp -= 60 * dt;
        if (f.hp <= 0) {
          fire.fires.splice(i, 1);
          addCash(game.state, 150);
          game.state.stats.firesOut += 1;
          addRespect(game.state, 15);
          checkRespectUnlocks(game);
          showToast(game.state, 'Fire out! +$150', 3);
          if (game.audio) game.audio.play('win');
        }
      }
    }
  } else {
    fire.sprayT = 0;
  }
  for (const f of fire.fires) f.t += dt;
}

export function fireBoxes(f) {
  // flame flickers with time; smoke above
  const flick = 1 + Math.sin(f.t * 9) * 0.25;
  return [
    { x: f.x, y: 1.2 * flick, z: f.z, sx: 2.2, sy: 2.4 * flick, sz: 2.2, c: [1, 0.45, 0.1] },
    { x: f.x, y: 2.2 * flick, z: f.z, sx: 1.2, sy: 1.6 * flick, sz: 1.2, c: [1, 0.85, 0.2] },
    { x: f.x, y: 4.2, z: f.z, sx: 1.6, sy: 2.2, sz: 1.6, c: [0.35, 0.35, 0.38], a: 0.75 },
  ];
}
