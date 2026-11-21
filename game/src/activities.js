// Solmar Bay — street activities: fishing, vending machines, ATMs.
//
// Fish at the pier for a few dollars, grab a snack from a machine to
// heal, and use an ATM to stash cash in the bank.

import { pushBox } from './render.js';
import { showToast } from './state.js';
import { SPAWNS } from './config.js';

const VENDING_SPOTS = [
  { x: 10, z: 10 },
  { x: -60, z: 60 },
  { x: 120, z: -60 },
  { x: -200, z: 40 },
];
const ATM_SPOTS = [
  { x: 20, z: -10 },
  { x: -100, z: 100 },
  { x: 150, z: 60 },
];

export function spawnActivities(g) {
  g.vending = VENDING_SPOTS.map((s) => ({ ...s }));
  g.atms = ATM_SPOTS.map((s) => ({ ...s }));
  g.bank = 0;
  g._fishing = { active: false, t: 0 };
  return g;
}

export function stepActivities(g, dt) {
  if (g._fishing && g._fishing.active) {
    g._fishing.t += dt;
    if (g._fishing.t >= 3.5) {
      g._fishing.active = false;
      const amount = 5 + Math.floor(Math.random() * 11);
      g.cash += amount;
      g.stats.fishCaught = (g.stats.fishCaught || 0) + 1;
      showToast(g, `Caught a fish! +$${amount}.`);
    }
  }
}

export function tryFish(g) {
  const p = g.player;
  if (Math.hypot(p.x - SPAWNS.fishing.x, p.z - SPAWNS.fishing.z) > 8) return false;
  g._fishing = { active: true, t: 0 };
  showToast(g, 'Fishing… wait for a bite.');
  return true;
}

export function tryVending(g) {
  const p = g.player;
  let near = false;
  for (const v of g.vending || []) {
    if (Math.hypot(p.x - v.x, p.z - v.z) <= 4) {
      near = true;
      break;
    }
  }
  if (!near) return false;
  if (g.cash < 3) return false;
  g.cash -= 3;
  g.health = Math.min(100, g.health + 15);
  showToast(g, 'Snack bought — +15 health.');
  return true;
}

export function tryAtm(g) {
  const p = g.player;
  let near = false;
  for (const a of g.atms || []) {
    if (Math.hypot(p.x - a.x, p.z - a.z) <= 4) {
      near = true;
      break;
    }
  }
  if (!near) return false;
  g.modal = {
    kind: 'atm',
    title: 'ATM',
    lines: [`Balance: $${g.bank || 0}`, '1. Deposit $50', '2. Withdraw $50'],
  };
  return true;
}

// 0 = deposit $50, 1 = withdraw $50.
export function atmAction(g, index) {
  g.bank = g.bank || 0;
  if (index === 0) {
    if (g.cash < 50) return false;
    g.cash -= 50;
    g.bank += 50;
    g.modal = null;
    showToast(g, 'Deposited $50.');
    return true;
  }
  if (index === 1) {
    if (g.bank < 50) return false;
    g.bank -= 50;
    g.cash += 50;
    g.modal = null;
    showToast(g, 'Withdrew $50.');
    return true;
  }
  return false;
}

// Vending machines and ATMs on the street.
export function activitiesBoxes(g, b, cam) {
  const plain = [0, 0, 1, 1];
  let count = 0;
  for (const v of g.vending || []) {
    pushBox(b, v.x, 0, v.z, 0.9, 1.8, 0.6, [0.9, 0.2, 0.25], plain);
    count += 1;
  }
  for (const a of g.atms || []) {
    pushBox(b, a.x, 0, a.z, 0.9, 1.6, 0.6, [0.2, 0.4, 0.9], plain);
    count += 1;
  }
  return count;
}
