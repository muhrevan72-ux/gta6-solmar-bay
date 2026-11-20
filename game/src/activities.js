// Solmar Bay — side activities.
//
// Fishing at the pier (hold E at the water, wait 3 s, catch a
// fish for $5-15), vending machines (Snack $3, +15 HP), and ATMs
// (deposit/withdraw cash to the bank). All three are small, safe
// income — no crime, no wanted.

import { SPAWNS, TUNE } from './config.js';
import { pushBox } from './render.js';
import { tileUV } from './texture.js';
import { dist } from './config.js';
import { addCash, showToast } from './state.js';

export function spawnActivities(game) {
  game._fishing = { active: false, t: 0 };
  game.vending = [
    { x: -60, z: -26 },
    { x: 60, z: -22 },
    { x: 120, z: 72 },
    { x: -120, z: 56 },
  ];
  game.atms = [
    { x: 30, z: 60 },
    { x: -30, z: -60 },
    { x: 150, z: 30 },
  ];
}

export function tryFish(game) {
  const p = game.player;
  if (dist(p.x, p.z, SPAWNS.fishing.x, SPAWNS.fishing.z) > 6) return false;
  if (game._fishing.active) return false;
  game._fishing.active = true;
  game._fishing.t = 0;
  showToast(game, 'Fishing… wait for a bite.');
  return true;
}

export function stepActivities(game, dt) {
  if (game._fishing.active) {
    game._fishing.t += dt;
    if (game._fishing.t >= TUNE.fishTime) {
      game._fishing.active = false;
      const amount = TUNE.fishMin + Math.floor(Math.random() * (TUNE.fishMax - TUNE.fishMin));
      game.stats.fishCaught += 1;
      addCash(game, amount, '— fish sold');
      showToast(game, `Caught a fish! +$${amount}`);
    }
  }
}

export function tryVending(game) {
  const p = game.player;
  for (const v of game.vending) {
    if (dist(p.x, p.z, v.x, v.z) < 3) {
      if (game.cash < TUNE.snackPrice) {
        showToast(game, 'Not enough cash for a snack.');
        return false;
      }
      game.cash -= TUNE.snackPrice;
      game.health = Math.min(100, game.health + TUNE.snackHeal);
      showToast(game, `Snack — HP ${game.health}`);
      return true;
    }
  }
  return false;
}

export function tryAtm(game) {
  const p = game.player;
  for (const a of game.atms) {
    if (dist(p.x, p.z, a.x, a.z) < 3) {
      game.modal = {
        kind: 'atm',
        title: 'ATM',
        lines: [
          `Cash $${game.cash} · Bank $${game.bank}`,
          '',
          '1. Deposit $50',
          '2. Withdraw $50',
          '',
          'Press 1-2, Esc to leave.',
        ],
      };
      return true;
    }
  }
  return false;
}

export function atmAction(game, idx) {
  if (idx === 0) {
    if (game.cash < 50) {
      showToast(game, 'Not enough cash to deposit.');
      return false;
    }
    game.cash -= 50;
    game.bank += 50;
    showToast(game, 'Deposited $50.');
  } else if (idx === 1) {
    if (game.bank < 50) {
      showToast(game, 'Not enough in the bank.');
      return false;
    }
    game.bank -= 50;
    game.cash += 50;
    showToast(game, 'Withdrew $50.');
  }
  game.modal = null;
  return true;
}

export function activityBoxes(game, b, cam) {
  const uv = tileUV('plain');
  for (const v of game.vending) {
    pushBox(b, v.x, 0, v.z, 1.2, 2, 0.8, [0.8, 0.2, 0.2], uv);
  }
  for (const a of game.atms) {
    pushBox(b, a.x, 0, a.z, 1.2, 2, 0.8, [0.2, 0.4, 0.8], uv);
  }
  return game.vending.length + game.atms.length;
}
