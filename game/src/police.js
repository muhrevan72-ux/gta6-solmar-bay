// Solmar Bay — police (rebuild #14).
// Wanted stars drive the response: 1 star foot cops, 2 stars
// interceptors, 3 stars roadblocks, 4 stars the helicopter.
// Cops chase, hold at shooting range, and shoot (2 + wanted
// damage, 2.5 s cooldown). A cop within 1.5 m busts the player.
// Out of sight for 14 s, the heat cools by one star.

import { CRIME, TUNE, SPAWNS } from './config.js';
import { isBlocked, lightState } from './world.js';
import { damagePlayer } from './combat.js';

export function spawnPolice(g) {
  g.cops = [];
  g.copCars = [];
  g.roadblocks = [];
  g.heli = null;
  g.wantedTimer = 0;
  return g.cops;
}

export function commitCrime(g, name) {
  const c = CRIME[name];
  if (!c) return;
  g.wanted = Math.max(g.wanted, c.stars);
  g.wantedTimer = 0;
}

export function stepWanted(g, dt) {
  // A cop within 60 m keeps the heat on; out of sight, it cools.
  let near = false;
  for (const c of g.cops || []) {
    if (Math.hypot(c.x - g.player.x, c.z - g.player.z) < 60) {
      near = true;
      break;
    }
  }
  if (near) {
    g.wantedTimer = 0;
    return;
  }
  g.wantedTimer = (g.wantedTimer || 0) + dt;
  if (g.wantedTimer >= TUNE.wantedDecaySec && g.wanted > 0) {
    g.wanted -= 1;
    g.wantedTimer = 0;
  }
}

// Line of sight: the segment must not cross a building footprint.
export function hasLineOfSight(g, x1, z1, x2, z2) {
  const steps = 24;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = x1 + (x2 - x1) * t;
    const z = z1 + (z2 - z1) * t;
    if (isBlocked(g.city, x, z)) return false;
  }
  return true;
}

function spawnCop(g, x, z) {
  return { x, z, heading: 0, hp: 100, speed: 4.5, shootCd: 0, state: 'chase', id: 'cop' + Math.floor(Math.random() * 1e6) };
}

export function stepPolice(g, dt) {
  if (!g.cops) g.cops = [];
  if (!g.copCars) g.copCars = [];
  if (!g.roadblocks) g.roadblocks = [];
  const w = g.wanted || 0;
  // Foot cops: one per star, up to 3.
  const wantCops = w > 0 ? Math.min(3, w) : 0;
  while (g.cops.length < wantCops) {
    const a = g.rng ? g.rng() * Math.PI * 2 : Math.random() * Math.PI * 2;
    const d = 25 + (g.rng ? g.rng() * 10 : 5);
    g.cops.push(spawnCop(g, g.player.x + Math.sin(a) * d, g.player.z + Math.cos(a) * d));
  }
  while (g.cops.length > wantCops) g.cops.pop();
  // Interceptors: wanted-1, max 3, from 2 stars.
  const wantCars = w >= 2 ? Math.min(3, w - 1) : 0;
  while (g.copCars.length < wantCars) {
    g.copCars.push({ x: g.player.x + 40, z: g.player.z, heading: 0, speed: 12, condition: 100, kind: 'car', name: 'Interceptor', color: [0.1, 0.15, 0.5], driver: 'npc' });
  }
  while (g.copCars.length > wantCars) g.copCars.pop();
  // Roadblocks: wanted-2, from 3 stars.
  const wantBlocks = w >= 3 ? w - 2 : 0;
  while (g.roadblocks.length < wantBlocks) {
    g.roadblocks.push({ x: g.player.x + 30, z: g.player.z + 10 });
  }
  while (g.roadblocks.length > wantBlocks) g.roadblocks.pop();
  // Helicopter at 4+ stars, gone at 0.
  if (w >= 4 && !g.heli) {
    g.heli = { x: g.player.x, z: g.player.z - 40, y: TUNE.heliAltitude, heading: 0 };
  } else if (w === 0) {
    g.heli = null;
  }
  if (g.heli) {
    // The heli circles the player at altitude, advancing its own
    // angle so it moves on every step.
    g.heli.a = (g.heli.a || 0) + dt * 0.5;
    g.heli.x = g.player.x + Math.sin(g.heli.a) * 40;
    g.heli.z = g.player.z + Math.cos(g.heli.a) * 40;
    g.heli.y = TUNE.heliAltitude;
  }
  // Cops act: bust, chase, or shoot.
  const dmg = 2 + w;
  for (const c of g.cops) {
    c.shootCd = Math.max(0, (c.shootCd || 0) - dt);
    const dx = g.player.x - c.x;
    const dz = g.player.z - c.z;
    const d = Math.hypot(dx, dz);
    if (d < 1.5) {
      bustPlayer(g);
      return;
    }
    if (d > 10) {
      // Chase, but do not enter buildings.
      const nx = c.x + (dx / d) * c.speed * dt;
      const nz = c.z + (dz / d) * c.speed * dt;
      if (!isBlocked(g.city, nx, nz)) {
        c.x = nx;
        c.z = nz;
      } else if (!isBlocked(g.city, nx, c.z)) {
        c.x = nx;
      } else if (!isBlocked(g.city, c.x, nz)) {
        c.z = nz;
      }
      c.heading = Math.atan2(dx / d, dz / d);
    } else if (c.shootCd <= 0 && hasLineOfSight(g, c.x, c.z, g.player.x, g.player.z)) {
      // Shoot from range.
      damagePlayer(g, dmg);
      c.shootCd = 2.5;
    }
  }
}

export function bustPlayer(g) {
  const fine = Math.floor(g.cash * 0.2);
  g.cash -= fine;
  g.wanted = 0;
  g.health = 100;
  g.armour = 0;
  g.player.x = SPAWNS.hospital.x;
  g.player.z = SPAWNS.hospital.z;
  g.player.inCar = null;
  g.player.graceTimer = 5;
  g.mode = 'busted';
  g.card = { title: 'BUSTED', text: `You paid a $${fine} fine. Press Enter to continue.` };
}

export function policeList(g) {
  const list = [];
  if ((g.wanted || 0) >= 1 && (g.cops || []).length > 0) list.push('Foot patrol');
  if ((g.wanted || 0) >= 2 && (g.copCars || []).length > 0) list.push('Interceptors');
  if ((g.wanted || 0) >= 3 && (g.roadblocks || []).length > 0) list.push('Roadblocks');
  if ((g.wanted || 0) >= 4 && g.heli) list.push('Police helicopter');
  return list;
}
