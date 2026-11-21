// Solmar Bay — police and the wanted system.
//
// Wanted stars bring a response: foot patrol at 1 star, interceptors
// at 2, roadblocks at 3, a helicopter at 4. Cops chase on foot and
// shoot from a distance (they hold off at 10 m and never walk into
// the player by accident); touching the player busts them. Out of
// sight for 14 seconds, one star fades.

import { TUNE, CRIME, SPAWNS } from './config.js';
import { hasLineOfSight as losCheck } from './world.js';
import { damagePlayer } from './combat.js';
import { pushBox } from './render.js';

export function hasLineOfSight(g, x1, z1, x2, z2) {
  // Accept either four numbers or two {x, z} points.
  if (typeof x1 === 'object') {
    return losCheck(g.city, x1.x, x1.z, z1.x, z1.z);
  }
  return losCheck(g.city, x1, z1, x2, z2);
}

export function commitCrime(g, type) {
  const crime = CRIME[type];
  if (!crime) return g.wanted;
  g.wanted = Math.min(5, g.wanted + crime.stars);
  return g.wanted;
}

export function spawnPolice(g) {
  g.cops = [];
  g.copCars = [];
  g.roadblocks = [];
  g.heli = null;
  g._wantedTimer = 0;
  return g.cops;
}

function spawnCop(g) {
  const p = g.player;
  const angle = Math.random() * Math.PI * 2;
  const dist = 40 + Math.random() * 20;
  return {
    x: p.x + Math.cos(angle) * dist,
    z: p.z + Math.sin(angle) * dist,
    heading: 0,
    speed: TUNE.copSpeed,
    shootCd: 0,
    hp: 100,
    state: 'chase',
    id: g.cops.length + 1,
  };
}

function spawnCopCar(g) {
  const p = g.player;
  const angle = Math.random() * Math.PI * 2;
  const dist = 50 + Math.random() * 20;
  return {
    x: p.x + Math.cos(angle) * dist,
    z: p.z + Math.sin(angle) * dist,
    heading: 0,
    speed: 14,
    hp: 100,
    id: g.copCars.length + 1,
  };
}

export function stepWanted(g, dt) {
  if (g.wanted <= 0) {
    g._wantedTimer = 0;
    return;
  }
  // A cop that can see the player (within 60 m, line of sight clear)
  // keeps the heat on. A cop within ~5 m always counts as seeing.
  let seen = false;
  for (const cop of g.cops) {
    const d = Math.hypot(cop.x - g.player.x, cop.z - g.player.z);
    if (d < 5) { seen = true; break; }
    if (d <= 60 && hasLineOfSight(g, cop.x, cop.z, g.player.x, g.player.z)) {
      seen = true;
      break;
    }
  }
  if (seen) {
    g._wantedTimer = 0;
    return;
  }
  g._wantedTimer = (g._wantedTimer || 0) + dt;
  if (g._wantedTimer >= 14) {
    g.wanted = Math.max(0, g.wanted - 1);
    g._wantedTimer = 0;
  }
}

export function stepPolice(g, dt) {
  const p = g.player;
  const wanted = g.wanted;

  // Scale the response to the wanted level.
  const wantCops = wanted >= 1 ? Math.min(wanted, 5) : 0;
  const wantCars = wanted >= 2 ? Math.min(wanted - 1, 3) : 0;
  const wantBlocks = wanted >= 3 ? Math.min(wanted - 2, 3) : 0;
  while (g.cops.length < wantCops) g.cops.push(spawnCop(g));
  while (g.cops.length > wantCops) g.cops.pop();
  while (g.copCars.length < wantCars) g.copCars.push(spawnCopCar(g));
  while (g.copCars.length > wantCars) g.copCars.pop();
  while (g.roadblocks.length < wantBlocks) {
    g.roadblocks.push({
      x: p.x + Math.sin(p.heading || 0) * 30,
      z: p.z + Math.cos(p.heading || 0) * 30,
    });
  }
  while (g.roadblocks.length > wantBlocks) g.roadblocks.pop();
  if (wanted >= 4 && !g.heli) {
    g.heli = { x: p.x + 40, z: p.z, y: TUNE.heliAltitude, angle: 0 };
  }
  if (wanted < 4) g.heli = null;

  // Foot cops: chase, hold at 10 m, shoot when they have a line of sight.
  for (const cop of g.cops) {
    const dx = p.x - cop.x;
    const dz = p.z - cop.z;
    const d = Math.hypot(dx, dz);
    cop.heading = Math.atan2(dx, dz);
    if (d > 10) {
      const step = Math.min(d - 10, cop.speed * dt);
      cop.x += (dx / d) * step;
      cop.z += (dz / d) * step;
    }
    if (d <= 2) {
      // Caught: busted.
      g.mode = 'busted';
      g.card = {
        title: 'BUSTED',
        text: 'The Solmar Bay PD caught up with you. The law always wins — this time.',
        hint: 'Press Enter to continue',
      };
      return;
    }
    cop.shootCd = Math.max(0, (cop.shootCd || 0) - dt);
    if (d <= 60 && cop.shootCd <= 0 && hasLineOfSight(g, cop.x, cop.z, p.x, p.z)) {
      damagePlayer(g, 2 + wanted);
      cop.shootCd = 2;
      if (g.audio) g.audio.sfx('shoot');
    }
  }

  // Interceptors close in and hold at 10 m.
  for (const car of g.copCars) {
    const dx = p.x - car.x;
    const dz = p.z - car.z;
    const d = Math.hypot(dx, dz);
    if (d > 10) {
      const step = Math.min(d - 10, car.speed * dt);
      car.x += (dx / d) * step;
      car.z += (dz / d) * step;
    }
  }

  // Helicopter circles the player at altitude.
  if (g.heli) {
    g.heli.angle = (g.heli.angle || 0) + dt * 0.3;
    g.heli.x = p.x + Math.cos(g.heli.angle) * 40;
    g.heli.z = p.z + Math.sin(g.heli.angle) * 40;
    g.heli.y = TUNE.heliAltitude;
  }
}

// Pay the price: a 20% fine, wanted cleared, health restored, and a
// fresh start at the hospital. Used when the player presses Enter on
// the busted or wasted screen.
export function bustPlayer(g) {
  g.cash = Math.floor(g.cash * 0.8);
  g.wanted = 0;
  g.health = 100;
  g.armour = 0;
  const p = g.player;
  if (p.inCar) {
    p.inCar.driver = null;
    p.inCar = null;
  }
  p.x = SPAWNS.hospital.x;
  p.z = SPAWNS.hospital.z;
  p.speed = 0;
  g.cops = [];
  g.copCars = [];
  g.roadblocks = [];
  g.heli = null;
  g.mode = 'play';
  g.card = null;
  g._wantedTimer = 0;
  return g;
}

export function policeList(g) {
  const list = [];
  if (g.wanted >= 1 || g.cops.length > 0) list.push('Foot patrol');
  if (g.wanted >= 2 || g.copCars.length > 0) list.push('Interceptors');
  if (g.wanted >= 3 || g.roadblocks.length > 0) list.push('Roadblocks');
  if (g.wanted >= 4 || g.heli) list.push('Police helicopter');
  return list;
}

// A foot cop in navy, with a cap: legs, torso, arms, head, cap.
export function policeBoxes(g, cop, b, cam) {
  const plain = [0, 0, 1, 1];
  const navy = [0.1, 0.15, 0.5];
  const skin = [0.85, 0.65, 0.5];
  pushBox(b, cop.x - 0.1, 0, cop.z, 0.15, 0.8, 0.15, navy, plain);
  pushBox(b, cop.x + 0.1, 0, cop.z, 0.15, 0.8, 0.15, navy, plain);
  pushBox(b, cop.x, 0.8, cop.z, 0.5, 0.55, 0.3, navy, plain);
  pushBox(b, cop.x - 0.32, 0.85, cop.z, 0.13, 0.5, 0.13, navy, plain);
  pushBox(b, cop.x + 0.32, 0.85, cop.z, 0.13, 0.5, 0.13, navy, plain);
  pushBox(b, cop.x, 1.35, cop.z, 0.32, 0.3, 0.3, skin, plain);
  pushBox(b, cop.x, 1.62, cop.z, 0.36, 0.1, 0.34, navy, plain);
  return 7;
}

// A roadblock: striped barrier plus cones.
export function roadblockBoxes(g, rb, b, cam) {
  const plain = [0, 0, 1, 1];
  pushBox(b, rb.x, 0.5, rb.z, 4, 0.5, 0.4, [0.95, 0.75, 0.1], plain);
  pushBox(b, rb.x - 2.5, 0, rb.z, 0.4, 1, 0.4, [0.9, 0.3, 0.1], plain);
  pushBox(b, rb.x + 2.5, 0, rb.z, 0.4, 1, 0.4, [0.9, 0.3, 0.1], plain);
  return 3;
}

// The police helicopter: body, tail, rotor.
export function heliBoxes(g, b, cam) {
  if (!g.heli) return 0;
  const plain = [0, 0, 1, 1];
  const h = g.heli;
  pushBox(b, h.x, h.y, h.z, 2.4, 1.6, 3.2, [0.1, 0.15, 0.5], plain);
  pushBox(b, h.x, h.y + 0.3, h.z - 3, 0.6, 0.6, 3, [0.1, 0.15, 0.5], plain);
  pushBox(b, h.x, h.y + 1, h.z, 7, 0.1, 0.4, [0.2, 0.2, 0.25], plain);
  return 3;
}
