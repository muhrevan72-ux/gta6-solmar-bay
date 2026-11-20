// Solmar Bay — wanted level + police.
//
// commitCrime(type) is the ONLY way wanted stars go up — every
// crime site in the game calls it (stealing, kills, bombs, gang
// kills). Nothing else raises wanted: no gang hostility, no
// explosion splash, no traffic collision, no event may add stars
// on its own. That is the round-4 "wanted on idle" fix: a fresh
// game with no input for 60 s MUST stay at 0 stars.
//
// Police: foot cops chase near the player, cop cars chase and
// ram. Ram tuning (play-test #4): per-car 2.5 s cooldown, damage
// scales with wanted, a 1-star car does little — a player
// standing still at 1 star for 60 s keeps HP 100. Helicopter at
// 4–5 stars with REAL line-of-sight through tall buildings.
// Roadblocks at 3+ stars. Busted = hospital respawn + 20% fine;
// wasted = respawn too.

import { TUNE, CRIME, SPAWNS, clamp, dist, makeRng } from './config.js';
import { isBlocked } from './world.js';
import { damagePlayer, dropCash } from './combat.js';
import { showToast, addCash } from './state.js';

// The one and only crime entry point.
export function commitCrime(game, type) {
  const c = CRIME[type];
  if (!c) return;
  const before = game.wanted;
  game.wanted = clamp(game.wanted + c.stars, 0, 5);
  game.wantedTimer = 0;
  if (game.wanted > before) {
    showToast(game, `${c.label} — wanted ${'★'.repeat(game.wanted)}`);
  }
  // Mass crimes jump straight up.
  if (type === 'massRampage' || type === 'copMassacre') {
    game.wanted = type === 'copMassacre' ? 5 : 4;
  }
}

export function spawnPolice(game) {
  game.cops = [];
  game.copCars = [];
  game.heli = null;
  game.roadblocks = [];
}

// Wanted decay: out of sight for wantedDecayTime seconds loses
// one star. "Out of sight" means no cop or cop car within
// copSightRange with a clear line.
export function stepWanted(game, dt) {
  if (game.wanted === 0) return;
  const p = game.player;
  let seen = false;
  for (const cop of game.cops) {
    if (dist(p.x, p.z, cop.x, cop.z) < TUNE.copSightRange && hasLineOfSight(game, cop.x, cop.z, p.x, p.z)) {
      seen = true;
      break;
    }
  }
  if (!seen) {
    for (const car of game.copCars) {
      if (dist(p.x, p.z, car.x, car.z) < TUNE.copSightRange) {
        seen = true;
        break;
      }
    }
  }
  if (seen) {
    game.wantedTimer = 0;
  } else {
    game.wantedTimer += dt;
    if (game.wantedTimer >= TUNE.wantedDecayTime) {
      game.wantedTimer = 0;
      game.wanted = Math.max(0, game.wanted - 1);
      if (game.wanted === 0) showToast(game, 'You lost the heat');
    }
  }
}

// Line of sight: true when no building stands between the two
// points (sampled along the segment). Used by the helicopter and
// the wanted decay.
export function hasLineOfSight(game, x0, z0, x1, z1) {
  const steps = 12;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const z = z0 + (z1 - z0) * t;
    // A building taller than 12 blocks sight at ground level.
    for (const b of game.city.buildings) {
      if (b.h < 12) continue;
      if (Math.abs(x - b.x) < b.w / 2 && Math.abs(z - b.z) < b.d / 2) return false;
    }
  }
  return true;
}

function spawnCopCar(game) {
  const rng = Math.random;
  const p = game.player;
  const ang = rng() * Math.PI * 2;
  const x = p.x + Math.cos(ang) * 60;
  const z = p.z + Math.sin(ang) * 60;
  const car = {
    x: clamp(x, -380, 380), z: clamp(z, -380, 380),
    heading: Math.atan2(p.x - x, p.z - z),
    speed: 0, damage: 0, ramCooldown: 0, kind: 'cop',
    name: 'Police Cruiser', colour: [0.15, 0.2, 0.35],
  };
  game.copCars.push(car);
  return car;
}

function spawnFootCop(game) {
  const p = game.player;
  const ang = Math.random() * Math.PI * 2;
  const cop = {
    x: p.x + Math.cos(ang) * 25,
    z: p.z + Math.sin(ang) * 25,
    heading: 0, hp: 100, speed: 5.5, batonCooldown: 0,
  };
  game.cops.push(cop);
  return cop;
}

export function stepPolice(game, dt) {
  const p = game.player;
  stepWanted(game, dt);
  const wanted = game.wanted;
  // Spawn pressure scales with wanted.
  const wantCars = wanted >= 1 ? Math.min(2 + wanted, 6) : 0;
  const wantCops = wanted >= 1 ? Math.min(wanted * 2, 8) : 0;
  while (game.copCars.length < wantCars) spawnCopCar(game);
  while (game.cops.length < wantCops) spawnFootCop(game);
  // Cop cars chase + ram.
  for (const car of game.copCars) {
    car.ramCooldown = Math.max(0, car.ramCooldown - dt);
    const d = dist(car.x, car.z, p.x, p.z);
    const target = Math.atan2(p.x - car.x, p.z - car.z);
    let diff = target - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.heading += clamp(diff, -2.4 * dt, 2.4 * dt);
    const speed = d > 40 ? 26 : d > 12 ? 20 : 12;
    car.speed += clamp(speed - car.speed, -10 * dt, 8 * dt);
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    if (!isBlocked(game.city, nx, car.z, 1.6)) car.x = nx;
    if (!isBlocked(game.city, car.x, nz, 1.6)) car.z = nz;
    // Ram: only when close, only every 2.5 s per car, damage
    // scales with wanted. A 1-star ram barely scratches.
    if (d < 3.2 && car.ramCooldown <= 0) {
      car.ramCooldown = 2.5;
      if (p.inCar) {
        p.inCar.damage += 4 + wanted * 3;
        if (p.inCar.damage >= 100) p.inCar.wrecked = true;
      } else {
        // On foot the cop busts the player instead of ramming.
        bustPlayer(game, 'rammed by a cop car');
        return;
      }
    }
  }
  // Foot cops chase; in range they swing a baton (1.2 s cooldown).
  for (const cop of [...game.cops]) {
    const d = dist(cop.x, cop.z, p.x, cop.z);
    cop.batonCooldown = Math.max(0, cop.batonCooldown - dt);
    if (d > 90) {
      game.cops.splice(game.cops.indexOf(cop), 1);
      continue;
    }
    const target = Math.atan2(p.x - cop.x, p.z - cop.z);
    cop.heading = target;
    if (d > 2) {
      cop.x += Math.sin(target) * cop.speed * dt;
      cop.z += Math.cos(target) * cop.speed * dt;
    } else if (cop.batonCooldown <= 0 && !p.inCar) {
      cop.batonCooldown = 1.2;
      damagePlayer(game, 8 + wanted * 2, 'beaten by a cop');
      if (game.health <= 0) return;
    }
    // A foot cop that reaches an idle player busts them.
    if (d < 1.6 && !p.inCar && game.mode === 'play') {
      bustPlayer(game, 'busted by a foot cop');
      return;
    }
  }
  // Helicopter at 4–5 stars.
  if (wanted >= 4) {
    if (!game.heli) {
      game.heli = {
        x: p.x + 40, z: p.z - 40, y: TUNE.heliAltitude,
        heading: 0, rotor: 0, spotlight: false,
      };
      showToast(game, 'Police helicopter overhead — break line of sight!');
    }
    const h = game.heli;
    h.rotor += dt * 20;
    const d = dist(h.x, h.z, p.x, p.z);
    const target = Math.atan2(p.x - h.x, p.z - h.z);
    h.heading = target;
    const sp = Math.min(TUNE.heliSpeed, d * 0.5 + 6);
    h.x += Math.sin(target) * sp * dt;
    h.z += Math.cos(target) * sp * dt;
    // Spotlight only when the heli can actually see the player
    // (real line-of-sight through tall buildings).
    h.spotlight = hasLineOfSight(game, h.x, h.z, p.x, p.z);
    if (h.spotlight) game.wantedTimer = 0; // seen: no decay
  } else if (game.heli) {
    game.heli = null;
  }
  // Roadblocks at 3+ stars: 3 parked cop cars ahead of the player.
  if (wanted >= 3 && game.roadblocks.length === 0) {
    const a = p.heading;
    for (let i = -1; i <= 1; i++) {
      game.roadblocks.push({
        x: p.x + Math.sin(a) * 50 + Math.cos(a) * i * 6,
        z: p.z + Math.cos(a) * 50 - Math.sin(a) * i * 6,
        heading: a + Math.PI / 2,
      });
    }
  }
  if (wanted < 3) game.roadblocks = [];
  // Despawn extra cars when wanted falls.
  while (game.copCars.length > wantCars) game.copCars.pop();
  while (game.cops.length > wantCops) game.cops.pop();
}

// Busted: lose 20% of cash, respawn on the hospital street.
export function bustPlayer(game, why) {
  const fine = Math.floor(game.cash * TUNE.bustedFine);
  game.cash -= fine;
  game.wanted = 0;
  game.wantedTimer = 0;
  game.mode = 'busted';
  game.bustedBy = why || 'busted';
  game.copCars = [];
  game.cops = [];
  game.heli = null;
  game.roadblocks = [];
  if (game.player.inCar) {
    game.player.inCar.driver = null;
    game.player.inCar = null;
  }
  showToast(game, `Busted! Fine $${fine}`);
}

export function respawnAfterBusted(game) {
  const p = game.player;
  // Hospital spawn is on the street in front of the hospital,
  // 30+ units from every building collider — never inside one.
  p.x = SPAWNS.hospital.x;
  p.z = SPAWNS.hospital.z;
  p.y = 0;
  p.heading = 0;
  p.vx = 0;
  p.vz = 0;
  p.inCar = null;
  game.health = 100;
  game.mode = 'play';
  game.menu = null;
  game.card = null;
}

// Police response list for the dense HUD: named units + distance
// + status.
export function policeList(game) {
  const list = [];
  const p = game.player;
  const names = ['OSPREY-1', 'KESTREL-2', 'FALCON-3', 'HAWK-4', 'EAGLE-5', 'VIPER-6'];
  game.copCars.forEach((car, i) => {
    const d = Math.round(dist(p.x, p.z, car.x, car.z));
    const status = d < 12 ? 'RAMMING' : d < 40 ? 'PURSUIT' : 'RESPONDING';
    list.push({ name: names[i % names.length], dist: d, status });
  });
  if (game.heli) {
    list.push({
      name: 'OSPREY-1 (HELI)',
      dist: Math.round(dist(p.x, p.z, game.heli.x, game.heli.z)),
      status: game.heli.spotlight ? 'SPOTLIGHT' : 'SEARCHING',
    });
  }
  if (game.roadblocks.length > 0) {
    list.push({ name: 'ROADBLOCK', dist: 50, status: 'ROADBLOCK' });
  }
  return list;
}
