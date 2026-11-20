// Solmar Bay — combat: weapons, shooting, punching, bombs, pickups.

import { CRIME } from './config.js';
import { commitCrime } from './police.js';

export const WEAPONS = [
  { name: 'Pistol', damage: 34, range: 60, cooldown: 0.25, ammo: Infinity },
  { name: 'SMG', damage: 18, range: 45, cooldown: 0.09, ammo: 120 },
  { name: 'Shotgun', damage: 60, range: 25, cooldown: 0.8, ammo: 24 },
];

function nearestPedInFront(g, maxDist, maxAngle) {
  const p = g.player;
  const fx = Math.sin(p.heading);
  const fz = Math.cos(p.heading);
  let best = null;
  let bestD = Infinity;
  for (const ped of g.peds) {
    if (ped.dead) continue;
    const dx = ped.x - p.x;
    const dz = ped.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d > maxDist || d < 0.01) continue;
    const dot = (dx * fx + dz * fz) / d;
    if (dot < Math.cos(maxAngle)) continue;
    if (d < bestD) {
      bestD = d;
      best = ped;
    }
  }
  return best;
}

function nearestGangInFront(g, maxDist, maxAngle) {
  const p = g.player;
  const fx = Math.sin(p.heading);
  const fz = Math.cos(p.heading);
  let best = null;
  let bestD = Infinity;
  for (const m of g.gangMembers || []) {
    if (m.dead) continue;
    const dx = m.x - p.x;
    const dz = m.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d > maxDist || d < 0.01) continue;
    const dot = (dx * fx + dz * fz) / d;
    if (dot < Math.cos(maxAngle)) continue;
    if (d < bestD) {
      bestD = d;
      best = m;
    }
  }
  return best;
}

// Kill a target: cash drop, a bomb refill, the kill counter, and
// the wanted level. The kill sets wanted to the MAX of the current
// level and the crime's stars (a kill after an assault is 2 stars
// total, not 3) — it never ADDS on top of the assault star.
export function killTarget(g, target) {
  if (!target || target.dead) return;
  target.dead = true;
  target.hp = 0;
  g.stats.kills = (g.stats.kills || 0) + 1;
  dropCash(g, target.x, target.z, 10 + Math.floor(Math.random() * 40));
  g.bombs = (g.bombs || 0) + 1;
  const isGang = (g.gangMembers || []).includes(target);
  const key = isGang ? 'killGang' : 'killPed';
  g.wanted = Math.min(5, Math.max(g.wanted, CRIME[key].stars));
  if (g.audio) g.audio.sfx('kill');
}

// A non-lethal hit on a ped is assault: +1 star, first hit only.
function assaultOnce(g) {
  if (!g._assaulted) {
    g._assaulted = true;
    commitCrime(g, 'assault');
  }
}

// Shoot at a point (tx, tz) or straight ahead. Returns the hit
// target or null. Cooldowns, weapon and ammo live on the PLAYER.
export function shoot(g, tx, tz) {
  if (g.player.shootCooldown > 0) return null;
  const w = WEAPONS[g.player.weapon] || WEAPONS[0];
  g.player.shootCooldown = w.cooldown;
  if (g.player.ammo && g.player.ammo[g.player.weapon] !== Infinity) {
    if (g.player.ammo[g.player.weapon] <= 0) return null;
    g.player.ammo[g.player.weapon] -= 1;
  }
  // Aim at the given point if one was passed, else straight ahead.
  let aimX = Math.sin(g.player.heading);
  let aimZ = Math.cos(g.player.heading);
  if (tx !== undefined && tz !== undefined) {
    const dx = tx - g.player.x;
    const dz = tz - g.player.z;
    const d = Math.hypot(dx, dz) || 1;
    aimX = dx / d;
    aimZ = dz / d;
  }
  // Find the nearest ped or gang member along the aim line.
  let best = null;
  let bestD = Infinity;
  const consider = (t) => {
    if (!t || t.dead) return;
    const dx = t.x - g.player.x;
    const dz = t.z - g.player.z;
    const d = Math.hypot(dx, dz);
    if (d > w.range || d < 0.01) return;
    const dot = (dx * aimX + dz * aimZ) / d;
    if (dot < 0.97) return; // off the aim line
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  };
  for (const ped of g.peds) consider(ped);
  for (const m of g.gangMembers || []) consider(m);
  if (g.audio) g.audio.sfx('shoot');
  if (!best) return null;
  best.hp -= w.damage;
  if (best.hp <= 0) {
    killTarget(g, best);
  } else {
    assaultOnce(g);
  }
  return best;
}

// Punch the ped/gang member directly in front (2 m, 12 damage).
// Returns the hit target or null.
export function punch(g) {
  if (g.player.punchCooldown > 0) return null;
  g.player.punchCooldown = 0.5;
  const target = nearestPedInFront(g, 2, 0.6) || nearestGangInFront(g, 2, 0.6);
  if (!target) return null;
  target.hp -= 12;
  if (g.audio) g.audio.sfx('punch');
  if (target.hp <= 0) {
    killTarget(g, target);
  } else {
    assaultOnce(g);
  }
  return target;
}

export function throwBomb(g) {
  if (!g.bombs || g.bombs <= 0) return false;
  g.bombs -= 1;
  const bx = g.player.x + Math.sin(g.player.heading) * 6;
  const bz = g.player.z + Math.cos(g.player.heading) * 6;
  if (g.audio) g.audio.sfx('explosion');
  for (const ped of g.peds) {
    if (ped.dead) continue;
    if (Math.hypot(ped.x - bx, ped.z - bz) < 8) {
      killTarget(g, ped);
    }
  }
  for (const m of g.gangMembers || []) {
    if (m.dead) continue;
    if (Math.hypot(m.x - bx, m.z - bz) < 8) {
      killTarget(g, m);
    }
  }
  return true;
}

export function dropCash(g, x, z, amount) {
  if (!g.pickups) g.pickups = [];
  g.pickups.push({ x, z, amount, kind: 'cash' });
}

export function stepPickups(g, dt) {
  if (!g.pickups) return;
  for (let i = g.pickups.length - 1; i >= 0; i--) {
    const pk = g.pickups[i];
    const d = Math.hypot(pk.x - g.player.x, pk.z - g.player.z);
    if (d < 2) {
      g.cash += pk.amount;
      g.pickups.splice(i, 1);
      g.toast = `+$${pk.amount}`;
      g.toastTimer = 3;
      if (g.audio) g.audio.sfx('pickup');
    }
  }
}

// Damage the player: armour absorbs first. 0 HP means wasted.
export function damagePlayer(g, dmg) {
  let rest = dmg;
  if (g.armour > 0) {
    const absorbed = Math.min(g.armour, rest);
    g.armour -= absorbed;
    rest -= absorbed;
  }
  g.health -= rest;
  if (g.health <= 0) {
    g.health = 0;
    g.mode = 'wasted';
    g.card = { title: 'WASTED', text: 'The city got the better of you.', reward: 0, respect: 0 };
  }
}
