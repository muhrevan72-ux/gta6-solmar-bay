// Solmar Bay — pedestrians.
//
// 76 people fill the streets: sitters on benches, chatting pairs, a
// queue at the taco truck, vendors at the food shops, and walkers
// strolling the sidewalks. Walkers head for a target and pick a new
// one when they arrive; a scared ped flees from the player. Nobody
// spawns on a road.

import { mulberry32 } from './state.js';
import { isOnRoad, randomSidewalkPoint } from './world.js';
import { pushBox, pushBoxRot } from './render.js';

const BULKS = [0.8, 0.9, 1.0, 1.1, 1.2, 1.3];
const SHIRTS = [
  [0.9, 0.3, 0.3], [0.3, 0.6, 0.9], [0.9, 0.8, 0.2], [0.4, 0.85, 0.4],
  [0.9, 0.5, 0.8], [0.6, 0.4, 0.9], [0.95, 0.95, 0.95], [0.2, 0.2, 0.25],
];
const SKINS = [[0.85, 0.65, 0.5], [0.7, 0.5, 0.35], [0.55, 0.4, 0.28]];

function makePed(rng, x, z, activity) {
  return {
    x,
    z,
    hp: 100,
    hairStyle: Math.floor(rng() * 5),
    height: 1.7 + rng() * 0.3,
    bulk: BULKS[Math.floor(rng() * BULKS.length)],
    activity,
    target: null,
    heading: rng() * Math.PI * 2,
    speed: 1 + rng() * 1.5,
    dead: false,
    flee: 0,
    shirt: SHIRTS[Math.floor(rng() * SHIRTS.length)],
    skin: SKINS[Math.floor(rng() * SKINS.length)],
    pants: [0.2 + rng() * 0.2, 0.25, 0.4 + rng() * 0.2],
  };
}

function sidewalkPoint(city, rng) {
  for (let tries = 0; tries < 20; tries++) {
    const p = randomSidewalkPoint(rng);
    if (!isOnRoad(p.x, p.z) && !city.blockers.some((b) => Math.abs(p.x - b.x) < b.hw + 1 && Math.abs(p.z - b.z) < b.hd + 1)) {
      return p;
    }
  }
  return { x: 10, z: 10 };
}

export function spawnPeds(g) {
  const rng = mulberry32(7);
  const city = g.city;
  const peds = [];

  // 7 sitters on benches.
  for (let i = 0; i < 7; i++) {
    const bench = city.benches[i % city.benches.length];
    const p = makePed(rng, bench.x, bench.z + 1, 'sit');
    peds.push(p);
  }
  // 14 chatters in 7 pairs.
  for (let i = 0; i < 7; i++) {
    const a = sidewalkPoint(city, rng);
    const p1 = makePed(rng, a.x, a.z, 'chat');
    const p2 = makePed(rng, a.x + 1.2, a.z + 0.5, 'chat');
    p1.heading = Math.atan2(p2.x - p1.x, p2.z - p1.z);
    p2.heading = Math.atan2(p1.x - p2.x, p1.z - p2.z);
    peds.push(p1, p2);
  }
  // 7 in a queue at the taco truck.
  for (let i = 0; i < 7; i++) {
    const p = makePed(rng, 30 + (i % 2) * 1.2, 150 + 4 + i * 1.4, 'queue');
    peds.push(p);
  }
  // 6 vendors at the food shops.
  const shops = [
    [-40, 70], [90, -30], [30, 150], [-90, -150], [-40, -70], [90, 30],
  ];
  for (const [x, z] of shops) {
    const p = makePed(rng, x + 3, z + 3, 'vendor');
    peds.push(p);
  }
  // 42 walkers on the sidewalks.
  for (let i = 0; i < 42; i++) {
    const a = sidewalkPoint(city, rng);
    const p = makePed(rng, a.x, a.z, 'walk');
    p.target = sidewalkPoint(city, rng);
    peds.push(p);
  }

  g.peds = peds;
  return peds;
}

export function stepPed(g, p, dt) {
  if (p.dead) return;
  const player = g.player;
  if (p.flee > 0) {
    // Run away from the player.
    const dx = p.x - player.x;
    const dz = p.z - player.z;
    const d = Math.hypot(dx, dz) || 1;
    const speed = 5;
    p.x += (dx / d) * speed * dt;
    p.z += (dz / d) * speed * dt;
    p.heading = Math.atan2(dx, dz);
    p.flee = Math.max(0, p.flee - dt);
    return;
  }
  if (p.activity !== 'walk' || !p.target) return;
  const dx = p.target.x - p.x;
  const dz = p.target.z - p.z;
  const d = Math.hypot(dx, dz);
  if (d < 1) {
    p.target = randomSidewalkPoint(mulberry32((Math.random() * 1e9) | 0));
    return;
  }
  const step = Math.min(d, p.speed * dt);
  p.x += (dx / d) * step;
  p.z += (dz / d) * step;
  p.heading = Math.atan2(dx, dz);
}

export function stepPeds(g, dt) {
  for (const p of g.peds) stepPed(g, p, dt);
}

// A ped is 8 body boxes (head, hair, torso, arms, legs, shoes) plus,
// at near LOD, a box for the eyes. Dead peds draw nothing. Returns
// the body-box count (8 live, 0 dead).
export function pedBoxes(g, p, b, cam) {
  if (p.dead) return 0;
  const plain = [0, 0, 1, 1];
  const s = p.height / 1.8;
  const h = p.heading || 0;
  const bulk = p.bulk || 1;
  const w = 0.42 * bulk;
  const legH = 0.8 * s;
  const torsoH = 0.55 * s;
  const headH = 0.3 * s;
  const hairH = 0.16 * s;
  const parts = [
    [0, 0, 0, 0.16, legH, 0.16, p.pants],
    [0, 0, 0, 0.16, legH, 0.16, p.pants],
    [0, legH, 0, w, torsoH, 0.28, p.shirt],
    [0, legH + torsoH, 0, 0.3, headH, 0.28, p.skin],
    [0, legH + torsoH + headH, 0, 0.32, hairH, 0.3, [0.15, 0.1, 0.08]],
    [0, legH + 0.05, 0, 0.13, torsoH - 0.05, 0.13, p.shirt],
    [0, legH + 0.05, 0, 0.13, torsoH - 0.05, 0.13, p.shirt],
    [0, 0, 0, w + 0.04, 0.1, 0.34, [0.2, 0.15, 0.1]],
  ];
  const sides = [
    [-0.1, 0], [0.1, 0], [0, 0], [0, 0], [0, 0],
    [-w / 2 - 0.05, 0], [w / 2 + 0.05, 0], [0, 0.05],
  ];
  const cos = Math.cos(h);
  const sin = Math.sin(h);
  for (let i = 0; i < parts.length; i++) {
    const [dx, dy, dz, bw, bh, bd, colour] = parts[i];
    const [sx, sz] = sides[i];
    const lx = dx + sx;
    const lz = dz + sz;
    const wx = p.x + lx * cos + lz * sin;
    const wz = p.z - lx * sin + lz * cos;
    pushBoxRot(b, wx, dy, wz, bw, bh, bd, h, colour, plain);
  }
  // Eyes, near LOD only (within 40 m; a null camera is always near).
  const player = g.player;
  const dist = Math.hypot(p.x - player.x, p.z - player.z);
  const near = !cam || dist < 40;
  if (near) {
    const ex = p.x + Math.sin(h) * 0.16;
    const ez = p.z + Math.cos(h) * 0.16;
    pushBoxRot(b, ex, legH + torsoH + headH * 0.5, ez, 0.2, 0.05, 0.05, h, [0.1, 0.1, 0.12], plain);
  }
  return 8;
}
