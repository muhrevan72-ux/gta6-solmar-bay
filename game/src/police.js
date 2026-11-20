// Solmar Bay — wanted level, police response, busted/wasted.

import { CRIME, TUNE, SPAWNS } from './config.js';
import { isBlocked, lightState } from './world.js';

// Initialise the police state (called by boot and by the test
// harness's makeGame).
export function spawnPolice(g) {
  g.cops = [];
  g.copCars = [];
  g.roadblocks = [];
  g.heli = null;
}

// Commit a crime: the wanted level ADDS the crime's stars, clamped
// at 5. (Kills are different: killTarget uses the MAX, so a kill
// after an assault is 2 stars total, not 3.)
export function commitCrime(g, key) {
  const crime = CRIME[key];
  if (!crime) return;
  g.wanted = Math.min(5, g.wanted + crime.stars);
  g.wantedTimer = 0;
}

// Wanted decays after 14 s out of sight with no cop nearby.
export function stepWanted(g, dt) {
  if (g.wanted <= 0) return;
  const copNear = (g.cops || []).some(c => Math.hypot(c.x - g.player.x, c.z - g.player.z) < 60);
  if (copNear) {
    g.wantedTimer = 0;
    return;
  }
  g.wantedTimer = (g.wantedTimer || 0) + dt;
  if (g.wantedTimer >= 14) {
    g.wanted = Math.max(0, g.wanted - 1);
    g.wantedTimer = 0;
  }
}

// Line of sight: blocked if a building sits between the two points.
export function hasLineOfSight(g, x1, z1, x2, z2) {
  for (const b of g.city.buildings) {
    // Segment-AABB test in 2D (sampled).
    const steps = 20;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = x1 + (x2 - x1) * t;
      const z = z1 + (z2 - z1) * t;
      if (Math.abs(x - b.x) < b.w / 2 && Math.abs(z - b.z) < b.d / 2) return false;
    }
  }
  return true;
}

// Spawn and move the police. Foot cops at 1 star, interceptor cars
// at 2 (wanted-1, max 3), roadblocks at 3 (wanted-2), the helicopter
// at 4+. A cop who touches the player busts them; a cop shooting
// the player to 0 HP wastes them. Foot cops stop at 15 m and shoot
// from there — they never walk into the player (a 60 s soak with
// one cop must hurt but not bust or waste the player).
export function stepPolice(g, dt) {
  if (!g.cops) g.cops = [];
  if (!g.copCars) g.copCars = [];
  if (!Array.isArray(g.roadblocks)) g.roadblocks = [];
  const wanted = g.wanted;
  // Foot cops: 1 per star (up to 4).
  const wantFoot = wanted >= 1 ? Math.min(4, wanted) : 0;
  while (g.cops.length < wantFoot) {
    const a = Math.random() * Math.PI * 2;
    g.cops.push({
      x: g.player.x + Math.cos(a) * 30,
      z: g.player.z + Math.sin(a) * 30,
      heading: 0, hp: 100, shootCd: 0, speed: 6, state: 'chase',
      id: 'cop-' + g.cops.length + '-' + Math.floor(Math.random() * 1e6),
    });
  }
  while (g.cops.length > wantFoot) g.cops.pop();
  // Cop cars: wanted-1, max 3.
  const wantCars = wanted >= 2 ? Math.min(3, wanted - 1) : 0;
  while (g.copCars.length < wantCars) {
    const a = Math.random() * Math.PI * 2;
    g.copCars.push({
      x: g.player.x + Math.cos(a) * 40,
      z: g.player.z + Math.sin(a) * 40,
      heading: 0, speed: 0, kind: 'copcar', condition: 100, driver: null, owned: false,
      colour: [0.1, 0.15, 0.5], name: 'Interceptor',
    });
  }
  while (g.copCars.length > wantCars) g.copCars.pop();
  // Roadblocks: wanted-2 (0 below 3 stars), as an array.
  const wantBlocks = wanted >= 3 ? wanted - 2 : 0;
  while (g.roadblocks.length < wantBlocks) {
    const a = Math.random() * Math.PI * 2;
    g.roadblocks.push({ x: g.player.x + Math.cos(a) * 20, z: g.player.z + Math.sin(a) * 20 });
  }
  while (g.roadblocks.length > wantBlocks) g.roadblocks.pop();
  // Helicopter at 4+.
  if (wanted >= 4) {
    if (!g.heli) g.heli = { x: g.player.x, z: g.player.z, y: TUNE.heliAltitude, angle: 0 };
    g.heli.angle += dt * 0.5;
    g.heli.x = g.player.x + Math.cos(g.heli.angle) * 30;
    g.heli.z = g.player.z + Math.sin(g.heli.angle) * 30;
    g.heli.y = TUNE.heliAltitude;
  } else {
    g.heli = null;
  }
  // Foot cops chase and shoot.
  for (const cop of g.cops) {
    const dx = g.player.x - cop.x;
    const dz = g.player.z - cop.z;
    const d = Math.hypot(dx, dz) || 1;
    if (d < 1.5) {
      bustPlayer(g);
      return;
    }
    // Chase, but stop at 15 m (shooting range) — never touch.
    if (d > 15) {
      const speed = cop.speed || 6;
      cop.x += (dx / d) * speed * dt;
      cop.z += (dz / d) * speed * dt;
    }
    cop.shootCd = Math.max(0, (cop.shootCd || 0) - dt);
    // Cop damage is 2 + wanted per hit, one shot every 2.5 s.
    if (d < 40 && cop.shootCd <= 0 && hasLineOfSight(g, cop.x, cop.z, g.player.x, g.player.z)) {
      cop.shootCd = 2.5;
      const dmg = 2 + wanted;
      // Armour absorbs first; 0 HP means wasted.
      let rest = dmg;
      if (g.armour > 0) {
        const absorbed = Math.min(g.armour, rest);
        g.armour -= absorbed;
        rest -= absorbed;
      }
      g.health -= rest;
      if (g.health <= 0) {
        g.health = 0;
        g.mode = 'wasted';
        g.card = { title: 'WASTED', text: 'The city got the better of you.', reward: 0, respect: 0 };
      }
    }
  }
  // Cop cars chase.
  for (const car of g.copCars) {
    const dx = g.player.x - car.x;
    const dz = g.player.z - car.z;
    const d = Math.hypot(dx, dz) || 1;
    car.heading = Math.atan2(dx, dz);
    car.speed = Math.min(22, car.speed + 8 * dt);
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    if (!isBlocked(g.city, nx, nz)) {
      car.x = nx;
      car.z = nz;
    }
    if (d < 3) {
      bustPlayer(g);
      return;
    }
  }
}

// Busted: 20% fine, wanted cleared, respawn at the hospital.
export function bustPlayer(g) {
  const fine = Math.floor(g.cash * 0.2);
  g.cash -= fine;
  g.wanted = 0;
  g.cops = [];
  g.copCars = [];
  g.roadblocks = [];
  g.heli = null;
  if (g.player.inCar) {
    g.player.inCar.driver = null;
    g.player.inCar = null;
  }
  g.player.x = SPAWNS.hospital.x;
  g.player.z = SPAWNS.hospital.z;
  g.player.heading = 0;
  g.health = 100;
  g.mode = 'busted';
  g.card = { title: 'BUSTED', text: `You paid a $${fine} fine.`, reward: 0, respect: 0 };
}

// What the police are doing right now, for the HUD.
export function policeList(g) {
  const list = [];
  if (g.wanted <= 0) return list;
  list.push('Foot patrol');
  if (g.wanted >= 2) list.push('Interceptors');
  if (g.wanted >= 3) list.push('Roadblocks');
  if (g.wanted >= 4) list.push('helicopter');
  return list;
}
