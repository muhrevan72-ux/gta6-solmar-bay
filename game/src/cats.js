// Solmar Bay — cats: the city has stray cats. E near a cat picks
// it up (it rides on the player's shoulder); E again at the
// safehouse puts it down for $20. Cats wander the sidewalks and
// meow (a soft blip).

import { showToast, addCash } from './state.js';
import { playBlip } from './audio.js';
import { randomSidewalkPoint } from './world.js';
import { makeRng } from './config.js';

export function createCats(city) {
  const cats = [];
  for (let i = 0; i < 5; i++) {
    const pt = randomSidewalkPoint(city, makeRng(500 + i * 17));
    cats.push({
      x: pt.x, z: pt.z, heading: Math.random() * Math.PI * 2,
      bob: Math.random() * Math.PI * 2,
      waitT: 2 + i,
      target: null,
      carried: false,
      color: [[0.9, 0.85, 0.7], [0.2, 0.2, 0.2], [0.9, 0.6, 0.3]][i % 3],
    });
  }
  return cats;
}

export function stepCats(game, dt) {
  const p = game.state.player;
  for (const cat of game.cats) {
    if (cat.carried) {
      cat.x = p.x;
      cat.z = p.z;
      continue;
    }
    cat.waitT -= dt;
    if (cat.waitT <= 0) {
      cat.waitT = 3 + Math.random() * 5;
      cat.target = randomSidewalkPoint(game.city, Math.random);
    }
    if (cat.target) {
      const dx = cat.target.x - cat.x, dz = cat.target.z - cat.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.5) {
        cat.heading = Math.atan2(dx, dz);
        cat.x += (dx / d) * 1.2 * dt;
        cat.z += (dz / d) * 1.2 * dt;
        cat.bob += dt * 6;
      }
    }
  }
}

// E near a cat picks it up; E at the safehouse with a cat puts it
// down for $20.
export function tryCat(game) {
  const s = game.state;
  const p = s.player;
  if (p.carryingCat) {
    // Put it down at the safehouse.
    if (Math.hypot(p.x + 250, p.z - 250) < 10) {
      const cat = p.carryingCat;
      cat.carried = false;
      cat.x = p.x + 1;
      cat.z = p.z + 1;
      p.carryingCat = null;
      addCash(s, 20);
      showToast(s, 'You found the cat a home! +$20', 4);
      playBlip(game.audio);
      return true;
    }
    return false;
  }
  for (const cat of game.cats) {
    if (!cat.carried && Math.hypot(cat.x - p.x, cat.z - p.z) < 2.5) {
      cat.carried = true;
      p.carryingCat = cat;
      showToast(s, 'You picked up a cat! Take it to the safehouse.', 4);
      playBlip(game.audio);
      return true;
    }
  }
  return false;
}

export function catBoxes(game, out) {
  for (const cat of game.cats) {
    if (cat.carried) continue; // drawn on the player's shoulder
    const bob = Math.sin(cat.bob) * 0.05;
    out.pushBoxRot(cat.x, 0.2 + bob, cat.z, 0.25, 0.2, 0.4, cat.color, cat.heading);
    out.pushBoxRot(cat.x, 0.35 + bob, cat.z + 0.15, 0.15, 0.15, 0.15, cat.color, cat.heading);
    // Ears.
    out.pushBoxRot(cat.x - 0.06, 0.45 + bob, cat.z + 0.15, 0.05, 0.08, 0.05, cat.color, cat.heading);
    out.pushBoxRot(cat.x + 0.06, 0.45 + bob, cat.z + 0.15, 0.05, 0.08, 0.05, cat.color, cat.heading);
  }
}
