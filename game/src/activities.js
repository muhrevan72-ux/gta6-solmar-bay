// Solmar Bay — small activities.
//
// Fishing at the pier (3 s, then $5–15 and a catch counted), vending
// machines ($3 for +15 HP) and ATMs (deposit / withdraw $50).

import { SPAWNS } from './config.js';

export function spawnActivities(g) {
  g.vending = [
    { x: 20, z: 44 },
    { x: -80, z: -24 },
    { x: -30, z: 76 },
    { x: 140, z: 96 },
  ];
  g.atms = [
    { x: 10, z: 30 },
    { x: -100, z: 40 },
    { x: 120, z: 80 },
  ];
}

export function tryFish(g) {
  if (Math.hypot(g.player.x - SPAWNS.fishing.x, g.player.z - SPAWNS.fishing.z) > 6) return false;
  g._fishing.active = true;
  g._fishing.t = 0;
  return true;
}

export function stepActivities(g, dt) {
  if (g._fishing.active) {
    g._fishing.t += dt;
    if (g._fishing.t >= 3) {
      g._fishing.active = false;
      g.stats.fishCaught = (g.stats.fishCaught || 0) + 1;
      const amount = 5 + Math.floor(Math.random() * 11);
      g.cash = (g.cash || 0) + amount;
      g.toast = `+$${amount} fish sold`;
      g.toastTimer = 3;
    }
  }
}

export function tryVending(g) {
  for (const v of g.vending || []) {
    if (Math.hypot(g.player.x - v.x, g.player.z - v.z) < 3) {
      if ((g.cash || 0) < 3) return false;
      g.cash -= 3;
      g.health = Math.min(100, (g.health || 0) + 15);
      if (g.player) g.player.health = g.health;
      return true;
    }
  }
  return false;
}

export function tryAtm(g) {
  for (const a of g.atms || []) {
    if (Math.hypot(g.player.x - a.x, g.player.z - a.z) < 3) {
      g.modal = {
        kind: 'atm',
        title: 'ATM',
        lines: [`Cash: $${g.cash || 0}`, `Bank: $${g.bank || 0}`, '1. Deposit $50', '2. Withdraw $50'],
      };
      return true;
    }
  }
  return false;
}

// 0 = deposit $50, 1 = withdraw $50.
export function atmAction(g, action) {
  if (action === 0) {
    if ((g.cash || 0) < 50) return false;
    g.cash -= 50;
    g.bank = (g.bank || 0) + 50;
    return true;
  }
  if (action === 1) {
    if ((g.bank || 0) < 50) return false;
    g.bank -= 50;
    g.cash = (g.cash || 0) + 50;
    return true;
  }
  return false;
}
