// Solmar Bay — combat: shooting, punching, bombs, cash drops.
// Shooting aims at a world point and hits the nearest target on
// the ray (within ~1.5 m of the line, inside the weapon range).

import { TUNE } from './config.js';
import { commitCrime } from './police.js';
import { addCash, damagePlayer, showToast } from './state.js';

export const WEAPONS = [
  { name: 'Pistol', damage: 34, range: 60, ammo: Infinity },
  { name: 'SMG', damage: 18, range: 45, ammo: 120 },
  { name: 'Shotgun', damage: 60, range: 25, ammo: 24 },
];

// Re-exported so the combat module is the single import point.
export { damagePlayer };

function targets(g) {
  const out = [];
  for (const p of g.peds) if (!p.dead) out.push({ t: p, type: 'ped' });
  for (const c of g.cops) if (!c.dead) out.push({ t: c, type: 'cop' });
  for (const m of g.gangMembers) if (!m.dead) out.push({ t: m, type: 'gang' });
  return out;
}

// Distance from point (px,pz) to the ray from (ox,oz) toward (dx,dz)
// (unit direction), plus the distance along the ray.
function rayHit(ox, oz, dx, dz, px, pz) {
  const vx = px - ox, vz = pz - oz;
  const along = vx * dx + vz * dz;
  if (along < 0) return null;
  const perp = Math.abs(vx * dz - vz * dx);
  return { along, perp };
}

export function shoot(g, aimX, aimZ) {
  const p = g.player;
  if (p.shootCooldown > 0) return null;
  const w = WEAPONS[p.weapon] || WEAPONS[0];
  // Ammo: the pistol is infinite; others spend a round.
  if (p.ammo[p.weapon] !== Infinity) {
    if (p.ammo[p.weapon] <= 0) return null;
    p.ammo[p.weapon]--;
  }
  p.shootCooldown = 0.35;
  const dx = aimX - p.x, dz = aimZ - p.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.001) return null;
  const ux = dx / d, uz = dz / d;
  let best = null, bestAlong = Infinity;
  for (const { t, type } of targets(g)) {
    const hit = rayHit(p.x, p.z, ux, uz, t.x, t.z);
    if (!hit) continue;
    if (hit.along > w.range) continue;
    if (hit.perp > 1.5) continue;
    if (hit.along < bestAlong) { bestAlong = hit.along; best = { t, type }; }
  }
  if (!best) return null;
  const target = best.t;
  target.hp -= w.damage;
  if (target.hp <= 0) {
    killTarget(g, target);
  } else {
    commitCrime(g, 'assault');
  }
  return target;
}

export function punch(g) {
  const p = g.player;
  if (p.punchCooldown > 0) return null;
  p.punchCooldown = 0.5;
  const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
  let best = null, bestD = TUNE.punchRange;
  for (const { t, type } of targets(g)) {
    const dx = t.x - p.x, dz = t.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d > TUNE.punchRange) continue;
    // Must be in front of the player.
    const dot = (dx * fx + dz * fz) / (d || 1);
    if (dot < 0.5) continue;
    if (d < bestD) { bestD = d; best = { t, type }; }
  }
  if (!best) return null;
  const target = best.t;
  target.hp -= TUNE.punchDamage;
  if (target.hp <= 0) killTarget(g, target);
  else {
    commitCrime(g, 'assault');
  }
  return target;
}

export function throwBomb(g) {
  const p = g.player;
  if (g.bombs <= 0) return false;
  if (p.bombCooldown > 0) return false;
  g.bombs--;
  p.bombCooldown = 1;
  const bx = p.x + Math.sin(p.heading) * 6;
  const bz = p.z + Math.cos(p.heading) * 6;
  let kills = 0;
  for (const { t, type } of targets(g)) {
    const d = Math.hypot(t.x - bx, t.z - bz);
    if (d < TUNE.bombRadius) {
      t.hp = 0;
      killTarget(g, t);
      kills++;
    }
  }
  if (kills > 0) commitCrime(g, 'explosion');
  return true;
}

export function killTarget(g, target) {
  if (target.dead) return;
  target.dead = true;
  target.hp = 0;
  g.stats.kills++;
  g.bombs = Math.min(9, g.bombs + 1);
  dropCash(g, target.x, target.z, 10 + Math.floor(Math.random() * 41));
  if (target.type === 'gang' || target.gang) commitCrime(g, 'killGang');
  else if (target.type === 'cop' || target.isCop) commitCrime(g, 'killCop');
  else commitCrime(g, 'killPed');
}

export function dropCash(g, x, z, amount) {
  g.pickups.push({ x, z, amount });
}

export function stepPickups(g, dt) {
  const p = g.player;
  for (let i = g.pickups.length - 1; i >= 0; i--) {
    const pk = g.pickups[i];
    if (Math.hypot(pk.x - p.x, pk.z - p.z) < 2) {
      addCash(g, pk.amount, '');
      showToast(g, `+$${pk.amount}`);
      g.pickups.splice(i, 1);
    }
  }
}
