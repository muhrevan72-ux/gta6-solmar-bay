// Solmar Bay — combat.
//
// Weapons: pistol (infinite ammo, 34 dmg), SMG (18 dmg, fast),
// shotgun (6 pellets x 22 dmg). F punches, G throws a bomb
// (3 carried, +1 per kill). A ped killed by the player drops a
// cash pickup on the ground — the player must walk over it to
// collect, with a "+$X" toast (never silent income).
//
// ASSAULT FIX (round 9, after play-test #7): a non-lethal hit
// used to raise NO wanted at all — the crime was only reported
// on a kill. Four pistol shots and three punches at a ped with
// no reaction and no wanted stars looked like a bug (and it was
// one: assault without consequence). Any successful hit on a
// person now reports 'punchPed' (Assault, 1 star) so the player
// gets immediate, visible feedback. Kills still report killPed.

import { TUNE, CRIME } from './config.js';
import { commitCrime } from './police.js';
import { addCash, showToast } from './state.js';
import { dist } from './config.js';

export const WEAPONS = [
  { name: 'Pistol', damage: 34, range: 60, cooldown: 0.25, spread: 0.12 },
  { name: 'SMG', damage: 18, range: 45, cooldown: 0.08, spread: 0.16 },
  { name: 'Shotgun', damage: 22, range: 25, cooldown: 0.7, spread: 0.35, pellets: 6 },
];

export function dropCash(game, x, z, amount) {
  game.pickups.push({ x, z, kind: 'cash', amount, t: 30 });
}

export function dropPickup(game, x, z, kind) {
  game.pickups.push({ x, z, kind, amount: 0, t: 30 });
}

// Walk-over collection: cash, health, armour, repair.
export function stepPickups(game, dt) {
  const p = game.player;
  for (const pk of game.pickups) {
    pk.t -= dt;
    const d = dist(pk.x, pk.z, p.x, p.z);
    if (d < TUNE.pickupRadius) {
      if (pk.kind === 'cash') {
        addCash(game, pk.amount, 'from the street');
      } else if (pk.kind === 'health') {
        game.health = Math.min(100, game.health + 25);
        showToast(game, '+25 HP');
      } else if (pk.kind === 'armour') {
        game.armour = Math.min(100, game.armour + 25);
        showToast(game, '+25 armour');
      } else if (pk.kind === 'repair') {
        if (p.inCar) p.inCar.condition = Math.min(100, p.inCar.condition + 25);
        showToast(game, 'Car repaired +25');
      }
      pk.t = 0;
    }
  }
  game.pickups = game.pickups.filter((pk) => pk.t > 0);
}

// Damage the player (armour absorbs first).
export function damagePlayer(game, amount) {
  let left = amount;
  if (game.armour > 0) {
    const absorbed = Math.min(game.armour, left);
    game.armour -= absorbed;
    left -= absorbed;
  }
  game.health = Math.max(0, game.health - left);
  if (game.health <= 0 && game.mode === 'play') {
    game.mode = 'wasted';
    game.bustedBy = 'the streets';
  }
}

// Shoot toward (tx, tz). Hits the first person/vehicle within the
// aim cone (0.12 rad) and weapon range. Returns the target hit.
export function shoot(game, tx, tz) {
  const p = game.player;
  if (p.shootCooldown > 0) return null;
  const w = WEAPONS[p.weapon];
  if (p.ammo[p.weapon] !== Infinity && p.ammo[p.weapon] <= 0) {
    showToast(game, 'Out of ammo — buy more at the shooting range');
    return null;
  }
  p.shootCooldown = w.cooldown;
  if (p.ammo[p.weapon] !== Infinity) p.ammo[p.weapon] -= 1;
  if (game.audio) game.audio.sfx('shoot');
  const aim = Math.atan2(tx - p.x, tz - p.z);
  // Find the closest target inside the cone.
  let best = null;
  let bestD = w.range;
  const consider = (obj, isPed) => {
    const d = dist(obj.x, obj.z, p.x, p.z);
    if (d > w.range || d < 0.5) return;
    const a = Math.atan2(obj.x - p.x, obj.z - p.z);
    let diff = Math.abs(a - aim);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff < w.spread && d < bestD) {
      best = { obj, isPed, d };
      bestD = d;
    }
  };
  for (const ped of game.peds) if (!ped.dead) consider(ped, true);
  for (const g of game.gangMembers) if (!g.dead) consider(g, true);
  for (const c of game.cops) consider(c, true);
  if (!best) return null;
  const dmg = w.damage * (w.pellets || 1);
  if (best.isPed) {
    const wasAlive = best.obj.hp > 0;
    best.obj.hp -= dmg;
    if (best.obj.hp <= 0 && wasAlive) {
      killTarget(game, best.obj);
    } else if (wasAlive) {
      // Non-lethal hit: assault. The player must SEE the
      // consequence (round-9 fix — see header). Only the FIRST
      // hit on a victim reports assault — later hits on the same
      // victim do not stack, or a 3-hit pistol kill would be
      // 4 stars (assault + assault + manslaughter).
      if (!best.obj._assaulted) {
        best.obj._assaulted = true;
        best.obj.flee = 3;
        commitCrime(game, 'punchPed');
      } else {
        best.obj.flee = 3;
      }
    }
  } else {
    best.obj.hp -= dmg;
    if (best.obj.hp <= 0) {
      killTarget(game, best.obj);
    }
  }
  return best.obj;
}

// Kill: cash drop, stats, crime, bomb refill. A victim who was
// already assaulted only adds the DIFFERENCE between the kill
// crime and the assault (killing one person is 2 stars total).
export function killTarget(game, target) {
  target.dead = true;
  game.stats.kills += 1;
  const already = target._assaulted ? 1 : 0;
  const isCop = game.cops.includes(target);
  const isGang = game.gangMembers.includes(target);
  if (isCop) commitCrime(game, 'killCop', 3 - already);
  else if (isGang) commitCrime(game, 'killGang', 2 - already);
  else commitCrime(game, 'killPed', 2 - already);
  const amount = TUNE.cashDropMin + Math.floor(Math.random() * (TUNE.cashDropMax - TUNE.cashDropMin));
  dropCash(game, target.x, target.z, amount);
  game.bombs = Math.min(9, game.bombs + 1);
  showToast(game, `+$${amount} dropped — walk over it to collect`);
}

// Throw a bomb at the player's facing point.
export function throwBomb(game) {
  const p = game.player;
  if (p.bombCooldown > 0) return false;
  if (game.bombs <= 0) {
    showToast(game, 'No bombs left — kill someone to restock');
    return false;
  }
  p.bombCooldown = 1;
  game.bombs -= 1;
  const bx = p.x + Math.sin(p.heading) * 6;
  const bz = p.z + Math.cos(p.heading) * 6;
  if (game.audio) game.audio.sfx('explosion');
  // Damage everything in the blast radius.
  const blast = (obj) => {
    const d = dist(obj.x, obj.z, bx, bz);
    if (d < TUNE.bombRadius && !obj.dead) {
      obj.hp -= TUNE.bombDamage;
      if (obj.hp <= 0) killTarget(game, obj);
    }
  };
  for (const ped of game.peds) blast(ped);
  for (const g of game.gangMembers) blast(g);
  for (const c of game.cops) blast(c);
  commitCrime(game, 'explosion');
  return true;
}

// Punch: short range, narrow cone in front of the player.
export function punch(game) {
  const p = game.player;
  if (p.punchCooldown > 0) return null;
  p.punchCooldown = 0.5;
  if (game.audio) game.audio.sfx('punch');
  const fx = p.x + Math.sin(p.heading) * 2;
  const fz = p.z + Math.cos(p.heading) * 2;
  let best = null;
  let bestD = 2.2;
  for (const ped of [...game.peds, ...game.gangMembers, ...game.cops]) {
    if (ped.dead) continue;
    const d = dist(ped.x, ped.z, fx, fz);
    if (d < bestD) {
      best = ped;
      bestD = d;
    }
  }
  if (!best) return null;
  best.hp -= TUNE.punchDamage;
  if (best.hp <= 0) {
    killTarget(game, best);
  } else {
    // A punch that connects is assault (round-9 fix — see header).
    // Only the first hit on a victim reports it (see shoot()).
    if (!best._assaulted) {
      best._assaulted = true;
      best.flee = 3;
      commitCrime(game, 'punchPed');
    } else {
      best.flee = 3;
    }
  }
  return best;
}

export { CRIME };
