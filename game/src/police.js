// Solmar Bay — wanted level + police. GTA-style crime table:
// every crime in the game calls commitCrime(type), which sets the
// wanted stars. Cops chase in cars and on foot; wanted decays when
// the player is out of sight for 14 seconds. Busted = hospital
// respawn + 20% cash fine.
//
// REQUIRED (round-4 play-test): ONLY the player's own crimes raise
// wanted. Idling, gang hostility, explosions the player did not
// cause and traffic collisions never call commitCrime.

import { TUNE, CRIME, clamp, angleLerp, dist2 } from './config.js';
import { collideCircle } from './world.js';
import { spawnVehicle } from './vehicles.js';

export function createPolice() {
  const police = {
    copCars: [],
    footCops: [],
    copKills: 0,
    explosionKills: 0,
    decayT: 0,
    spawnT: 0,
    busted: false,
  };
  police.commitCrime = (game, type) => commitCrime(game, type);
  return police;
}

// Set the wanted level for a crime. Escalates for cop kills and
// multiple explosion kills; caps at 5 stars.
export function commitCrime(game, type) {
  const state = game.state;
  const police = game.police;
  const entry = CRIME[type];
  if (!entry) return;
  let stars = entry.stars;
  if (type === 'killCop') {
    police.copKills += 1;
    if (police.copKills >= 3) stars = Math.max(stars, 4);
    if (police.copKills >= 6) stars = 5;
  }
  if (type === 'explosion') {
    police.explosionKills += 1;
    if (police.explosionKills >= 2) stars = Math.max(stars, 4);
  }
  if (stars > state.wanted) state.wanted = stars;
  state.wanted = Math.min(5, state.wanted);
  police.decayT = 0;
  if (game.hud) game.hud.flashWanted();
}

export function updatePolice(game, dt) {
  const state = game.state;
  const police = game.police;
  const player = game.player;
  if (state.wanted <= 0) {
    police.decayT = 0;
    // clear cops when the heat is gone
    if (police.copCars.length || police.footCops.length) {
      police.copCars = [];
      police.footCops = [];
    }
    return;
  }

  // wanted decays after hiding out of sight (no cop within 60 units)
  let nearestCop = Infinity;
  for (const c of police.copCars) nearestCop = Math.min(nearestCop, Math.hypot(c.x - player.x, c.z - player.z));
  for (const c of police.footCops) nearestCop = Math.min(nearestCop, Math.hypot(c.x - player.x, c.z - player.z));
  if (nearestCop > TUNE.copSightRange) {
    police.decayT += dt;
    if (police.decayT >= TUNE.wantedDecayTime) {
      police.decayT = 0;
      state.wanted -= 1;
      if (state.wanted <= 0) {
        state.wanted = 0;
        police.copCars = [];
        police.footCops = [];
      }
    }
  } else {
    police.decayT = 0;
  }

  // spawn cop cars: one per star, up to 4
  const wantCars = Math.min(4, state.wanted);
  police.spawnT -= dt;
  if (police.copCars.length < wantCars && police.spawnT <= 0) {
    police.spawnT = 2;
    const angle = Math.random() * Math.PI * 2;
    const x = player.x + Math.sin(angle) * 60;
    const z = player.z + Math.cos(angle) * 60;
    const car = spawnVehicle(game.vehicles, 'police', clamp(x, -380, 380), clamp(z, -380, 380), angle, [0.1, 0.15, 0.25]);
    car.driver = 'cop';
    police.copCars.push(car);
    if (game.audio) game.audio.play('siren');
  }
  // foot cops: one per star, up to 4, only when wanted >= 2
  const wantCops = state.wanted >= 2 ? Math.min(4, state.wanted) : 0;
  if (police.footCops.length < wantCops && police.spawnT <= 0) {
    police.spawnT = 2;
    const angle = Math.random() * Math.PI * 2;
    police.footCops.push({
      x: player.x + Math.sin(angle) * 25,
      z: player.z + Math.cos(angle) * 25,
      heading: angle,
      speed: 7,
    });
  }

  // cop cars chase the player
  const wantSpeed = 14 + state.wanted * 3;
  for (const car of police.copCars) {
    const desired = Math.atan2(player.x - car.x, player.z - car.z);
    car.heading = angleLerp(car.heading, desired, 1 - Math.pow(0.001, dt));
    car.speed = Math.min(wantSpeed, car.speed + 12 * dt);
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    const fixed = collideCircle(game.city, nx, nz, 2.2);
    car.x = fixed.x;
    car.z = fixed.z;
    // ram: if the cop car touches the player, damage + bust check
    if (dist2(car.x, car.z, player.x, player.z) < 9) {
      if (game.combat) game.combat.damagePlayer(game, 12 * dt);
      if (player.inVehicle && Math.hypot(car.speed - (player.inVehicle.speed || 0)) > 8) {
        // boxed in while slow: busted
        if (Math.abs(player.speed) < 2 && state.wanted >= 3) {
          bustPlayer(game, 'boxed in by the police');
        }
      }
    }
  }

  // foot cops chase and baton the player
  for (const cop of police.footCops) {
    const d = Math.hypot(player.x - cop.x, player.z - cop.z);
    const desired = Math.atan2(player.x - cop.x, player.z - cop.z);
    cop.heading = angleLerp(cop.heading, desired, 1 - Math.pow(0.001, dt));
    const nx = cop.x + Math.sin(cop.heading) * cop.speed * dt;
    const nz = cop.z + Math.cos(cop.heading) * cop.speed * dt;
    const fixed = collideCircle(game.city, nx, nz, 0.6);
    cop.x = fixed.x;
    cop.z = fixed.z;
    if (d < 2.2 && !player.inVehicle) {
      if (game.combat) game.combat.damagePlayer(game, 18 * dt);
      // caught on foot at close range: busted
      if (state.health <= 0) bustPlayer(game, 'beaten by the police');
      else if (d < 1.6) bustPlayer(game, 'caught by the police');
    }
  }
}

// Busted: respawn at the hospital (on the street outside it — see
// world.js spawns.hospital), lose 20% of cash, heat cleared.
export function bustPlayer(game, reason) {
  const state = game.state;
  const player = game.player;
  if (state.mode === 'busted') return;
  state.mode = 'busted';
  const fine = Math.floor(state.cash * TUNE.bustedFine);
  state.cash -= fine;
  state.wanted = 0;
  game.police.copCars = [];
  game.police.footCops = [];
  game.police.copKills = 0;
  if (game.audio) game.audio.play('busted');
  state.bustedReason = reason || 'Busted by the police';
  state.bustedFine = fine;
  void player;
}

// Respawn after the busted screen: hospital street, health restored.
export function respawnAfterBusted(game) {
  const state = game.state;
  const player = game.player;
  state.mode = 'playing';
  state.health = 100;
  state.armour = 0;
  state.wanted = 0;
  const h = game.city.spawns.hospital;
  player.x = h.x;
  player.z = h.z;
  player.y = 0;
  player.inVehicle = null;
  player.onTrain = false;
  player.onElevator = false;
  player.parachute = false;
  player.falling = 0;
  player.speed = 0;
  player.vx = 0;
  player.vz = 0;
  if (game.camera && game.camera.snap) {
    // snapCamera is imported by main.js; keep the camera sane here
    game.camera.snap = true;
  }
  if (game.audio) game.audio.play('respawn');
}
