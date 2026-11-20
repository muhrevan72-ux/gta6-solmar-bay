// Solmar Bay — side activities: fishing, vending, ATMs (rebuild #13).
import { SPAWNS } from './config.js';
import { addCash, showToast } from './state.js';

export function spawnActivities(g) {
  g.vending = [
    { x: -60, z: 8 }, { x: 60, z: -52 }, { x: -120, z: 128 }, { x: 180, z: 8 },
  ];
  g.atms = [
    { x: -30, z: 8 }, { x: 90, z: -52 }, { x: -180, z: 68 },
  ];
}

export function tryFish(g) {
  const d = Math.hypot(g.player.x - SPAWNS.fishing.x, g.player.z - SPAWNS.fishing.z);
  if (d > 8) return false;
  g._fishing = { active: true, t: 0 };
  return true;
}

export function tryVending(g) {
  for (const v of g.vending) {
    if (Math.hypot(v.x - g.player.x, v.z - g.player.z) < 4) {
      if (g.cash < 3) return false;
      g.cash -= 3;
      g.health = Math.min(100, g.health + 15);
      showToast(g, 'Snack +15 HP — $3');
      return true;
    }
  }
  return false;
}

export function tryAtm(g) {
  for (const a of g.atms) {
    if (Math.hypot(a.x - g.player.x, a.z - g.player.z) < 4) {
      g.modal = { kind: 'atm', title: 'ATM', lines: [`Cash $${g.cash} · Bank $${g.bank}`, '1. Deposit $50', '2. Withdraw $50'] };
      return true;
    }
  }
  return false;
}

// action 0 = deposit $50, 1 = withdraw $50.
export function atmAction(g, action) {
  if (action === 0) {
    if (g.cash < 50) return false;
    g.cash -= 50;
    g.bank += 50;
    return true;
  }
  if (g.bank < 50) return false;
  g.bank -= 50;
  g.cash += 50;
  return true;
}

export function stepActivities(g, dt) {
  if (g._fishing && g._fishing.active) {
    g._fishing.t += dt;
    if (g._fishing.t >= 3) {
      g._fishing.active = false;
      const amount = 5 + Math.floor(Math.random() * 11);
      addCash(g, amount, 'fish');
      g.stats.fishCaught += 1;
    }
  }
}
