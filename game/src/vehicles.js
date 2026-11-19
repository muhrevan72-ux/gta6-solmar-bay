// Cars: the player's car physics, parked cars, and the traffic that
// drives the road grid. No drawing, no browser: cars are plain objects
// and these functions move them.
import {
  CAR_COLORS, ROAD_W, ROAD_X, ROAD_Y, TUNING, angleDiff, clamp, dist2,
} from './config.js';
import { collideCircle, isRoad, lanePoint, nearestRoadPoint, randomRoadPoint } from './world.js';

let nextCarId = 1;

export function makeCar(kind, x, y, angle, color) {
  return {
    id: nextCarId,
    kind, // 'player' | 'traffic' | 'police' | 'parked'
    x, y, angle,
    speed: 0,
    hp: 100,
    color: color || CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
    driver: null, // 'player' | 'npc' | null (parked)
    route: null, // traffic only: { axis, line, dir }
    turnCd: 0,
    smokeT: 0,
    length: 46,
    width: 22,
  };
}

// Parked cars line the road edges, angled with the road, doors facing it.
export function spawnParkedCars(world, rng, count, nearX, nearY, minDist) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const p = randomRoadPoint(rng, nearX, nearY, minDist);
    const vertical = rng() < 0.5;
    const side = rng() < 0.5 ? -1 : 1;
    const x = vertical ? p.x + side * (ROAD_W / 2 - 16) : p.x;
    const y = vertical ? p.y : p.y + side * (ROAD_W / 2 - 16);
    const angle = vertical ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI);
    const car = makeCar('parked', x, y, angle);
    car.driver = null;
    cars.push(car);
  }
  return cars;
}

// Traffic cars on the roads, each with a route along one road line.
export function spawnTrafficCars(world, rng, count, nearX, nearY, minDist) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const p = randomRoadPoint(rng, nearX, nearY, minDist);
    const near = nearestRoadPoint(p.x, p.y);
    const dir = rng() < 0.5 ? -1 : 1;
    const at = lanePoint(near.axis, near.line, near.axis === 'v' ? p.y : p.x, dir);
    const car = makeCar('traffic', at.x, at.y, near.axis === 'v' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI));
    car.driver = 'npc';
    car.route = { axis: near.axis, line: near.line, dir };
    car.speed = TUNING.trafficSpeed * (0.85 + rng() * 0.3);
    car.cruise = car.speed;
    cars.push(car);
  }
  return cars;
}

// Arcade driving for the player's car. `input` is {up, down, left, right,
// handbrake} (booleans). Returns { crashed } for sound and shake.
export function updatePlayerCar(car, input, dt, world) {
  const t = TUNING;
  let crashed = false;
  if (input.up) car.speed += t.carAccel * dt;
  else if (input.down) {
    if (car.speed > 20) car.speed -= t.carBrake * dt;
    else car.speed -= t.carAccel * 0.6 * dt;
  } else {
    car.speed -= Math.sign(car.speed) * t.carDrag * 60 * dt * 0.2;
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  if (input.handbrake) {
    car.speed -= Math.sign(car.speed) * t.handbrakeDrag * 60 * dt;
    if (Math.abs(car.speed) < 10) car.speed = 0;
  }
  car.speed = clamp(car.speed, -t.carReverseMax, t.carMaxSpeed);
  const steerAmount = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const steerFactor = clamp(Math.abs(car.speed) / 240, 0.25, 1);
  const handbrakeBoost = input.handbrake ? 1.7 : 1;
  car.angle += steerAmount * t.carSteer * steerFactor * handbrakeBoost * Math.sign(car.speed || 1) * dt;

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const before = { x: car.x, y: car.y };
  const fixed = collideCircle(world, nx, ny, TUNING.carRadius);
  car.x = fixed.x;
  car.y = fixed.y;
  const moved = Math.hypot(car.x - before.x, car.y - before.y);
  const wanted = Math.abs(car.speed) * dt;
  if (wanted - moved > 6 && Math.abs(car.speed) > 140) {
    car.hp = Math.max(0, car.hp - 6);
    car.speed *= -0.25;
    crashed = true;
  } else if (wanted - moved > 2) {
    car.speed *= 0.6;
  }
  if (car.hp < 40) car.smokeT = Math.max(car.smokeT, 0.1);
  return { crashed };
}

// One traffic car: follow its road, turn at intersections sometimes,
// slow for the car ahead, and teleport back near the player when lost.
export function updateTraffic(world, cars, dt, playerX, playerY, rng) {
  const half = ROAD_W / 2;
  for (const car of cars) {
    if (car.kind !== 'traffic') continue;
    if (car.turnCd > 0) car.turnCd -= dt;
    const route = car.route;
    // Slow for a car directly ahead in the same lane.
    let ahead = null;
    for (const other of cars) {
      if (other === car || other.kind === 'parked') continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const forward = route.axis === 'v'
        ? dy * route.dir
        : dx * route.dir;
      const side = route.axis === 'v' ? Math.abs(dx) : Math.abs(dy);
      if (forward > 0 && forward < 80 && side < 30) { ahead = other; break; }
    }
    const targetSpeed = ahead ? 0 : car.cruise;
    car.speed += clamp(targetSpeed - car.speed, -260 * dt, 200 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;

    // At an intersection, maybe turn onto the crossing road.
    const nearX = ROAD_X.reduce((best, cx) => (Math.abs(car.x - cx) < Math.abs(car.x - best) ? cx : best), ROAD_X[0]);
    const nearY = ROAD_Y.reduce((best, cy) => (Math.abs(car.y - cy) < Math.abs(car.y - best) ? cy : best), ROAD_Y[0]);
    const atCrossing = Math.abs(car.x - nearX) < 34 && Math.abs(car.y - nearY) < 34;
    if (atCrossing && car.turnCd <= 0 && rng() < 0.02) {
      if (route.axis === 'v') {
        const dir = rng() < 0.5 ? -1 : 1;
        const at = lanePoint('h', nearY, car.x, dir);
        car.route = { axis: 'h', line: nearY, dir };
        car.angle = dir > 0 ? 0 : Math.PI;
        car.y = at.y;
      } else {
        const dir = rng() < 0.5 ? -1 : 1;
        const at = lanePoint('v', nearX, car.y, dir);
        car.route = { axis: 'v', line: nearX, dir };
        car.angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        car.x = at.x;
      }
      car.turnCd = 1.2;
    } else {
      // Stay glued to the lane.
      if (route.axis === 'v') car.x += ((route.line + (route.dir > 0 ? -22 : 22)) - car.x) * Math.min(1, 4 * dt);
      else car.y += ((route.line + (route.dir > 0 ? 22 : -22)) - car.y) * Math.min(1, 4 * dt);
    }

    // Lost the player by too much: reappear on a road near them.
    const d2 = dist2(car.x, car.y, playerX, playerY);
    if (d2 > 1500 * 1500 || !isRoad(car.x, car.y)) {
      const p = randomRoadPoint(rng, playerX, playerY, 500);
      const near = nearestRoadPoint(p.x, p.y);
      const dir = rng() < 0.5 ? -1 : 1;
      const at = lanePoint(near.axis, near.line, near.axis === 'v' ? p.y : p.x, dir);
      car.x = at.x;
      car.y = at.y;
      car.route = { axis: near.axis, line: near.line, dir };
      car.angle = near.axis === 'v' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
      car.speed = car.cruise;
    }
    if (car.x < half) car.x = half;
    if (car.y < half) car.y = half;
  }
}

// Simple circle-vs-circle pushes between cars. Returns crash events
// {a, b, hard} for damage, sound and wanted level.
export function resolveCarCollisions(cars) {
  const events = [];
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      const min = 34;
      if (d2 >= min * min || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const push = (min - d) / 2;
      const nx = dx / d;
      const ny = dy / d;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      const rel = Math.abs(a.speed - b.speed);
      if (rel > 110) {
        events.push({ a, b, hard: rel > 260 });
        a.hp = Math.max(0, a.hp - rel * 0.04);
        b.hp = Math.max(0, b.hp - rel * 0.04);
        a.speed *= 0.7;
        b.speed *= 0.7;
      }
    }
  }
  return events;
}

// The nearest car to (x, y) within maxDist, whatever its kind.
export function nearestCar(cars, x, y, maxDist) {
  let best = null;
  let bestD = maxDist * maxDist;
  for (const car of cars) {
    const d = dist2(car.x, car.y, x, y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}
