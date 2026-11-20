// Solmar Bay — side activities: fishing, vending machines, ATMs.

import { SPAWNS } from './config.js';

export function spawnActivities(g) {
  g.vending = [];
  for (let i = 0; i < 4; i++) {
    g.vending.push({ x: -100 + i * 80, z: 69, kind: 'vending' });
  }
  g.atms = [];
  for (let i = 0; i < 3; i++) {
    g.atms.push({ x: -60 + i * 90, z: -69, kind: 'atm' });
  }
  g._fishing = { active: false, timer: 0 };
}

// Start fishing at the pier (SPAWNS.fishing).
export function tryFish(g) {
  const d = Math.hypot(g.player.x - SPAWNS.fishing.x, g.player.z - SPAWNS.fishing.z);
  if (d > 8) return false;
  g._fishing.active = true;
  g._fishing.timer = 3;
  g.toast = 'Fishing… wait for a bite';
  g.toastTimer = 3;
  return true;
}

export function stepFishing(g, dt) {
  if (!g._fishing || !g._fishing.active) return;
  g._fishing.timer -= dt;
  if (g._fishing.timer <= 0) {
    g._fishing.active = false;
    const amount = 5 + Math.floor(Math.random() * 11);
    g.cash += amount;
    g.stats.fishCaught = (g.stats.fishCaught || 0) + 1;
    g.toast = `Caught a fish! +$${amount}`;
    g.toastTimer = 3;
  }
}

// The combined activity stepper (fishing is the only timed one).
export function stepActivities(g, dt) {
  stepFishing(g, dt);
}

// Buy a snack from a nearby vending machine ($3, +15 HP).
export function tryVending(g) {
  let best = null;
  let bestD = 6;
  for (const v of g.vending) {
    const d = Math.hypot(v.x - g.player.x, v.z - g.player.z);
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  if (!best) return false;
  if (g.cash < 3) {
    g.toast = 'A snack costs $3';
    g.toastTimer = 3;
    return false;
  }
  g.cash -= 3;
  g.health = Math.min(100, g.health + 15);
  g.toast = 'Snack — +15 HP';
  g.toastTimer = 3;
  return true;
}

// Open the ATM modal at a nearby ATM.
export function tryAtm(g) {
  let best = null;
  let bestD = 6;
  for (const a of g.atms) {
    const d = Math.hypot(a.x - g.player.x, a.z - g.player.z);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  if (!best) return false;
  g.modal = { kind: 'atm', title: 'Solmar Bank ATM', lines: [`Balance: $${g.bank || 0}`] };
  return true;
}

// ATM actions: 0 = deposit $50, 1 = withdraw $50.
export function atmAction(g, action) {
  if (action === 0) {
    if (g.cash < 50) return false;
    g.cash -= 50;
    g.bank = (g.bank || 0) + 50;
    g.modal = null;
    return true;
  }
  if (action === 1) {
    if ((g.bank || 0) < 50) return false;
    g.bank -= 50;
    g.cash += 50;
    g.modal = null;
    return true;
  }
  return false;
}
