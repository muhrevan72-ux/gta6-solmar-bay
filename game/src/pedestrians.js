// Solmar Bay — pedestrians: sidewalk walkers, beach crowds, groups.
// Natural movement: per-ped pace variation ("breathing" speed),
// gentle sinusoidal heading wander, softer turns — no robot-straight
// walking. They flee from danger.

import { mulberry32, clamp, dist } from './config.js';
import { moveWithCollision, collides } from './world.js';

const SHIRTS = [
  [0.9, 0.3, 0.3], [0.3, 0.5, 0.9], [0.3, 0.8, 0.4], [0.9, 0.8, 0.2],
  [0.8, 0.4, 0.8], [0.95, 0.95, 0.95], [0.2, 0.2, 0.25], [0.9, 0.55, 0.25],
];
const PANTS = [
  [0.25, 0.3, 0.55], [0.2, 0.2, 0.22], [0.5, 0.45, 0.35], [0.85, 0.85, 0.8],
];

export function createPeds(city) {
  const rng = mulberry32(4242);
  const list = [];
  // spawn spots: downtown sidewalks, beach crowd, harbour, suburbs
  const spots = [];
  for (let i = 0; i < 40; i++) spots.push({ x: -160 + rng() * 320, z: -160 + rng() * 320 });
  for (let i = 0; i < 16; i++) spots.push({ x: -350 + rng() * 30, z: -330 + rng() * 660 }); // beach
  for (let i = 0; i < 10; i++) spots.push({ x: -280 + rng() * 200, z: 260 + rng() * 100 }); // harbour
  for (let i = 0; i < 10; i++) spots.push({ x: 210 + rng() * 160, z: -320 + rng() * 440 }); // suburbs
  let id = 0;
  for (const s of spots) {
    if (collides(city, s.x, s.z, 1)) continue;
    // 30% spawn in a small group sharing a destination
    const inGroup = rng() < 0.3;
    const group = inGroup ? Math.floor(id / 3) : null;
    const gx = s.x + (inGroup ? (rng() - 0.5) * 6 : 0);
    const gz = s.z + (inGroup ? (rng() - 0.5) * 6 : 0);
    list.push({
      id: id++, x: gx, z: gz, heading: rng() * Math.PI * 2,
      baseSpeed: 1.6 + rng() * 1.2, speed: 0,
      shirt: SHIRTS[Math.floor(rng() * SHIRTS.length)],
      pants: PANTS[Math.floor(rng() * PANTS.length)],
      skin: [0.92, 0.75, 0.6],
      health: 100, alive: true,
      flee: 0, fleeX: 0, fleeZ: 0,
      tx: gx, tz: gz, // wander target
      phase: rng() * Math.PI * 2, // individual rhythm
      group,
    });
    if (list.length >= 76) break;
  }
  return { list };
}

export function fleeFrom(peds, x, z, r) {
  for (const p of peds.list) {
    if (!p.alive) continue;
    if (dist(p.x, p.z, x, z) < r) {
      p.flee = 3 + Math.random() * 2;
      p.fleeX = x; p.fleeZ = z;
    }
  }
}

export function updatePeds(dt, game) {
  const t = game.time;
  for (const p of game.peds.list) {
    if (!p.alive) continue;
    if (p.flee > 0) {
      p.flee -= dt;
      // run away from the danger point
      const dx = p.x - p.fleeX, dz = p.z - p.fleeZ;
      const l = Math.hypot(dx, dz) || 1;
      p.heading = Math.atan2(dx / l, dz / l);
      const sp = p.baseSpeed * 2.2;
      moveWithCollision(game.city, p, Math.sin(p.heading) * sp * dt, Math.cos(p.heading) * sp * dt, 0.8);
      continue;
    }
    // wander: pick a new nearby target when arrived
    if (dist(p.x, p.z, p.tx, p.tz) < 3) {
      const nx = p.x + (Math.random() - 0.5) * 80;
      const nz = p.z + (Math.random() - 0.5) * 80;
      p.tx = Math.max(-390, Math.min(390, nx));
      p.tz = Math.max(-390, Math.min(390, nz));
    }
    const want = Math.atan2(p.tx - p.x, p.tz - p.z);
    let diff = want - p.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    // soft turns + gentle sinusoidal wander
    p.heading += clamp(diff, -3 * dt, 3 * dt) + Math.sin(t * 0.7 + p.phase) * 0.25 * dt;
    // pace "breathes" ±20% on an individual rhythm
    const pace = 1 + 0.2 * Math.sin(t * 0.9 + p.phase);
    const sp = p.baseSpeed * pace;
    moveWithCollision(game.city, p, Math.sin(p.heading) * sp * dt, Math.cos(p.heading) * sp * dt, 0.8);
  }
}

export function drawPeds(renderer, game) {
  for (const p of game.peds.list) {
    if (!p.alive) continue;
    const bob = Math.sin(game.time * 6 + p.phase) * 0.06;
    renderer.box(p.x, 0.4 + bob, p.z, 0.45, 0.8, 0.45, p.pants, 1, p.heading, 0, 0);
    renderer.box(p.x, 1.15 + bob, p.z, 0.9, 0.75, 0.5, p.shirt, 1, p.heading, 0, 0);
    renderer.box(p.x, 1.8 + bob, p.z, 0.55, 0.55, 0.55, p.skin, 1, p.heading, 0, 0);
  }
}
