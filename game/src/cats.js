// Solmar Bay — cats and dogs. Cats wander the beach and shops;
// press E near one to pick it up and carry it on your shoulder,
// press E again to put it down. Dogs wander the city; press E near
// one to pet it — it jumps and wags. Pure fun, no stats.

import { mulberry32, dist } from './config.js';
import { moveWithCollision, collides } from './world.js';
import { setToast } from './state.js';

const CAT_COLORS = [
  [0.95, 0.6, 0.25], [0.95, 0.95, 0.95], [0.4, 0.4, 0.45], [0.85, 0.75, 0.6],
];
const DOG_COLORS = [
  [0.6, 0.42, 0.25], [0.3, 0.22, 0.15], [0.85, 0.8, 0.7], [0.5, 0.5, 0.55],
];

export function createCats(city) {
  const rng = mulberry32(31337);
  const cats = [];
  const dogs = [];
  for (let i = 0; i < 8; i++) {
    const x = -350 + rng() * 60 + (i % 2 === 0 ? 200 : 0);
    const z = -330 + rng() * 660;
    if (collides(city, x, z, 1)) continue;
    cats.push({
      x, z, heading: rng() * Math.PI * 2,
      color: CAT_COLORS[i % CAT_COLORS.length],
      picked: false, tx: x, tz: z, phase: rng() * Math.PI * 2,
    });
  }
  for (let i = 0; i < 6; i++) {
    const x = -160 + rng() * 320;
    const z = -160 + rng() * 320;
    if (collides(city, x, z, 1)) continue;
    dogs.push({
      x, z, heading: rng() * Math.PI * 2,
      color: DOG_COLORS[i % DOG_COLORS.length],
      joy: 0, tx: x, tz: z, phase: rng() * Math.PI * 2,
    });
  }
  return { cats, dogs };
}

export function nearestCat(game, x, z, maxDist) {
  let best = null, bd = maxDist;
  for (const c of game.cats.cats) {
    if (c.picked) continue;
    const d = dist(x, z, c.x, c.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

export function nearestDog(game, x, z, maxDist) {
  let best = null, bd = maxDist;
  for (const d of game.cats.dogs) {
    const dd = dist(x, z, d.x, d.z);
    if (dd < bd) { bd = dd; best = d; }
  }
  return best;
}

export function pickUpCat(game, cat) {
  game.player.carryingCat = cat;
  cat.picked = true;
  game.state.stats.catsPet += 1;
  setToast(game.state, 'You picked up the cat! Press E to put it down.', 3);
  if (game.audio) game.audio.blip(900, 0.12);
}

export function putDownCat(game) {
  const cat = game.player.carryingCat;
  if (!cat) return false;
  cat.picked = false;
  cat.x = game.player.x + 1;
  cat.z = game.player.z + 1;
  cat.tx = cat.x; cat.tz = cat.z;
  game.player.carryingCat = null;
  setToast(game.state, 'The cat trots off, happy.', 2);
  return true;
}

export function petDog(game, dog) {
  dog.joy = 2.5;
  setToast(game.state, 'The dog wags its tail happily!', 2);
  if (game.audio) game.audio.blip(800, 0.1);
}

function wander(dt, game, a, speed) {
  if (dist(a.x, a.z, a.tx, a.tz) < 2) {
    a.tx = Math.max(-390, Math.min(390, a.x + (Math.random() - 0.5) * 40));
    a.tz = Math.max(-390, Math.min(390, a.z + (Math.random() - 0.5) * 40));
  }
  const want = Math.atan2(a.tx - a.x, a.tz - a.z);
  let diff = want - a.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  a.heading += Math.max(-2.5 * dt, Math.min(2.5 * dt, diff));
  moveWithCollision(game.city, a, Math.sin(a.heading) * speed * dt, Math.cos(a.heading) * speed * dt, 0.5);
}

export function updateCats(dt, game) {
  for (const c of game.cats.cats) {
    if (c.picked) {
      c.x = game.player.x;
      c.z = game.player.z;
      continue;
    }
    wander(dt, game, c, 1.2);
  }
  for (const d of game.cats.dogs) {
    if (d.joy > 0) d.joy -= dt;
    wander(dt, game, d, 2.2);
  }
}

export function drawCats(renderer, game) {
  for (const c of game.cats.cats) {
    if (c.picked) continue; // drawn on the player's shoulder instead
    const bob = Math.sin(game.time * 8 + c.phase) * 0.05;
    renderer.box(c.x, 0.3 + bob, c.z, 0.45, 0.35, 0.7, c.color, 1, c.heading, 0, 0);
    renderer.box(c.x, 0.62 + bob, c.z + 0.3, 0.4, 0.35, 0.4, c.color, 1, c.heading, 0, 0);
  }
  for (const d of game.cats.dogs) {
    const jump = d.joy > 0 ? Math.abs(Math.sin(game.time * 10)) * 0.5 : 0;
    renderer.box(d.x, 0.45 + jump, d.z, 0.55, 0.55, 1.0, d.color, 1, d.heading, 0, 0);
    renderer.box(d.x, 0.95 + jump, d.z + 0.45, 0.5, 0.5, 0.5, d.color, 1, d.heading, 0, 0);
  }
}
