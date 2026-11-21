// Solmar Bay — police: wanted stars, foot cops, interceptors,
// roadblocks, and the helicopter. Wanted is MAX-based (a crime
// raises it to at least its level, never stacks). Stars decay
// after 14 s out of sight. Cops stop ~8 m out and shoot; they
// only bust a player they actually touch.

import { CRIME, TUNE, SPAWNS } from './config.js';
import { isBlocked } from './world.js';
import { damagePlayer, showToast } from './state.js';
export function spawnPolice(g) {
  g.cops = [];
  g.copCars = [];
  g.roadblocks = [];
  g.heli = null;
}

export function commitCrime(g, type) {
  const c = CRIME[type];
  if (!c) return;
  g.wanted = Math.min(5, Math.max(g.wanted, c.stars));
  g.wantedTimer = 0;
}

// Line of sight: sample the segment; a building in the way blocks it.
export function hasLineOfSight(g, x1, z1, x2, z2) {
  const steps = Math.ceil(Math.hypot(x2 - x1, z2 - z1) / 2);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (isBlocked(g.city, x1 + (x2 - x1) * t, z1 + (z2 - z1) * t)) return false;
  }
  return true;
}

export function stepWanted(g, dt) {
  if (g.wanted <= 0) { g.wantedTimer = 0; return; }
  // A cop with line of sight (within 60 m) stops the decay.
  let seen = false;
  for (const cop of g.cops) {
    const d = Math.hypot(cop.x - g.player.x, cop.z - g.player.z);
    if (d < TUNE.sightRange && hasLineOfSight(g, cop.x, cop.z, g.player.x, g.player.z)) { seen = true; break; }
  }
  if (seen) { g.wantedTimer = 0; return; }
  g.wantedTimer += dt;
  if (g.wantedTimer >= TUNE.wantedDecaySec) {
    g.wanted = Math.max(0, g.wanted - 1);
    g.wantedTimer = 0;
  }
}

function makeCop(x, z) {
  return { x, z, type: 'cop', hp: 100, dead: false, shootCd: 1 + Math.random(), speed: 3.5 };
}

export function stepPolice(g, dt) {
  const wanted = g.wanted;
  // Foot cops: one per star (cap 5).
  const wantCops = Math.min(5, wanted);
  while (g.cops.length < wantCops) {
    const a = Math.random() * Math.PI * 2;
    g.cops.push(makeCop(g.player.x + Math.cos(a) * 25, g.player.z + Math.sin(a) * 25));
  }
  while (g.cops.length > wantCops) g.cops.pop();
  // Interceptor cars: one per star above 1 (cap 3).
  const wantCars = Math.min(3, Math.max(0, wanted - 1));
  while (g.copCars.length < wantCars) {
    const a = Math.random() * Math.PI * 2;
    g.copCars.push({ x: g.player.x + Math.cos(a) * 30, z: g.player.z + Math.sin(a) * 30, heading: 0, speed: 0, type: 'copCar' });
  }
  while (g.copCars.length > wantCars) g.copCars.pop();
  // Roadblocks: one per star above 2 (cap 3).
  const wantBlocks = Math.min(3, Math.max(0, wanted - 2));
  while (g.roadblocks.length < wantBlocks) {
    g.roadblocks.push({ x: g.player.x + 20 + g.roadblocks.length * 8, z: g.player.z, type: 'roadblock' });
  }
  while (g.roadblocks.length > wantBlocks) g.roadblocks.pop();
  // Helicopter at 4+ stars.
  if (wanted >= 4) {
    if (!g.heli) g.heli = { x: g.player.x, z: g.player.z, y: TUNE.heliAltitude, angle: 0, type: 'heli' };
    g.heli.angle += dt * 0.4;
    g.heli.x = g.player.x + Math.cos(g.heli.angle) * 30;
    g.heli.z = g.player.z + Math.sin(g.heli.angle) * 30;
    g.heli.y = TUNE.heliAltitude;
  } else {
    g.heli = null;
  }

  // Foot cops chase, stop ~8 m out, and shoot.
  for (const cop of g.cops) {
    if (cop.dead) continue;
    const dx = g.player.x - cop.x, dz = g.player.z - cop.z;
    const d = Math.hypot(dx, dz);
    // Touching the player busts them.
    if (d < 1.5) { bustPlayer(g); return; }
    if (d > 8) {
      const nx = cop.x + (dx / d) * cop.speed * dt;
      const nz = cop.z + (dz / d) * cop.speed * dt;
      if (!isBlocked(g.city, nx, cop.z)) cop.x = nx;
      if (!isBlocked(g.city, cop.x, nz)) cop.z = nz;
    }
    // Shoot: range 30 m, needs line of sight, cooldown ~2.5 s.
    cop.shootCd -= dt;
    if (cop.shootCd <= 0 && d < TUNE.copShootRange && hasLineOfSight(g, cop.x, cop.z, g.player.x, g.player.z)) {
      damagePlayer(g, 2 + wanted);
      cop.shootCd = TUNE.copShootCd;
    }
  }
  // Cop cars chase the player.
  for (const cc of g.copCars) {
    const dx = g.player.x - cc.x, dz = g.player.z - cc.z;
    const d = Math.hypot(dx, dz);
    if (d > 10) {
      const nx = cc.x + (dx / d) * 12 * dt;
      const nz = cc.z + (dz / d) * 12 * dt;
      if (!isBlocked(g.city, nx, cc.z)) cc.x = nx;
      if (!isBlocked(g.city, cc.x, nz)) cc.z = nz;
    }
  }
}

export function bustPlayer(g) {
  const fine = Math.floor(g.cash * 0.2);
  g.cash -= fine;
  g.wanted = 0;
  g.wantedTimer = 0;
  g.health = 100;
  g.armour = 0;
  if (g.player.inCar) {
    g.player.inCar.driver = null;
    g.player.inCar = null;
  }
  g.player.x = SPAWNS.hospital.x;
  g.player.z = SPAWNS.hospital.z;
  g.mode = 'busted';
  showToast(g, `Busted! Fine $${fine}`);
}

export function policeList(g) {
  const out = [];
  if (g.wanted <= 0 && !g.heli && (!g.cops || g.cops.length === 0) && (!g.copCars || g.copCars.length === 0) && (!g.roadblocks || g.roadblocks.length === 0)) return out;
  const px = g.player.x, pz = g.player.z;
  const nearest = (arr) => {
    let best = Infinity;
    for (const u of arr || []) {
      const d = Math.hypot((u.x || 0) - px, (u.z || 0) - pz);
      if (d < best) best = d;
    }
    return best === Infinity ? 0 : Math.round(best);
  };
  // One entry per response type (not one per unit).
  if (g.cops && g.cops.length > 0) {
    out.push(`Foot patrol — ${nearest(g.cops)}m — PURSUIT`);
  }
  if (g.copCars && g.copCars.length > 0) {
    out.push(`Interceptors — ${nearest(g.copCars)}m — PURSUIT`);
  }
  if (g.roadblocks && g.roadblocks.length > 0) {
    out.push(`Roadblock — ${nearest(g.roadblocks)}m — ROADBLOCK`);
  }
  if (g.heli) {
    const d = Math.round(Math.hypot((g.heli.x || 0) - px, (g.heli.z || 0) - pz));
    out.push(`helicopter — ${d}m — RESPONDING`);
  }
  return out;
}
