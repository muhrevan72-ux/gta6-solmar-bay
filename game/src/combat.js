// Solmar Bay — combat: weapons, punching, bombs, pickups.
//
// Pistol (start, infinite ammo), SMG + shotgun as pickups, throwable
// bombs (blast radius, damages nearby, raises wanted). Aim via the
// centre crosshair, hitscan. Weapon switching (1/2/3), shoot (mouse
// click), bomb (G). Killed peds/cops drop cash pickups ($10-50);
// walking over one collects the money. Killing raises wanted
// (commitCrime: killPed 2, killCop 3, explosion 3).

import { TUNE, COL, dist2 } from './config.js';
import { addCash, damagePlayer, healPlayer, showToast } from './state.js';
import { commitCrime } from './police.js';
import { damageCar } from './vehicles.js';
import { provokeGang } from './gangs.js';
import { pedFightBack } from './pedestrians.js';
import { playThud } from './audio.js';

export const WEAPONS = {
  pistol: { name: 'Pistol', damage: TUNE.pistolDamage, range: 60, rate: 0.25, auto: false, pellets: 1, spread: 0.01 },
  smg: { name: 'SMG', damage: TUNE.smgDamage, range: 50, rate: 0.09, auto: true, pellets: 1, spread: 0.04 },
  shotgun: { name: 'Shotgun', damage: TUNE.shotgunDamage, range: 25, rate: 0.8, auto: false, pellets: 6, spread: 0.09 },
};

export function createCombat() {
  return {
    pickups: [], // {kind: 'health'|'armour'|'wrench'|'cash'|'smg'|'shotgun', x, z, value}
    shootT: 0, // fire-rate cooldown
    recentShotT: 0, // peds flee while > 0
    recentBombT: 0,
    muzzleT: 0,
  };
}

export function switchWeapon(game, name) {
  const s = game.state;
  if (!s.weapons[name]) return false; // not owned yet — stays put
  if (s.weapon === name) return true;
  s.weapon = name;
  showToast(s, WEAPONS[name].name + ' equipped.', 1.5);
  return true;
}

// Hitscan shot from the camera centre. Finds the closest target in
// a narrow cone in front of the player: peds, cops, gang members,
// cars (damaged), and the shooting-range targets.
export function shoot(game) {
  const s = game.state;
  const c = game.combat;
  if (s.player.inCar) return false;
  if (c.shootT > 0) return false;
  const w = WEAPONS[s.weapon];
  c.shootT = w.rate;
  c.recentShotT = 1.5;
  c.muzzleT = 0.08;
  const p = s.player;
  const fx = Math.sin(p.heading);
  const fz = Math.cos(p.heading);
  let best = null;
  let bestD = w.range;
  function consider(x, z, kind, ref) {
    const dx = x - p.x;
    const dz = z - p.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d > w.range || d < 0.5) return;
    // In the cone? Dot with the facing direction.
    const dot = (dx * fx + dz * fz) / d;
    if (dot < 0.94) return;
    if (d < bestD) {
      bestD = d;
      best = { kind, ref, d };
    }
  }
  for (const ped of game.peds.list) {
    if (ped.hp > 0) consider(ped.x, ped.z, 'ped', ped);
  }
  for (const cop of game.police.cops) {
    consider(cop.x, cop.z, 'cop', cop);
  }
  for (const v of game.vehicles.list) {
    if (v.driver !== 'player') consider(v.x, v.z, 'car', v);
  }
  for (const t of game.training.targets) {
    if (!t.hit) consider(t.x, t.z, 'target', t);
  }
  if (!best) return true; // shot fired, nothing hit
  // Damage the target (shotgun fires 6 pellets).
  for (let i = 0; i < w.pellets; i++) {
    if (best.kind === 'ped') damagePed(game, best.ref, w.damage);
    else if (best.kind === 'cop') damageCop(game, best.ref, w.damage);
    else if (best.kind === 'car') damageCar(game, best.ref, w.damage);
    else if (best.kind === 'target') hitTarget(game, best.ref);
  }
  return true;
}

export function damagePed(game, ped, n) {
  ped.hp -= n;
  if (ped.hp <= 0) {
    killPed(game, ped);
  } else {
    // The ped fights back.
    pedFightBack(game, ped);
  }
}

export function killPed(game, ped) {
  const s = game.state;
  ped.hp = 0;
  s.stats.kills++;
  dropCash(game, ped.x, ped.z);
  if (ped.gang) {
    commitCrime(game, 'killGang');
    provokeGang(game, ped.gang, 25);
  } else {
    commitCrime(game, 'killPed');
  }
  if (game.audio) {
    playThud(game.audio);
  }
}

export function damageCop(game, cop, n) {
  cop.hp = (cop.hp === undefined ? 100 : cop.hp) - n;
  if (cop.hp <= 0 && !cop.dead) {
    cop.dead = true;
    game.state.stats.kills++;
    game.state.stats.copKills = (game.state.stats.copKills || 0) + 1;
    dropCash(game, cop.x, cop.z);
    commitCrime(game, 'killCop');
    const i = game.police.cops.indexOf(cop);
    if (i >= 0) game.police.cops.splice(i, 1);
  }
}

export function dropCash(game, x, z) {
  const v = TUNE.cashDropMin + Math.floor(Math.random() * (TUNE.cashDropMax - TUNE.cashDropMin));
  game.combat.pickups.push({ kind: 'cash', x: x + (Math.random() - 0.5) * 2, z: z + (Math.random() - 0.5) * 2, value: v });
}

// F punch: hits the closest ped/cop within 2.5 m in front.
export function punch(game) {
  const s = game.state;
  if (s.player.inCar) return false;
  const p = s.player;
  const fx = Math.sin(p.heading);
  const fz = Math.cos(p.heading);
  let best = null;
  let bestD = 2.5;
  for (const ped of game.peds.list) {
    if (ped.hp <= 0) continue;
    const d = Math.sqrt(dist2(p.x, p.z, ped.x, ped.z));
    if (d > bestD) continue;
    const dot = ((ped.x - p.x) * fx + (ped.z - p.z) * fz) / (d || 1);
    if (dot < 0.5) continue;
    bestD = d;
    best = { kind: 'ped', ref: ped };
  }
  for (const cop of game.police.cops) {
    const d = Math.sqrt(dist2(p.x, p.z, cop.x, cop.z));
    if (d > bestD) continue;
    const dot = ((cop.x - p.x) * fx + (cop.z - p.z) * fz) / (d || 1);
    if (dot < 0.5) continue;
    bestD = d;
    best = { kind: 'cop', ref: cop };
  }
  if (!best) return false;
  if (best.kind === 'ped') {
    commitCrime(game, 'punchPed');
    damagePed(game, best.ref, TUNE.punchDamage);
  } else {
    commitCrime(game, 'punchPed');
    damageCop(game, best.ref, TUNE.punchDamage);
  }
  if (game.audio) playThud(game.audio);
  return true;
}

// G bomb: throwable, blast radius 9, damage 120, raises wanted.
export function throwBomb(game) {
  const s = game.state;
  if (s.bombs <= 0) {
    showToast(s, 'No bombs left. Find more around the city.', 2);
    return false;
  }
  s.bombs--;
  const c = game.combat;
  c.recentBombT = 2;
  const p = s.player;
  const bx = p.x + Math.sin(p.heading) * 6;
  const bz = p.z + Math.cos(p.heading) * 6;
  let victims = 0;
  for (const ped of game.peds.list) {
    if (ped.hp <= 0) continue;
    if (dist2(ped.x, ped.z, bx, bz) < TUNE.bombRadius * TUNE.bombRadius) {
      damagePed(game, ped, TUNE.bombDamage);
      victims++;
    }
  }
  for (const cop of [...game.police.cops]) {
    if (dist2(cop.x, cop.z, bx, bz) < TUNE.bombRadius * TUNE.bombRadius) {
      damageCop(game, cop, TUNE.bombDamage);
      victims++;
    }
  }
  for (const v of game.vehicles.list) {
    if (v.driver === 'player') continue;
    if (dist2(v.x, v.z, bx, bz) < TUNE.bombRadius * TUNE.bombRadius) {
      damageCar(game, v, TUNE.bombDamage);
    }
  }
  commitCrime(game, victims >= 2 ? 'explosion' : 'explosion');
  if (victims >= 3) commitCrime(game, 'massRampage');
  return true;
}

function hitTarget(game, t) {
  if (t.hit) return;
  t.hit = true;
  game.training.score += 10;
  showToast(game.state, 'Target down! +10', 1);
}

export function stepCombat(game, dt) {
  const c = game.combat;
  if (c.shootT > 0) c.shootT -= dt;
  if (c.recentShotT > 0) c.recentShotT -= dt;
  if (c.recentBombT > 0) c.recentBombT -= dt;
  if (c.muzzleT > 0) c.muzzleT -= dt;
  // Pickups: walk over one to collect it.
  const s = game.state;
  const p = s.player;
  for (let i = c.pickups.length - 1; i >= 0; i--) {
    const pk = c.pickups[i];
    if (dist2(p.x, p.z, pk.x, pk.z) < TUNE.pickupRadius * TUNE.pickupRadius) {
      collectPickup(game, pk);
      c.pickups.splice(i, 1);
    }
  }
}

export function collectPickup(game, pk) {
  const s = game.state;
  if (pk.kind === 'cash') {
    addCash(s, pk.value);
    showToast(s, '+$' + pk.value, 1.5);
  } else if (pk.kind === 'health') {
    healPlayer(s, 50);
    showToast(s, '+50 HP', 1.5);
  } else if (pk.kind === 'armour') {
    s.armour = Math.min(100, s.armour + 50);
    showToast(s, '+50 armour', 1.5);
  } else if (pk.kind === 'wrench') {
    if (s.player.inCar) {
      s.player.inCar.damage = Math.max(0, s.player.inCar.damage - 50);
      showToast(s, 'Car repaired +50', 1.5);
    }
  } else if (pk.kind === 'smg') {
    s.weapons.smg = true;
    s.ammo.smg = 120;
    showToast(s, 'SMG picked up!', 2);
  } else if (pk.kind === 'shotgun') {
    s.weapons.shotgun = true;
    s.ammo.shotgun = 24;
    showToast(s, 'Shotgun picked up!', 2);
  } else if (pk.kind === 'bomb') {
    s.bombs += 2;
    showToast(s, '+2 bombs', 1.5);
  }
}

// Scatter the starting pickups around the city.
export function seedPickups(game) {
  const c = game.combat;
  const spots = [
    { kind: 'health', x: -50, z: 20 }, { kind: 'health', x: 100, z: -80 },
    { kind: 'armour', x: -120, z: -60 }, { kind: 'armour', x: 200, z: 60 },
    { kind: 'wrench', x: 150, z: -110 }, { kind: 'wrench', x: -200, z: 150 },
    { kind: 'smg', x: 0, z: -350 }, { kind: 'shotgun', x: 330, z: -100 },
    { kind: 'bomb', x: 60, z: 140 }, { kind: 'bomb', x: -250, z: -150 },
  ];
  for (const pk of spots) c.pickups.push({ ...pk, value: 0 });
}

export function pickupBoxes(game, out) {
  for (const pk of game.combat.pickups) {
    const col = pk.kind === 'health' ? [0.9, 0.2, 0.2]
      : pk.kind === 'armour' ? [0.3, 0.5, 0.95]
      : pk.kind === 'wrench' ? [0.9, 0.9, 0.9]
      : pk.kind === 'cash' ? [0.95, 0.8, 0.15]
      : pk.kind === 'bomb' ? [0.15, 0.15, 0.15]
      : [0.9, 0.5, 0.1];
    out.pushBox(pk.x, 0.5, pk.z, 0.8, 0.8, 0.8, col);
  }
}

export { WEAPONS as WEAPON_DEFS };
