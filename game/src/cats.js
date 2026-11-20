// Solmar Bay — cats.
//
// Six stray cats roam the sidewalks. Press E near one to pick
// it up and carry it home (the beach house). A delivered cat
// pays $20 and +5 respect, and the cat stays at the house.
// Carrying a cat slows the player slightly; petting (E while
// carrying) calms it.

import { makeRng } from './config.js';
import { pushBox } from './render.js';
import { tileUV } from './texture.js';
import { randomSidewalkPoint } from './world.js';
import { dist } from './config.js';
import { addCash, showToast } from './state.js';
import { SPAWNS } from './config.js';

export function spawnCats(game) {
  const rng = makeRng(31337);
  game.cats = [];
  for (let i = 0; i < 6; i++) {
    const p = randomSidewalkPoint(rng);
    game.cats.push({
      x: p.x,
      z: p.z,
      heading: rng() * Math.PI * 2,
      colour: [[0.15, 0.15, 0.15], [0.9, 0.9, 0.9], [0.85, 0.6, 0.3], [0.5, 0.5, 0.5]][i % 4],
      state: 'wander', // wander | carried | home
      target: randomSidewalkPoint(rng),
      wait: rng() * 3,
      id: Math.random().toString(36).slice(2, 8),
    });
  }
}

export function stepCats(game, dt) {
  const p = game.player;
  for (const c of game.cats) {
    if (c.state === 'carried') {
      c.x = p.x;
      c.z = p.z;
      // Delivered at the beach house.
      if (dist(p.x, p.z, SPAWNS.beachHouse.x, SPAWNS.beachHouse.z) < 6) {
        c.state = 'home';
        p.carryingCat = null;
        addCash(game, 20, '— cat delivered home');
        game.respect += 5;
        showToast(game, 'Cat delivered home! +$20 · +5 respect');
      }
      continue;
    }
    if (c.state === 'home') continue;
    c.wait -= dt;
    if (c.wait <= 0) {
      c.target = randomSidewalkPoint(Math.random);
      c.wait = 2 + Math.random() * 4;
    }
    const d = dist(c.x, c.z, c.target.x, c.target.z);
    if (d > 1) {
      const a = Math.atan2(c.target.x - c.x, c.target.z - c.z);
      c.heading = a;
      c.x += Math.sin(a) * 1.5 * dt;
      c.z += Math.cos(a) * 1.5 * dt;
    }
  }
}

// Pick up a nearby cat (or pet the one being carried).
export function tryCat(game) {
  const p = game.player;
  if (p.carryingCat) {
    p.petting = 2;
    showToast(game, 'You pet the cat. It purrs.');
    return true;
  }
  for (const c of game.cats) {
    if (c.state === 'wander' && dist(c.x, c.z, p.x, p.z) < 3) {
      c.state = 'carried';
      p.carryingCat = c;
      showToast(game, 'Cat picked up — carry it home to the beach house.');
      return true;
    }
  }
  return false;
}

export function catBoxes(game, b, cam) {
  const uv = tileUV('plain');
  for (const c of game.cats) {
    if (c.state === 'home') {
      // At the beach house, lounging.
      pushBox(b, SPAWNS.beachHouse.x + (c.id.charCodeAt(0) % 5), 0.4, SPAWNS.beachHouse.z + 2, 0.5, 0.3, 1, c.colour, uv);
      continue;
    }
    pushBox(b, c.x, 0, c.z, 0.4, 0.3, 0.9, c.colour, uv);
    pushBox(b, c.x, 0.3, c.z - 0.4, 0.3, 0.3, 0.3, c.colour, uv);
    pushBox(b, c.x - 0.1, 0.55, c.z - 0.45, 0.08, 0.12, 0.08, c.colour, uv);
    pushBox(b, c.x + 0.1, 0.55, c.z - 0.45, 0.08, 0.12, 0.08, c.colour, uv);
  }
  return game.cats.length;
}
