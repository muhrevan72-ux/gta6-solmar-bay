// Solmar Bay — pedestrians.
//
// 76 of them: 7 sitting, 14 chatting, 7 queuing, 6 vending and 42
// walking. They vary in height (1.7–2.0 m), bulk and hair style, and
// none spawn on a road. pedBoxes draws 7 boxes plus the eyes at near
// LOD (inside 40 m); a null camera always counts as near.

import { COL } from './config.js';
import { isOnRoad, randomSidewalkPoint, isBlocked } from './world.js';
import { pushBox } from './render.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SHIRTS = [
  [0.8, 0.3, 0.3], [0.3, 0.5, 0.9], [0.9, 0.8, 0.3], [0.4, 0.8, 0.4],
  [0.8, 0.4, 0.8], [0.9, 0.9, 0.9], [0.2, 0.2, 0.25], [0.9, 0.6, 0.3],
];
const PANTS = [
  [0.2, 0.25, 0.4], [0.35, 0.3, 0.25], [0.5, 0.5, 0.55], [0.15, 0.15, 0.18],
];

function makePed(rng, x, z, activity) {
  return {
    x, z, y: 0,
    heading: rng() * Math.PI * 2,
    hp: 100,
    activity,
    height: 1.7 + rng() * 0.3,
    bulk: 0.8 + rng() * 0.5,
    hairStyle: Math.floor(rng() * 5),
    hair: COL.hair[Math.floor(rng() * COL.hair.length)],
    shirt: SHIRTS[Math.floor(rng() * SHIRTS.length)],
    pants: PANTS[Math.floor(rng() * PANTS.length)],
    speed: 1.2 + rng() * 0.8,
    target: null,
    flee: 0,
    dead: false,
  };
}

export function spawnPeds(g) {
  const rng = mulberry32(777);
  const peds = [];
  const freePoint = () => {
    for (let i = 0; i < 50; i++) {
      const p = randomSidewalkPoint(rng);
      if (!g.city || !isBlocked(g.city, p.x, p.z)) return p;
    }
    return { x: 30, z: 30 };
  };
  // Sitters on the benches.
  for (let i = 0; i < 7; i++) {
    const bench = g.city && g.city.benches[i % g.city.benches.length];
    const p = bench ? { x: bench.x, z: bench.z } : freePoint();
    peds.push(makePed(rng, p.x, p.z, 'sit'));
  }
  // Chatters in pairs (the partner steps off the road too).
  for (let i = 0; i < 7; i++) {
    const p = freePoint();
    peds.push(makePed(rng, p.x, p.z, 'chat'));
    let qx = p.x + 1.2;
    let qz = p.z + 0.5;
    if (isOnRoad(qx, qz)) {
      // Try nearby offsets until the partner is off the road.
      const offsets = [[-1.2, 0.5], [0.5, 1.2], [-0.5, -1.2], [1.2, -0.5]];
      for (const [ox, oz] of offsets) {
        if (!isOnRoad(p.x + ox, p.z + oz)) { qx = p.x + ox; qz = p.z + oz; break; }
      }
      if (isOnRoad(qx, qz)) { qx = p.x; qz = p.z + 1.5; }
    }
    peds.push(makePed(rng, qx, qz, 'chat'));
  }
  // A queue outside the first food shop.
  for (let i = 0; i < 7; i++) {
    peds.push(makePed(rng, 40 + i * 0.2, 44 + i * 1.4, 'queue'));
  }
  // Vendors by the market stalls.
  for (let i = 0; i < 6; i++) {
    const p = freePoint();
    peds.push(makePed(rng, p.x, p.z, 'vendor'));
  }
  // Walkers with a destination.
  for (let i = 0; i < 42; i++) {
    const p = freePoint();
    const ped = makePed(rng, p.x, p.z, 'walk');
    ped.target = freePoint();
    peds.push(ped);
  }
  g.peds = peds;
}

export function stepPed(g, p, dt) {
  if (p.dead) return;
  if (p.flee > 0) {
    p.flee -= dt;
    const dx = p.x - g.player.x;
    const dz = p.z - g.player.z;
    const d = Math.hypot(dx, dz) || 1;
    const step = 5 * dt;
    p.x += (dx / d) * step;
    p.z += (dz / d) * step;
    p.heading = Math.atan2(dx / d, dz / d);
    return;
  }
  if (p.activity !== 'walk') return;
  if (!p.target) p.target = randomSidewalkPoint(Math.random);
  const dx = p.target.x - p.x;
  const dz = p.target.z - p.z;
  const d = Math.hypot(dx, dz);
  if (d < 1.5) {
    p.target = randomSidewalkPoint(Math.random);
    return;
  }
  const step = Math.min(d, p.speed * dt);
  p.x += (dx / d) * step;
  p.z += (dz / d) * step;
  p.heading = Math.atan2(dx / d, dz / d);
}

export function stepPeds(g, dt) {
  for (const p of g.peds) stepPed(g, p, dt);
}

// The ped model: head, hair, torso, 2 arms, 2 legs — 7 boxes — plus
// the eyes at near LOD. Dead peds draw nothing.
export function pedBoxes(g, p, b, camera) {
  if (p.dead) return 0;
  const ref = camera || g.player;
  const d = ref ? Math.hypot(p.x - (ref.x || 0), p.z - (ref.z || 0)) : 0;
  const near = !camera || d < 40;
  const h = p.height || 1.8;
  const bulk = p.bulk || 1;
  const skin = [0.85, 0.65, 0.5];
  const fx = Math.sin(p.heading || 0);
  const fz = Math.cos(p.heading || 0);
  let n = 0;
  const put = (x, y, z, w, hh, dd, col) => { pushBox(b, x, y, z, w, hh, dd, col); n++; };
  const legH = h * 0.42;
  const torsoH = h * 0.36;
  const headY = h - 0.22;
  put(p.x, headY - 0.2, p.z, 0.4 * bulk, 0.4, 0.4 * bulk, skin); // head
  put(p.x, headY + 0.18, p.z, 0.42 * bulk, 0.14, 0.42 * bulk, p.hair); // hair
  put(p.x, legH, p.z, 0.58 * bulk, torsoH, 0.34 * bulk, p.shirt); // torso
  put(p.x - 0.36 * bulk, legH, p.z, 0.18, torsoH, 0.18, p.shirt); // left arm
  put(p.x + 0.36 * bulk, legH, p.z, 0.18, torsoH, 0.18, p.shirt); // right arm
  put(p.x - 0.14 * bulk, 0, p.z, 0.22 * bulk, legH, 0.22 * bulk, p.pants); // left leg
  put(p.x + 0.14 * bulk, 0, p.z, 0.22 * bulk, legH, 0.22 * bulk, p.pants); // right leg
  if (near) {
    put(p.x + fx * 0.22, headY - 0.15, p.z + fz * 0.22, 0.26, 0.07, 0.05, [0.1, 0.1, 0.12]); // eyes
  }
  return n;
}
