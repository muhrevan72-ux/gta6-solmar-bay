// Solmar Bay — combat: hitscan weapons, punch, throwable bombs, cash
// drops and pickups. The crosshair is the screen centre; shots raycast
// from the camera through it.

import { WEAPONS, BOMB, PICKUPS, WANTED, COL, PLAYER } from './config.js';
import { damageVehicle } from './vehicles.js';

export function createCombat() {
  return {
    pickups: [],   // {kind,x,z,amount,t,respawn}
    bombs: [],     // {x,y,z,vx,vy,vz,fuse}
    shootCd: 0,
    tracer: null,  // {from:[x,y,z], to:[x,y,z], t}
    weaponSpots: [
      { kind: 'smg', x: -88, z: 44 },
      { kind: 'shotgun', x: 350, z: 260 },
      { kind: 'smg', x: 315, z: -160 },
      { kind: 'bomb', x: 200, z: -200 },
      { kind: 'health', x: -60, z: -40 },
      { kind: 'armor', x: 260, z: 240 },
      { kind: 'wrench', x: 24, z: 70 },
    ],
  };
}

export function seedPickups(game) {
  for (const s of game.combat.weaponSpots) {
    game.combat.pickups.push({
      kind: s.kind, x: s.x, z: s.z,
      amount: s.kind === 'smg' ? PICKUPS.smgAmmo : s.kind === 'shotgun' ? PICKUPS.shotgunAmmo : s.kind === 'bomb' ? PICKUPS.bombAdd : 0,
      t: Math.random() * 6, respawn: 90, home: { x: s.x, z: s.z },
    });
  }
}

export function spawnPickup(game, kind, x, z, amount) {
  game.combat.pickups.push({ kind, x, z, amount: amount || 0, t: Math.random() * 6, respawn: 0, home: null });
}

// ---- punching (F) ----

export function tryPunch(game) {
  const p = game.player;
  if (p.punchCd > 0 || p.inVehicle) return;
  p.punchCd = PLAYER.punchCooldown;
  p.punchAnim = 0.3;
  game.audio.thud();
  const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
  // peds in front
  for (const ped of game.peds.list) {
    if (ped.state === 'dead') continue;
    const dx = ped.x - p.x, dz = ped.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < PLAYER.punchRange + 0.5 && (dx * fx + dz * fz) / (d || 1) > 0.4) {
      damagePed(game, ped, PLAYER.punchDamage, 'punch');
    }
  }
  // foot cops in front
  for (const c of game.police.cops) {
    const dx = c.x - p.x, dz = c.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < PLAYER.punchRange + 0.5 && (dx * fx + dz * fz) / (d || 1) > 0.4) {
      damageCop(game, c, PLAYER.punchDamage);
    }
  }
}

// ---- killing peds / cops ----

export function damagePed(game, ped, dmg, cause) {
  if (ped.state === 'dead') return;
  ped.health -= dmg;
  if (ped.health > 0) {
    ped.state = 'flee';
    ped.fleeT = 3;
    ped.heading = Math.atan2(ped.x - game.player.x, ped.z - game.player.z);
    if (cause === 'car' || cause === 'shot' || cause === 'bomb') {
      raiseWanted(game, 0); // hurt but alive: no star yet
    }
    return;
  }
  ped.state = 'dead';
  ped.deadT = 0;
  game.state.stats.kills++;
  const cash = PICKUPS.cashMin + Math.floor(Math.random() * (PICKUPS.cashMax - PICKUPS.cashMin));
  spawnPickup(game, 'cash', ped.x, ped.z, cash);
  raiseWanted(game, WANTED.killStars);
  game.peds.fleeFrom(ped.x, ped.z, 18);
  game.audio.blip(220, 0.15);
}

export function damageCop(game, cop, dmg) {
  cop.health = (cop.health ?? 60) - dmg;
  if (cop.health > 0) return;
  const i = game.police.cops.indexOf(cop);
  if (i >= 0) game.police.cops.splice(i, 1);
  game.state.stats.kills++;
  const cash = 25 + Math.floor(Math.random() * 25);
  spawnPickup(game, 'cash', cop.x, cop.z, cash);
  raiseWanted(game, WANTED.killStars);
  game.audio.blip(180, 0.2);
}

export function raiseWanted(game, stars) {
  const state = game.state;
  if (stars > 0) {
    state.wanted = Math.min(WANTED.maxStars, state.wanted + stars);
    state.wantedTimer = 0;
    if (state.wanted >= 1) game.audio.sirenStart();
  }
}

// ---- shooting (mouse click, hitscan from the camera) ----

function rayHit(game, origin, dir, range) {
  // returns {kind:'ped'|'cop'|'vehicle', obj, dist, point} or null
  let best = null;
  const consider = (x, z, y0, y1, radius, kind, obj) => {
    const dx = x - origin[0], dz = z - origin[2];
    const along = dx * dir[0] + dz * dir[2];
    if (along < 1 || along > range) return;
    const px = origin[0] + dir[0] * along, pz = origin[2] + dir[2] * along;
    const lateral = Math.hypot(px - x, pz - z);
    if (lateral > radius) return;
    const y = origin[1] + dir[1] * along;
    if (y < y0 - 0.2 || y > y1 + 0.2) return;
    if (!best || along < best.dist) {
      best = { kind, obj, dist: along, point: [px, y, pz] };
    }
  };
  for (const ped of game.peds.list) {
    if (ped.state === 'dead') continue;
    consider(ped.x, ped.z, 0, 1.9, 0.9, 'ped', ped);
  }
  for (const c of game.police.cops) {
    consider(c.x, c.z, 0, 1.9, 0.9, 'cop', c);
  }
  for (const v of game.vehicles.list) {
    if (v === game.player.inVehicle) continue;
    consider(v.x, v.z, v.y, v.y + 2.2, 2.1, 'vehicle', v);
  }
  return best;
}

export function tryShoot(game) {
  const combat = game.combat;
  const state = game.state;
  if (combat.shootCd > 0) return;
  const w = WEAPONS[state.weapon];
  if (!state.weapon || !w) return;
  if (!game.spendAmmo()) {
    game.toast('Out of ammo — find a weapon pickup.');
    game.audio.blip(140, 0.1);
    combat.shootCd = 0.3;
    return;
  }
  combat.shootCd = w.rate;
  const cam = game.camera;
  const origin = cam.eye;
  const dir = [
    cam.target[0] - cam.eye[0],
    cam.target[1] - cam.eye[1],
    cam.target[2] - cam.eye[2],
  ];
  const len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  dir[0] /= len; dir[1] /= len; dir[2] /= len;

  const pellets = w.pellets || 1;
  let endPoint = [origin[0] + dir[0] * w.range, origin[1] + dir[1] * w.range, origin[2] + dir[2] * w.range];
  for (let i = 0; i < pellets; i++) {
    const d = [
      dir[0] + (Math.random() - 0.5) * w.spread * 2,
      dir[1] + (Math.random() - 0.5) * w.spread * 2,
      dir[2] + (Math.random() - 0.5) * w.spread * 2,
    ];
    const dl = Math.hypot(d[0], d[1], d[2]) || 1;
    d[0] /= dl; d[1] /= dl; d[2] /= dl;
    const hit = rayHit(game, origin, d, w.range);
    if (hit) {
      endPoint = hit.point;
      if (hit.kind === 'ped') damagePed(game, hit.obj, w.damage, 'shot');
      else if (hit.kind === 'cop') damageCop(game, hit.obj, w.damage);
      else if (hit.kind === 'vehicle') {
        damageVehicle(game, hit.obj, w.damage, 'shot');
        if (hit.obj.police) raiseWanted(game, 1);
        if (hit.obj.driver === 'npc') {
          game.peds.fleeFrom(hit.obj.x, hit.obj.z, 12);
          hit.obj.driver = null; hit.obj.traffic = null;
        }
      }
      break; // one hit per trigger pull (pellets share the first hit)
    }
  }
  combat.tracer = { from: [...origin], to: endPoint, t: 0.06 };
  game.audio.shot(state.weapon);
  game.peds.fleeFrom(game.player.x, game.player.z, 20);
}

// ---- bombs (G) ----

export function throwBomb(game) {
  const state = game.state;
  const p = game.player;
  if (state.bombs <= 0) {
    game.toast('No bombs — find a bomb pickup.');
    return;
  }
  state.bombs--;
  const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
  game.combat.bombs.push({
    x: p.x + fx * 0.8, y: p.y + 1.4, z: p.z + fz * 0.8,
    vx: fx * BOMB.throwSpeed, vy: 6, vz: fz * BOMB.throwSpeed,
    fuse: BOMB.fuse,
  });
  game.audio.blip(520, 0.08);
}

function explode(game, b) {
  const R = BOMB.radius;
  game.audio.explosion();
  game.flashT = 0.12;
  // damage everything in the blast
  for (const ped of game.peds.list) {
    if (ped.state === 'dead') continue;
    const d = Math.hypot(ped.x - b.x, ped.z - b.z);
    if (d < R) damagePed(game, ped, Math.round(BOMB.damage * (1 - d / (R + 4))), 'bomb');
  }
  for (const c of [...game.police.cops]) {
    const d = Math.hypot(c.x - b.x, c.z - b.z);
    if (d < R) damageCop(game, c, Math.round(BOMB.damage * (1 - d / (R + 4))));
  }
  for (const v of game.vehicles.list) {
    const d = Math.hypot(v.x - b.x, v.z - b.z);
    if (d < R) damageVehicle(game, v, Math.round(BOMB.damage * (1 - d / (R + 4))), 'bomb');
  }
  const pd = Math.hypot(game.player.x - b.x, game.player.z - b.z);
  if (pd < R && !game.player.inVehicle) {
    game.hurtPlayer(Math.round(BOMB.damage * 0.6 * (1 - pd / (R + 4))), 'bomb');
  }
  raiseWanted(game, WANTED.explosionStars);
  game.peds.fleeFrom(b.x, b.z, 26);
}

// ---- per-frame update ----

export function updateCombat(dt, game) {
  const combat = game.combat;
  if (combat.shootCd > 0) combat.shootCd -= dt;
  if (combat.tracer) {
    combat.tracer.t -= dt;
    if (combat.tracer.t <= 0) combat.tracer = null;
  }
  // bombs fly and blow
  for (let i = combat.bombs.length - 1; i >= 0; i--) {
    const b = combat.bombs[i];
    b.vy -= 20 * dt;
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    b.fuse -= dt;
    if (b.y <= 0.1 || b.fuse <= 0) {
      explode(game, b);
      combat.bombs.splice(i, 1);
    }
  }
  // pickups: bob, collect, respawn weapon spots
  const p = game.player;
  const pv = p.inVehicle;
  for (let i = combat.pickups.length - 1; i >= 0; i--) {
    const pk = combat.pickups[i];
    pk.t += dt;
    const px = pv ? pv.x : p.x, pz = pv ? pv.z : p.z;
    const d = Math.hypot(pk.x - px, pk.z - pz);
    const reach = pv ? 3.2 : 1.7;
    if (d < reach) {
      if (!collectPickup(game, pk)) continue; // e.g. wrench on foot: leave it
      if (pk.home) {
        // weapon spots respawn after a while
        pk.takenAt = game.time;
        pk.x = 1e6; pk.z = 1e6; // park it far away until respawn
      } else {
        combat.pickups.splice(i, 1);
      }
      continue;
    }
    if (pk.home && pk.takenAt !== undefined && game.time - pk.takenAt > pk.respawn) {
      pk.x = pk.home.x; pk.z = pk.home.z;
      pk.takenAt = undefined;
    }
  }
}

function collectPickup(game, pk) {
  const state = game.state;
  switch (pk.kind) {
    case 'cash':
      state.cash += pk.amount;
      state.toast = '+$' + pk.amount;
      state.toastTimer = 1.4;
      game.audio.blip(990, 0.08);
      break;
    case 'health':
      game.healPlayer(PICKUPS.healthAmount);
      game.toast('Health +30');
      game.audio.blip(660, 0.1);
      break;
    case 'armor':
      game.addArmor(PICKUPS.armorAmount);
      game.toast('Armour +50');
      game.audio.blip(660, 0.1);
      break;
    case 'wrench': {
      const pv = game.player.inVehicle;
      if (pv) {
        pv.health = Math.min(100, pv.health + PICKUPS.wrenchAmount);
        pv.wrecked = false;
        game.toast('Vehicle repaired');
      } else {
        game.toast('Wrench — get in a car to use it');
        return false; // not consumed: leave it on the ground
      }
      game.audio.blip(520, 0.1);
      break;
    }
    case 'smg':
      state.ammo.smg += pk.amount || PICKUPS.smgAmmo;
      game.toast('SMG ammo +' + (pk.amount || PICKUPS.smgAmmo));
      game.audio.blip(880, 0.1);
      break;
    case 'shotgun':
      state.ammo.shotgun += pk.amount || PICKUPS.shotgunAmmo;
      game.toast('Shotgun ammo +' + (pk.amount || PICKUPS.shotgunAmmo));
      game.audio.blip(880, 0.1);
      break;
    case 'bomb':
      state.bombs = Math.min(BOMB.maxCount, state.bombs + (pk.amount || PICKUPS.bombAdd));
      game.toast('Bombs +' + (pk.amount || PICKUPS.bombAdd));
      game.audio.blip(880, 0.1);
      break;
    default:
      break;
  }
  return true;
}

// ---- drawing ----

export function drawCombat(renderer, game) {
  const combat = game.combat;
  for (const pk of combat.pickups) {
    if (pk.x > 1e5) continue; // waiting to respawn
    const bob = Math.sin(pk.t * 2.5) * 0.15;
    const y = 0.7 + bob;
    if (pk.kind === 'cash') {
      renderer.box(pk.x, y, pk.z, 0.7, 0.18, 0.45, pk.t, COL.cash, COL.cash);
    } else if (pk.kind === 'health') {
      renderer.box(pk.x, y, pk.z, 0.7, 0.2, 0.7, 0, COL.health, COL.health);
      renderer.box(pk.x, y + 0.15, pk.z, 0.7, 0.2, 0.25, 0, COL.health, COL.health);
    } else if (pk.kind === 'armor') {
      renderer.box(pk.x, y, pk.z, 0.6, 0.6, 0.6, pk.t, COL.armor, COL.armor);
    } else if (pk.kind === 'wrench') {
      renderer.box(pk.x, y, pk.z, 0.8, 0.2, 0.2, pk.t, COL.wrench, COL.wrench);
    } else if (pk.kind === 'smg' || pk.kind === 'shotgun') {
      renderer.box(pk.x, y, pk.z, 0.25, 0.25, 1.0, pk.t, COL.weapon, COL.weapon);
      renderer.box(pk.x, y, pk.z, 0.6, 0.15, 0.15, pk.t, COL.weapon, COL.weapon);
    } else if (pk.kind === 'bomb') {
      renderer.box(pk.x, y, pk.z, 0.45, 0.45, 0.45, pk.t, COL.bomb, COL.bomb);
    }
  }
  for (const b of combat.bombs) {
    renderer.box(b.x, b.y, b.z, 0.4, 0.4, 0.4, b.fuse * 6, COL.bomb, COL.bomb);
  }
  if (combat.tracer) {
    const t = combat.tracer;
    const dx = t.to[0] - t.from[0], dy = t.to[1] - t.from[1], dz = t.to[2] - t.from[2];
    const len = Math.hypot(dx, dy, dz) || 1;
    const mx = (t.from[0] + t.to[0]) / 2, my = (t.from[1] + t.to[1]) / 2, mz = (t.from[2] + t.to[2]) / 2;
    const yaw = Math.atan2(dx, dz);
    const pitch = Math.asin(dy / len);
    renderer.box(mx, my, mz, 0.06, 0.06, len, yaw, [1, 0.9, 0.4], [1, 0.9, 0.4], -pitch);
  }
}
