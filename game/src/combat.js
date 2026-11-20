// Solmar Bay — combat (rebuild #15).
// Pistol 34 dmg / range 60, punch 12 dmg / range 2.5 m, bombs
// blast 6 m ahead. A non-lethal hit is assault (1 star, once per
// victim); a kill is killPed/killGang (2 stars) with a cash drop
// and a bomb refill. Armour absorbs damage before health; 0 HP
// shows the WASTED card.

import { CRIME, WEAPONS } from './config.js';
import { commitCrime } from './police.js';
import { showToast } from './state.js';

export { WEAPONS };

function weaponOf(g) {
  return WEAPONS[g.player.weapon || 0] || WEAPONS[0];
}

function findTargetNear(g, x, z, radius) {
  let best = null;
  let bestD = radius;
  const consider = (t) => {
    if (!t || t.hp <= 0 || t.dead) return;
    const d = Math.hypot(t.x - x, t.z - z);
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  };
  for (const p of g.peds || []) consider(p);
  for (const m of g.gangMembers || []) consider(m);
  for (const c of g.cops || []) consider(c);
  return best;
}

function assaultOnce(g, target) {
  if (!target._assaulted) {
    target._assaulted = true;
    commitCrime(g, 'assault');
  }
}

export function shoot(g, aimX, aimZ) {
  const p = g.player;
  if (p.shootCooldown > 0) return null;
  const w = weaponOf(g);
  const dist = Math.hypot(aimX - p.x, aimZ - p.z);
  if (dist > w.range) return null;
  const target = findTargetNear(g, aimX, aimZ, 2);
  p.shootCooldown = w.cooldown;
  if (!target) return null;
  target.hp -= w.damage;
  if (target.hp <= 0) {
    killTarget(g, target);
  } else {
    assaultOnce(g, target);
  }
  return target;
}

export function punch(g) {
  const p = g.player;
  if (p.punchCooldown > 0) return null;
  p.punchCooldown = 0.4;
  const fx = Math.sin(p.heading || 0);
  const fz = Math.cos(p.heading || 0);
  let best = null;
  let bestD = 2.5;
  const consider = (t) => {
    if (!t || t.hp <= 0 || t.dead) return;
    const dx = t.x - p.x;
    const dz = t.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d > 2.5) return;
    const dot = (dx * fx + dz * fz) / (d || 1);
    if (dot < 0.5) return; // must be in front
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  };
  for (const t of g.peds || []) consider(t);
  for (const t of g.gangMembers || []) consider(t);
  for (const t of g.cops || []) consider(t);
  if (!best) return null;
  best.hp -= 12;
  if (best.hp <= 0) {
    killTarget(g, best);
  } else {
    assaultOnce(g, best);
  }
  return best;
}

export function throwBomb(g) {
  const p = g.player;
  if ((g.bombs || 0) <= 0) return false;
  if ((p.bombCooldown || 0) > 0) return false;
  g.bombs -= 1;
  p.bombCooldown = 1.5;
  const fx = Math.sin(p.heading || 0);
  const fz = Math.cos(p.heading || 0);
  const bx = p.x + fx * 6;
  const bz = p.z + fz * 6;
  commitCrime(g, 'explosion');
  const killInRadius = (list) => {
    for (const t of list || []) {
      if (!t || t.hp <= 0 || t.dead) continue;
      if (Math.hypot(t.x - bx, t.z - bz) <= 5) killTarget(g, t);
    }
  };
  killInRadius(g.peds);
  killInRadius(g.gangMembers);
  killInRadius(g.cops);
  return true;
}

export function killTarget(g, target) {
  if (!target || target.dead) return;
  target.dead = true;
  target.hp = 0;
  target.state = 'dead';
  g.stats.kills = (g.stats.kills || 0) + 1;
  g.bombs = (g.bombs || 0) + 1;
  const amount = 10 + Math.floor((g.rng ? g.rng() : Math.random()) * 41);
  dropCash(g, target.x, target.z, amount);
  if (target.gang) commitCrime(g, 'killGang');
  else if (target.isCop) commitCrime(g, 'killCop');
  else commitCrime(g, 'killPed');
}

export function dropCash(g, x, z, amount) {
  if (!g.pickups) g.pickups = [];
  g.pickups.push({ x, z, amount });
  return g.pickups[g.pickups.length - 1];
}

export function stepPickups(g, dt) {
  if (!g.pickups) return;
  const p = g.player;
  for (let i = g.pickups.length - 1; i >= 0; i--) {
    const pk = g.pickups[i];
    if (Math.hypot(pk.x - p.x, pk.z - p.z) < 2.5) {
      g.cash += pk.amount;
      showToast(g, `+$${pk.amount}`);
      g.pickups.splice(i, 1);
    }
  }
}

// Armour absorbs damage first. At 0 HP the WASTED card shows.
// The spawn grace (5 s after a real game start / respawn) blocks
// damage; a fresh state has grace 0 so tests can damage directly.
export function damagePlayer(g, amount) {
  const p = g.player;
  if ((p.graceTimer || 0) > 0) return;
  let rest = amount;
  if (g.armour > 0) {
    const absorbed = Math.min(g.armour, rest);
    g.armour -= absorbed;
    rest -= absorbed;
  }
  if (rest > 0) {
    g.health = Math.max(0, g.health - rest);
  }
  if (g.health <= 0) {
    g.health = 0;
    g.mode = 'wasted';
    g.card = { title: 'WASTED', text: 'Press Enter to wake up at the hospital.' };
  }
}
