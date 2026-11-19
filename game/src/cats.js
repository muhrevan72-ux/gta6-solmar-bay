// Solmar Bay — cats and dogs. Eight voxel cats wander the beach and
// shops: press E near one to pick it up and carry it on your
// shoulder, press E again to put it down. Six dogs wander the city:
// press E near one to pet it (it jumps and wags). Pure fun.

import { dist2, makeRng } from './config.js';
import { collideCircle } from './world.js';

const CAT_COLOURS = [
  [0.9, 0.55, 0.2], [0.95, 0.95, 0.95], [0.2, 0.2, 0.22],
  [0.6, 0.6, 0.62], [0.95, 0.75, 0.4], [0.85, 0.5, 0.3],
  [0.4, 0.35, 0.3], [0.9, 0.9, 0.85],
];

export function createCats() {
  // seeded so cat/dog spots are the same every run (and every test)
  const rng = makeRng(777);
  const cats = { list: [], dogs: [] };
  const spots = [
    [-310, 100], [-300, 160], [-320, -60], [-60, -40], [60, -40],
    [-40, 60], [40, 120], [120, 40],
  ];
  for (let i = 0; i < 8; i++) {
    cats.list.push({
      id: i,
      x: spots[i][0] + (rng() * 10 - 5),
      z: spots[i][1] + (rng() * 10 - 5),
      heading: rng() * Math.PI * 2,
      targetHeading: rng() * Math.PI * 2,
      speed: 1 + rng(),
      colour: CAT_COLOURS[i],
      carried: false,
      wanderT: 2 + rng() * 4,
      bob: rng() * 6,
    });
  }
  for (let i = 0; i < 6; i++) {
    cats.dogs.push({
      id: i,
      x: -200 + rng() * 400,
      z: -200 + rng() * 400,
      heading: rng() * Math.PI * 2,
      targetHeading: rng() * Math.PI * 2,
      speed: 1.6 + rng(),
      happy: 0,
      wag: 0,
      wanderT: 2 + rng() * 4,
      bob: rng() * 6,
    });
  }
  return cats;
}

export function updateCats(game, dt) {
  const p = game.player;
  for (const cat of game.cats.list) {
    if (cat.carried) {
      // rides on the player's shoulder (boxes drawn by player.js)
      cat.x = p.x;
      cat.z = p.z;
      continue;
    }
    cat.bob += dt * 3;
    cat.wanderT -= dt;
    if (cat.wanderT <= 0) {
      cat.wanderT = 2 + Math.random() * 5;
      cat.targetHeading = Math.random() * Math.PI * 2;
    }
    let dh = cat.targetHeading - cat.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI;
    cat.heading += dh * Math.min(1, dt * 2);
    const nx = cat.x + Math.sin(cat.heading) * cat.speed * dt;
    const nz = cat.z + Math.cos(cat.heading) * cat.speed * dt;
    const fixed = collideCircle(game.city, nx, nz, 0.4);
    cat.x = fixed.x;
    cat.z = fixed.z;
  }
  for (const dog of game.cats.dogs) {
    dog.bob += dt * 3;
    if (dog.happy > 0) {
      dog.happy -= dt;
      dog.wag += dt * 12;
      continue; // stays put, wagging, while happy
    }
    dog.wanderT -= dt;
    if (dog.wanderT <= 0) {
      dog.wanderT = 2 + Math.random() * 5;
      dog.targetHeading = Math.random() * Math.PI * 2;
    }
    let dh = dog.targetHeading - dog.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI;
    dog.heading += dh * Math.min(1, dt * 2);
    const nx = dog.x + Math.sin(dog.heading) * dog.speed * dt;
    const nz = dog.z + Math.cos(dog.heading) * dog.speed * dt;
    const fixed = collideCircle(game.city, nx, nz, 0.5);
    dog.x = fixed.x;
    dog.z = fixed.z;
  }
}

// E near a cat: pick it up (or put it down). Returns true if it acted.
export function interactCat(game) {
  const p = game.player;
  if (p.carryingCat) {
    const cat = p.carryingCat;
    cat.carried = false;
    cat.x = p.x + 1;
    cat.z = p.z + 1;
    p.carryingCat = null;
    return true;
  }
  for (const cat of game.cats.list) {
    if (cat.carried) continue;
    if (dist2(p.x, p.z, cat.x, cat.z) < 16) {
      cat.carried = true;
      p.carryingCat = cat;
      return true;
    }
  }
  return false;
}

// E near a dog: pet it. Returns true if it acted.
export function interactDog(game) {
  const p = game.player;
  for (const dog of game.cats.dogs) {
    if (dist2(p.x, p.z, dog.x, dog.z) < 16) {
      dog.happy = 3;
      game.state.stats.catsPet += 1;
      if (game.audio) game.audio.play('pickup');
      return true;
    }
  }
  return false;
}

export function catBoxes(cat) {
  if (cat.carried) return []; // drawn on the player's shoulder
  return [
    { x: cat.x, y: 0.35, z: cat.z, sx: 0.5, sy: 0.5, sz: 0.9, c: cat.colour },
    { x: cat.x, y: 0.75, z: cat.z + 0.45, sx: 0.4, sy: 0.4, sz: 0.4, c: cat.colour },
    { x: cat.x - 0.15, y: 1.0, z: cat.z + 0.45, sx: 0.12, sy: 0.25, sz: 0.12, c: cat.colour },
    { x: cat.x + 0.15, y: 1.0, z: cat.z + 0.45, sx: 0.12, sy: 0.25, sz: 0.12, c: cat.colour },
    { x: cat.x, y: 0.4, z: cat.z - 0.55, sx: 0.15, sy: 0.35, sz: 0.5, c: cat.colour },
  ];
}

export function dogBoxes(dog) {
  const wag = dog.happy > 0 ? Math.sin(dog.wag) * 0.3 : 0;
  return [
    { x: dog.x, y: 0.5, z: dog.z, sx: 0.7, sy: 0.7, sz: 1.3, c: [0.55, 0.4, 0.25] },
    { x: dog.x, y: 1.0, z: dog.z + 0.7, sx: 0.55, sy: 0.55, sz: 0.55, c: [0.55, 0.4, 0.25] },
    { x: dog.x - 0.2, y: 1.35, z: dog.z + 0.7, sx: 0.15, sy: 0.3, sz: 0.15, c: [0.4, 0.28, 0.18] },
    { x: dog.x + 0.2, y: 1.35, z: dog.z + 0.7, sx: 0.15, sy: 0.3, sz: 0.15, c: [0.4, 0.28, 0.18] },
    { x: dog.x, y: 0.7 + wag, z: dog.z - 0.8, sx: 0.15, sy: 0.5, sz: 0.15, c: [0.55, 0.4, 0.25] },
  ];
}
