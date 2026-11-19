// Solmar Bay — combat: shooting, punching, bombs, weapon switching.
//
// Click shoots (raycast from the camera through the click point),
// F punches, G throws a bomb, 1/2/3 switch weapons (pistol / SMG /
// shotgun). Shooting a ped is a kill crime (2 stars); shooting a
// cop is 3; an explosion is 3. Kills drop cash pickups (collected
// with a toast — never silently).

import { TUNE } from './config.js';
import { pressedKey } from './input.js';
import { commitCrime } from './police.js';
import { showToast, addRespect } from './state.js';
import { findNearbyPed, dropCash } from './pedestrians.js';
import { gangMemberKilled } from './gangs.js';
import { playThud } from './audio.js';

export function createCombat() {
  return {
    shootT: 0, // fire-rate cooldown
    muzzleT: 0, // muzzle-flash timer (HUD)
    bombT: 0,
  };
}

const WEAPON_STATS = {
  pistol: { damage: TUNE.pistolDamage, rate: 0.35, range: 60 },
  smg: { damage: TUNE.smgDamage, rate: 0.09, range: 50 },
  shotgun: { damage: TUNE.shotgunDamage, rate: 0.8, range: 25, pellets: 6 },
};

export function stepCombat(game, dt) {
  const s = game.state;
  const c = game.combat;
  const inp = game.input;
  c.shootT -= dt;
  c.muzzleT -= dt;
  c.bombT -= dt;
  // While the phone is open, E/F/G and weapon switching are blocked
  // (the player is looking at the phone).
  if (game.phone && game.phone.open) return;
  // Weapon switch: 1 pistol, 2 SMG, 3 shotgun (only if owned).
  if (pressedKey(inp, 'Digit1') && s.weapons.pistol) s.weapon = 'pistol';
  if (pressedKey(inp, 'Digit2') && s.weapons.smg) s.weapon = 'smg';
  if (pressedKey(inp, 'Digit3') && s.weapons.shotgun) s.weapon = 'shotgun';
  // Punch: F, nearest ped/cop within 2.5 m.
  if (pressedKey(inp, 'KeyF')) punch(game);
  // Bomb: G, if any left.
  if (pressedKey(inp, 'KeyG') && c.bombT <= 0) throwBomb(game);
  // Shoot: mouse click (or held, for the SMG).
  if (inp.mouse.clicked && c.shootT <= 0) shoot(game);
}

function punch(game) {
  const s = game.state;
  const p = s.player;
  playThud(game.audio);
  const ped = findNearbyPed(game, p.x, p.z, 2.5);
  if (ped) {
    ped.hp -= TUNE.punchDamage;
    if (ped.hp <= 0) killPed(game, ped);
    else {
      commitCrime(game, 'punchPed');
      showToast(s, 'You punched a pedestrian!', 2);
    }
    return;
  }
  // Punch a cop.
  for (const cop of game.police.cops) {
    if (Math.hypot(cop.x - p.x, cop.z - p.z) < 2.5) {
      commitCrime(game, 'killCop');
      showToast(s, 'You punched a cop!', 2);
      return;
    }
  }
  // Punch a gang member.
  for (const m of game.gangs.members) {
    if (!m.dead && Math.hypot(m.x - p.x, m.z - p.z) < 2.5) {
      m.hp -= TUNE.punchDamage;
      if (m.hp <= 0) gangMemberKilled(game, m);
      else { m.hostile = true; commitCrime(game, 'killGang'); }
      return;
    }
  }
}

function killPed(game, ped) {
  const s = game.state;
  ped.dead = true;
  s.stats.kills++;
  commitCrime(game, 'killPed');
  dropCash(game, ped.x, ped.z);
  showToast(s, 'Pedestrian down. The cops saw that.', 3);
}

function shoot(game) {
  const s = game.state;
  const c = game.combat;
  const w = WEAPON_STATS[s.weapon];
  if (s.weapon !== 'pistol') {
    if (s.ammo[s.weapon] <= 0) {
      showToast(s, 'No ammo for the ' + s.weapon + '!', 2);
      return;
    }
    s.ammo[s.weapon]--;
  }
  c.shootT = w.rate;
  c.muzzleT = 0.08;
  // Raycast from the camera forward: the first ped/cop/gang member
  // within range and within 3 degrees of the aim ray is hit.
  const cam = game.camera;
  const p = s.player;
  const ox = p.inCar ? p.inCar.x : p.x;
  const oz = p.inCar ? p.inCar.z : p.z;
  const dx = Math.sin(cam.yaw), dz = Math.cos(cam.yaw);
  const pellets = w.pellets || 1;
  let hit = false;
  for (let pi = 0; pi < pellets; pi++) {
    const spread = (Math.random() - 0.5) * 0.06;
    const rx = Math.sin(cam.yaw + spread), rz = Math.cos(cam.yaw + spread);
    let best = null;
    let bestD = w.range;
    let bestKind = null;
    const consider = (x, z, obj, kind) => {
      const vx = x - ox, vz = z - oz;
      const along = vx * rx + vz * rz;
      if (along < 1 || along > bestD) return;
      const perp = Math.abs(vx * rz - vz * rx);
      if (perp < 1.5) { bestD = along; best = obj; bestKind = kind; }
    };
    for (const ped of game.peds) if (!ped.dead) consider(ped.x, ped.z, ped, 'ped');
    for (const cop of game.police.cops) consider(cop.x, cop.z, cop, 'cop');
    for (const m of game.gangs.members) if (!m.dead) consider(m.x, m.z, m, 'gang');
    if (best) {
      hit = true;
      if (bestKind === 'ped') {
        best.hp -= w.damage;
        if (best.hp <= 0) killPed(game, best);
        else commitCrime(game, 'punchPed');
      } else if (bestKind === 'cop') {
        commitCrime(game, 'killCop');
        s.stats.copKills++;
        showToast(s, 'You shot a cop! Wanted up!', 3);
      } else if (bestKind === 'gang') {
        best.hp -= w.damage;
        if (best.hp <= 0) gangMemberKilled(game, best);
        else { best.hostile = true; commitCrime(game, 'killGang'); }
      }
    }
  }
  if (!hit) {
    // A miss still makes noise: nearby peds flee (handled in
    // stepPedestrians via wanted).
  }
}

function throwBomb(game) {
  const s = game.state;
  const c = game.combat;
  if (s.bombs <= 0) {
    showToast(s, 'No bombs left!', 2);
    return;
  }
  s.bombs--;
  c.bombT = 0.5;
  const p = s.player;
  const bx = p.x + Math.sin(p.heading) * 4;
  const bz = p.z + Math.cos(p.heading) * 4;
  playThud(game.audio);
  // Explosion: everything in radius 9 takes 120 damage.
  let caught = 0;
  for (const ped of game.peds) {
    if (!ped.dead && Math.hypot(ped.x - bx, ped.z - bz) < TUNE.bombRadius) {
      ped.hp -= TUNE.bombDamage;
      if (ped.hp <= 0) killPed(game, ped);
      caught++;
    }
  }
  for (const cop of game.police.cops) {
    if (Math.hypot(cop.x - bx, cop.z - bz) < TUNE.bombRadius) {
      commitCrime(game, 'killCop');
      caught++;
    }
  }
  for (const m of game.gangs.members) {
    if (!m.dead && Math.hypot(m.x - bx, m.z - bz) < TUNE.bombRadius) {
      m.hp -= TUNE.bombDamage;
      if (m.hp <= 0) gangMemberKilled(game, m);
      caught++;
    }
  }
  commitCrime(game, 'explosion');
  showToast(s, 'BOOM! ' + caught + ' caught in the blast. Bombs left: ' + s.bombs, 3);
}
