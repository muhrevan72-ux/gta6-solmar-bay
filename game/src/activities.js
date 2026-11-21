// Solmar Bay — street activities: fishing, vending machines,
// ATMs. Fishing takes ~3 s and pays $5–15.

import { SPAWNS } from './config.js';
import { addCash, showToast } from './state.js';

export function spawnActivities(g) {
  g.vending = [
    { x: 10, z: 30 }, { x: -70, z: 30 }, { x: 130, z: -30 }, { x: -130, z: 90 },
  ];
  g.atms = [
    { x: 20, z: -30 }, { x: -50, z: 90 }, { x: 150, z: 30 },
  ];
  g._fishing = { active: false, t: 0 };
  return g;
}

function nearPoint(g, x, z, r) {
  return Math.hypot(g.player.x - x, g.player.z - z) < r;
}

export function tryFish(g) {
  if (!nearPoint(g, SPAWNS.fishing.x, SPAWNS.fishing.z, 6)) return false;
  g._fishing = { active: true, t: 0 };
  showToast(g, 'Fishing… wait for a bite');
  return true;
}

export function stepActivities(g, dt) {
  if (g._fishing && g._fishing.active) {
    g._fishing.t += dt;
    if (g._fishing.t >= 3) {
      g._fishing.active = false;
      const amount = 5 + Math.floor(Math.random() * 11);
      addCash(g, amount, 'fish sold');
      g.stats.fishCaught++;
      showToast(g, `Caught a fish! +$${amount}`);
    }
  }
}

export function tryVending(g) {
  let machine = null;
  for (const v of g.vending) {
    if (nearPoint(g, v.x, v.z, 4)) { machine = v; break; }
  }
  if (!machine) return false;
  if (g.cash < 3) return false;
  g.cash -= 3;
  g.health = Math.min(100, g.health + 15);
  showToast(g, 'Snack bought — $3, +15 HP');
  return true;
}

export function tryAtm(g) {
  for (const a of g.atms) {
    if (nearPoint(g, a.x, a.z, 4)) {
      g.modal = { kind: 'atm', title: 'ATM' };
      return true;
    }
  }
  return false;
}

// 0 = deposit $50 (cash → bank), 1 = withdraw $50 (bank → cash).
export function atmAction(g, action) {
  if (action === 0) {
    if (g.cash < 50) return false;
    g.cash -= 50;
    g.bank += 50;
    showToast(g, 'Deposited $50');
    return true;
  }
  if (action === 1) {
    if (g.bank < 50) return false;
    g.bank -= 50;
    g.cash += 50;
    showToast(g, 'Withdrew $50');
    return true;
  }
  return false;
}
