// Solmar Bay — side activities: fishing, vending machines, ATMs.
//
// Fishing at the pier (E near the water, catch fish for $),
// vending machines (E to buy a snack that heals a little), ATMs
// (E to deposit/withdraw $50 into the bank). Each activity
// triggers and changes state/cash as specified.

import { TUNE, SPAWNS, dist } from './config.js';
import { addCash, showToast } from './state.js';

export function spawnActivities(game) {
  game.vending = [
    { x: -60, z: -20 }, { x: 60, z: -16 }, { x: 40, z: 139 },
  ];
  game.atms = [
    { x: 8, z: -8 }, { x: -8, z: 60 },
  ];
  game.fishing = { active: false, t: 0 };
}

// Fish at the pier (E). Hold still for fishTime seconds, then a
// fish is caught. Returns true when fishing started.
export function tryFish(game) {
  const p = game.player;
  if (dist(p.x, p.z, SPAWNS.fishing.x, SPAWNS.fishing.z) > 6) return false;
  if (game.fishing.active) return false;
  game.fishing.active = true;
  game.fishing.t = TUNE.fishTime;
  showToast(game, 'Fishing... hold still...');
  return true;
}

export function stepActivities(game, dt) {
  if (game.fishing.active) {
    const p = game.player;
    if (p.moving) {
      game.fishing.active = false;
      showToast(game, 'You moved — the fish got away');
      return;
    }
    game.fishing.t -= dt;
    if (game.fishing.t <= 0) {
      game.fishing.active = false;
      const amount = TUNE.fishMin + Math.floor(Math.random() * (TUNE.fishMax - TUNE.fishMin));
      addCash(game, amount, 'fish caught');
      game.stats.fishCaught += 1;
      showToast(game, `Caught a fish! Sold for $${amount}`);
    }
  }
}

// Buy a snack from the nearest vending machine (E). $3, +15 HP.
export function tryVending(game) {
  const p = game.player;
  for (const v of game.vending) {
    if (dist(p.x, p.z, v.x, v.z) < 3) {
      if (game.cash < TUNE.snackPrice) {
        showToast(game, 'Not enough cash for a snack');
        return false;
      }
      game.cash -= TUNE.snackPrice;
      game.health = Math.min(100, game.health + TUNE.snackHeal);
      showToast(game, `Snack bought — +${TUNE.snackHeal} HP`);
      return true;
    }
  }
  return false;
}

// Use the nearest ATM (E): deposit $50 into the bank, or
// withdraw $50 when the bank has it. Alternates by cash.
export function tryAtm(game) {
  const p = game.player;
  for (const a of game.atms) {
    if (dist(p.x, p.z, a.x, a.z) < 3) {
      if (game.cash >= 50) {
        game.cash -= 50;
        game.bank += 50;
        showToast(game, `Deposited $50 — bank balance $${game.bank}`);
      } else if (game.bank >= 50) {
        game.bank -= 50;
        game.cash += 50;
        showToast(game, `Withdrew $50 — bank balance $${game.bank}`);
      } else {
        showToast(game, `ATM — cash $${game.cash}, bank $${game.bank}`);
      }
      return true;
    }
  }
  return false;
}

// Draw vending machines + ATMs.
export function activityBoxes(game, out) {
  for (const v of game.vending) {
    out.push({ x: v.x, y: 0, z: v.z, w: 1.4, h: 2.2, d: 0.8, c: [0.9, 0.2, 0.3] });
    out.push({ x: v.x, y: 1.6, z: v.z + 0.45, w: 1, h: 0.5, d: 0.1, c: [1.2, 1.2, 1.2] });
  }
  for (const a of game.atms) {
    out.push({ x: a.x, y: 0, z: a.z, w: 1.2, h: 2, d: 0.8, c: [0.2, 0.5, 0.9] });
    out.push({ x: a.x, y: 1.4, z: a.z + 0.45, w: 0.8, h: 0.5, d: 0.1, c: [1.3, 1.3, 0.9] });
  }
  return out;
}
