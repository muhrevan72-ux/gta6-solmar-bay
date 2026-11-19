// Solmar Bay — side activities: fishing, vending machines, ATMs.
//
// - Fishing at the pier (-330, 100): E starts a 3-second cast;
//   the catch pays $5-15.
// - Vending machines (3): E buys a $3 snack, +15 HP.
// - ATMs (2): E deposits/withdraws in $50 chunks into the bank
//   (state.bank). The bank balance persists in the save.

import { TUNE, FISHING_SPOT, VENDING_MACHINES, ATMS } from './config.js';
import { showToast, addCash, healPlayer } from './state.js';

export function createActivities() {
  return {
    fishing: null, // {t} — seconds left on the cast
    atmOpen: false,
  };
}

export function stepActivities(game, dt) {
  const a = game.activities;
  const s = game.state;
  if (a.fishing) {
    a.fishing.t -= dt;
    if (a.fishing.t <= 0) {
      a.fishing = null;
      const catchValue = TUNE.fishMin + Math.floor(Math.random() * (TUNE.fishMax - TUNE.fishMin + 1));
      addCash(s, catchValue);
      showToast(s, 'You caught a fish! Sold for $' + catchValue + '.', 4);
    }
  }
}

// E near the pier starts a cast; E near a vending machine buys a
// snack; E near an ATM opens the bank menu. Returns true if an
// activity was triggered.
export function tryActivity(game) {
  const s = game.state;
  const p = s.player;
  // Fishing.
  if (Math.hypot(p.x - FISHING_SPOT.x, p.z - FISHING_SPOT.z) < 4) {
    if (!game.activities.fishing) {
      game.activities.fishing = { t: TUNE.fishTime };
      showToast(s, 'Casting… wait 3 seconds.', 3);
    }
    return true;
  }
  // Vending machines.
  for (const vm of VENDING_MACHINES) {
    if (Math.hypot(p.x - vm.x, p.z - vm.z) < 3) {
      if (s.cash < TUNE.snackPrice) {
        showToast(s, 'A snack costs $' + TUNE.snackPrice + '.', 3);
        return true;
      }
      addCash(s, -TUNE.snackPrice);
      healPlayer(s, TUNE.snackHeal);
      showToast(s, 'Snack! +' + TUNE.snackHeal + ' HP (-$' + TUNE.snackPrice + ')', 3);
      return true;
    }
  }
  // ATMs.
  for (const atm of ATMS) {
    if (Math.hypot(p.x - atm.x, p.z - atm.z) < 3) {
      game.activities.atmOpen = !game.activities.atmOpen;
      if (game.activities.atmOpen) {
        showToast(s, 'ATM — Bank: $' + s.bank + ' · Cash: $' + s.cash + ' · 1 deposit $50 · 2 withdraw $50', 5);
      }
      return true;
    }
  }
  return false;
}

// Digit keys while the ATM menu is open: 1 deposit $50, 2 withdraw.
export function atmDigit(game, digit) {
  const s = game.state;
  if (!game.activities.atmOpen) return false;
  if (digit === 1) {
    if (s.cash < 50) { showToast(s, 'You need $50 cash to deposit.', 3); return false; }
    addCash(s, -50);
    s.bank += 50;
    showToast(s, 'Deposited $50. Bank: $' + s.bank, 3);
    return true;
  }
  if (digit === 2) {
    if (s.bank < 50) { showToast(s, 'Your bank balance is under $50.', 3); return false; }
    s.bank -= 50;
    addCash(s, 50);
    showToast(s, 'Withdrew $50. Bank: $' + s.bank, 3);
    return true;
  }
  return false;
}

export function activityBoxes(game, out) {
  // Vending machines.
  for (const vm of VENDING_MACHINES) {
    out.pushBox(vm.x, 0.9, vm.z, 1, 1.8, 0.7, [0.9, 0.2, 0.2]);
    out.pushBox(vm.x, 1.2, vm.z + 0.36, 0.7, 0.5, 0.05, [0.2, 0.2, 0.2]);
  }
  // ATMs.
  for (const atm of ATMS) {
    out.pushBox(atm.x, 1, atm.z, 1, 2, 0.6, [0.2, 0.3, 0.5]);
    out.pushBox(atm.x, 1.3, atm.z + 0.31, 0.7, 0.5, 0.05, [0.1, 0.8, 0.3]);
  }
  // Fishing rod marker at the pier.
  out.pushBox(FISHING_SPOT.x, 0.5, FISHING_SPOT.z, 0.2, 1, 0.2, [0.6, 0.4, 0.2]);
}
