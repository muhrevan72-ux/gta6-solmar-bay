// Solmar Bay — side activities: fishing, vending machines, ATMs.
// Written fresh for rebuild #18.

import { SPAWNS } from './config.js';
import { addCash, showToast } from './state.js';

export function spawnActivities(g) {
  const vending = [
    { x: 30, z: 60 }, { x: -60, z: -30 }, { x: 120, z: 90 }, { x: -120, z: 150 },
  ];
  const atms = [
    { x: 20, z: 40 }, { x: -80, z: -60 }, { x: 150, z: -60 },
  ];
  g.vending = vending;
  g.atms = atms;
  g._fishing = { active: false, t: 0 };
  return { vending, atms };
}

export function tryFish(g) {
  const pier = SPAWNS.fishing;
  const d = Math.hypot(g.player.x - pier.x, g.player.z - pier.z);
  if (d > 10) return false;
  g._fishing = { active: true, t: 0 };
  showToast(g, 'Fishing… wait for a bite');
  return true;
}

export function tryVending(g) {
  let best = null;
  let bestD = 4;
  for (const v of g.vending) {
    const d = Math.hypot(v.x - g.player.x, v.z - g.player.z);
    if (d < bestD) { best = v; bestD = d; }
  }
  if (!best) return false;
  if ((g.cash || 0) < 3) return false;
  g.cash -= 3;
  g.health = Math.min(100, (g.health || 0) + 15);
  showToast(g, 'Snack — $3, +15 health');
  return true;
}

export function tryAtm(g) {
  let best = null;
  let bestD = 5;
  for (const a of g.atms) {
    const d = Math.hypot(a.x - g.player.x, a.z - g.player.z);
    if (d < bestD) { best = a; bestD = d; }
  }
  if (!best) return false;
  g.modal = { kind: 'atm', title: 'ATM', lines: ['Deposit $50', 'Withdraw $50'] };
  return true;
}

export function atmAction(g, which) {
  if (which === 0) {
    // Deposit $50.
    if ((g.cash || 0) < 50) return false;
    g.cash -= 50;
    g.bank = (g.bank || 0) + 50;
    return true;
  }
  if (which === 1) {
    // Withdraw $50.
    if ((g.bank || 0) < 50) return false;
    g.bank -= 50;
    g.cash = (g.cash || 0) + 50;
    return true;
  }
  return false;
}

export function stepActivities(g, dt) {
  if (g._fishing && g._fishing.active) {
    g._fishing.t += dt;
    if (g._fishing.t >= 3.5) {
      g._fishing.active = false;
      g.stats.fishCaught = (g.stats.fishCaught || 0) + 1;
      const amount = 5 + Math.floor(Math.random() * 11);
      addCash(g, amount, 'fish');
      showToast(g, `Caught a fish — $${amount}`);
    }
  }
}
