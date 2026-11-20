// Solmar Bay — side activities (rebuild #15).
// Fishing at the pier, vending machines, ATMs.

import { SPAWNS } from './config.js';
import { showToast } from './state.js';
import { pushBox } from './render.js';

export function spawnActivities(g) {
  g.vending = [
    { x: -60, z: 30 }, { x: 90, z: -30 }, { x: -180, z: 90 }, { x: 150, z: 60 },
  ];
  g.atms = [
    { x: -30, z: -30 }, { x: 120, z: 30 }, { x: -90, z: -60 },
  ];
  return { vending: g.vending, atms: g.atms };
}

export function tryFish(g) {
  const d = Math.hypot(g.player.x - SPAWNS.fishing.x, g.player.z - SPAWNS.fishing.z);
  if (d > 8) return false;
  g._fishing = { active: true, timer: 3 };
  return true;
}

export function tryVending(g) {
  let v = null;
  let bestD = 5;
  for (const m of g.vending || []) {
    const d = Math.hypot(m.x - g.player.x, m.z - g.player.z);
    if (d < bestD) {
      bestD = d;
      v = m;
    }
  }
  if (!v) return false;
  if (g.cash < 3) return false;
  g.cash -= 3;
  g.health = Math.min(100, g.health + 15);
  showToast(g, 'Snack! +15 HP');
  return true;
}

export function tryAtm(g) {
  let a = null;
  let bestD = 5;
  for (const m of g.atms || []) {
    const d = Math.hypot(m.x - g.player.x, m.z - g.player.z);
    if (d < bestD) {
      bestD = d;
      a = m;
    }
  }
  if (!a) return false;
  g.modal = { kind: 'atm', title: 'ATM', lines: ['Deposit $50', 'Withdraw $50'] };
  return true;
}

export function atmAction(g, which) {
  if (which === 0) {
    // Deposit $50.
    if (g.cash < 50) return false;
    g.cash -= 50;
    g.bank = (g.bank || 0) + 50;
    return true;
  }
  // Withdraw $50.
  if ((g.bank || 0) < 50) return false;
  g.bank -= 50;
  g.cash += 50;
  return true;
}

export function stepActivities(g, dt) {
  if (g._fishing && g._fishing.active) {
    g._fishing.timer -= dt;
    if (g._fishing.timer <= 0) {
      g._fishing.active = false;
      const pay = 5 + Math.floor(g.rng() * 11);
      g.cash += pay;
      g.stats.fishCaught = (g.stats.fishCaught || 0) + 1;
      showToast(g, `Caught a fish! +$${pay}`);
    }
  }
}
