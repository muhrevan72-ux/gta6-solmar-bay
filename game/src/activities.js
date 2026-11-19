// Solmar Bay — side activities: fishing, vending machines, ATMs.
//
// - Fishing at the pier (-330, 100): press E near the water, wait
//   3 seconds with the line out, catch a fish for $5-15.
// - Vending machines (3): press E to buy a snack ($3, +15 HP).
// - ATMs (2): press E to deposit/withdraw in $50 chunks into the
//   bank (state.bank).

import { TUNE, dist2 } from './config.js';
import { addCash, healPlayer, showToast } from './state.js';

export const FISHING_SPOT = { x: -330, z: 100 };
export const VENDING_MACHINES = [
  { x: -40, z: -60 },
  { x: 40, z: 40 },
  { x: 100, z: 120 },
];
export const ATMS = [
  { x: -20, z: 20 },
  { x: 80, z: -40 },
];

export function createActivities() {
  return {
    fishing: { active: false, t: 0, cooldown: 0 },
  };
}

export function startFishing(game) {
  const a = game.activities.fishing;
  const p = game.state.player;
  if (a.cooldown > 0) return false;
  if (a.active) return false;
  if (dist2(p.x, p.z, FISHING_SPOT.x, FISHING_SPOT.z) > 100) return false;
  a.active = true;
  a.t = TUNE.fishTime;
  showToast(game.state, 'Line cast... wait for a bite.', 2);
  return true;
}

export function stepActivities(game, dt) {
  const a = game.activities.fishing;
  if (a.cooldown > 0) a.cooldown -= dt;
  if (!a.active) return;
  a.t -= dt;
  if (a.t <= 0) {
    a.active = false;
    a.cooldown = 5; // short cooldown before the next cast
    const reward = TUNE.fishMin + Math.floor(Math.random() * (TUNE.fishMax - TUNE.fishMin + 1));
    addCash(game.state, reward);
    showToast(game.state, 'Caught a fish! +$' + reward, 2);
  }
}

export function nearestVending(game, x, z, range) {
  let best = null;
  let bestD = range * range;
  for (const m of VENDING_MACHINES) {
    const d = dist2(x, z, m.x, m.z);
    if (d < bestD) {
      bestD = d;
      best = m;
    }
  }
  return best;
}

export function buySnack(game) {
  const s = game.state;
  if (s.cash < TUNE.snackPrice) {
    showToast(s, 'A snack costs $' + TUNE.snackPrice + '.', 2);
    return false;
  }
  s.cash -= TUNE.snackPrice;
  healPlayer(s, TUNE.snackHeal);
  showToast(s, 'Snack! +$' + TUNE.snackPrice + ' spent, +' + TUNE.snackHeal + ' HP.', 2);
  return true;
}

export function nearestAtm(game, x, z, range) {
  let best = null;
  let bestD = range * range;
  for (const m of ATMS) {
    const d = dist2(x, z, m.x, m.z);
    if (d < bestD) {
      bestD = d;
      best = m;
    }
  }
  return best;
}

export function atmDeposit(game, amount) {
  const s = game.state;
  const n = Math.min(amount, s.cash);
  if (n <= 0) {
    showToast(s, 'Nothing to deposit.', 2);
    return 0;
  }
  s.cash -= n;
  s.bank += n;
  showToast(s, 'Deposited $' + n + '. Bank balance: $' + s.bank + '.', 2);
  return n;
}

export function atmWithdraw(game, amount) {
  const s = game.state;
  const n = Math.min(amount, s.bank);
  if (n <= 0) {
    showToast(s, 'Nothing to withdraw.', 2);
    return 0;
  }
  s.bank -= n;
  s.cash += n;
  showToast(s, 'Withdrew $' + n + '. Bank balance: $' + s.bank + '.', 2);
  return n;
}

export function activityBoxes(game, out) {
  // Vending machines (tall boxes with a lit front).
  for (const m of VENDING_MACHINES) {
    out.pushBox(m.x, 1, m.z, 1.2, 2, 0.8, [0.85, 0.15, 0.25]);
    out.pushBox(m.x, 1.4, m.z + 0.45, 0.9, 0.8, 0.1, [0.9, 0.95, 1.0]);
  }
  // ATMs.
  for (const m of ATMS) {
    out.pushBox(m.x, 1, m.z, 1, 2, 0.6, [0.2, 0.3, 0.6]);
    out.pushBox(m.x, 1.3, m.z + 0.35, 0.7, 0.5, 0.1, [0.4, 0.8, 0.4]);
  }
  // Fishing line while casting.
  const a = game.activities.fishing;
  if (a.active) {
    const p = game.state.player;
    out.pushBox(p.x, 0.5, p.z + 1, 0.1, 0.1, 3, [0.9, 0.9, 0.9]);
  }
}
