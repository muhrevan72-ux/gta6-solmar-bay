// Solmar Bay — firefighters: fires spawn around the city; drive the
// red fire truck to one and hold F to spray water. Extinguishing a
// fire pays $150.

import { SIDE_REWARDS, dist } from './config.js';
import { setToast, addCash } from './state.js';

export function createFire() {
  return { fires: [], spawnT: 25 };
}

function spawnFire(game) {
  const city = game.city;
  const spots = [
    { x: -140, z: 40 }, { x: 140, z: -40 }, { x: 40, z: 140 },
    { x: -40, z: -140 }, { x: 100, z: 100 }, { x: -200, z: 300 },
    { x: 250, z: -100 }, { x: -300, z: 100 }, { x: 300, z: 200 },
  ];
  const s = spots[Math.floor(Math.random() * spots.length)];
  game.fire.fires.push({ x: s.x, z: s.z, hp: 100, t: 0, kind: Math.random() < 0.5 ? 'car' : 'building' });
  setToast(game.state, 'Fire reported! Grab the fire truck.', 4);
}

export function updateFire(dt, game) {
  const fire = game.fire;
  fire.spawnT -= dt;
  if (fire.spawnT <= 0 && fire.fires.length < 3) {
    fire.spawnT = 45 + Math.random() * 20;
    spawnFire(game);
  }
  const p = game.player;
  const truck = p.inVehicle && p.inVehicle.kind === 'fire' ? p.inVehicle : null;
  for (let i = fire.fires.length - 1; i >= 0; i--) {
    const f = fire.fires[i];
    f.t += dt;
    if (truck && game.input.down('KeyF')) {
      // spray: fire must be in front of the truck and within 14 units
      const d = dist(truck.x, truck.z, f.x, f.z);
      const fx = Math.sin(truck.heading), fz = Math.cos(truck.heading);
      const dot = ((f.x - truck.x) * fx + (f.z - truck.z) * fz) / (d || 1);
      if (d < 14 && dot > 0.4) {
        f.hp -= 45 * dt;
        truck.spray = 0.2;
        if (f.hp <= 0) {
          fire.fires.splice(i, 1);
          addCash(game.state, SIDE_REWARDS.fire);
          game.state.stats.firesOut += 1;
          setToast(game.state, 'Fire out! +$' + SIDE_REWARDS.fire, 3);
          if (game.audio) game.audio.jingle();
          continue;
        }
      }
    }
  }
  if (truck && truck.spray > 0) truck.spray -= dt;
}

export function drawFire(renderer, game) {
  const t = game.time;
  for (const f of game.fire.fires) {
    const flick = 0.7 + Math.sin(t * 11 + f.x) * 0.3;
    renderer.box(f.x, 1.2, f.z, 2.2, 2.4, 2.2, [1, 0.45 * flick, 0.1], 0.95);
    renderer.box(f.x, 2.8, f.z, 1.4, 1.4, 1.4, [1, 0.8, 0.15], 0.9);
    renderer.box(f.x + 0.8, 4.2, f.z, 1.6, 1.6, 1.6, [0.35, 0.35, 0.35], 0.55);
    // beacon so the player can find the fire
    renderer.box(f.x, 7, f.z, 1.6, 8, 1.6, [1, 0.3, 0.1], 0.5 + Math.sin(t * 5) * 0.2);
  }
  // water spray from the fire truck
  const p = game.player;
  const truck = p.inVehicle && p.inVehicle.kind === 'fire' ? p.inVehicle : null;
  if (truck && truck.spray > 0) {
    for (let i = 1; i <= 4; i++) {
      const d = i * 3;
      renderer.box(
        truck.x + Math.sin(truck.heading) * d,
        1.2 + i * 0.3,
        truck.z + Math.cos(truck.heading) * d,
        1.2, 0.8, 1.2, [0.4, 0.7, 1], 0.6,
      );
    }
  }
}
