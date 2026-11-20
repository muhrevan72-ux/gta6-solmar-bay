// Solmar Bay — on-foot player (rebuild #13).
import { isBlocked } from './world.js';
import { axis } from './input.js';
import { pushBox } from './render.js';
import { TUNE, OUTFIT } from './config.js';

export function outfitColours(g) {
  const o = g.player.outfit;
  return {
    hair: OUTFIT.hair[o.hair].colour,
    shirt: OUTFIT.shirt[o.shirt].colour,
    pants: OUTFIT.pants[o.pants].colour,
    shoes: OUTFIT.shoes[o.shoes].colour,
  };
}

export function stepPlayer(g, dt, input) {
  const p = g.player;
  // Cooldowns decay BEFORE the in-car early return.
  p.eCooldown = Math.max(0, p.eCooldown - dt);
  p.shootCooldown = Math.max(0, p.shootCooldown - dt);
  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  p.bombCooldown = Math.max(0, p.bombCooldown - dt);
  if (p.inCar) return;
  if (p.onTrain && g.train) {
    p.x = 300 * Math.sin(g.train.a);
    p.z = 300 * Math.cos(g.train.a);
    return;
  }
  const yaw = g.camera ? g.camera.yaw : p.heading;
  p.heading = yaw;
  const fwd = -axis(input, 'KeyW', 'KeyS'); // W = +1 forward
  const strafe = axis(input, 'KeyA', 'KeyD'); // D = +1 right
  const running = input.down.has('ShiftLeft') || input.down.has('ShiftRight');
  const speed = running ? TUNE.runSpeed : TUNE.walkSpeed;
  const mx = Math.sin(yaw) * fwd + Math.cos(yaw) * strafe;
  const mz = Math.cos(yaw) * fwd - Math.sin(yaw) * strafe;
  const dx = mx * speed * dt;
  const dz = mz * speed * dt;
  const nx = p.x + dx;
  const nz = p.z + dz;
  if (g.city) {
    if (!isBlocked(g.city, nx, p.z)) p.x = nx;
    if (!isBlocked(g.city, p.x, nz)) p.z = nz;
  } else {
    p.x = nx;
    p.z = nz;
  }
  p.speed = Math.hypot(dx, dz) / Math.max(dt, 1e-6);
}

export function tryEnterVehicle(g) {
  const p = g.player;
  if (p.inCar) return null;
  let best = null;
  let bestD = 4.5;
  for (const v of g.vehicles) {
    if (v.driver) continue;
    const d = Math.hypot(v.x - p.x, v.z - p.z);
    if (d < bestD) { bestD = d; best = v; }
  }
  if (!best) return null;
  p.inCar = best;
  best.driver = 'player';
  p.x = best.x;
  p.z = best.z;
  return best;
}

export function exitVehicle(g) {
  const p = g.player;
  const v = p.inCar;
  if (!v) return;
  v.driver = null;
  p.inCar = null;
  const spots = [[2.5, 0], [-2.5, 0], [0, 2.5], [0, -2.5], [3.5, 0], [0, 3.5]];
  for (const [dx, dz] of spots) {
    const nx = v.x + dx, nz = v.z + dz;
    if (!g.city || !isBlocked(g.city, nx, nz)) {
      p.x = nx;
      p.z = nz;
      return;
    }
  }
  p.x = v.x + 2.5;
  p.z = v.z;
}

// 11 boxes: shoes 2, legs 2, torso, arms 2, head, hair, weapon, pack.
export function playerBoxes(g, b, cam) {
  const p = g.player;
  const cols = outfitColours(g);
  const plain = [0, 0, 1, 1];
  const s = 1;
  let n = 0;
  const box = (x, y, z, w, h, d, col) => { pushBox(b, x, y, z, w, h, d, col, plain); n++; };
  box(p.x - 0.18, 0.25 * s, p.z, 0.22, 0.6 * s, 0.22, cols.shoes);
  box(p.x + 0.18, 0.25 * s, p.z, 0.22, 0.6 * s, 0.22, cols.shoes);
  box(p.x - 0.16, 0.25 * s, p.z, 0.3, 0.75 * s, 0.3, cols.pants);
  box(p.x + 0.16, 0.25 * s, p.z, 0.3, 0.75 * s, 0.3, cols.pants);
  box(p.x, 0.85 * s, p.z, 0.85, 0.6 * s, 0.45, cols.shirt);
  box(p.x - 0.55, 0.85 * s, p.z, 0.22, 0.6 * s, 0.22, cols.shirt);
  box(p.x + 0.55, 0.85 * s, p.z, 0.22, 0.6 * s, 0.22, cols.shirt);
  box(p.x, 1.45 * s, p.z, 0.42, 0.42 * s, 0.42, [0.85, 0.65, 0.5]);
  box(p.x, 1.8 * s, p.z, 0.44, 0.18 * s, 0.44, cols.hair);
  box(p.x + 0.55, 1.0 * s, p.z + 0.25, 0.12, 0.12, 0.5, [0.15, 0.15, 0.15]);
  box(p.x, 1.0 * s, p.z - 0.3, 0.6, 0.5 * s, 0.15, [0.3, 0.25, 0.2]);
  return n;
}
