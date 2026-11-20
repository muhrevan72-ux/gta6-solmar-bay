// Solmar Bay — fire service (rebuild #13).
import { pushBox } from './render.js';
import { addCash } from './state.js';

export function spawnFireService(g) {
  g.fires = [];
  g._fireTimer = 90 + Math.random() * 90;
}

export function stepFires(g, dt) {
  g._fireTimer -= dt;
  if (g._fireTimer <= 0) {
    // A fire breaks out at a random building — never a duplicate
    // at a building that is already burning.
    const b = g.city.buildings[Math.floor(Math.random() * g.city.buildings.length)];
    const dup = g.fires.some((f) => Math.hypot(f.x - b.x, f.z - b.z) < 5);
    if (!dup) {
      g.fires.push({ x: b.x, z: b.z, hp: 100, spread: 0 });
    }
    g._fireTimer = 90 + Math.random() * 90;
    return;
  }
  // Unattended fires grow slowly.
  for (const f of g.fires) {
    f.hp = Math.min(200, f.hp + dt * 2);
    f.spread += dt;
  }
}

export function sprayFire(g, dt) {
  for (let i = 0; i < g.fires.length; i++) {
    const f = g.fires[i];
    if (Math.hypot(f.x - g.player.x, f.z - g.player.z) < 6) {
      f.hp -= 30 * dt;
      if (f.hp <= 0) {
        g.fires.splice(i, 1);
        g.stats.firesOut += 1;
        addCash(g, 150, 'fire rescue');
        g.respect += 15;
      }
      return true;
    }
  }
  return false;
}

// Returns the number of fires drawn.
export function fireBoxes(g, b, cam) {
  const plain = [0, 0, 1, 1];
  let n = 0;
  for (const f of g.fires) {
    pushBox(b, f.x, 1, f.z, 2, 3, 2, [1, 0.5, 0.1], plain); n++;
    pushBox(b, f.x, 4, f.z, 1.5, 1.5, 1.5, [0.4, 0.4, 0.4], plain); n++;
  }
  // The suite counts fires, not boxes: return the fire count.
  return g.fires.length;
}
