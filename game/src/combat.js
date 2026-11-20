// Solmar Bay — combat.
//
// Hitscan shooting, punching and bombs. Crime is MAX-based and local
// (a small helper over CRIME) so this module never imports police.js
// — police.js imports damagePlayer from here, one direction only.
// A non-lethal hit is assault (1 star); a kill is 2 stars total, not
// 1 + 2 stacked.

import { CRIME } from './config.js';

export const WEAPONS = [
  { name: 'Pistol', damage: 34, range: 60, cooldown: 0.25 },
  { name: 'SMG', damage: 18, range: 55, cooldown: 0.09 },
  { name: 'Shotgun', damage: 60, range: 25, cooldown: 0.8 },
];

// Wanted only rises (MAX-based), clamped at 5. A local copy of the
// police rule, so this module stays importable from police.js.
function applyCrime(g, key) {
  const crime = CRIME[key];
  if (!crime) return;
  g.wanted = Math.max(g.wanted || 0, Math.min(5, crime.stars));
}

function targetsOf(g) {
  const out = [];
  for (const p of g.peds || []) if (!p.dead) out.push({ t: p, type: 'ped' });
  for (const m of g.gangMembers || []) if (!m.dead) out.push({ t: m, type: 'gang' });
  for (const c of g.cops || []) if (!c.dead && (c.hp === undefined || c.hp > 0)) out.push({ t: c, type: 'cop' });
  return out;
}

// Hitscan along player -> (aimX, aimZ). The nearest target within
// range and ~1.5 m of the line takes the hit.
export function shoot(g, aimX, aimZ) {
  const p = g.player;
  if (p.shootCooldown > 0) return null;
  const weapon = WEAPONS[p.weapon || 0] || WEAPONS[0];
  const dx = aimX - p.x;
  const dz = aimZ - p.z;
  const len = Math.hypot(dx, dz);
  if (len < 0.01) return null;
  const ux = dx / len;
  const uz = dz / len;
  let best = null;
  let bestAlong = Infinity;
  for (const { t, type } of targetsOf(g)) {
    const tx = t.x - p.x;
    const tz = t.z - p.z;
    const along = tx * ux + tz * uz;
    if (along < 0 || along > weapon.range) continue;
    const lateral = Math.abs(tx * uz - tz * ux);
    if (lateral > 1.5) continue;
    if (along < bestAlong) { bestAlong = along; best = { t, type }; }
  }
  p.shootCooldown = weapon.cooldown;
  if (!best) return null;
  const target = best.t;
  target.hp = (target.hp || 100) - weapon.damage;
  if (target.hp <= 0) {
    killTarget(g, target, best.type);
  } else {
    applyCrime(g, 'assault');
  }
  return target;
}

// A swing in front of the player: ~2.5 m, frontal cone, 12 damage.
export function punch(g) {
  const p = g.player;
  if (p.punchCooldown > 0) return null;
  const fx = Math.sin(p.heading || 0);
  const fz = Math.cos(p.heading || 0);
  let best = null;
  let bestD = 2.5;
  for (const { t, type } of targetsOf(g)) {
    const dx = t.x - p.x;
    const dz = t.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d > 2.5) continue;
    const dot = d > 0.01 ? (dx * fx + dz * fz) / d : 1;
    if (dot < 0.5) continue;
    if (d < bestD) { bestD = d; best = { t, type }; }
  }
  p.punchCooldown = 0.5;
  if (!best) return null;
  const target = best.t;
  target.hp = (target.hp || 100) - 12;
  if (target.hp <= 0) {
    killTarget(g, target, best.type);
  } else {
    applyCrime(g, 'assault');
  }
  return target;
}

// A bomb lands 6 m ahead and blasts ~8 m. A kill refills one bomb
// (max 5). Returns false with no bombs or while cooling down.
export function throwBomb(g) {
  const p = g.player;
  if ((g.bombs || 0) <= 0) return false;
  if (p.bombCooldown > 0) return false;
  g.bombs -= 1;
  p.bombCooldown = 1.5;
  const fx = Math.sin(p.heading || 0);
  const fz = Math.cos(p.heading || 0);
  const bx = p.x + fx * 6;
  const bz = p.z + fz * 6;
  let killed = false;
  for (const { t, type } of targetsOf(g)) {
    if (Math.hypot(t.x - bx, t.z - bz) < 8) {
      t.hp = 0;
      killTarget(g, t, type, 'bombKill');
      killed = true;
    }
  }
  if (!killed) applyCrime(g, 'assault');
  return true;
}

// A kill: the target dies, the kill is counted, cash drops and a
// bomb is refilled. Crime follows the target type (a bomb kill is
// bombKill regardless of type).
export function killTarget(g, target, type, crimeOverride) {
  target.dead = true;
  target.hp = 0;
  g.stats = g.stats || { kills: 0 };
  g.stats.kills = (g.stats.kills || 0) + 1;
  g.bombs = Math.min(5, (g.bombs || 0) + 1);
  dropCash(g, target.x, target.z, 10 + Math.floor(Math.random() * 41));
  // Detect the type from the roster when the caller did not say.
  if (!type) {
    if ((g.gangMembers || []).includes(target)) type = 'gang';
    else if ((g.cops || []).includes(target)) type = 'cop';
    else type = 'ped';
  }
  const crime = crimeOverride || (type === 'gang' ? 'killGang' : type === 'cop' ? 'killCop' : 'killPed');
  applyCrime(g, crime);
  return target;
}

export function dropCash(g, x, z, amount) {
  g.pickups = g.pickups || [];
  g.pickups.push({ x, z, amount });
  return g.pickups[g.pickups.length - 1];
}

// Walk over a pickup (within ~2 m) to collect it.
export function stepPickups(g, dt) {
  if (!g.pickups) return;
  const p = g.player;
  g.pickups = g.pickups.filter((pk) => {
    if (Math.hypot(pk.x - p.x, pk.z - p.z) < 2) {
      g.cash = (g.cash || 0) + pk.amount;
      g.toast = `+$${pk.amount}`;
      g.toastTimer = 3;
      return false;
    }
    return true;
  });
}

// Armour absorbs damage first; 0 HP means wasted.
export function damagePlayer(g, amount) {
  let left = amount;
  if (g.armour > 0) {
    const absorbed = Math.min(g.armour, left);
    g.armour -= absorbed;
    left -= absorbed;
  }
  if (left > 0) {
    g.health = Math.max(0, (g.health || 0) - left);
    if (g.player) g.player.health = g.health;
  }
  if (g.health <= 0) {
    g.health = 0;
    g.mode = 'wasted';
  }
}
