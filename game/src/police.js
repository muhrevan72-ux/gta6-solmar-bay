// Solmar Bay — police, wanted level, busted/wasted (rebuild #13).
import { isBlocked, isOnRoad } from './world.js';
import { CRIME, TUNE, SPAWNS } from './config.js';
import { damagePlayer } from './combat.js';

export function spawnPolice(g) {
  g.cops = [];
  g.copCars = [];
  g.roadblocks = [];
  g.heli = null;
}

export function commitCrime(g, key) {
  const c = CRIME[key];
  if (!c) return;
  g.wanted = Math.min(5, g.wanted + c.stars);
}

export function stepWanted(g, dt) {
  if (g.wanted <= 0) return;
  const near = g.cops.some((c) => Math.hypot(c.x - g.player.x, c.z - g.player.z) < 60);
  if (near) {
    g.wantedTimer = 0;
    return;
  }
  g.wantedTimer += dt;
  if (g.wantedTimer >= 14) {
    g.wanted -= 1;
    g.wantedTimer = 0;
  }
}

export function hasLineOfSight(g, x1, z1, x2, z2) {
  const d = Math.hypot(x2 - x1, z2 - z1);
  const steps = Math.max(1, Math.ceil(d / 2));
  for (let i = 1; i < steps; i++) {
    const x = x1 + ((x2 - x1) * i) / steps;
    const z = z1 + ((z2 - z1) * i) / steps;
    if (g.city && isBlocked(g.city, x, z)) return false;
  }
  return true;
}

function spawnCop(g) {
  const a = Math.random() * Math.PI * 2;
  const x = g.player.x + Math.sin(a) * 25;
  const z = g.player.z + Math.cos(a) * 25;
  return { x, z, heading: 0, hp: 100, speed: 4.5, shootCd: 0, state: 'chase', id: 'cop' + g.cops.length, isCop: true };
}

export function stepPolice(g, dt) {
  if (g.wanted <= 0) {
    g.cops = [];
    g.copCars = [];
    g.roadblocks = [];
    g.heli = null;
    return;
  }
  // Foot cops: one per star (max 5).
  const wantCops = Math.min(g.wanted, 5);
  while (g.cops.length < wantCops) g.cops.push(spawnCop(g));
  if (g.cops.length > wantCops) g.cops.length = wantCops;
  for (const c of g.cops) {
    const dx = g.player.x - c.x, dz = g.player.z - c.z;
    const d = Math.hypot(dx, dz);
    if (d < 2) {
      bustPlayer(g);
      return;
    }
    if (d > 12) {
      c.x += (dx / d) * c.speed * dt;
      c.z += (dz / d) * c.speed * dt;
      c.heading = Math.atan2(dx, dz);
    } else if (d < 40 && hasLineOfSight(g, c.x, c.z, g.player.x, g.player.z)) {
      c.shootCd -= dt;
      if (c.shootCd <= 0) {
        damagePlayer(g, 2 + g.wanted);
        c.shootCd = 2.5;
      }
    }
  }
  // Cop cars: wanted - 1, max 3.
  const wantCars = Math.min(Math.max(0, g.wanted - 1), 3);
  while (g.copCars.length < wantCars) {
    const a = Math.random() * Math.PI * 2;
    g.copCars.push({
      kind: 'car', x: g.player.x + Math.sin(a) * 30, z: g.player.z + Math.cos(a) * 30,
      heading: 0, colour: [0.1, 0.15, 0.5], name: 'Police Interceptor',
      speed: 12, condition: 100, driver: 'cop', owned: false,
    });
  }
  if (g.copCars.length > wantCars) g.copCars.length = wantCars;
  for (const v of g.copCars) {
    const dx = g.player.x - v.x, dz = g.player.z - v.z;
    const d = Math.hypot(dx, dz);
    if (d > 15) {
      v.heading = Math.atan2(dx, dz);
      v.x += Math.sin(v.heading) * v.speed * dt;
      v.z += Math.cos(v.heading) * v.speed * dt;
    }
  }
  // Roadblocks: wanted - 2.
  const wantBlocks = Math.max(0, g.wanted - 2);
  while (g.roadblocks.length < wantBlocks) {
    g.roadblocks.push({ x: g.player.x + 40 + g.roadblocks.length * 20, z: g.player.z + 20 });
  }
  if (g.roadblocks.length > wantBlocks) g.roadblocks.length = wantBlocks;
  // Helicopter at 4-5 stars: circles the player at altitude 80.
  if (g.wanted >= 4) {
    if (!g.heli) g.heli = { x: g.player.x + 40, z: g.player.z, y: TUNE.heliAltitude, heading: 0 };
    g.heli.heading += dt * 0.5;
    g.heli.x = g.player.x + Math.cos(g.heli.heading) * 40;
    g.heli.z = g.player.z + Math.sin(g.heli.heading) * 40;
    g.heli.y = TUNE.heliAltitude;
  } else {
    g.heli = null;
  }
}

export function bustPlayer(g) {
  const fine = Math.floor(g.cash * 0.2);
  g.cash -= fine;
  g.wanted = 0;
  g.health = 100;
  if (g.player.inCar) {
    g.player.inCar.driver = null;
    g.player.inCar = null;
  }
  g.player.x = SPAWNS.hospital.x;
  g.player.z = SPAWNS.hospital.z;
  g.mode = 'busted';
  g.card = { title: 'BUSTED', text: 'The cops got you. You paid a 20% fine. Press Enter to get back out there.' };
  g._bustedApplied = true;
}

export function policeList(g) {
  const out = [];
  if (g.wanted >= 1 && g.cops.length > 0) out.push(`Foot patrol x${g.cops.length}`);
  if (g.wanted >= 2 && g.copCars.length > 0) out.push(`Interceptors x${g.copCars.length}`);
  if (g.wanted >= 3 && g.roadblocks.length > 0) out.push(`Roadblocks x${g.roadblocks.length}`);
  if (g.heli) out.push('helicopter overhead');
  return out;
}
