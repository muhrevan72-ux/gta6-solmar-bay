// Solmar Bay — the player: on-foot movement, entering/exiting cars,
// the player model (11 boxes) and outfit colours.

import { TUNE, OUTFIT } from './config.js';
import { isBlocked } from './world.js';
import { pushBox } from './render.js';
import { stepPlayerCar } from './vehicles.js';

export function outfitColours(game) {
  const o = (game.player && game.player.outfit) || { hair: 0, shirt: 0, pants: 0, shoes: 0 };
  const hair = OUTFIT.hair[o.hair] || OUTFIT.hair[0];
  const shirt = OUTFIT.shirt[o.shirt] || OUTFIT.shirt[0];
  const pants = OUTFIT.pants[o.pants] || OUTFIT.pants[0];
  const shoes = OUTFIT.shoes[o.shoes] || OUTFIT.shoes[0];
  return { hair: hair.color, shirt: shirt.color, pants: pants.color, shoes: shoes.color };
}

export function stepPlayer(g, dt, input) {
  const p = g.player;
  // Cooldowns decay FIRST — before the in-car early return — or
  // they freeze forever while the player is driving (round-8 bug).
  // Cooldowns live on the PLAYER, not the game.
  if (p.eCooldown > 0) p.eCooldown = Math.max(0, p.eCooldown - dt);
  if (p.shootCooldown > 0) p.shootCooldown = Math.max(0, p.shootCooldown - dt);
  if (p.punchCooldown > 0) p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  if (p.bombCooldown > 0) p.bombCooldown = Math.max(0, p.bombCooldown - dt);
  if (p.inCar) {
    stepPlayerCar(g, dt, input);
    return;
  }
  const running = input.downKey('ShiftLeft') || input.downKey('ShiftRight');
  const speed = running ? TUNE.runSpeed : TUNE.walkSpeed;
  let fwd = 0;
  let strafe = 0;
  if (input.downKey('KeyW')) fwd += 1;
  if (input.downKey('KeyS')) fwd -= 1;
  if (input.downKey('KeyA')) strafe -= 1;
  if (input.downKey('KeyD')) strafe += 1;
  if (fwd === 0 && strafe === 0) {
    p.speed = 0;
    return;
  }
  const len = Math.hypot(fwd, strafe) || 1;
  fwd /= len;
  strafe /= len;
  // Forward follows the CAMERA yaw when there is a camera, else the
  // player's heading. Strafe is perpendicular to forward.
  const yaw = (g.camera && typeof g.camera.yaw === 'number') ? g.camera.yaw : p.heading;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const sx = Math.cos(yaw);
  const sz = -Math.sin(yaw);
  const dx = (fx * fwd + sx * strafe) * speed * dt;
  const dz = (fz * fwd + sz * strafe) * speed * dt;
  const nx = p.x + dx;
  const nz = p.z + dz;
  // A building blocks movement: never end inside one.
  if (!isBlocked(g.city, nx, nz)) {
    p.x = nx;
    p.z = nz;
    p.speed = speed;
  } else {
    // Try sliding along one axis.
    if (!isBlocked(g.city, nx, p.z)) {
      p.x = nx;
      p.speed = speed;
    } else if (!isBlocked(g.city, p.x, nz)) {
      p.z = nz;
      p.speed = speed;
    } else {
      p.speed = 0;
    }
  }
  if (fwd > 0) p.heading = Math.atan2(dx, dz);
}

// Enter the nearest car within 4 m. Returns the car or null.
// inCar IS the vehicle (never a boolean).
export function tryEnterVehicle(g) {
  const p = g.player;
  let best = null;
  let bestD = 4;
  for (const v of g.vehicles) {
    if (v.driver) continue;
    const d = Math.hypot(v.x - p.x, v.z - p.z);
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  if (!best) return null;
  best.driver = 'player';
  p.inCar = best;
  p.x = best.x;
  p.z = best.z;
  p.heading = best.heading;
  return best;
}

// Get out of the car onto a free spot next to it.
export function exitVehicle(g) {
  const p = g.player;
  const car = p.inCar;
  if (!car) return false;
  car.driver = null;
  p.inCar = null;
  // Step out to the side of the car, on open ground.
  const offsets = [[3, 0], [-3, 0], [0, 3], [0, -3], [4, 0], [-4, 0]];
  for (const [ox, oz] of offsets) {
    const nx = car.x + ox;
    const nz = car.z + oz;
    if (!isBlocked(g.city, nx, nz)) {
      p.x = nx;
      p.z = nz;
      return true;
    }
  }
  p.x = car.x + 3;
  p.z = car.z;
  return true;
}

// The player model: 11 boxes — legs 2, torso, arms 2, head, hair,
// shoes 2, weapon, backpack. Colours follow the outfit.
export function playerBoxes(g, batch, cam) {
  const p = g.player;
  const cols = outfitColours(g);
  const y = p.y || 0;
  const h = 1.8;
  let n = 0;
  const box = (x, yy, z, w, hh, d, col) => { pushBox(batch, x, yy, z, w, hh, d, col); n++; };
  box(p.x - 0.18, y, p.z, 0.32, 0.8, 0.32, cols.pants); // left leg
  box(p.x + 0.18, y, p.z, 0.32, 0.8, 0.32, cols.pants); // right leg
  box(p.x, y + 0.8, p.z, 0.7, 0.6, 0.4, cols.shirt); // torso
  box(p.x - 0.5, y + 0.85, p.z, 0.22, 0.55, 0.22, cols.shirt); // left arm
  box(p.x + 0.5, y + 0.85, p.z, 0.22, 0.55, 0.22, cols.shirt); // right arm
  box(p.x, y + 1.4, p.z, 0.45, 0.4, 0.4, [0.9, 0.75, 0.6]); // head
  box(p.x, y + 1.75, p.z, 0.48, 0.15, 0.42, cols.hair); // hair
  box(p.x - 0.18, y, p.z + 0.1, 0.34, 0.12, 0.5, cols.shoes); // left shoe
  box(p.x + 0.18, y, p.z + 0.1, 0.34, 0.12, 0.5, cols.shoes); // right shoe
  box(p.x + 0.55, y + 1.0, p.z, 0.12, 0.3, 0.12, [0.2, 0.2, 0.2]); // weapon in hand
  box(p.x, y + 0.9, p.z - 0.28, 0.5, 0.45, 0.15, [0.4, 0.3, 0.2]); // backpack
  return n;
}
