// Solmar Bay — shooting, punching, bombs, cash pickups, damage.
// Written fresh for rebuild #18.

import { commitCrime, damagePlayer as hurtPlayer } from './police.js';
import { addCash } from './state.js';

// 0 pistol, 1 SMG, 2 shotgun.
export const WEAPONS = [
  { name: 'Pistol', damage: 34, range: 60, cooldown: 0.25 },
  { name: 'SMG', damage: 20, range: 50, cooldown: 0.1 },
  { name: 'Shotgun', damage: 60, range: 25, cooldown: 0.8 },
];

export const WEAPON_NAMES = ['Pistol', 'SMG', 'Shotgun'];

export function damagePlayer(g, amount) {
  return hurtPlayer(g, amount);
}

// Drop a small cash pickup at a spot.
export function dropCash(g, x, z, amount) {
  if (!g.pickups) g.pickups = [];
  g.pickups.push({ x, z, amount, t: 60 });
  return g.pickups[g.pickups.length - 1];
}

// Kill a target: mark it dead, count the kill, refill a bomb, drop cash,
// and report the crime (killGang for a gang member, killPed otherwise).
export function killTarget(g, target) {
  if (target.dead) return;
  target.dead = true;
  target.hp = 0;
  g.stats.kills = (g.stats.kills || 0) + 1;
  g.bombs = Math.min(9, (g.bombs || 0) + 1);
  const amount = 10 + Math.floor(Math.random() * 41);
  dropCash(g, target.x, target.z, amount);
  const wasGang = isGangMember(g, target);
  commitCrime(g, wasGang ? 'killGang' : 'killPed');
  return amount;
}

function nearestTargetOnRay(g, tx, tz, range) {
  // A shot is a ray from the player toward (tx, tz). A target is
  // hit only if it lies close to that ray (within 2 m) and inside
  // the weapon range. Returns the closest such target, or null.
  const dx = tx - g.player.x;
  const dz = tz - g.player.z;
  const len = Math.hypot(dx, dz);
  if (len < 0.001) return null;
  const ux = dx / len, uz = dz / len;
  let best = null;
  let bestT = Infinity;
  const all = [...(g.peds || []), ...(g.gangs || []), ...(g.gangMembers || []), ...(g.cops || [])];
  const seen = new Set();
  for (const t of all) {
    if (seen.has(t)) continue;
    seen.add(t);
    if (t.dead || t.hp <= 0) continue;
    const rx = t.x - g.player.x;
    const rz = t.z - g.player.z;
    const proj = rx * ux + rz * uz;
    if (proj < 0 || proj > range) continue;
    const perp = Math.abs(rx * uz - rz * ux);
    if (perp > 2) continue;
    if (proj < bestT) { best = t; bestT = proj; }
  }
  return best;
}

function isGangMember(g, target) {
  return (g.gangs || []).includes(target) || (g.gangMembers || []).includes(target);
}

function applyHit(g, target, dmg, crimeKey) {
  target.hp -= dmg;
  if (target.hp <= 0) {
    killTarget(g, target);
  } else {
    commitCrime(g, crimeKey || 'assault');
  }
}

// Shoot toward (tx, tz). Returns the target hit, or null.
export function shoot(g, tx, tz) {
  if (g.player.shootCooldown > 0) return null;
  const w = WEAPONS[g.player.weapon] || WEAPONS[0];
  g.player.shootCooldown = w.cooldown;
  if (g.player.ammo[g.player.weapon] !== Infinity) {
    if (g.player.ammo[g.player.weapon] <= 0) return null;
    g.player.ammo[g.player.weapon]--;
  }
  const target = nearestTargetOnRay(g, tx, tz, w.range);
  if (!target) return null;
  applyHit(g, target, w.damage, 'assault');
  return target;
}

// Punch the target in front of the player (heading = facing).
// Returns the target hit, or null.
export function punch(g) {
  const reach = 2.2;
  const fx = Math.sin(g.player.heading || 0);
  const fz = Math.cos(g.player.heading || 0);
  const tx = g.player.x + fx * 1.5;
  const tz = g.player.z + fz * 1.5;
  let best = null;
  let bestD = reach;
  const all = [...(g.peds || []), ...(g.gangs || []), ...(g.gangMembers || []), ...(g.cops || [])];
  const seen = new Set();
  for (const t of all) {
    if (seen.has(t)) continue;
    seen.add(t);
    if (t.dead || t.hp <= 0) continue;
    const d = Math.hypot(t.x - tx, t.z - tz);
    if (d < bestD) { best = t; bestD = d; }
  }
  if (!best) return null;
  applyHit(g, best, 12, 'assault');
  return best;
}

export function throwBomb(g) {
  if ((g.bombs || 0) <= 0) return false;
  g.bombs--;
  const fx = Math.sin(g.player.heading || 0);
  const fz = Math.cos(g.player.heading || 0);
  const bx = g.player.x + fx * 6;
  const bz = g.player.z + fz * 6;
  const all = [...(g.peds || []), ...(g.gangs || []), ...(g.gangMembers || []), ...(g.cops || [])];
  const seen = new Set();
  for (const t of all) {
    if (seen.has(t)) continue;
    seen.add(t);
    if (t.dead || t.hp <= 0) continue;
    if (Math.hypot(t.x - bx, t.z - bz) < 8) {
      killTarget(g, t);
    }
  }
  return true;
}

// Walk over a cash pickup to collect it.
export function stepPickups(g, dt) {
  if (!g.pickups) return;
  for (const p of g.pickups) p.t -= dt;
  g.pickups = g.pickups.filter((p) => p.t > 0);
  for (const p of g.pickups) {
    if (Math.hypot(p.x - g.player.x, p.z - g.player.z) < 2) {
      addCash(g, p.amount, 'cash pickup');
      p.t = 0;
    }
  }
  g.pickups = g.pickups.filter((p) => p.t > 0);
}
