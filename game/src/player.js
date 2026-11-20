// Solmar Bay — the player on foot.
//
// W/S walk along the camera yaw (forward is (sin yaw, cos yaw)),
// Shift runs, A/D strafe. Buildings block: the new position is
// checked against the city and the player slides along a wall rather
// than clipping through it. Cooldowns decay BEFORE the in-car early
// return (round-8 bug: they froze while driving).

import { TUNE, OUTFIT, COL } from './config.js';
import { isBlocked } from './world.js';
import { axis } from './input.js';
import { pushBox } from './render.js';

// The outfit colours the model actually wears, from OUTFIT.
export function outfitColours(g) {
  const o = g.player.outfit || { hair: 0, shirt: 0, pants: 0, shoes: 0 };
  const pick = (list, i) => (list[Math.max(0, Math.min(list.length - 1, i))] || {}).colour || [0.5, 0.5, 0.5];
  return {
    hair: pick(OUTFIT.hair, o.hair),
    shirt: pick(OUTFIT.shirt, o.shirt),
    pants: pick(OUTFIT.pants, o.pants),
    shoes: pick(OUTFIT.shoes, o.shoes),
  };
}

export function stepPlayer(g, dt, input) {
  const p = g.player;
  // Cooldowns decay first — even while driving, so a punch or a bomb
  // queued before getting in is ready again afterwards.
  for (const k of ['eCooldown', 'punchCooldown', 'bombCooldown', 'shootCooldown']) {
    if (p[k] > 0) p[k] = Math.max(0, p[k] - dt);
  }
  if (p.petting > 0) p.petting = Math.max(0, p.petting - dt);
  if (p.inCar) return;

  const yaw = (g.camera && g.camera.yaw) || p.heading || 0;
  const fwd = -axis(input, 'KeyW', 'KeyS'); // W -> +1
  const strafe = axis(input, 'KeyA', 'KeyD'); // D -> +1
  const running = input.down.has('ShiftLeft') || input.down.has('ShiftRight');
  const speed = running ? TUNE.runSpeed : TUNE.walkSpeed;
  let dx = Math.sin(yaw) * fwd + Math.cos(yaw) * strafe;
  let dz = Math.cos(yaw) * fwd - Math.sin(yaw) * strafe;
  const len = Math.hypot(dx, dz);
  if (len > 1) { dx /= len; dz /= len; }
  const moving = len > 0.01;
  p.speed = moving ? speed : 0;
  if (!moving) return;

  // Face the way we walk (only on W/S — strafing keeps the facing).
  if (fwd !== 0) p.heading = Math.atan2(dx, dz);

  const step = speed * dt;
  const nx = p.x + dx * step;
  const nz = p.z + dz * step;
  if (!g.city || !isBlocked(g.city, nx, nz)) {
    p.x = nx; p.z = nz;
  } else if (!isBlocked(g.city, nx, p.z)) {
    // Slide along the wall in x.
    p.x = nx;
  } else if (!isBlocked(g.city, p.x, nz)) {
    // Slide along the wall in z.
    p.z = nz;
  }
  // Inside a room, stay inside it.
  if (p.inside) {
    p.x = Math.max(-8, Math.min(8, p.x));
    p.z = Math.max(-6, Math.min(6, p.z));
  }
}

// Get into the nearest vehicle (within ~4 m). Returns it, or null.
export function tryEnterVehicle(g) {
  const p = g.player;
  let best = null;
  let bestD = 4;
  for (const v of g.vehicles) {
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

// Step out beside the car, on the first free spot around it.
export function exitVehicle(g) {
  const p = g.player;
  const v = p.inCar;
  if (!v) return;
  const spots = [
    [2.5, 0], [-2.5, 0], [0, 2.5], [0, -2.5],
    [3.5, 0], [-3.5, 0], [0, 3.5], [0, -3.5],
    [4, 2], [-4, -2], [2, -4], [-2, 4],
  ];
  let placed = false;
  for (const [ox, oz] of spots) {
    const x = v.x + ox;
    const z = v.z + oz;
    if (!g.city || !isBlocked(g.city, x, z)) {
      p.x = x; p.z = z; placed = true; break;
    }
  }
  if (!placed) { p.x = v.x + 3; p.z = v.z; }
  p.inCar = null;
  v.driver = null;
}

// The on-foot model: head, hair, torso, 2 arms, 2 legs, 2 shoes,
// eyes and the held weapon — 11 boxes.
export function playerBoxes(g, b) {
  const p = g.player;
  const c = outfitColours(g);
  const skin = [0.85, 0.65, 0.5];
  const fx = Math.sin(p.heading || 0);
  const fz = Math.cos(p.heading || 0);
  const rx = Math.cos(p.heading || 0);
  const rz = -Math.sin(p.heading || 0);
  const at = (ox, oz) => ({ x: p.x + rx * ox + fx * oz, z: p.z + rz * ox + fz * oz });
  const y = p.y || 0;
  let n = 0;
  const put = (x, yy, z, w, h, d, col) => { pushBox(b, x, yy, z, w, h, d, col); n++; };
  // Head + hair.
  put(p.x, y + 1.5, p.z, 0.42, 0.42, 0.42, skin);
  put(p.x, y + 1.9, p.z, 0.44, 0.16, 0.44, c.hair);
  // Torso.
  put(p.x, y + 0.9, p.z, 0.62, 0.62, 0.36, c.shirt);
  // Arms.
  put(p.x - rx * 0.38, y + 0.9, p.z - rz * 0.38, 0.2, 0.6, 0.2, c.shirt);
  put(p.x + rx * 0.38, y + 0.9, p.z + rz * 0.38, 0.2, 0.6, 0.2, c.shirt);
  // Legs + shoes.
  put(p.x - rx * 0.15, y + 0.3, p.z - rz * 0.15, 0.24, 0.6, 0.24, c.pants);
  put(p.x + rx * 0.15, y + 0.3, p.z + rz * 0.15, 0.24, 0.6, 0.24, c.pants);
  put(p.x - rx * 0.15, y, p.z - rz * 0.15 + fz * 0.05, 0.26, 0.12, 0.36, c.shoes);
  put(p.x + rx * 0.15, y, p.z + rz * 0.15 + fz * 0.05, 0.26, 0.12, 0.36, c.shoes);
  // Eyes (on the face, forward of the head) and the held weapon.
  const face = at(0, 0.24);
  put(face.x, y + 1.58, face.z, 0.3, 0.08, 0.06, [0.1, 0.1, 0.12]);
  const hand = at(0.42, 0.2);
  put(hand.x, y + 1.0, hand.z, 0.1, 0.12, 0.5, [0.15, 0.15, 0.18]);
  return n;
}
