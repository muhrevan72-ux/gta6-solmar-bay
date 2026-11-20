// Solmar Bay — combat: weapons, damage, pickups.
//
// Weapons: pistol (start, infinite ammo), SMG + shotgun as
// pickups (unlocked by respect). Bombs (G) damage everything in
// a radius. Killed peds/cops drop cash on the GROUND — walking
// over a drop collects it with a "+$X" toast. There is no silent
// income anywhere in this game.

import { TUNE, dist } from './config.js';
import { addCash, showToast } from './state.js';

// Crime reporting goes through the police system, wired by
// main.js as game.policeCommit. Headless tests that drive combat
// without the full boot can leave it unwired — then crimes are
// simply not recorded, instead of crashing.
function crime(game, type) {
  if (typeof game.policeCommit === 'function') game.policeCommit(type);
}

export const WEAPONS = [
  { name: 'Pistol', damage: TUNE.pistolDamage, rate: 0.25, range: 60, ammo: Infinity },
  { name: 'SMG', damage: TUNE.smgDamage, rate: 0.09, range: 50, ammo: 120 },
  { name: 'Shotgun', damage: TUNE.shotgunDamage, rate: 0.7, range: 26, ammo: 24 },
];

export function weaponName(game) {
  return WEAPONS[game.player.weapon].name;
}

// Spawn a cash drop on the ground at (x, z). It sits there until
// the player walks over it — it is never added silently.
export function dropCash(game, x, z, amount) {
  game.pickups.push({ kind: 'cash', x, z, amount, t: 60 });
}

// Spawn a health / armour / repair pickup.
export function dropPickup(game, kind, x, z, amount = 25) {
  game.pickups.push({ kind, x, z, amount, t: 60 });
}

// Collect pickups the player stands on.
export function stepPickups(game, dt) {
  const p = game.player;
  for (const pk of game.pickups) pk.t -= dt;
  game.pickups = game.pickups.filter((pk) => pk.t > 0);
  for (const pk of [...game.pickups]) {
    if (dist(p.x, p.z, pk.x, pk.z) > TUNE.pickupRadius) continue;
    if (pk.kind === 'cash') {
      addCash(game, pk.amount, 'cash pickup');
    } else if (pk.kind === 'health') {
      p.health = undefined; // health lives on the game, not the player
      game.health = Math.min(100, game.health + pk.amount);
      showToast(game, `+${pk.amount} HP`);
    } else if (pk.kind === 'armour') {
      game.armour = Math.min(100, game.armour + pk.amount);
      showToast(game, `+${pk.amount} armour`);
    } else if (pk.kind === 'repair' && p.inCar) {
      p.inCar.damage = Math.max(0, p.inCar.damage - pk.amount);
      showToast(game, `Car repaired +${pk.amount}`);
    } else if (pk.kind === 'smg') {
      game.unlocks.smgUnlocked = true;
      p.ammo[1] = Math.max(p.ammo[1], 120);
      showToast(game, 'SMG picked up!');
    } else if (pk.kind === 'shotgun') {
      game.unlocks.shotgunUnlocked = true;
      p.ammo[2] = Math.max(p.ammo[2], 24);
      showToast(game, 'Shotgun picked up!');
    }
    game.pickups.splice(game.pickups.indexOf(pk), 1);
  }
}

// Damage the player. Returns true when the player dies.
export function damagePlayer(game, amount, source) {
  if (game.mode !== 'play') return false;
  let rest = amount;
  if (game.armour > 0) {
    const absorbed = Math.min(game.armour, rest);
    game.armour -= absorbed;
    rest -= absorbed;
  }
  game.health -= rest;
  if (game.health <= 0) {
    game.health = 0;
    game.mode = 'wasted';
    game.bustedBy = source || 'wasted';
    return true;
  }
  return false;
}

// Hitscan shot from the player toward (tx, tz). Hits the nearest
// ped, cop, gang member or vehicle in range and in front.
export function shoot(game, tx, tz) {
  const p = game.player;
  const w = WEAPONS[p.weapon];
  if (p.shootCooldown > 0) return false;
  if (p.ammo[p.weapon] !== Infinity) {
    if (p.ammo[p.weapon] <= 0) {
      showToast(game, 'Out of ammo — press 1 for pistol');
      return false;
    }
    p.ammo[p.weapon] -= 1;
  }
  p.shootCooldown = w.rate;
  const aim = Math.atan2(tx - p.x, tz - p.z);
  const targets = [];
  for (const ped of game.peds) targets.push({ kind: 'ped', o: ped, x: ped.x, z: ped.z, hp: 'hp' });
  for (const cop of game.cops) targets.push({ kind: 'cop', o: cop, x: cop.x, z: cop.z, hp: 'hp' });
  for (const gm of game.gangMembers) targets.push({ kind: 'gang', o: gm, x: gm.x, z: gm.z, hp: 'hp' });
  for (const v of game.vehicles) targets.push({ kind: 'car', o: v, x: v.x, z: v.z, hp: 'damage' });
  let best = null;
  let bestD = w.range;
  for (const t of targets) {
    const d = dist(p.x, p.z, t.x, t.z);
    if (d > bestD) continue;
    const ang = Math.atan2(t.x - p.x, t.z - p.z);
    let diff = Math.abs(ang - aim);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff > 0.12) continue; // must be roughly on the aim line
    best = t;
    bestD = d;
  }
  if (!best) return true; // fired, hit nothing
  const pellets = p.weapon === 2 ? 6 : 1;
  const dmg = w.damage * pellets;
  if (best.kind === 'car') {
    best.o.damage = (best.o.damage || 0) + dmg;
    if (best.o.damage > 100) best.o.wrecked = true;
  } else {
    best.o.hp -= dmg;
    if (best.o.hp <= 0) killTarget(game, best);
  }
  return true;
}

function killTarget(game, t) {
  const o = t.o;
  game.stats.kills += 1;
  const amount = TUNE.cashDropMin + Math.floor(Math.random() * (TUNE.cashDropMax - TUNE.cashDropMin));
  dropCash(game, o.x, o.z, amount);
  if (t.kind === 'ped') {
    game.peds.splice(game.peds.indexOf(o), 1);
    crime(game, 'killPed');
  } else if (t.kind === 'cop') {
    game.cops.splice(game.cops.indexOf(o), 1);
    crime(game, 'killCop');
  } else if (t.kind === 'gang') {
    game.gangMembers.splice(game.gangMembers.indexOf(o), 1);
    crime(game, 'killGang');
  }
}

// Throw a bomb at the player's feet. Blast damages everything
// nearby and raises wanted — never silent. The bomb count lives
// on the GAME (game.bombs, set to 3 by newGame), not the player
// object — using p.bombs was undefined, so bombs never ran out.
export function throwBomb(game) {
  const p = game.player;
  if (game.bombs <= 0) {
    showToast(game, 'No bombs left');
    return false;
  }
  if (p.bombCooldown > 0) return false;
  game.bombs -= 1;
  p.bombCooldown = 1;
  const bx = p.x + Math.sin(p.heading) * 3;
  const bz = p.z + Math.cos(p.heading) * 3;
  let victims = 0;
  const blast = (o, x, z) => {
    if (dist(bx, bz, x, z) <= TUNE.bombRadius) {
      o.hp = (o.hp || 100) - TUNE.bombDamage;
      return true;
    }
    return false;
  };
  for (const ped of [...game.peds]) if (blast(ped, ped.x, ped.z) && ped.hp <= 0) { game.peds.splice(game.peds.indexOf(ped), 1); victims++; dropCash(game, ped.x, ped.z, 20); }
  for (const cop of [...game.cops]) if (blast(cop, cop.x, cop.z) && cop.hp <= 0) { game.cops.splice(game.cops.indexOf(cop), 1); victims++; }
  for (const gm of [...game.gangMembers]) if (blast(gm, gm.x, gm.z) && gm.hp <= 0) { game.gangMembers.splice(game.gangMembers.indexOf(gm), 1); victims++; }
  for (const v of game.vehicles) {
    if (dist(bx, bz, v.x, v.z) <= TUNE.bombRadius) {
      v.damage = (v.damage || 0) + TUNE.bombDamage;
      if (v.damage > 100) v.wrecked = true;
    }
  }
  if (victims >= 3) crime(game, 'massRampage');
  else if (victims > 0) crime(game, 'explosion');
  else crime(game, 'explosion');
  game.stats.kills += victims;
  return true;
}

// Punch: short range, in front of the player.
export function punch(game) {
  const p = game.player;
  if (p.punchCooldown > 0) return false;
  p.punchCooldown = 0.5;
  const fx = p.x + Math.sin(p.heading) * 2;
  const fz = p.z + Math.cos(p.heading) * 2;
  for (const ped of [...game.peds]) {
    if (dist(fx, fz, ped.x, ped.z) < 2.2) {
      ped.hp -= TUNE.punchDamage;
      crime(game, 'punchPed');
      if (ped.hp <= 0) {
        game.peds.splice(game.peds.indexOf(ped), 1);
        game.stats.kills += 1;
        dropCash(game, ped.x, ped.z, 15);
        crime(game, 'killPed');
      }
      return true;
    }
  }
  for (const gm of [...game.gangMembers]) {
    if (dist(fx, fz, gm.x, gm.z) < 2.2) {
      gm.hp -= TUNE.punchDamage;
      gm.hostile = true;
      if (gm.hp <= 0) {
        game.gangMembers.splice(game.gangMembers.indexOf(gm), 1);
        game.stats.kills += 1;
        dropCash(game, gm.x, gm.z, 20);
        crime(game, 'killGang');
      }
      return true;
    }
  }
  for (const cop of [...game.cops]) {
    if (dist(fx, fz, cop.x, cop.z) < 2.2) {
      cop.hp -= TUNE.punchDamage;
      if (cop.hp <= 0) {
        game.cops.splice(game.cops.indexOf(cop), 1);
        game.stats.kills += 1;
        crime(game, 'killCop');
      }
      return true;
    }
  }
  return true; // swung at air
}
