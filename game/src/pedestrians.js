// Solmar Bay — pedestrians: 76 citizens with activities (walk, sit,
// chat, queue, vendor), fleeing, and the LOD humanoid model.

import { COL, FOOD_SHOPS } from './config.js';
import { randomSidewalkPoint, isOnRoad } from './world.js';
import { pushBox } from './render.js';

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makePed(x, z, activity, rng) {
  return {
    x, z, heading: rng() * Math.PI * 2,
    hp: 100, activity, dead: false,
    height: 1.7 + rng() * 0.3,
    bulk: 0.8 + rng() * 0.4,
    hairStyle: Math.floor(rng() * 5),
    hairColor: COL.hair[Math.floor(rng() * COL.hair.length)],
    shirtColor: COL.shirts[Math.floor(rng() * COL.shirts.length)],
    pantsColor: COL.pants[Math.floor(rng() * COL.pants.length)],
    speed: 1 + rng() * 1.5,
    target: null,
    flee: 0,
    shop: null,
  };
}

// The second chatter stands ~1.2 m from the first — but never on a
// road. Try several offsets until one lands off-road (round-10 bug:
// a blind +1.2 offset pushed the chatter onto the road).
function secondChatterSpot(first, rng) {
  const offsets = [
    [1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2],
    [1.2, 1.2], [-1.2, -1.2], [0.8, 0.8], [-0.8, -0.8],
    [1.6, 0.4], [-0.4, 1.6],
  ];
  for (const [ox, oz] of offsets) {
    const nx = first.x + ox;
    const nz = first.z + oz;
    if (!isOnRoad(nx, nz)) return { x: nx, z: nz };
  }
  return { x: first.x, z: first.z };
}

export function spawnPeds(g) {
  const rng = mulberry32(4242);
  g.peds = [];
  // 7 sitters on benches.
  for (let i = 0; i < 7; i++) {
    const b = g.city.benches[i % g.city.benches.length];
    const p = makePed(b.x, b.z + 0.5, 'sit', rng);
    g.peds.push(p);
  }
  // 14 chatters in 7 pairs.
  for (let i = 0; i < 7; i++) {
    const first = randomSidewalkPoint(rng);
    const p1 = makePed(first.x, first.z, 'chat', rng);
    const spot = secondChatterSpot(first, rng);
    const p2 = makePed(spot.x, spot.z, 'chat', rng);
    p1.heading = Math.atan2(p2.x - p1.x, p2.z - p1.z);
    p2.heading = Math.atan2(p1.x - p2.x, p1.z - p2.z);
    g.peds.push(p1, p2);
  }
  // 7 queuers at the food shops, in a line behind the counter.
  // The queue runs AWAY from the nearest road: shops at z >= 0
  // queue toward +z, the Taco Truck (z = -68) toward -z — the old
  // +6 always put its queue on the -60 road line.
  for (let i = 0; i < 7; i++) {
    const shop = FOOD_SHOPS[i % FOOD_SHOPS.length];
    const dir = shop.z >= 0 ? 1 : -1;
    const p = makePed(shop.x + (i % 3) * 2 - 2, shop.z + dir * (6 + Math.floor(i / 3) * 2), 'queue', rng);
    p.shop = shop;
    g.peds.push(p);
  }
  // 6 vendors at the stalls and food shops.
  const vendorSpots = [
    ...g.city.stalls.map(s => ({ x: s.x, z: s.z })),
    { x: FOOD_SHOPS[0].x, z: FOOD_SHOPS[0].z + 2 },
    { x: FOOD_SHOPS[1].x, z: FOOD_SHOPS[1].z + 2 },
  ];
  for (let i = 0; i < 6; i++) {
    const s = vendorSpots[i % vendorSpots.length];
    const p = makePed(s.x, s.z, 'vendor', rng);
    g.peds.push(p);
  }
  // 42 walkers on the sidewalks.
  for (let i = 0; i < 42; i++) {
    const pt = randomSidewalkPoint(rng);
    const p = makePed(pt.x, pt.z, 'walk', rng);
    p.target = randomSidewalkPoint(rng);
    g.peds.push(p);
  }
}

export function stepPed(g, p, dt) {
  if (p.dead) return;
  // Fleeing: run away from the player while the flee timer runs.
  if (p.flee > 0) {
    const dx = p.x - g.player.x;
    const dz = p.z - g.player.z;
    const d = Math.hypot(dx, dz) || 1;
    p.x += (dx / d) * p.speed * 2.5 * dt;
    p.z += (dz / d) * p.speed * 2.5 * dt;
    p.heading = Math.atan2(dx, dz);
    p.flee = Math.max(0, p.flee - dt);
    return;
  }
  if (p.activity === 'walk' && p.target) {
    const dx = p.target.x - p.x;
    const dz = p.target.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 1) {
      // Reached the target: pick a new sidewalk point.
      let nt = null;
      for (let tries = 0; tries < 5 && !nt; tries++) {
        const cand = randomSidewalkPoint(Math.random);
        if (!isOnRoad(cand.x, cand.z)) nt = cand;
      }
      p.target = nt || { x: 0, z: 20 };
    } else {
      p.x += (dx / d) * p.speed * dt;
      p.z += (dz / d) * p.speed * dt;
      p.heading = Math.atan2(dx, dz);
    }
  } else if (p.activity === 'queue' && p.shop) {
    // Advance slowly toward the shop counter.
    const dx = p.shop.x - p.x;
    const dz = p.shop.z + 3 - p.z;
    const d = Math.hypot(dx, dz);
    if (d > 1.5) {
      p.x += (dx / d) * 0.3 * dt;
      p.z += (dz / d) * 0.3 * dt;
    }
  }
  // Sitters, chatters and vendors stay put.
}

export function stepPeds(g, dt) {
  for (const p of g.peds) stepPed(g, p, dt);
}

// A live ped is 8 boxes (legs 2, torso, arms 2, head, hair, shoes).
// With a real camera, within 40 m the eyes appear (2 more boxes).
// With no camera (null) the base 8 are drawn — no eyes.
// Dead peds draw nothing.
export function pedBoxes(g, ped, batch, cam) {
  if (ped.dead) return 0;
  const px = cam ? cam.x : (g.player ? g.player.x : 0);
  const pz = cam ? cam.z : (g.player ? g.player.z : 0);
  const dist = Math.hypot(ped.x - px, ped.z - pz);
  const near = cam ? dist < 40 : false;
  const h = ped.height;
  const w = 0.35 * ped.bulk;
  let n = 0;
  const box = (x, y, z, bw, bh, bd, col) => { pushBox(batch, x, y, z, bw, bh, bd, col); n++; };
  const legH = h * 0.45;
  box(ped.x - w * 0.25, 0, ped.z, w * 0.4, legH, w * 0.4, ped.pantsColor);
  box(ped.x + w * 0.25, 0, ped.z, w * 0.4, legH, w * 0.4, ped.pantsColor);
  box(ped.x, legH, ped.z, w * 1.6, h * 0.32, w * 0.9, ped.shirtColor);
  box(ped.x - w * 0.95, legH + 0.05, ped.z, w * 0.3, h * 0.3, w * 0.3, ped.shirtColor);
  box(ped.x + w * 0.95, legH + 0.05, ped.z, w * 0.3, h * 0.3, w * 0.3, ped.shirtColor);
  box(ped.x, legH + h * 0.32, ped.z, w * 0.9, h * 0.22, w * 0.85, [0.9, 0.75, 0.6]);
  box(ped.x, legH + h * 0.32 + h * 0.22, ped.z, w * 0.95, h * 0.08, w * 0.9, ped.hairColor);
  box(ped.x, 0, ped.z + w * 0.1, w * 1.1, 0.1, w * 0.7, [0.15, 0.12, 0.1]);
  if (near) {
    const eyeY = legH + h * 0.32 + h * 0.12;
    box(ped.x - w * 0.2, eyeY, ped.z + w * 0.45, 0.05, 0.05, 0.05, [0.05, 0.05, 0.05]);
    box(ped.x + w * 0.2, eyeY, ped.z + w * 0.45, 0.05, 0.05, 0.05, [0.05, 0.05, 0.05]);
  }
  return n;
}
