// Solmar Bay — wanted level + police. Wanted stars per crime, like
// real GTA: a crime table (CRIME_STARS) maps each crime to the level
// it sets; killing cops and explosions escalate further. Wanted
// decays after hiding out of sight. Busted = hospital + 20% fine.

import { CRIME_STARS, TUNE, COL, clamp, dist } from './config.js';
import { collides } from './world.js';

export function createPolice() {
  const police = {
    cars: [], // cop cars (vehicles with driver 'police', kind 'cop')
    cops: [], // foot cops {x,z,heading,speed,health,alive}
    decayT: 0,
    bustT: 0, // time boxed in by a cop car while slow
    copKills: 0,
    explosionKills: 0,
    spawnT: 0,
  };
  // attach the crime-table entry point so every module can call it
  // as game.police.commitCrime(game, type)
  police.commitCrime = (game, type) => commitCrime(game, type);
  return police;
}

// Set the wanted level for a crime. Escalates for cop kills and
// explosions, caps at 5 stars (GTA V style).
export function commitCrime(game, type) {
  const state = game.state;
  const police = game.police;
  const stars = CRIME_STARS[type] || 1;
  if (stars > state.wanted) state.wanted = stars;
  if (type === 'killCop') {
    police.copKills += 1;
    if (police.copKills >= 3) state.wanted = Math.max(state.wanted, 4);
    if (police.copKills >= 6) state.wanted = 5;
  }
  if (type === 'explosion') {
    police.explosionKills += 1;
    if (police.explosionKills >= 2) state.wanted = Math.max(state.wanted, 4);
  }
  state.wanted = Math.min(5, state.wanted);
  police.decayT = 0;
  ensurePolice(game);
}

function ensurePolice(game) {
  const state = game.state;
  const police = game.police;
  const p = game.player;
  // cop cars: one per star, up to 4
  const wantCars = Math.min(4, state.wanted);
  while (police.cars.length < wantCars) {
    const angle = Math.random() * Math.PI * 2;
    const x = p.x + Math.cos(angle) * 70;
    const z = p.z + Math.sin(angle) * 70;
    const car = {
      kind: 'cop', x: Math.max(-390, Math.min(390, x)), z: Math.max(-390, Math.min(390, z)),
      y: 0, heading: Math.atan2(p.x - x, p.z - z), speed: 0, steer: 0, throttle: 0,
      color: COL.cop, damage: 0, driver: 'police', traffic: false, parked: false,
      lane: -1, wp: 0, dir: 1, pitch: 0, roll: 0, airborne: false, climb: 0, spray: 0,
    };
    police.cars.push(car);
    game.vehicles.list.push(car);
  }
  // foot cops: one per star, up to 4, only when wanted >= 2
  const wantCops = state.wanted >= 2 ? Math.min(4, state.wanted) : 0;
  while (police.cops.length < wantCops) {
    const angle = Math.random() * Math.PI * 2;
    police.cops.push({
      x: p.x + Math.cos(angle) * 25, z: p.z + Math.sin(angle) * 25,
      heading: 0, speed: 0, health: 100, alive: true,
    });
  }
}

function removePolice(game) {
  const police = game.police;
  for (const car of police.cars) {
    const i = game.vehicles.list.indexOf(car);
    if (i >= 0) game.vehicles.list.splice(i, 1);
  }
  police.cars = [];
  police.cops = [];
}

export function getBusted(game, reason) {
  const state = game.state;
  state.bustedReason = reason;
  state.mode = 'busted';
  const fine = Math.floor(state.cash * TUNE.bustedFine);
  state.cash -= fine;
  removePolice(game);
  state.wanted = 0;
}

export function updatePolice(dt, game) {
  const state = game.state;
  const police = game.police;
  const p = game.player;
  if (state.wanted <= 0) {
    if (police.cars.length > 0 || police.cops.length > 0) removePolice(game);
    return;
  }
  ensurePolice(game);
  police.spawnT -= dt;

  // cop cars chase the player (or the player's car)
  const target = p.inVehicle || p;
  for (const car of police.cars) {
    if (car.damage >= 100) continue;
    const want = Math.atan2(target.x - car.x, target.z - car.z);
    let diff = want - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.heading += clamp(diff, -2.2 * dt, 2.2 * dt);
    const wantSpeed = 14 + state.wanted * 3;
    car.speed += (wantSpeed - car.speed) * Math.min(1, 2 * dt);
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    if (!collides(game.city, nx, nz, 1.7)) { car.x = nx; car.z = nz; }
    else car.speed *= 0.5;
    // ram the player
    const d = dist(car.x, car.z, p.x, p.z);
    if (d < 3.2 && !p.inVehicle) {
      if (game.hurtPlayer) game.hurtPlayer(8 * dt * 10, 'cop');
    } else if (d < 4 && p.inVehicle) {
      p.inVehicle.damage += 12 * dt;
    }
    // boxed in while slow = busted
    if (d < 5 && (!p.inVehicle || Math.abs(p.inVehicle.speed) < 2)) {
      police.bustT += dt;
      if (police.bustT > 3) { getBusted(game, 'Busted by the police'); return; }
    } else {
      police.bustT = 0;
    }
  }

  // foot cops chase on foot and punch up close
  for (const cop of police.cops) {
    if (!cop.alive) continue;
    const d = dist(cop.x, cop.z, p.x, p.z);
    if (p.inVehicle) {
      // run toward the player's car
      const want = Math.atan2(p.x - cop.x, p.z - cop.z);
      cop.heading = want;
      cop.x += Math.sin(want) * 7 * dt;
      cop.z += Math.cos(want) * 7 * dt;
      continue;
    }
    const want = Math.atan2(p.x - cop.x, p.z - cop.z);
    cop.heading = want;
    if (d > 2.2) {
      cop.x += Math.sin(want) * 6.5 * dt;
      cop.z += Math.cos(want) * 6.5 * dt;
    } else if (game.hurtPlayer) {
      game.hurtPlayer(10 * dt, 'cop');
    }
  }

  // wanted decays after hiding out of sight (no cop within 60 units)
  let nearest = Infinity;
  for (const car of police.cars) nearest = Math.min(nearest, dist(car.x, car.z, p.x, p.z));
  for (const cop of police.cops) {
    if (cop.alive) nearest = Math.min(nearest, dist(cop.x, cop.z, p.x, p.z));
  }
  if (nearest > 60) {
    police.decayT += dt;
    if (police.decayT >= TUNE.wantedDecayTime) {
      police.decayT = 0;
      state.wanted -= 1;
      if (state.wanted <= 0) {
        state.wanted = 0;
        removePolice(game);
      }
    }
  } else {
    police.decayT = 0;
  }
}

export function drawPolice(renderer, game) {
  for (const cop of game.police.cops) {
    if (!cop.alive) continue;
    const bob = Math.sin(game.time * 7) * 0.05;
    renderer.box(cop.x, 0.4 + bob, cop.z, 0.45, 0.8, 0.45, [0.15, 0.2, 0.5], 1, cop.heading, 0, 0);
    renderer.box(cop.x, 1.15 + bob, cop.z, 0.9, 0.75, 0.5, [0.15, 0.25, 0.85], 1, cop.heading, 0, 0);
    renderer.box(cop.x, 1.8 + bob, cop.z, 0.55, 0.55, 0.55, [0.92, 0.75, 0.6], 1, cop.heading, 0, 0);
    renderer.box(cop.x, 2.15 + bob, cop.z, 0.6, 0.2, 0.6, [0.1, 0.15, 0.5], 1, cop.heading, 0, 0);
  }
}
