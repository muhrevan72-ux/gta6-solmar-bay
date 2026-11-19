// Damage, pickups and getting busted. No drawing, no browser:
// health and armour are numbers on the state, pickups are plain objects.
import { TUNING, dist2 } from './config.js';
import { nearestRoadPoint } from './world.js';

// Armour soaks 60% of a hit; the rest reaches health.
export function damagePlayer(state, amount) {
  const player = state.player;
  if (player.invulnT > 0) return;
  const soaked = Math.min(player.armor, amount * 0.6);
  player.armor -= soaked;
  player.health -= amount - soaked;
  player.invulnT = 0.6;
}

export function damageCar(car, amount) {
  car.hp = Math.max(0, car.hp - amount);
  if (car.hp < 40) car.smokeT = Math.max(car.smokeT, 0.2);
}

export function makePickups(world, rng) {
  const list = [];
  function at(kind, x, y) {
    list.push({ kind, x, y, bob: rng() * Math.PI * 2, respawnT: 0 });
  }
  // Health waits by the hospital, armour by the garage, wrenches by roads.
  at('health', world.points.hospital.x + 70, world.points.hospital.y);
  at('health', world.points.hospital.x - 70, world.points.hospital.y + 40);
  at('armor', world.points.garage.x + 70, world.points.garage.y);
  at('armor', world.points.garage.x - 70, world.points.garage.y - 40);
  for (let i = 0; i < 6; i += 1) {
    const p = nearestRoadPoint(
      220 + rng() * (world.w - 440),
      60 + rng() * (world.h - 120),
    );
    at('wrench', p.x + (rng() < 0.5 ? -60 : 60), p.y + (rng() < 0.5 ? -60 : 60));
  }
  return list;
}

// Walk or drive over a pickup to collect it. Collected ones come back
// after 20 seconds, at a new roadside spot.
export function updatePickups(state, dt, rng) {
  const player = state.player;
  const px = player.car ? player.car.x : player.x;
  const py = player.car ? player.car.y : player.y;
  for (const pickup of state.pickups) {
    pickup.bob += dt * 3;
    if (pickup.respawnT > 0) {
      pickup.respawnT -= dt;
      if (pickup.respawnT <= 0) {
        const p = nearestRoadPoint(
          220 + rng() * (state.world.w - 440),
          60 + rng() * (state.world.h - 120),
        );
        pickup.x = p.x + 70;
        pickup.y = p.y + 40;
      }
      continue;
    }
    if (dist2(px, py, pickup.x, pickup.y) > 36 * 36) continue;
    if (pickup.kind === 'health') {
      if (player.health >= TUNING.maxHealth) continue;
      player.health = Math.min(TUNING.maxHealth, player.health + 35);
    } else if (pickup.kind === 'armor') {
      if (player.armor >= TUNING.maxArmor) continue;
      player.armor = Math.min(TUNING.maxArmor, player.armor + 50);
    } else if (pickup.kind === 'wrench') {
      if (!player.car || player.car.hp >= 100) continue;
      player.car.hp = Math.min(100, player.car.hp + 60);
    } else {
      continue;
    }
    pickup.respawnT = 20;
    state.events.push({ type: 'pickup', kind: pickup.kind });
  }
}

// Health at zero means the player is busted: hospital, a fine, no heat.
export function checkBusted(state) {
  if (state.player.health > 0) return false;
  const loss = Math.floor(state.cash * TUNING.bustedCashLoss);
  state.lastFine = loss;
  state.cash -= loss;
  state.stats.busted += 1;
  state.wanted = 0;
  state.player.health = TUNING.maxHealth;
  state.player.armor = 0;
  state.player.x = state.world.points.hospital.x;
  state.player.y = state.world.points.hospital.y + 60;
  state.player.angle = Math.PI / 2;
  if (state.player.car) {
    state.player.car.driver = null;
    state.player.car.kind = 'parked';
    state.player.car = null;
    state.player.onFoot = true;
  }
  state.banner = `Busted! The hospital patched you up. Fine: $${loss}.`;
  state.bannerT = 4;
  return true;
}
