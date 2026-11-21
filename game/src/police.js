// Solmar Bay — police, wanted stars, busts, roadblocks, helicopter.
// Written fresh for rebuild #18.

import { CRIME, TUNE, COL } from './config.js';
import { isBlocked } from './world.js';
import { pushBox, pushBoxRot } from './render.js';

export function spawnPolice(g) {
  g.cops = [];
  g.copCars = [];
  g.roadblocks = [];
  g.heli = null;
  g.wantedTimer = 0;
  return g.cops;
}

export function commitCrime(g, key) {
  const c = CRIME[key];
  if (!c) return;
  g.wanted = Math.max(g.wanted, c.stars);
}

// Line of sight: blocked only by a building between the two points.
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

// A cop touching the player busts them (unless the player is in a
// car, where the cop just keeps chasing).
export function bustPlayer(g) {
  const fine = Math.floor(g.cash * 0.2);
  g.cash = Math.max(0, g.cash - fine);
  g.wanted = 0;
  g.health = 100;
  g.player.x = -150;
  g.player.z = 100;
  g.player.inCar = null;
  g.mode = 'play';
  return fine;
}

function ensureCops(g) {
  const wanted = g.wanted;
  // Foot cops: 1 at 1 star, more as the heat rises.
  const wantFoot = wanted >= 1 ? Math.min(wanted, 4) : 0;
  while (g.cops.length < wantFoot) {
    g.cops.push({
      x: g.player.x + 10 + Math.random() * 20,
      z: g.player.z + 10 + Math.random() * 20,
      hp: 100, shootCd: 2 + Math.random(),
    });
  }
  while (g.cops.length > wantFoot) g.cops.pop();
  // Cop cars: wanted - 1, capped at 3.
  const wantCars = wanted >= 2 ? Math.min(wanted - 1, 3) : 0;
  while (g.copCars.length < wantCars) {
    g.copCars.push({
      x: g.player.x + 15, z: g.player.z + 15,
      heading: 0, speed: 14, hp: 200,
    });
  }
  while (g.copCars.length > wantCars) g.copCars.pop();
  // Roadblocks: wanted - 2, from 3 stars up.
  const wantBlocks = wanted >= 3 ? wanted - 2 : 0;
  while (g.roadblocks.length < wantBlocks) {
    g.roadblocks.push({
      x: g.player.x + 25, z: g.player.z,
      heading: 0,
    });
  }
  while (g.roadblocks.length > wantBlocks) g.roadblocks.pop();
  // Helicopter from 4 stars up.
  if (wanted >= 4 && !g.heli) {
    g.heli = { x: g.player.x + 30, z: g.player.z, y: TUNE.heliAltitude, angle: 0 };
  }
  if (wanted < 4) g.heli = null;
}

export function stepPolice(g, dt) {
  ensureCops(g);
  const dmg = 2 + g.wanted;
  for (const cop of g.cops) {
    // Chase the player but hold at ~3 m and shoot from there
    // (closing to under 2 m is what busts the player).
    const dx = g.player.x - cop.x, dz = g.player.z - cop.z;
    const d = Math.hypot(dx, dz) || 1;
    const speed = g.player.inCar ? 10 : 5;
    if (d > 3) {
      cop.x += (dx / d) * speed * dt;
      cop.z += (dz / d) * speed * dt;
    }
    // Touching the player on foot = busted (the busted screen
    // shows; Enter on it applies the fine and respawns).
    if (d < 2 && !g.player.inCar) {
      g.mode = 'busted';
      return;
    }
    // Shoot when in range and in line of sight.
    cop.shootCd -= dt;
    if (cop.shootCd <= 0 && d < 60 && hasLineOfSight(g, cop.x, cop.z, g.player.x, g.player.z)) {
      cop.shootCd = 2 + Math.random();
      damagePlayer(g, dmg);
      if (g.health <= 0) {
        g.mode = 'wasted';
        return;
      }
    }
  }
  for (const car of g.copCars) {
    const dx = g.player.x - car.x, dz = g.player.z - car.z;
    const d = Math.hypot(dx, dz) || 1;
    car.heading = Math.atan2(dx, dz);
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    if (d < 3 && !g.player.inCar) {
      g.mode = 'busted';
      return;
    }
  }
  if (g.heli) {
    g.heli.angle += dt * 0.4;
    g.heli.x = g.player.x + Math.cos(g.heli.angle) * 30;
    g.heli.z = g.player.z + Math.sin(g.heli.angle) * 30;
    g.heli.y = TUNE.heliAltitude;
  }
}

// Wanted decays after 14 s out of sight (a cop nearby prevents it).
export function stepWanted(g, dt) {
  if (g.wanted <= 0) { g.wantedTimer = 0; return; }
  let seen = false;
  for (const cop of g.cops) {
    if (Math.hypot(cop.x - g.player.x, cop.z - g.player.z) < 60) { seen = true; break; }
  }
  if (!seen) {
    for (const car of g.copCars) {
      if (Math.hypot(car.x - g.player.x, car.z - g.player.z) < 60) { seen = true; break; }
    }
  }
  if (seen) { g.wantedTimer = 0; return; }
  g.wantedTimer += dt;
  if (g.wantedTimer >= 14) {
    g.wantedTimer = 0;
    g.wanted = Math.max(0, g.wanted - 1);
  }
}

// Armour absorbs damage first; 0 HP = wasted.
export function damagePlayer(g, amount) {
  let a = amount;
  if (g.armour > 0) {
    const absorbed = Math.min(g.armour, a);
    g.armour -= absorbed;
    a -= absorbed;
  }
  g.health = Math.max(0, g.health - a);
  if (g.health <= 0) g.mode = 'wasted';
}

export function policeList(g) {
  // One entry per response type (not one per unit).
  const list = [];
  if (g.wanted >= 1 && g.cops.length > 0) list.push('Foot patrol');
  if (g.wanted >= 2 && g.copCars.length > 0) list.push('Interceptors');
  if (g.wanted >= 3 && g.roadblocks.length > 0) list.push('Roadblock');
  if (g.heli) list.push('Police helicopter');
  return list;
}

// Draw one cop (7 boxes) or a cop car into the batch.
export function copBoxes(g, cop, b, gl) {
  const skin = [0.85, 0.65, 0.5];
  const navy = COL.copNavy;
  pushBox(b, cop.x - 0.12, 0, cop.z, 0.22, 0.85, 0.22, navy, [0, 0, 1, 1]);
  pushBox(b, cop.x + 0.12, 0, cop.z, 0.22, 0.85, 0.22, navy, [0, 0, 1, 1]);
  pushBox(b, cop.x, 0.85, cop.z, 0.65, 0.65, 0.35, navy, [0, 0, 1, 1]);
  pushBox(b, cop.x - 0.42, 0.9, cop.z, 0.18, 0.55, 0.18, navy, [0, 0, 1, 1]);
  pushBox(b, cop.x + 0.42, 0.9, cop.z, 0.18, 0.55, 0.18, navy, [0, 0, 1, 1]);
  pushBox(b, cop.x, 1.5, cop.z, 0.34, 0.34, 0.34, skin, [0, 0, 1, 1]);
  pushBox(b, cop.x, 1.82, cop.z, 0.36, 0.1, 0.36, navy, [0, 0, 1, 1]);
  return 7;
}

export function copCarBoxes(g, car, b, gl) {
  pushBoxRot(b, car.x, 0.35, car.z, 2.4, 0.9, 5.0, car.heading, [0.1, 0.1, 0.12], [0, 0, 1, 1]);
  pushBoxRot(b, car.x, 1.25, car.z - 0.3, 2.0, 0.7, 2.6, car.heading, COL.cabinSilver, [0, 0, 1, 1]);
  pushBoxRot(b, car.x, 1.25, car.z + 0.5, 2.0, 0.3, 1.0, car.heading, COL.copNavy, [0, 0, 1, 1]);
  return 3;
}

export function heliBoxes(g, b, gl) {
  if (!g.heli) return 0;
  const h = g.heli;
  pushBox(b, h.x, h.y, h.z, 2.0, 1.2, 4.5, COL.copNavy, [0, 0, 1, 1]);
  pushBox(b, h.x, h.y + 1.2, h.z, 6.0, 0.15, 0.4, [0.2, 0.2, 0.2], [0, 0, 1, 1]);
  pushBox(b, h.x, h.y + 0.3, h.z - 2.5, 0.4, 0.4, 2.0, COL.copNavy, [0, 0, 1, 1]);
  return 3;
}
