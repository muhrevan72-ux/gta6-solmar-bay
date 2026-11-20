// Solmar Bay — stray cats.
//
// Six cats wander the city. Pick one up (E), carry it to Maya's
// beach house and she pays $20 + 5 respect. Pressing E while
// carrying pets the cat instead.

import { SPAWNS } from './config.js';
import { pushBox } from './render.js';

export function spawnCats(g) {
  const spots = [
    [10, 30], [-40, 50], [60, -20], [-90, 90], [120, 40], [-20, -60],
  ];
  g.cats = spots.map(([x, z]) => ({
    x, z,
    state: 'wander',
    wanderA: Math.random() * Math.PI * 2,
  }));
}

export function tryCat(g) {
  if (g.player.carryingCat) {
    g.player.petting = 2;
    return true;
  }
  for (const c of g.cats || []) {
    if (c.state === 'wander' && Math.hypot(c.x - g.player.x, c.z - g.player.z) < 3) {
      c.state = 'carried';
      g.player.carryingCat = c;
      return true;
    }
  }
  return false;
}

export function stepCats(g, dt) {
  for (const c of g.cats || []) {
    if (c.state === 'carried') {
      c.x = g.player.x;
      c.z = g.player.z;
      if (Math.hypot(g.player.x - SPAWNS.beachHouse.x, g.player.z - SPAWNS.beachHouse.z) < 6) {
        c.state = 'home';
        g.player.carryingCat = null;
        g.cash = (g.cash || 0) + 20;
        g.respect = (g.respect || 0) + 5;
        g.toast = '+$20 cat delivered';
        g.toastTimer = 3;
      }
    } else if (c.state === 'wander') {
      if (Math.random() < 0.02) c.wanderA = Math.random() * Math.PI * 2;
      c.x += Math.sin(c.wanderA) * 0.8 * dt;
      c.z += Math.cos(c.wanderA) * 0.8 * dt;
    }
  }
}

// A cat: body, head, 2 ears, tail — 5 boxes.
export function catBoxes(g, b, camera) {
  let n = 0;
  for (const c of g.cats || []) {
    if (c.state === 'home') continue;
    const col = [0.9, 0.8, 0.6];
    pushBox(b, c.x, 0.2, c.z, 0.5, 0.3, 0.25, col); n++; // body
    pushBox(b, c.x, 0.4, c.z + 0.3, 0.25, 0.25, 0.25, col); n++; // head
    pushBox(b, c.x - 0.08, 0.55, c.z + 0.3, 0.08, 0.12, 0.08, col); n++; // ear
    pushBox(b, c.x + 0.08, 0.55, c.z + 0.3, 0.08, 0.12, 0.08, col); n++; // ear
    pushBox(b, c.x, 0.3, c.z - 0.35, 0.08, 0.08, 0.4, col); n++; // tail
  }
  return n;
}
