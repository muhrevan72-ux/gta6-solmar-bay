// Solmar Bay — stray cats (rebuild #13).
// Pick one up with E, pet it with E again, carry it to the
// beach house for $20 + 5 respect.
import { pushBox } from './render.js';
import { randomSidewalkPoint } from './world.js';
import { SPAWNS } from './config.js';
import { addCash } from './state.js';

export function spawnCats(g) {
  g.cats = [];
  for (let i = 0; i < 6; i++) {
    const p = randomSidewalkPoint(Math.random);
    g.cats.push({ x: p.x, z: p.z, state: 'wander', heading: Math.random() * Math.PI * 2 });
  }
}

export function tryCat(g) {
  const p = g.player;
  if (p.carryingCat) {
    p.petting = 2;
    return true;
  }
  for (const c of g.cats) {
    if (c.state === 'home') continue;
    if (Math.hypot(c.x - p.x, c.z - p.z) < 3) {
      c.state = 'carried';
      p.carryingCat = c;
      return true;
    }
  }
  return false;
}

export function stepCats(g, dt) {
  const p = g.player;
  for (const c of g.cats) {
    if (c.state === 'carried') {
      c.x = p.x;
      c.z = p.z;
      const d = Math.hypot(p.x - SPAWNS.beachHouse.x, p.z - SPAWNS.beachHouse.z);
      if (d < 8) {
        c.state = 'home';
        p.carryingCat = null;
        addCash(g, 20, 'cat rescue');
        g.respect += 5;
      }
    } else if (c.state === 'wander') {
      c.heading += (Math.random() - 0.5) * dt;
      c.x += Math.sin(c.heading) * 0.8 * dt;
      c.z += Math.cos(c.heading) * 0.8 * dt;
    }
  }
  if (p.petting > 0) p.petting = Math.max(0, p.petting - dt);
}

// 5 boxes per cat: body, head, ears 2, tail.
export function catBoxes(g, b, cam) {
  const plain = [0, 0, 1, 1];
  let n = 0;
  for (const c of g.cats) {
    if (c.state === 'home') continue;
    pushBox(b, c.x, 0.25, c.z, 0.7, 0.35, 0.35, [0.9, 0.85, 0.8], plain); n++;
    pushBox(b, c.x + 0.4, 0.5, c.z, 0.3, 0.3, 0.3, [0.9, 0.85, 0.8], plain); n++;
    pushBox(b, c.x + 0.35, 0.75, c.z - 0.08, 0.1, 0.12, 0.05, [0.9, 0.85, 0.8], plain); n++;
    pushBox(b, c.x + 0.35, 0.75, c.z + 0.08, 0.1, 0.12, 0.05, [0.9, 0.85, 0.8], plain); n++;
    pushBox(b, c.x - 0.45, 0.4, c.z, 0.4, 0.12, 0.12, [0.9, 0.85, 0.8], plain); n++;
  }
  return n;
}
