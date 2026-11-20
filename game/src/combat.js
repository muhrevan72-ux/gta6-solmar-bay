// Solmar Bay — combat (rebuild #13).
// Non-lethal hit = assault (1 star, first hit only); a kill is
// 2 stars TOTAL (no assault stacking — the kill sets the wanted
// level to at least 2 instead of adding on top).
import { commitCrime } from './police.js';
import { addCash } from './state.js';

export const WEAPONS = [
  { name: 'Pistol', damage: 34, range: 60, cooldown: 0.25 },
  { name: 'SMG', damage: 20, range: 55, cooldown: 0.12 },
  { name: 'Shotgun', damage: 60, range: 30, cooldown: 0.8 },
];

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

function findTarget(g, aimAngle, range, tol) {
  const p = g.player;
  let best = null;
  let bestD = range + 1;
  const cands = [
    ...g.peds.filter((x) => !x.dead),
    ...g.gangMembers.filter((x) => !x.dead),
    ...g.cops.filter((x) => x.hp > 0),
  ];
  for (const c of cands) {
    const dx = c.x - p.x, dz = c.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d > range || d > bestD) continue;
    const ang = Math.atan2(dx, dz);
    if (angleDiff(ang, aimAngle) > tol) continue;
    best = c;
    bestD = d;
  }
  return best;
}

// Shooting is aimed at a POINT (the click / the crosshair): the hit
// is the living target nearest that point, inside a 2.5 m radius
// and inside the weapon's range. A ray-cone alone would let a
// bystander far down the aim line take the bullet.
function findShootTarget(g, tx, tz, range) {
  const p = g.player;
  let best = null;
  let bestD = 2.5;
  const cands = [
    ...g.peds.filter((x) => !x.dead),
    ...g.gangMembers.filter((x) => !x.dead),
    ...g.cops.filter((x) => x.hp > 0),
  ];
  for (const c of cands) {
    if (Math.hypot(c.x - p.x, c.z - p.z) > range) continue;
    const dAim = Math.hypot(c.x - tx, c.z - tz);
    if (dAim < bestD) { best = c; bestD = dAim; }
  }
  return best;
}

function applyHit(g, target, damage) {
  target.hp -= damage;
  if (target.hp <= 0) {
    killTarget(g, target);
  } else if (!target._assaulted) {
    target._assaulted = true;
    commitCrime(g, 'assault');
  }
  if (target.flee !== undefined) target.flee = 3;
}

export function shoot(g, tx, tz) {
  const p = g.player;
  const w = WEAPONS[p.weapon];
  if (p.shootCooldown > 0) return null;
  if (p.weapon > 0 && p.ammo[p.weapon] <= 0) return null;
  p.shootCooldown = w.cooldown;
  if (p.weapon > 0) p.ammo[p.weapon] -= 1;
  const target = findShootTarget(g, tx, tz, w.range);
  if (!target) return null;
  applyHit(g, target, w.damage);
  return target;
}

export function punch(g) {
  const p = g.player;
  if (p.punchCooldown > 0) return null;
  p.punchCooldown = 0.5;
  const target = findTarget(g, p.heading, 2.5, 0.6);
  if (!target) return null;
  applyHit(g, target, 12);
  return target;
}

export function throwBomb(g) {
  const p = g.player;
  if (g.bombs <= 0) return false;
  if (p.bombCooldown > 0) return false;
  p.bombCooldown = 1;
  g.bombs -= 1;
  const lx = p.x + Math.sin(p.heading) * 6;
  const lz = p.z + Math.cos(p.heading) * 6;
  const cands = [
    ...g.peds.filter((x) => !x.dead),
    ...g.gangMembers.filter((x) => !x.dead),
  ];
  for (const c of [...cands]) {
    if (Math.hypot(c.x - lx, c.z - lz) < 8) killTarget(g, c);
  }
  return true;
}

export function killTarget(g, target) {
  if (target.dead) return;
  target.dead = true;
  g.stats.kills += 1;
  if (target.gang) {
    g.wanted = Math.max(g.wanted, 2);
  } else if (target.isCop) {
    g.wanted = Math.max(g.wanted, 3);
  } else {
    g.wanted = Math.max(g.wanted, 2);
  }
  dropCash(g, target.x, target.z, 10 + Math.floor(Math.random() * 41));
  if (g.bombs < 5) g.bombs += 1;
}

export function dropCash(g, x, z, amount) {
  g.pickups.push({ x, z, amount });
}

export function stepPickups(g, dt) {
  for (let i = g.pickups.length - 1; i >= 0; i--) {
    const pk = g.pickups[i];
    if (Math.hypot(pk.x - g.player.x, pk.z - g.player.z) < 2) {
      addCash(g, pk.amount, 'cash pickup');
      g.pickups.splice(i, 1);
    }
  }
}

export function damagePlayer(g, amount) {
  let rest = amount;
  if (g.armour > 0) {
    const absorbed = Math.min(g.armour, rest);
    g.armour -= absorbed;
    rest -= absorbed;
  }
  g.health -= rest;
  if (g.health <= 0) {
    g.health = 0;
    g.mode = 'wasted';
    g.card = { title: 'WASTED', text: 'The city got the better of you. Press Enter to wake up at the hospital.' };
    g._bustedApplied = false;
  }
}
