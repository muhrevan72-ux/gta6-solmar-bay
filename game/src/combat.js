// Solmar Bay — combat.
//
// Four weapons, fists, and bombs. Shooting aims at a world point and
// hits the first person on the aim line within range; punching hits
// whoever is right in front of the player; a bomb lands six metres
// ahead and clears a small blast radius. Killing someone drops cash,
// refills a bomb, and puts two wanted stars on the player. Damage to
// the player goes through armour first, and reaching zero health
// shows the wasted screen.

import { showToast } from './state.js';
import { commitCrime } from './police.js';

export const WEAPONS = [
  { name: 'Pistol', damage: 34, range: 60, cooldown: 0.25, ammo: Infinity },
  { name: 'SMG', damage: 18, range: 55, cooldown: 0.09, ammo: 120 },
  { name: 'Shotgun', damage: 60, range: 30, cooldown: 0.8, ammo: 24 },
  { name: 'Rifle', damage: 50, range: 100, cooldown: 0.5, ammo: 60 },
];

function targets(g) {
  const list = [];
  for (const p of g.peds) if (!p.dead) list.push(p);
  for (const m of g.gangMembers) if (!m.dead) list.push(m);
  for (const c of g.cops) if (!c.dead) list.push(c);
  return list;
}

export function dropCash(g, x, z, amount) {
  g.pickups.push({ x, z, amount });
  return g.pickups[g.pickups.length - 1];
}

export function killTarget(g, target) {
  if (!target || target.dead) return false;
  target.dead = true;
  g.stats.kills += 1;
  g.bombs += 1;
  dropCash(g, target.x, target.z, 10 + Math.floor(Math.random() * 41));
  if (g.cops.includes(target)) {
    commitCrime(g, 'killCop');
  } else {
    g.wanted = 2;
  }
  return true;
}

export function shoot(g, x, z) {
  const p = g.player;
  if (p.shootCooldown > 0) return null;
  const weapon = WEAPONS[p.weapon] || WEAPONS[0];
  const ammo = p.ammo[p.weapon];
  if (ammo !== Infinity && ammo <= 0) return null;
  p.shootCooldown = weapon.cooldown;
  if (ammo !== Infinity) p.ammo[p.weapon] = ammo - 1;
  if (g.audio) g.audio.sfx('shoot');

  const dx = x - p.x;
  const dz = z - p.z;
  const len = Math.hypot(dx, dz);
  if (len < 0.01) return null;
  const ux = dx / len;
  const uz = dz / len;
  let best = null;
  let bestAlong = Infinity;
  for (const t of targets(g)) {
    const tx = t.x - p.x;
    const tz = t.z - p.z;
    const along = tx * ux + tz * uz;
    if (along <= 0 || along > weapon.range) continue;
    const perp = Math.abs(tx * uz - tz * ux);
    if (perp > 1.5) continue;
    if (along < bestAlong) {
      best = t;
      bestAlong = along;
    }
  }
  if (!best) return null;
  best.hp -= weapon.damage;
  if (best.hp <= 0) {
    killTarget(g, best);
  } else {
    commitCrime(g, 'assault');
    // A wounded ped runs.
    if (best.flee !== undefined) best.flee = 3;
  }
  return best;
}

export function punch(g) {
  const p = g.player;
  const weapon = WEAPONS[p.weapon];
  p.punchCooldown = 0.4;
  if (g.audio) g.audio.sfx('punch');
  const fx = Math.sin(p.heading || 0);
  const fz = Math.cos(p.heading || 0);
  let best = null;
  let bestAlong = Infinity;
  for (const t of targets(g)) {
    const tx = t.x - p.x;
    const tz = t.z - p.z;
    const along = tx * fx + tz * fz;
    if (along <= 0 || along > 2) continue;
    const perp = Math.abs(tx * fz - tz * fx);
    if (perp > 1) continue;
    if (along < bestAlong) {
      best = t;
      bestAlong = along;
    }
  }
  if (!best) return null;
  best.hp -= 12;
  if (best.hp <= 0) {
    killTarget(g, best);
  } else {
    commitCrime(g, 'assault');
    if (best.flee !== undefined) best.flee = 3;
  }
  return best;
}

export function throwBomb(g) {
  const p = g.player;
  if (g.bombs <= 0) return false;
  g.bombs -= 1;
  p.bombCooldown = 1;
  if (g.audio) g.audio.sfx('explosion');
  const bx = p.x + Math.sin(p.heading || 0) * 6;
  const bz = p.z + Math.cos(p.heading || 0) * 6;
  let hit = false;
  for (const t of targets(g)) {
    const d = Math.hypot(t.x - bx, t.z - bz);
    if (d <= 4) {
      t.hp = 0;
      killTarget(g, t);
      hit = true;
    }
  }
  return true;
}

export function stepPickups(g, dt) {
  const p = g.player;
  for (let i = g.pickups.length - 1; i >= 0; i--) {
    const pk = g.pickups[i];
    const d = Math.hypot(pk.x - p.x, pk.z - p.z);
    if (d <= 2.5) {
      g.pickups.splice(i, 1);
      g.cash += pk.amount;
      showToast(g, `+$${pk.amount}`);
      if (g.audio) g.audio.sfx('pickup');
    }
  }
}

// All damage to the player funnels through here. Armour absorbs
// first; reaching zero health shows the wasted screen (mode plus a
// visible card) so the player is never left on a blank screen.
export function damagePlayer(g, amount) {
  if (g.health <= 0) return g.health;
  const absorbed = Math.min(g.armour, amount);
  g.armour -= absorbed;
  const rest = amount - absorbed;
  g.health = Math.max(0, g.health - rest);
  if (g.health <= 0) {
    g.mode = 'wasted';
    g.card = {
      title: 'WASTED',
      text: 'You got wasted in Solmar Bay. The hospital patched you up — for a price.',
      hint: 'Press Enter to continue',
    };
  }
  return g.health;
}
