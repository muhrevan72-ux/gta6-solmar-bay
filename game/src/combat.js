// Solmar Bay — combat: punch, hitscan pistol / SMG / shotgun,
// throwable bombs, cash drops ($10–$50) from kills, health / armour /
// wrench pickups, and damage to the player (which can bust them).

import { TUNE, clamp, dist2 } from './config.js';
import { addCash, showToast } from './state.js';
import { collideCircle } from './world.js';

export const WEAPONS = [
  { id: 'pistol', name: 'Pistol', damage: TUNE.pistolDamage, range: 60, rate: 0.28, spread: 0.02, pellets: 1, ammo: Infinity }, // infinite ammo
  { id: 'smg', name: 'SMG', damage: TUNE.smgDamage, range: 55, rate: 0.09, spread: 0.06, pellets: 1, ammo: 120 },
  { id: 'shotgun', name: 'Shotgun', damage: TUNE.shotgunDamage, range: 30, rate: 0.7, spread: 0.12, pellets: 6, ammo: 24 },
];

export function createCombat() {
  return {
    weapon: 0, // index into WEAPONS
    owned: [true, false, false], // pistol owned; smg/shotgun are pickups
    ammo: [Infinity, 0, 0], // rounds per weapon (pistol infinite)
    bombs: 3,
    bombCooldown: 0,
    shootCooldown: 0,
    punchCooldown: 0,
    bombWentOff: false, // one-frame flag so peds flee
    cashDrops: [], // { x, z, amount, t }
    pickups: [], // { x, z, kind: health|armour|wrench|smg|shotgun, t }
    bombsActive: [], // { x, y, z, vx, vy, vz, t }
  };
}

// `persist` pickups never expire — the respect unlocks (SMG at the
// range, shotgun at the harbour) must still be there when the player
// walks over, however long that takes.
export function spawnPickup(game, x, z, kind, persist) {
  game.combat.pickups.push({ x, z, kind, t: 0, persist: !!persist });
}

export function dropCash(game, x, z, amount) {
  game.combat.cashDrops.push({ x, z, amount, t: 0 });
}

// Damage the player (armour absorbs first). Health 0 = busted.
export function damagePlayer(game, amount) {
  const state = game.state;
  if (state.mode !== 'playing') return;
  let left = amount;
  if (state.armour > 0) {
    const absorbed = Math.min(state.armour, left);
    state.armour -= absorbed;
    left -= absorbed;
  }
  state.health -= left;
  if (state.health <= 0) {
    state.health = 0;
    // death (health 0) is WASTED, arrest is BUSTED — the police
    // module shows the right screen for each
    if (game.police) game.police.bustPlayer(game, 'You were beaten down', 'wasted');
  }
}

export function healPlayer(game, amount) {
  game.state.health = clamp(game.state.health + amount, 0, 100);
}

// Punch: hits the nearest ped / gang member / cop in front, 2.5 range.
export function punch(game) {
  const combat = game.combat;
  if (combat.punchCooldown > 0) return false;
  combat.punchCooldown = 0.45;
  const p = game.player;
  const fx = Math.sin(p.heading);
  const fz = Math.cos(p.heading);
  let hit = false;
  const tryHit = (x, z) => {
    const dx = x - p.x;
    const dz = z - p.z;
    const d = Math.hypot(dx, dz);
    if (d > 3 || d < 0.01) return false;
    const dot = (dx * fx + dz * fz) / d;
    return dot > 0.3;
  };
  for (const ped of game.peds) {
    if (!ped.alive || !tryHit(ped.x, ped.z)) continue;
    killPed(game, ped, 'punchPed');
    hit = true;
    break;
  }
  if (!hit && game.gangs) {
    for (const m of game.gangs.members) {
      if (!m.alive || !tryHit(m.x, m.z)) continue;
      killGangMember(game, m, 'punchPed');
      hit = true;
      break;
    }
  }
  if (hit && game.audio) game.audio.play('punch');
  return hit;
}

export function killPed(game, ped, crime) {
  if (!ped.alive) return;
  ped.alive = false;
  game.state.stats.pedsKilled += 1;
  if (game.police && game.police.commitCrime) game.police.commitCrime(game, crime || 'killPed');
  const amount = TUNE.cashDropMin + Math.floor(Math.random() * (TUNE.cashDropMax - TUNE.cashDropMin));
  dropCash(game, ped.x, ped.z, amount);
  // respawn a fresh ped elsewhere (handled by updateCombat)
  game._respawnPed = true;
}

export function killGangMember(game, member, crime) {
  if (!member.alive) return;
  member.alive = false;
  if (game.police && game.police.commitCrime) game.police.commitCrime(game, crime || 'killGang');
  const amount = TUNE.cashDropMin + Math.floor(Math.random() * (TUNE.cashDropMax - TUNE.cashDropMin));
  dropCash(game, member.x, member.z, amount);
}

export function killCop(game, cop) {
  // foot cop object: remove from the police list
  const list = game.police.footCops;
  const i = list.indexOf(cop);
  if (i >= 0) list.splice(i, 1);
  if (game.police && game.police.commitCrime) game.police.commitCrime(game, 'killCop');
  dropCash(game, cop.x, cop.z, 50);
  game.state.stats.copsKilled += 1;
}

// Hitscan shot from the camera crosshair: ray from the player
// forward; nearest living target within range and a narrow cone.
export function shoot(game) {
  const combat = game.combat;
  const weapon = WEAPONS[combat.weapon];
  if (!combat.owned[combat.weapon]) return false;
  if (combat.shootCooldown > 0) return false;
  // ammo: the pistol is infinite, SMG/shotgun spend a round per shot
  if (combat.ammo[combat.weapon] <= 0) return false;
  combat.shootCooldown = weapon.rate;
  if (combat.ammo[combat.weapon] !== Infinity) combat.ammo[combat.weapon] -= 1;
  const p = game.player;
  const camYaw = game.camera.yaw;
  const fx = Math.sin(camYaw);
  const fz = Math.cos(camYaw);
  let best = null;
  let bestD = weapon.range;
  const consider = (x, z, kind, ref) => {
    const dx = x - p.x;
    const dz = z - p.z;
    const d = Math.hypot(dx, dz);
    if (d > weapon.range || d < 0.5) return;
    const dot = (dx * fx + dz * fz) / d;
    const spread = weapon.spread + (1 - dot) * 2;
    if (dot < 0.92) return;
    if (d < bestD) {
      bestD = d;
      best = { kind, ref, d, spread };
    }
  };
  for (const ped of game.peds) if (ped.alive) consider(ped.x, ped.z, 'ped', ped);
  if (game.gangs) for (const m of game.gangs.members) if (m.alive) consider(m.x, m.z, 'gang', m);
  if (game.police) for (const c of game.police.footCops) consider(c.x, c.z, 'cop', c);
  if (game.training) for (const t of game.training.targets) if (t.alive) consider(t.x, t.z, 'target', t);
  if (game.audio) game.audio.play('shoot');
  if (!best) return true; // shot fired, nothing hit
  const damage = weapon.damage * weapon.pellets;
  if (best.kind === 'ped') killPed(game, best.ref, 'killPed');
  else if (best.kind === 'gang') killGangMember(game, best.ref, 'killGang');
  else if (best.kind === 'cop') killCop(game, best.ref);
  else if (best.kind === 'target' && game.training) game.training.hitTarget(game, best.ref, damage);
  return true;
}

// Throw a bomb toward the crosshair. It arcs, lands, explodes.
export function throwBomb(game) {
  const combat = game.combat;
  if (combat.bombs <= 0 || combat.bombCooldown > 0) return false;
  combat.bombs -= 1;
  combat.bombCooldown = 0.6;
  const p = game.player;
  const yaw = game.camera.yaw;
  combat.bombsActive.push({
    x: p.x,
    y: (p.y || 0) + 1.5,
    z: p.z,
    vx: Math.sin(yaw) * 18,
    vy: 6,
    vz: Math.cos(yaw) * 18,
    t: 0,
  });
  if (game.audio) game.audio.play('throw');
  return true;
}

function explodeBomb(game, bomb) {
  const combat = game.combat;
  combat.bombWentOff = true;
  if (game.audio) game.audio.play('explosion');
  let victims = 0;
  const blast = (x, z) => dist2(x, z, bomb.x, bomb.z) < TUNE.bombRadius * TUNE.bombRadius;
  for (const ped of game.peds) {
    if (ped.alive && blast(ped.x, ped.z)) {
      killPed(game, ped, 'explosion');
      victims += 1;
    }
  }
  if (game.gangs) {
    for (const m of game.gangs.members) {
      if (m.alive && blast(m.x, m.z)) {
        killGangMember(game, m, 'explosion');
        victims += 1;
      }
    }
  }
  if (game.police) {
    for (const c of [...game.police.footCops]) {
      if (blast(c.x, c.z)) {
        killCop(game, c);
        victims += 1;
      }
    }
    for (const car of game.police.copCars) {
      if (blast(car.x, car.z)) {
        car.damage = 100;
        car.wrecked = true;
      }
    }
  }
  // the player's own bomb can hurt the player too
  const p = game.player;
  if (dist2(p.x, p.z, bomb.x, bomb.z) < 36) {
    damagePlayer(game, 40);
  }
  if (victims >= 2 && game.police) {
    game.police.explosionKills += 1;
  }
  if (game.police && game.police.commitCrime && victims > 0) {
    game.police.commitCrime(game, 'explosion');
  }
}

export function updateCombat(game, dt) {
  const combat = game.combat;
  combat.bombWentOff = false;
  combat.bombCooldown = Math.max(0, combat.bombCooldown - dt);
  combat.shootCooldown = Math.max(0, combat.shootCooldown - dt);
  combat.punchCooldown = Math.max(0, combat.punchCooldown - dt);

  // bombs arc and explode on landing
  for (let i = combat.bombsActive.length - 1; i >= 0; i--) {
    const b = combat.bombsActive[i];
    b.t += dt;
    b.vy -= 22 * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
    if (b.y <= 0 || b.t > 3) {
      combat.bombsActive.splice(i, 1);
      explodeBomb(game, b);
    }
  }

  // cash drops + pickups: walk over to collect
  const p = game.player;
  for (let i = combat.cashDrops.length - 1; i >= 0; i--) {
    const d = combat.cashDrops[i];
    d.t += dt;
    if (d.t > 30) {
      combat.cashDrops.splice(i, 1);
      continue;
    }
    if (dist2(p.x, p.z, d.x, d.z) < TUNE.pickupRadius * TUNE.pickupRadius) {
      addCash(game.state, d.amount);
      showToast(game.state, '+$' + d.amount, 1.5);
      combat.cashDrops.splice(i, 1);
    }
  }
  for (let i = combat.pickups.length - 1; i >= 0; i--) {
    const pk = combat.pickups[i];
    pk.t += dt;
    if (pk.t > 60 && !pk.persist) {
      combat.pickups.splice(i, 1);
      continue;
    }
    if (dist2(p.x, p.z, pk.x, pk.z) < TUNE.pickupRadius * TUNE.pickupRadius) {
      if (pk.kind === 'health') healPlayer(game, 50);
      else if (pk.kind === 'armour') game.state.armour = clamp(game.state.armour + 50, 0, 100);
      else if (pk.kind === 'wrench' && p.inVehicle) {
        p.inVehicle.damage = Math.max(0, p.inVehicle.damage - 50);
        p.inVehicle.wrecked = false;
      } else if (pk.kind === 'smg') {
        combat.owned[1] = true;
        combat.ammo[1] = WEAPONS[1].ammo; // refill on pickup
        combat.weapon = 1;
      } else if (pk.kind === 'shotgun') {
        combat.owned[2] = true;
        combat.ammo[2] = WEAPONS[2].ammo; // refill on pickup
        combat.weapon = 2;
      }
      showToast(game.state, 'Picked up ' + pk.kind, 2);
      combat.pickups.splice(i, 1);
    }
  }

  // keep the city crowded: respawn killed peds elsewhere
  if (game._respawnPed) {
    game._respawnPed = false;
    let alive = 0;
    for (const ped of game.peds) if (ped.alive) alive += 1;
    if (alive < TUNE.pedCap) {
      const x = -280 + Math.random() * 560;
      const z = -280 + Math.random() * 560;
      const fixed = collideCircle(game.city, x, z, 0.6);
      game.peds.push({
        id: game.peds.length,
        x: fixed.x, z: fixed.z,
        heading: Math.random() * Math.PI * 2,
        targetHeading: 0,
        speed: 1.5, baseSpeed: 1.5, fleeing: 0, group: 0,
        skin: [0.9, 0.7, 0.5], shirt: [0.2, 0.5, 0.9], pants: [0.25, 0.35, 0.6],
        wanderT: 2, bob: 0, alive: true,
      });
    }
  }

  // ramming: a fast car hitting a ped kills them (a crime)
  if (p.inVehicle && Math.abs(p.inVehicle.speed) > 6) {
    const veh = p.inVehicle;
    for (const ped of game.peds) {
      if (!ped.alive) continue;
      if (dist2(ped.x, ped.z, veh.x, veh.z) < 6) {
        killPed(game, ped, 'killPed');
      }
    }
    if (game.gangs) {
      for (const m of game.gangs.members) {
        if (m.alive && dist2(m.x, m.z, veh.x, veh.z) < 6) {
          // gang members cannot be rammed (round-3 note): they dodge
          m.x += (m.x - veh.x) * 0.5;
          m.z += (m.z - veh.z) * 0.5;
        }
      }
    }
  }
}
