// Pedestrians: they stroll the sidewalks, and run when a car comes at
// them or a fight breaks out. No drawing, no browser.
import { COLORS, ROAD_W, TUNING, angleTo, clamp, dist2 } from './config.js';
import { collideCircle, nearestRoadPoint } from './world.js';

export function makePed(x, y) {
  return {
    x, y,
    angle: Math.random() * Math.PI * 2,
    speed: TUNING.pedSpeed * (0.8 + Math.random() * 0.4),
    state: 'walk', // 'walk' | 'flee' | 'down'
    downT: 0,
    shirt: COLORS.pedShirt[Math.floor(Math.random() * COLORS.pedShirt.length)],
    target: null,
    waitT: 0,
  };
}

// Peds stand on sidewalks: just off a road edge.
export function spawnPeds(world, rng, count, nearX, nearY, minDist) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const p = nearestRoadPoint(
      220 + rng() * (world.w - 440),
      60 + rng() * (world.h - 120),
    );
    const dx = p.x - nearX;
    const dy = p.y - nearY;
    if (dx * dx + dy * dy < minDist * minDist) continue;
    const side = rng() < 0.5 ? -1 : 1;
    const x = p.axis === 'v' ? p.x + side * (ROAD_W / 2 + 16) : p.x + (rng() - 0.5) * 120;
    const y = p.axis === 'v' ? p.y + (rng() - 0.5) * 120 : p.y + side * (ROAD_W / 2 + 16);
    const ped = makePed(clamp(x, 110, world.w - 20), clamp(y, 20, world.h - 20));
    ped.target = pickSidewalkTarget(world, rng, ped.x, ped.y);
    peds.push(ped);
  }
  return peds;
}

function pickSidewalkTarget(world, rng, x, y) {
  const p = nearestRoadPoint(x, y);
  const along = (rng() - 0.5) * 500;
  const side = rng() < 0.5 ? -1 : 1;
  if (p.axis === 'v') {
    return {
      x: clamp(p.x + side * (ROAD_W / 2 + 16), 110, world.w - 20),
      y: clamp(p.y + along, 20, world.h - 20),
    };
  }
  return {
    x: clamp(p.x + along, 110, world.w - 20),
    y: clamp(p.y + side * (ROAD_W / 2 + 16), 20, world.h - 20),
  };
}

export function updatePeds(world, peds, dt, danger, rng) {
  for (const ped of peds) {
    if (ped.state === 'down') {
      ped.downT -= dt;
      if (ped.downT <= 0) ped.state = 'walk';
      continue;
    }
    // Flee a fast car or a fight nearby.
    if (danger && dist2(ped.x, ped.y, danger.x, danger.y) < 170 * 170) {
      ped.state = 'flee';
    } else if (ped.state === 'flee' && (!danger || dist2(ped.x, ped.y, danger.x, danger.y) > 320 * 320)) {
      ped.state = 'walk';
      ped.target = pickSidewalkTarget(world, rng, ped.x, ped.y);
    }
    if (ped.state === 'flee' && danger) {
      const away = angleTo(danger.x, danger.y, ped.x, ped.y);
      ped.angle = away;
      ped.x += Math.cos(away) * TUNING.pedFleeSpeed * dt;
      ped.y += Math.sin(away) * TUNING.pedFleeSpeed * dt;
    } else {
      if (!ped.target || dist2(ped.x, ped.y, ped.target.x, ped.target.y) < 24 * 24) {
        if (ped.waitT > 0) {
          ped.waitT -= dt;
          continue;
        }
        ped.target = pickSidewalkTarget(world, rng, ped.x, ped.y);
        if (rng() < 0.25) ped.waitT = 1 + rng() * 2;
      }
      const go = angleTo(ped.x, ped.y, ped.target.x, ped.target.y);
      ped.angle = go;
      ped.x += Math.cos(go) * ped.speed * dt;
      ped.y += Math.sin(go) * ped.speed * dt;
    }
    const fixed = collideCircle(world, ped.x, ped.y, 10);
    ped.x = fixed.x;
    ped.y = fixed.y;
  }
}

// Peds a car is about to hit: close, and the car is moving fast.
// The caller decides the consequences (knock-down, wanted level).
export function pedsHitByCar(peds, car) {
  const hit = [];
  if (Math.abs(car.speed) < 120) return hit;
  for (const ped of peds) {
    if (ped.state === 'down') continue;
    if (dist2(ped.x, ped.y, car.x, car.y) < 30 * 30) hit.push(ped);
  }
  return hit;
}

export function knockDown(ped, seconds) {
  ped.state = 'down';
  ped.downT = seconds;
}
