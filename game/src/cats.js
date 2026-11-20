// Solmar Bay — cats.
//
// Small voxel cats wander the beach and the shop fronts. Press
// E near a cat to pick it up — it rides on the player's shoulder
// (drawn by player.js). Press E again to put it down. Pure fun,
// no stats, no crimes.

import { dist, makeRng } from './config.js';
import { showToast } from './state.js';

export function spawnCats(game) {
  const rng = makeRng(555);
  game.cats = [];
  const spots = [
    { x: -330, z: 60 }, { x: -320, z: -40 }, { x: -60, z: -20 },
    { x: 60, z: -16 }, { x: -40, z: 76 }, { x: 120, z: 74 },
  ];
  for (let i = 0; i < 6; i++) {
    const s = spots[i % spots.length];
    game.cats.push({
      x: s.x + (rng() - 0.5) * 8,
      z: s.z + (rng() - 0.5) * 8,
      heading: rng() * Math.PI * 2,
      speed: 1.2 + rng(),
      colour: [[0.85, 0.7, 0.5], [0.25, 0.25, 0.28], [0.95, 0.95, 0.95], [0.6, 0.45, 0.3]][i % 4],
      target: null,
      walkPhase: rng() * 6,
      carried: false,
    });
  }
}

export function stepCats(game, dt) {
  for (const cat of game.cats) {
    if (cat.carried) {
      cat.x = game.player.x;
      cat.z = game.player.z;
      continue;
    }
    if (!cat.target || dist(cat.x, cat.z, cat.target.x, cat.target.z) < 1) {
      cat.target = {
        x: cat.x + (Math.random() - 0.5) * 24,
        z: cat.z + (Math.random() - 0.5) * 24,
      };
    }
    const a = Math.atan2(cat.target.x - cat.x, cat.target.z - cat.z);
    cat.heading = a;
    cat.x += Math.sin(a) * cat.speed * dt;
    cat.z += Math.cos(a) * cat.speed * dt;
    cat.walkPhase += dt * 5;
  }
}

// Pick up / put down a nearby cat (E). Returns true on success.
export function tryCat(game) {
  const p = game.player;
  if (p.carryingCat) {
    const cat = p.carryingCat;
    cat.carried = false;
    cat.x = p.x + Math.sin(p.heading) * 1.5;
    cat.z = p.z + Math.cos(p.heading) * 1.5;
    p.carryingCat = null;
    showToast(game, 'You put the cat down');
    return true;
  }
  for (const cat of game.cats) {
    if (!cat.carried && dist(p.x, p.z, cat.x, cat.z) < 3) {
      cat.carried = true;
      p.carryingCat = cat;
      showToast(game, 'You picked up the cat — it rides on your shoulder');
      return true;
    }
  }
  return false;
}

// Draw cats: body, head, ears, tail.
export function catBoxes(game, out) {
  for (const cat of game.cats) {
    if (cat.carried) continue; // drawn on the player's shoulder
    const wag = Math.sin(cat.walkPhase) * 0.15;
    out.push({ x: cat.x, y: 0.25, z: cat.z, w: 0.4, h: 0.35, d: 0.7, c: cat.colour });
    out.push({ x: cat.x, y: 0.6, z: cat.z + 0.45, w: 0.35, h: 0.3, d: 0.35, c: cat.colour });
    out.push({ x: cat.x - 0.1, y: 0.85, z: cat.z + 0.45, w: 0.1, h: 0.15, d: 0.1, c: cat.colour });
    out.push({ x: cat.x + 0.1, y: 0.85, z: cat.z + 0.45, w: 0.1, h: 0.15, d: 0.1, c: cat.colour });
    out.push({ x: cat.x, y: 0.35, z: cat.z - 0.5, w: 0.12, h: 0.12, d: 0.5 + wag, c: cat.colour });
  }
  return out;
}
