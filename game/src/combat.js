// Solmar Bay — combat: punch, hitscan weapons (pistol/SMG/shotgun),
// throwable bombs, cash drops for kills, health/armour/wrench/
// weapon pickups. Killing raises wanted through the crime table.

import { TUNE, clamp, dist } from './config.js';
import { collides } from './world.js';

export function createCombat() {
  return {
    pickups: [], // {kind, x, z, amount}
    cashDrops: [], // {x, z, amount, t}
    bombs: [], // {x, z, y, vx, vz, fuse}
    shootT: 0,
  };
}

export function seedPickups(game) {
  const c = game.combat;
  const spots = [
    { kind: 'health', x: -40, z: 40 }, { kind: 'health', x: 120, z: -120 },
    { kind: 'armour', x: 40, z: -40 }, { kind: 'armour', x: -120, z: 120 },
    { kind: 'wrench', x: 170, z: 110 }, { kind: 'wrench', x: -90, z: 210 },
    { kind: 'smg', x: 100, z: 100 }, { kind: 'shotgun', x: -200, z: 300 },
    { kind: 'bomb', x: 60, z: 60 }, { kind: 'bomb', x: -60, z: -60 },
    { kind: 'health', x: -330, z: 0 }, { kind: 'armour', x: 300, z: -300 },
  ];
  for (const s of spots) c.pickups.push({ kind: s.kind, x: s.x, z: s.z, amount: s.kind === 'smg' ? 60 : s.kind === 'shotgun' ? 12 : s.kind === 'bomb' ? 3 : 0 });
}

function rayBlocked(city, x0, z0, x1, z1) {
  const steps = Math.ceil(dist(x0, z0, x1, z1) / 4);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (collides(city, x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, 0.5)) return true;
  }
  return false;
}

// All shootable targets: peds, gang members, foot cops.
export function shootTargets(game) {
  const out = [];
  for (const p of game.peds.list) if (p.alive) out.push({ x: p.x, z: p.z, ref: p, kind: 'ped' });
  if (game.gangs) for (const m of game.gangs.members) if (m.alive) out.push({ x: m.x, z: m.z, ref: m, kind: 'gang' });
  for (const c of game.police.cops) if (c.alive) out.push({ x: c.x, z: c.z, ref: c, kind: 'cop' });
  return out;
}

// Damage a ped/gang member/cop. Returns 'killed' when it dies.
export function damageTarget(game, target, dmg, cause) {
  const ref = target.ref;
  ref.health -= dmg;
  // a gang member hit turns its whole gang hostile
  if (target.kind === 'gang' && game.gangs && game.gangs.onMemberHit) {
    game.gangs.onMemberHit(game, ref);
  }
  if (ref.health > 0) return 'hit';
  ref.alive = false;
  const state = game.state;
  state.stats.kills += 1;
  // cash drop $10–$50
  const cash = 10 + Math.floor(Math.random() * 41);
  game.combat.cashDrops.push({ x: ref.x, z: ref.z, amount: cash, t: 0 });
  if (target.kind === 'ped') {
    if (game.police) game.police.commitCrime(game, cause === 'bomb' ? 'explosion' : 'killPed');
    if (game.peds && game.peds.fleeFrom) game.peds.fleeFrom(ref.x, ref.z, 25);
  } else if (target.kind === 'gang') {
    if (game.police) game.police.commitCrime(game, cause === 'bomb' ? 'explosion' : 'killGang');
  } else if (target.kind === 'cop') {
    if (game.police) game.police.commitCrime(game, 'killCop');
  }
  return 'killed';
}

// F punch: nearest target in front, within range. Cooldown gated `<= 0`.
export function tryPunch(game) {
  const state = game.state;
  if (state.fCooldown > 0) return false;
  state.fCooldown = TUNE.punchCooldown;
  const p = game.player;
  if (p.inVehicle) return false;
  const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
  let best = null, bd = TUNE.punchRange;
  for (const t of shootTargets(game)) {
    const d = dist(p.x, p.z, t.x, t.z);
    if (d > bd) continue;
    const dot = ((t.x - p.x) * fx + (t.z - p.z) * fz) / (d || 1);
    if (dot < 0.3) continue;
    best = t; bd = d;
  }
  if (!best) {
    if (game.audio) game.audio.thud(300);
    return true; // swung at air
  }
  if (game.audio) game.audio.thud(500);
  if (best.kind === 'ped' && game.police) game.police.commitCrime(game, 'punchPed');
  return damageTarget(game, best, TUNE.punchDamage, 'punch');
}

// Mouse click / auto-fire: hitscan from the camera centre crosshair.
export function tryShoot(game) {
  const state = game.state;
  const combat = game.combat;
  if (combat.shootT > 0) return false;
  const cd = state.weapon === 'smg' ? TUNE.shootCooldownSmg
    : state.weapon === 'shotgun' ? TUNE.shootCooldownShotgun
    : TUNE.shootCooldownPistol;
  combat.shootT = cd;
  const p = game.player;
  if (p.inVehicle) return false;
  // spend ammo (pistol is infinite)
  if (state.weapon === 'smg') {
    if (state.ammo.smg <= 0) { state.weapon = 'pistol'; return false; }
    state.ammo.smg -= 1;
  } else if (state.weapon === 'shotgun') {
    if (state.ammo.shotgun <= 0) { state.weapon = 'pistol'; return false; }
    state.ammo.shotgun -= 1;
  }
  const cam = game.camera;
  const eye = cam.eye;
  const tx = cam.target[0], ty = cam.target[1], tz = cam.target[2];
  let dx = tx - eye[0], dy = ty - eye[1], dz = tz - eye[2];
  const dl = Math.hypot(dx, dy, dz) || 1;
  dx /= dl; dy /= dl; dz /= dl;
  const range = TUNE.shootRange;
  const spread = state.weapon === 'shotgun' ? 0.09 : state.weapon === 'smg' ? 0.03 : 0.012;
  const acc = 1 + (state.accuracyBonus || 0);
  const shots = state.weapon === 'shotgun' ? 5 : 1;
  let hitAny = false;
  for (let s = 0; s < shots; s++) {
    const jx = (Math.random() - 0.5) * spread * 2 / acc;
    const jz = (Math.random() - 0.5) * spread * 2 / acc;
    const dirx = dx + jx, dirz = dz + jz;
    let best = null, bd = range;
    for (const t of shootTargets(game)) {
      const vx = t.x - eye[0], vz = t.z - eye[2];
      const along = vx * dirx + vz * dirz;
      if (along < 1 || along > bd) continue;
      const perp = Math.abs(vx * dirz - vz * dirx);
      if (perp > 1.6) continue;
      if (rayBlocked(game.city, eye[0], eye[2], t.x, t.z)) continue;
      best = t; bd = along;
    }
    if (best) {
      const dmg = state.weapon === 'shotgun' ? 22 : state.weapon === 'smg' ? 14 : 34;
      damageTarget(game, best, dmg, 'shoot');
      hitAny = true;
    }
  }
  if (game.audio) game.audio.shot(state.weapon);
  return hitAny;
}

// G: throw a bomb. Cooldown gated `<= 0`.
export function throwBomb(game) {
  const state = game.state;
  if (state.gCooldown > 0) return false;
  if (state.bombs <= 0) return false;
  const p = game.player;
  if (p.inVehicle) return false;
  state.gCooldown = TUNE.bombCooldown;
  state.bombs -= 1;
  game.combat.bombs.push({
    x: p.x, z: p.z, y: 1.5,
    vx: Math.sin(p.heading) * 14, vz: Math.cos(p.heading) * 14,
    fuse: 1.1,
  });
  if (game.audio) game.audio.blip(300, 0.1);
  return true;
}

export function updateCombat(dt, game) {
  const combat = game.combat;
  const state = game.state;
  if (combat.shootT > 0) combat.shootT -= dt;
  // bombs tick and explode
  for (let i = combat.bombs.length - 1; i >= 0; i--) {
    const b = combat.bombs[i];
    b.fuse -= dt;
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    b.y += 3 * dt;
    if (b.fuse <= 0) {
      combat.bombs.splice(i, 1);
      explode(game, b.x, b.z);
    }
  }
  // cash drops expire after 25s
  for (let i = combat.cashDrops.length - 1; i >= 0; i--) {
    combat.cashDrops[i].t += dt;
    if (combat.cashDrops[i].t > 25) combat.cashDrops.splice(i, 1);
  }
  // pickup collection (walk over)
  const p = game.player;
  if (p.inVehicle) return;
  for (let i = combat.pickups.length - 1; i >= 0; i--) {
    const pk = combat.pickups[i];
    if (dist(p.x, p.z, pk.x, pk.z) < 2.2) {
      combat.pickups.splice(i, 1);
      collectPickup(game, pk);
    }
  }
  for (let i = combat.cashDrops.length - 1; i >= 0; i--) {
    const cd = combat.cashDrops[i];
    if (dist(p.x, p.z, cd.x, cd.z) < 2.2) {
      combat.cashDrops.splice(i, 1);
      state.cash += cd.amount;
      if (game.audio) game.audio.blip(880, 0.08);
    }
  }
}

function explode(game, x, z) {
  const state = game.state;
  if (game.audio) game.audio.boom();
  game.flashT = 0.12;
  // damage every target in the blast radius
  let victims = 0;
  for (const t of shootTargets(game)) {
    if (dist(x, z, t.x, t.z) < TUNE.bombRadius) {
      damageTarget(game, t, TUNE.bombDamage, 'bomb');
      victims += 1;
    }
  }
  // self-damage up close
  const p = game.player;
  const pd = dist(x, z, p.x, p.z);
  if (!p.inVehicle && pd < 6 && game.hurtPlayer) game.hurtPlayer(30, 'bomb');
  if (p.inVehicle && dist(x, z, p.inVehicle.x, p.inVehicle.z) < TUNE.bombRadius) {
    p.inVehicle.damage += 60;
  }
  if (victims > 0 && game.police) game.police.commitCrime(game, victims >= 3 ? 'massRampage' : 'explosion');
  if (game.peds && game.peds.fleeFrom) game.peds.fleeFrom(x, z, 40);
}

function collectPickup(game, pk) {
  const state = game.state;
  if (pk.kind === 'health') {
    state.health = Math.min(100, state.health + 40);
  } else if (pk.kind === 'armour') {
    state.armour = Math.min(100, state.armour + 40);
  } else if (pk.kind === 'wrench') {
    const v = game.player.inVehicle;
    if (v) v.damage = Math.max(0, v.damage - 50);
  } else if (pk.kind === 'smg') {
    state.ammo.smg += pk.amount;
    state.weapon = 'smg';
  } else if (pk.kind === 'shotgun') {
    state.ammo.shotgun += pk.amount;
    state.weapon = 'shotgun';
  } else if (pk.kind === 'bomb') {
    state.bombs += pk.amount;
  }
  if (game.audio) game.audio.blip(880, 0.08);
}

const PICKUP_COLORS = {
  health: [1, 0.25, 0.3], armour: [0.3, 0.6, 1], wrench: [0.9, 0.9, 0.9],
  smg: [0.9, 0.7, 0.2], shotgun: [0.9, 0.5, 0.2], bomb: [0.2, 0.2, 0.25],
};

export function drawCombat(renderer, game) {
  const t = game.time;
  for (const pk of game.combat.pickups) {
    const bob = Math.sin(t * 3 + pk.x) * 0.25;
    renderer.box(pk.x, 1 + bob, pk.z, 1.1, 1.1, 1.1, PICKUP_COLORS[pk.kind] || [1, 1, 1], 1, 0, t * 0.8, 0);
  }
  for (const cd of game.combat.cashDrops) {
    renderer.box(cd.x, 0.5 + Math.sin(t * 4 + cd.x) * 0.15, cd.z, 0.9, 0.4, 0.6, [0.2, 0.9, 0.3], 1, 0, 0, 0);
  }
  for (const b of game.combat.bombs) {
    renderer.box(b.x, b.y, b.z, 0.7, 0.7, 0.7, [0.15, 0.15, 0.18], 1, 0, t * 5, 0);
  }
}

export { clamp };
