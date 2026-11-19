// The player on foot: walking, running, getting in and out of cars,
// and the punch. Car driving lives in vehicles.js; this file only
// moves the person, never the car.
import { TUNING, angleDiff, dist2 } from './config.js';
import { collideCircle } from './world.js';
import { nearestCar } from './vehicles.js';

export function makePlayer(x, y) {
  return {
    x, y,
    angle: 0,
    onFoot: true,
    car: null,
    health: TUNING.maxHealth,
    armor: 0,
    punchT: 0,
    punchCd: 0,
    invulnT: 0,
    walkPhase: 0,
    speed: 0,
  };
}

// `move` is {x, y} in -1..1 (from the keys), `run` is the Shift key.
export function updateOnFoot(player, move, run, dt, world) {
  const len = Math.hypot(move.x, move.y);
  if (len < 0.05) {
    player.speed = 0;
    return;
  }
  const speed = run ? TUNING.runSpeed : TUNING.walkSpeed;
  const nx = move.x / len;
  const ny = move.y / len;
  player.speed = speed;
  player.angle = Math.atan2(ny, nx);
  player.walkPhase += speed * dt;
  const fixed = collideCircle(
    world,
    player.x + nx * speed * dt,
    player.y + ny * speed * dt,
    TUNING.playerRadius,
  );
  player.x = fixed.x;
  player.y = fixed.y;
  if (player.punchCd > 0) player.punchCd -= dt;
  if (player.punchT > 0) player.punchT -= dt;
  if (player.invulnT > 0) player.invulnT -= dt;
}

// The nearest car the player can get into. Police cars are locked.
export function tryEnterCar(state) {
  const player = state.player;
  const car = nearestCar(state.cars, player.x, player.y, 84);
  if (!car || car.kind === 'police' || car.hp <= 0) return null;
  const stolen = car.kind === 'parked' || car.kind === 'traffic';
  player.onFoot = false;
  player.car = car;
  car.kind = 'player';
  car.driver = 'player';
  car.route = null;
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  return { car, stolen };
}

// Step out beside the car, on the side away from the road centre.
export function exitCar(state, world) {
  const player = state.player;
  const car = player.car;
  if (!car) return;
  const side = Math.PI / 2;
  const px = car.x + Math.cos(car.angle + side) * 34;
  const py = car.y + Math.sin(car.angle + side) * 34;
  const fixed = collideCircle(world, px, py, TUNING.playerRadius);
  player.x = fixed.x;
  player.y = fixed.y;
  player.angle = car.angle;
  player.onFoot = true;
  player.car = null;
  car.kind = 'parked';
  car.driver = null;
  car.speed = 0;
}

// A punch: a short swing that hits peds and cops in front of the player.
// Returns the targets it hit, so the caller can knock them down.
export function punch(state, targets) {
  const player = state.player;
  if (player.punchCd > 0 || !player.onFoot) return [];
  player.punchT = 0.25;
  player.punchCd = TUNING.punchCooldown;
  const hit = [];
  for (const target of targets) {
    if (target.state === 'down' || target.downT > 0) continue;
    const d = dist2(player.x, player.y, target.x, target.y);
    if (d > TUNING.punchRange * TUNING.punchRange) continue;
    const to = Math.atan2(target.y - player.y, target.x - player.x);
    if (Math.abs(angleDiff(player.angle, to)) > 1.1) continue;
    hit.push(target);
  }
  return hit;
}
