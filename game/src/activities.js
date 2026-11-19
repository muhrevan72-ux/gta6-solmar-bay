// Solmar Bay — small side activities: fishing at the pier, vending
// machines, and ATMs (deposit / withdraw). All real, all wired to
// cash / health / bank — no mockups.

import { TUNE, clamp, dist2 } from './config.js';
import { showToast, addCash } from './state.js';
import { showMenu } from './hud.js';

export const FISHING_SPOT = { x: -330, z: 100 }; // shore end of the pier
export const VENDING_SPOTS = [
  { x: 9, z: -60 },
  { x: 109, z: 100 },
  { x: -91, z: -200 },
];
export const ATM_SPOTS = [
  { x: 9, z: 20 },
  { x: -91, z: 60 },
];

export function createActivities() {
  return {
    machines: VENDING_SPOTS.map((s) => ({ ...s })),
    atms: ATM_SPOTS.map((s) => ({ ...s })),
    fishingSpot: { ...FISHING_SPOT },
    fishing: null, // { t } while a cast is out
    fishingCooldown: 0,
    fishCaught: 0,
    atmOpen: false,
  };
}

export function nearestMachine(game) {
  const p = game.player;
  for (const m of game.activities.machines) {
    if (dist2(p.x, p.z, m.x, m.z) < 16) return m;
  }
  return null;
}

export function nearestAtm(game) {
  const p = game.player;
  for (const a of game.activities.atms) {
    if (dist2(p.x, p.z, a.x, a.z) < 16) return a;
  }
  return null;
}

export function nearFishingSpot(game) {
  const p = game.player;
  return dist2(p.x, p.z, game.activities.fishingSpot.x, game.activities.fishingSpot.z) < 25;
}

// Cast a line. The catch lands after TUNE.fishTime seconds.
export function startFishing(game) {
  const a = game.activities;
  if (!a || a.fishing) return false;
  if (a.fishingCooldown > 0) {
    showToast(game.state, 'Wait a bit before casting again.', 2);
    return false;
  }
  a.fishing = { t: 0 };
  game.player.fishing = true;
  showToast(game.state, 'Fishing… wait for a bite.', 2);
  return true;
}

export function updateActivities(game, dt) {
  const a = game.activities;
  if (!a) return;
  if (a.fishingCooldown > 0) a.fishingCooldown -= dt;
  if (!a.fishing) return;
  a.fishing.t += dt;
  if (a.fishing.t >= TUNE.fishTime) {
    const reward = TUNE.fishMin + Math.floor(Math.random() * (TUNE.fishMax - TUNE.fishMin + 1));
    addCash(game.state, reward);
    a.fishCaught += 1;
    a.fishing = null;
    a.fishingCooldown = 5;
    game.player.fishing = false;
    showToast(game.state, 'Caught a fish! +$' + reward, 3);
    if (game.audio) game.audio.play('win');
  }
}

// Buy a snack from the nearest vending machine: $3, +15 HP.
export function buySnack(game) {
  const m = nearestMachine(game);
  if (!m) return false;
  if (game.state.cash < TUNE.snackPrice) {
    showToast(game.state, 'A snack costs $' + TUNE.snackPrice + '. Not enough cash.', 2);
    return false;
  }
  game.state.cash -= TUNE.snackPrice;
  game.state.health = clamp(game.state.health + TUNE.snackHeal, 0, 100);
  showToast(game.state, 'Snack! +' + TUNE.snackHeal + ' HP (-$' + TUNE.snackPrice + ')', 2);
  if (game.audio) game.audio.play('pickup');
  return true;
}

// ATM: opens a menu; digits deposit / withdraw in $50 chunks.
export function openAtm(game) {
  const a = game.activities;
  if (!a || !nearestAtm(game)) return false;
  a.atmOpen = true;
  showAtmMenu(game);
  return true;
}

export function showAtmMenu(game) {
  showMenu(game.hud, 'ATM',
    'Cash: $' + game.state.cash + '<br>Bank: $' + (game.state.bank || 0),
    'Press 1 to deposit $' + TUNE.atmStep + ', 2 to withdraw $' + TUNE.atmStep + ', Esc to close.');
}

export function handleAtmKeys(game) {
  const input = game.input;
  const a = game.activities;
  if (!a || !a.atmOpen) return false;
  if (input.pressedKey('Digit1')) {
    if (game.state.cash < TUNE.atmStep) {
      showToast(game.state, 'Not enough cash to deposit $' + TUNE.atmStep + '.', 2);
    } else {
      game.state.cash -= TUNE.atmStep;
      game.state.bank = (game.state.bank || 0) + TUNE.atmStep;
      showToast(game.state, 'Deposited $' + TUNE.atmStep + ' to the bank.', 2);
    }
    showAtmMenu(game);
    return true;
  }
  if (input.pressedKey('Digit2')) {
    if ((game.state.bank || 0) < TUNE.atmStep) {
      showToast(game.state, 'Not enough in the bank to withdraw $' + TUNE.atmStep + '.', 2);
    } else {
      game.state.bank -= TUNE.atmStep;
      game.state.cash += TUNE.atmStep;
      showToast(game.state, 'Withdrew $' + TUNE.atmStep + ' from the bank.', 2);
    }
    showAtmMenu(game);
    return true;
  }
  return false;
}

// Dynamic boxes: vending machines, ATMs, and the fishing bobber.
export function activitiesBoxes(game) {
  const a = game.activities;
  if (!a) return [];
  const boxes = [];
  for (const m of a.machines) {
    boxes.push({ x: m.x, y: 1.1, z: m.z, sx: 1.4, sy: 2.2, sz: 0.9, c: [0.9, 0.2, 0.3] });
    boxes.push({ x: m.x, y: 1.5, z: m.z + 0.5, sx: 1.0, sy: 0.7, sz: 0.2, c: [1, 0.95, 0.6] });
  }
  for (const t of a.atms) {
    boxes.push({ x: t.x, y: 1.1, z: t.z, sx: 1.2, sy: 2.2, sz: 0.8, c: [0.15, 0.25, 0.5] });
    boxes.push({ x: t.x, y: 1.6, z: t.z + 0.45, sx: 0.9, sy: 0.6, sz: 0.2, c: [0.4, 0.8, 1] });
  }
  if (a.fishing) {
    // bobber in the water just past the pier end
    boxes.push({ x: -336, y: 0.6, z: 100, sx: 0.5, sy: 0.5, sz: 0.5, c: [1, 0.3, 0.2] });
  }
  return boxes;
}
