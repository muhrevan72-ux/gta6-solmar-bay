// Solmar Bay — the police.
//
// Wanted is MAX-based (commitCrime never lowers it). Foot cops chase
// and shoot; cop cars, roadblocks and the helicopter join as the heat
// rises. Out of sight for 14 s loses a star. A cop that reaches the
// player busts them — the tuning test proves a stationary player at
// 1 star survives 60 s with real damage (3 shots x 3 HP = 91).

import { CRIME, TUNE, SPAWNS, COL } from './config.js';
import { isBlocked } from './world.js';
import { makeVehicle } from './vehicles.js';
import { damagePlayer } from './combat.js';

export function spawnPolice(g) {
  g.cops = [];
  g.copCars = [];
  g.roadblocks = [];
  g.heli = null;
  g.wantedTimer = 0;
}

// Wanted only ever rises here (MAX-based) and clamps at 5 stars.
// An unknown key changes nothing. `override` forces a star count.
export function commitCrime(g, key, override) {
  if (override !== undefined && override !== null) {
    g.wanted = Math.max(0, Math.min(5, override));
    return;
  }
  const crime = CRIME[key];
  if (!crime) return;
  g.wanted = Math.max(g.wanted, Math.min(5, crime.stars));
}

// Lose a star after 14 s out of sight; a cop within 60 m blocks it.
export function stepWanted(g, dt) {
  if (g.wanted <= 0) { g.wantedTimer = 0; return; }
  const seen = (g.cops || []).some((c) => Math.hypot(c.x - g.player.x, c.z - g.player.z) < TUNE.sightRange);
  if (seen) { g.wantedTimer = 0; return; }
  g.wantedTimer = (g.wantedTimer || 0) + dt;
  if (g.wantedTimer >= TUNE.wantedDecaySec) {
    g.wanted = Math.max(0, g.wanted - 1);
    g.wantedTimer = 0;
  }
}

// Is the straight line clear? Sampled every 2 m; a building blocks.
export function hasLineOfSight(g, x1, z1, x2, z2) {
  if (!g.city) return true;
  const d = Math.hypot(x2 - x1, z2 - z1);
  const steps = Math.max(1, Math.ceil(d / 2));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (isBlocked(g.city, x1 + (x2 - x1) * t, z1 + (z2 - z1) * t)) return false;
  }
  return true;
}

function spawnFootCop(g) {
  const a = Math.random() * Math.PI * 2;
  const x = g.player.x + Math.cos(a) * 25;
  const z = g.player.z + Math.sin(a) * 25;
  return { x, z, heading: 0, hp: 100, speed: 6, shootCd: 0, state: 'chase', id: `cop-${Date.now()}-${Math.floor(Math.random() * 1e6)}` };
}

export function stepPolice(g, dt) {
  if (g.mode === 'busted' || g.mode === 'wasted') return;
  const wanted = g.wanted || 0;
  // Scale the response to the heat.
  const footTarget = Math.min(wanted, 3);
  const carTarget = wanted >= 2 ? Math.min(3, wanted - 1) : 0;
  const blockTarget = wanted >= 3 ? Math.min(3, wanted - 2) : 0;
  if (wanted === 0) {
    g.cops = [];
    g.copCars = [];
    g.roadblocks = [];
    g.heli = null;
    return;
  }
  while (g.cops.length < footTarget) g.cops.push(spawnFootCop(g));
  if (g.cops.length > footTarget) g.cops.length = footTarget;
  while (g.copCars.length < carTarget) {
    const a = Math.random() * Math.PI * 2;
    const car = makeVehicle('car', g.player.x + Math.cos(a) * 30, g.player.z + Math.sin(a) * 30, 0, COL.copNavy, 'Interceptor');
    car.driver = 'cop';
    car.speed = 12;
    g.copCars.push(car);
  }
  if (g.copCars.length > carTarget) g.copCars.length = carTarget;
  while (g.roadblocks.length < blockTarget) {
    const a = Math.random() * Math.PI * 2;
    g.roadblocks.push({ x: g.player.x + Math.cos(a) * 20, z: g.player.z + Math.sin(a) * 20 });
  }
  if (g.roadblocks.length > blockTarget) g.roadblocks.length = blockTarget;
  if (wanted >= 4) {
    if (!g.heli) g.heli = { x: g.player.x + 40, z: g.player.z, y: TUNE.heliAltitude, heading: 0 };
  } else {
    g.heli = null;
  }

  // Foot cops: chase, shoot inside 30 m with a clear line, bust at 2 m.
  for (const cop of g.cops) {
    cop.shootCd = Math.max(0, (cop.shootCd || 0) - dt);
    const dx = g.player.x - cop.x;
    const dz = g.player.z - cop.z;
    const d = Math.hypot(dx, dz);
    if (d < TUNE.copBustRange) {
      g.mode = 'busted';
      return;
    }
    if (d < TUNE.copShootRange && cop.shootCd <= 0 && hasLineOfSight(g, cop.x, cop.z, g.player.x, g.player.z)) {
      damagePlayer(g, 2 + wanted);
      cop.shootCd = 2;
    }
    if (d > 0.01) {
      const step = Math.min(d, (cop.speed || 6) * dt);
      cop.x += (dx / d) * step;
      cop.z += (dz / d) * step;
      cop.heading = Math.atan2(dx / d, dz / d);
    }
  }
  // Interceptors close in on the player.
  for (const car of g.copCars) {
    const dx = g.player.x - car.x;
    const dz = g.player.z - car.z;
    const d = Math.hypot(dx, dz);
    if (d > 5 && d > 0.01) {
      const step = Math.min(d - 5, 12 * dt);
      car.x += (dx / d) * step;
      car.z += (dz / d) * step;
      car.heading = Math.atan2(dx / d, dz / d);
    }
  }
  // The helicopter circles overhead.
  if (g.heli) {
    g.heli.heading += dt * 0.5;
    g.heli.x = g.player.x + Math.cos(g.heli.heading) * 40;
    g.heli.z = g.player.z + Math.sin(g.heli.heading) * 40;
    g.heli.y = TUNE.heliAltitude;
  }
}

// Busted: a 20% fine, wanted cleared, health restored, back at the
// hospital on foot.
export function bustPlayer(g) {
  const fine = Math.floor((g.cash || 0) * 0.2);
  g.cash = Math.max(0, (g.cash || 0) - fine);
  g.wanted = 0;
  g.wantedTimer = 0;
  g.health = 100;
  g.player.health = 100;
  g.player.x = SPAWNS.hospital.x;
  g.player.z = SPAWNS.hospital.z;
  g.player.y = 0;
  g.player.inCar = null;
  g.cops = [];
  g.copCars = [];
  g.roadblocks = [];
  g.heli = null;
  g.mode = 'play';
}

export function policeList(g) {
  const out = [];
  if (g.cops && g.cops.length > 0) out.push(`Foot patrol x${g.cops.length}`);
  if (g.copCars && g.copCars.length > 0) out.push(`Interceptors x${g.copCars.length}`);
  if (g.roadblocks && g.roadblocks.length > 0) out.push(`Roadblock x${g.roadblocks.length}`);
  if (g.heli) out.push('Police helicopter');
  return out;
}
