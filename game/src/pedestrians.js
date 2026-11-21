// Solmar Bay — pedestrians: walkers, sitters, chatters, queues,
// vendors. 76 total. They walk the sidewalks, flee when shot
// at, and give the city its life.

import { COL } from './config.js';
import { isBlocked, isOnRoad, randomSidewalkPoint } from './world.js';
import { pushBox } from './render.js';

function makePed(rng, x, z, activity) {
  return {
    x, z,
    type: 'ped',
    hp: 100,
    dead: false,
    activity,
    target: null,
    speed: 1 + rng() * 1.2,
    height: 1.7 + rng() * 0.3,
    bulk: 0.8 + rng() * 0.5,
    hairStyle: Math.floor(rng() * 5),
    hairColor: COL.hair[Math.floor(rng() * COL.hair.length)],
    skinColor: COL.skin[Math.floor(rng() * COL.skin.length)],
    shirtColor: COL.shirt[Math.floor(rng() * COL.shirt.length)],
    pantsColor: COL.pants[Math.floor(rng() * COL.pants.length)],
    flee: 0,
    walkPhase: rng() * Math.PI * 2,
  };
}

export function spawnPeds(g) {
  let seed = 777;
  const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  g.peds = [];
  const spot = () => {
    for (let i = 0; i < 20; i++) {
      const p = randomSidewalkPoint(rng);
      if (!isOnRoad(p.x, p.z) && !isBlocked(g.city, p.x, p.z)) return p;
    }
    return { x: 0, z: 40 };
  };
  // 7 sitters (on benches).
  for (let i = 0; i < 7; i++) {
    const b = g.city.benches[i % g.city.benches.length];
    g.peds.push(makePed(rng, b.x, b.z + 1, 'sit'));
  }
  // 14 chatters (7 pairs).
  for (let i = 0; i < 7; i++) {
    const p = spot();
    g.peds.push(makePed(rng, p.x, p.z, 'chat'));
    g.peds.push(makePed(rng, p.x + 1.2, p.z + 0.5, 'chat'));
  }
  // 7 in a queue (at the burger joint).
  for (let i = 0; i < 7; i++) {
    g.peds.push(makePed(rng, 80 + i * 1.2, -30, 'queue'));
  }
  // 6 vendors (at the market stalls, off the road grid).
  for (let i = 0; i < 6; i++) {
    g.peds.push(makePed(rng, -210, 194 + i * 6, 'vendor'));
  }
  // 42 walkers.
  for (let i = 0; i < 42; i++) {
    const p = spot();
    const ped = makePed(rng, p.x, p.z, 'walk');
    ped.target = spot();
    g.peds.push(ped);
  }
  return g.peds;
}

export function stepPed(g, p, dt) {
  if (p.dead) return;
  if (p.flee > 0) {
    p.flee -= dt;
    const dx = p.x - g.player.x, dz = p.z - g.player.z;
    const d = Math.hypot(dx, dz) || 1;
    const nx = p.x + (dx / d) * 4 * dt;
    const nz = p.z + (dz / d) * 4 * dt;
    if (!isBlocked(g.city, nx, p.z)) p.x = nx;
    if (!isBlocked(g.city, p.x, nz)) p.z = nz;
    return;
  }
  if (p.activity === 'walk') {
    if (!p.target) p.target = randomSidewalkPoint(Math.random);
    const dx = p.target.x - p.x, dz = p.target.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 1.5) {
      p.target = randomSidewalkPoint(Math.random);
      return;
    }
    const nx = p.x + (dx / d) * p.speed * dt;
    const nz = p.z + (dz / d) * p.speed * dt;
    if (!isBlocked(g.city, nx, p.z)) p.x = nx;
    if (!isBlocked(g.city, p.x, nz)) p.z = nz;
    p.walkPhase += dt * p.speed * 3;
  }
  // Sitters, chatters, queuers and vendors stay put.
}

export function stepPeds(g, dt) {
  for (const p of g.peds) stepPed(g, p, dt);
}

// Draw a pedestrian (8 boxes near, 7 far — no eyes at distance).
export function pedBoxes(g, p, batch, camera) {
  if (p.dead) return 0;
  const h = p.height;
  const legH = h * 0.45, torsoH = h * 0.32, headH = h * 0.22;
  const w = 0.35 * p.bulk;
  const near = !camera || Math.hypot((camera.x || 0) - p.x, (camera.z || 0) - p.z) < 40;
  const bob = Math.sin(p.walkPhase || 0) * 0.06;
  // Legs.
  pushBox(batch, p.x - w * 0.25, 0, p.z, w * 0.4, legH, w * 0.4, p.pantsColor);
  pushBox(batch, p.x + w * 0.25, 0, p.z, w * 0.4, legH, w * 0.4, p.pantsColor);
  // Torso.
  pushBox(batch, p.x, legH, p.z, w, torsoH, w * 0.6, p.shirtColor);
  // Arms.
  pushBox(batch, p.x - w * 0.65, legH + 0.05 + bob, p.z, w * 0.25, torsoH * 0.9, w * 0.25, p.shirtColor);
  pushBox(batch, p.x + w * 0.65, legH + 0.05 - bob, p.z, w * 0.25, torsoH * 0.9, w * 0.25, p.shirtColor);
  // Head + hair.
  pushBox(batch, p.x, legH + torsoH, p.z, w * 0.7, headH, w * 0.7, p.skinColor);
  pushBox(batch, p.x, legH + torsoH + headH * 0.75, p.z, w * 0.72, headH * 0.3, w * 0.72, p.hairColor);
  if (near) {
    // Eyes (a single thin box across the face).
    pushBox(batch, p.x, legH + torsoH + headH * 0.4, p.z + w * 0.36, w * 0.5, headH * 0.12, 0.05, [0.05, 0.05, 0.08]);
  }
  return 8;
}
