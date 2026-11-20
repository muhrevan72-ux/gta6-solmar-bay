// Solmar Bay — the fire service.
//
// Fires break out at random buildings every couple of minutes and
// grow while unattended. Spraying water within 10 m puts one out:
// $150 + 15 respect per fire.

import { pushBox } from './render.js';

export function spawnFireService(g) {
  g.fires = [];
  g._fireTimer = 120;
}

export function stepFires(g, dt) {
  g._fireTimer = (g._fireTimer === undefined ? 120 : g._fireTimer) - dt;
  // Unattended fires grow, 1 HP per second.
  for (const f of g.fires || []) {
    f.hp = (f.hp || 0) + dt;
  }
  if (g._fireTimer > 0) return;
  g._fireTimer = 90 + Math.random() * 90;
  if (!g.city || !g.city.buildings || !g.city.buildings.length) return;
  const b = g.city.buildings[Math.floor(Math.random() * g.city.buildings.length)];
  // No duplicate fire at the same building.
  if ((g.fires || []).some((f) => Math.hypot(f.x - b.x, f.z - b.z) < 2)) return;
  g.fires.push({ x: b.x, z: b.z, hp: 60, spread: 0 });
}

// Spray water: 40 HP/s within 10 m. A fire put out pays $150.
export function sprayFire(g, dt) {
  let sprayed = false;
  for (const f of g.fires || []) {
    if (Math.hypot(g.player.x - f.x, g.player.z - f.z) > 10) continue;
    sprayed = true;
    f.hp -= 40 * dt;
  }
  if (!sprayed) return false;
  g.fires = (g.fires || []).filter((f) => {
    if (f.hp <= 0) {
      g.stats.firesOut = (g.stats.firesOut || 0) + 1;
      g.cash = (g.cash || 0) + 150;
      g.respect = (g.respect || 0) + 15;
      g.toast = '+$150 fire out';
      g.toastTimer = 3;
      return false;
    }
    return true;
  });
  return true;
}

// One entry per fire (flame + smoke boxes inside).
export function fireBoxes(g, b, camera) {
  let n = 0;
  for (const f of g.fires || []) {
    pushBox(b, f.x, 1, f.z, 2, 2, 2, [1, 0.5, 0.1]); // flame
    pushBox(b, f.x, 3, f.z, 2.5, 1.5, 2.5, [0.3, 0.3, 0.32]); // smoke
    n++;
  }
  return n;
}
