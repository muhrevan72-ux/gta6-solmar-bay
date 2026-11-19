// The wanted level and the police who answer it: patrol cars that chase
// and ram, and on-foot cops who chase and grab. No drawing, no browser.
import {
  COLORS, TUNING, angleDiff, angleTo, clamp, dist2,
} from './config.js';
import { makeCar, nearestCar } from './vehicles.js';
import { collideCircle, randomRoadPoint } from './world.js';

export function wantedGain(state, amount) {
  state.wanted = clamp(state.wanted + amount, 0, TUNING.maxWanted);
  state.wantedTimer = 0;
  state.wantedDecayT = 0;
}

// How many police cars and on-foot cops a wanted level fields.
export function policeForLevel(level) {
  return { cars: clamp(level, 0, 5), cops: level >= 2 ? level - 1 : 0 };
}

export function policeNear(state, range) {
  const range2 = range * range;
  for (const car of state.cars) {
    if (car.kind === 'police' && dist2(car.x, car.y, state.player.x, state.player.y) < range2) return true;
  }
  for (const cop of state.cops) {
    if (dist2(cop.x, cop.y, state.player.x, state.player.y) < range2) return true;
  }
  return false;
}

// Wanted decays only while no police can see the player.
export function updateWanted(state, dt) {
  if (state.wanted === 0) return;
  if (policeNear(state, 450)) {
    state.wantedTimer = 0;
    state.wantedDecayT = 0;
    return;
  }
  state.wantedTimer += dt;
  if (state.wantedTimer < TUNING.wantedDecayDelay) return;
  state.wantedDecayT += dt;
  if (state.wantedDecayT >= TUNING.wantedDecayEvery) {
    state.wantedDecayT = 0;
    state.wanted = Math.max(0, state.wanted - 1);
  }
}

// Spawn or remove police until the field matches the wanted level.
// Police appear on roads near the player, never right on top of them.
export function ensurePolice(state, world, rng) {
  const want = policeForLevel(state.wanted);
  const cars = state.cars.filter((car) => car.kind === 'police');
  const cops = state.cops;
  while (cars.length < want.cars) {
    const p = randomRoadPoint(rng, state.player.x, state.player.y, 520);
    const car = makeCar('police', p.x, p.y, 0, COLORS.police);
    car.driver = 'npc';
    car.hp = 120;
    state.cars.push(car);
    cars.push(car);
  }
  while (cars.length > want.cars) {
    const car = cars.pop();
    const index = state.cars.indexOf(car);
    if (index !== -1) state.cars.splice(index, 1);
  }
  while (cops.length < want.cops) {
    const p = randomRoadPoint(rng, state.player.x, state.player.y, 420);
    cops.push({
      x: p.x, y: p.y, angle: 0, speed: 0,
      grabT: 0, downT: 0,
    });
  }
  while (cops.length > want.cops) cops.pop();
}

// Police cars steer at the player and ram; on-foot cops run the player
// down and grab. Returns 'busted' when a grab holds long enough.
export function updatePolice(state, world, dt) {
  const player = state.player;
  const px = player.car ? player.car.x : player.x;
  const py = player.car ? player.car.y : player.y;

  for (const car of state.cars) {
    if (car.kind !== 'police') continue;
    const want = angleTo(car.x, car.y, px, py);
    const turn = clamp(angleDiff(car.angle, want), -2.4 * dt, 2.4 * dt);
    car.angle += turn;
    car.speed = Math.min(TUNING.policeCarSpeed, car.speed + 420 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    const fixed = collideCircle(world, car.x, car.y, 18);
    if (fixed.x !== car.x || fixed.y !== car.y) {
      car.speed *= 0.5;
      car.x = fixed.x;
      car.y = fixed.y;
    }
    // Ramming the player's car hurts it; ramming the player hurts them.
    const target = player.car || player;
    const d = dist2(car.x, car.y, target.x, target.y);
    if (d < 44 * 44 && car.speed > 200) {
      if (player.car) {
        player.car.hp = Math.max(0, player.car.hp - 8);
        car.speed *= 0.4;
      } else if (player.invulnT <= 0) {
        player.health -= 6;
        player.invulnT = 0.7;
      }
      car.speed *= 0.5;
    }
    if (car.hp < 40) car.smokeT = Math.max(car.smokeT, 0.1);
  }

  for (const cop of state.cops) {
    if (cop.downT > 0) {
      cop.downT -= dt;
      cop.grabT = 0;
      continue;
    }
    const d = dist2(cop.x, cop.y, player.x, player.y);
    if (player.onFoot && d < 900 * 900) {
      const go = angleTo(cop.x, cop.y, player.x, player.y);
      cop.angle = go;
      cop.x += Math.cos(go) * TUNING.copRunSpeed * dt;
      cop.y += Math.sin(go) * TUNING.copRunSpeed * dt;
      const fixed = collideCircle(world, cop.x, cop.y, 10);
      cop.x = fixed.x;
      cop.y = fixed.y;
      if (d < 36 * 36) {
        cop.grabT += dt;
        if (cop.grabT > 1.2) return 'busted';
      } else {
        cop.grabT = 0;
      }
    } else if (!player.onFoot) {
      // The player drove off: the cop gives up and heads for the road.
      cop.grabT = 0;
    }
  }
  return null;
}

// The nearest police car, for the HUD's "nearest threat" and for sound.
export function nearestPoliceCar(state) {
  let best = null;
  let bestD = Infinity;
  for (const car of state.cars) {
    if (car.kind !== 'police') continue;
    const d = dist2(car.x, car.y, state.player.x, state.player.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}
