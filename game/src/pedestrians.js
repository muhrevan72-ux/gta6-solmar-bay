// Solmar Bay — pedestrians.
//
// 76 peds with routines: most walk the sidewalks, 7 sit on
// benches, 14 chat in pairs, 7 queue at the donut shop, 6 vend
// at food stalls. Peds flee from gunfire and explosions, and a
// ped killed by the player drops cash on the ground (a pickup,
// never silent income — see combat.js).
//
// SPAWN RULE (round-6 fix): randomSidewalkPoint rejects any point
// ON a road, and stepPed re-rolls a target that lands on a road.
// A ped that spawns on a road freezes (its target is unreachable
// and it never moves) — that was a flaky-test root cause.

import { makeRng, COL, TUNE } from './config.js';
import { pushBox } from './render.js';
import { tileUV } from './texture.js';
import { randomSidewalkPoint, isOnRoad, isBlocked } from './world.js';
import { dist } from './config.js';

export function hairBox(b, x, y, z, colour, style) {
  const uv = tileUV('plain');
  if (style === 0) pushBox(b, x, y + 0.35, z, 0.5, 0.2, 0.5, colour, uv);
  else if (style === 1) pushBox(b, x, y + 0.3, z, 0.55, 0.5, 0.55, colour, uv);
  else if (style === 2) pushBox(b, x, y + 0.4, z, 0.2, 0.45, 0.5, colour, uv); // mohawk
  else if (style === 3) pushBox(b, x, y + 0.35, z, 0.5, 0.35, 0.5, colour, uv); // spikes
  else pushBox(b, x, y + 0.3, z, 0.48, 0.25, 0.48, colour, uv);
  return 1;
}

export function spawnPeds(game) {
  const rng = makeRng(777);
  game.peds = [];
  const benches = game.city.benches;
  const donut = { x: 40, z: 132 };
  // 7 sitters on benches.
  for (let i = 0; i < 7; i++) {
    const bn = benches[i % benches.length];
    game.peds.push(makePed(rng, bn.x, bn.z, 'sit'));
  }
  // 14 chatters in 7 pairs.
  for (let i = 0; i < 7; i++) {
    const p = randomSidewalkPoint(rng);
    game.peds.push(makePed(rng, p.x, p.z, 'chat'));
    game.peds.push(makePed(rng, p.x + 1.2, p.z + 0.5, 'chat'));
  }
  // 7 queuers at the donut shop (on the sidewalk, not in the shop).
  for (let i = 0; i < 7; i++) {
    game.peds.push(makePed(rng, donut.x + 3 + i * 0.2, donut.z + 8 + i * 1.2, 'queue'));
  }
  // 6 vendors at food stalls. Stall points sit on the SIDEWALK
  // next to each shop front (8 m off the nearest road line) —
  // a stall ON a road line freezes the vendor (round-6 lesson).
  const stalls = [
    { x: -52, z: -24 },
    { x: 68, z: -20 },
    { x: -40, z: 73 },
    { x: 40, z: 135 },
    { x: 128, z: 71 },
    { x: -112, z: 48 },
  ];
  for (let i = 0; i < 6; i++) {
    game.peds.push(makePed(rng, stalls[i].x, stalls[i].z, 'vendor'));
  }
  // The rest walk the sidewalks.
  while (game.peds.length < TUNE.pedCap) {
    const p = randomSidewalkPoint(rng);
    game.peds.push(makePed(rng, p.x, p.z, 'walk'));
  }
}

function makePed(rng, x, z, activity) {
  const target = randomSidewalkPoint(rng);
  return {
    x,
    z,
    y: 0,
    heading: rng() * Math.PI * 2,
    hp: 100,
    speed: 1 + rng() * 1.2,
    activity, // walk | sit | chat | queue | vendor
    target,
    wait: rng() * 4,
    skin: COL.skin[Math.floor(rng() * COL.skin.length)],
    hair: COL.hair[Math.floor(rng() * COL.hair.length)],
    hairStyle: Math.floor(rng() * 5),
    shirt: COL.shirt[Math.floor(rng() * COL.shirt.length)],
    pants: [[0.25, 0.35, 0.6], [0.15, 0.15, 0.18], [0.5, 0.4, 0.3]][Math.floor(rng() * 3)],
    height: 1.7 + rng() * 0.3,
    bulk: 0.8 + rng() * 0.4,
    flee: 0,
    dead: false,
    id: Math.random().toString(36).slice(2, 8),
  };
}

export function stepPed(game, p, dt) {
  if (p.dead) return;
  if (p.flee > 0) {
    p.flee -= dt;
    // Run away from the player.
    const a = Math.atan2(p.x - game.player.x, p.z - game.player.z);
    const nx = p.x + Math.sin(a) * 6 * dt;
    const nz = p.z + Math.cos(a) * 6 * dt;
    if (!isBlocked(game.city, nx, nz)) {
      p.x = nx;
      p.z = nz;
    }
    p.heading = a;
    return;
  }
  if (p.activity === 'sit' || p.activity === 'chat' || p.activity === 'vendor') {
    // Stationary: small idle sway.
    p.wait -= dt;
    if (p.wait <= 0) {
      p.heading += (Math.random() - 0.5) * 1.2;
      p.wait = 2 + Math.random() * 4;
    }
    return;
  }
  if (p.activity === 'queue') {
    // Shuffle forward slowly.
    p.wait -= dt;
    if (p.wait <= 0) {
      p.z -= 0.3;
      p.wait = 3 + Math.random() * 3;
    }
    return;
  }
  // Walkers: head to the target, then pick a new one.
  const d = dist(p.x, p.z, p.target.x, p.target.z);
  if (d < 1.5) {
    p.wait -= dt;
    if (p.wait <= 0) {
      let t = randomSidewalkPoint(Math.random);
      // Never target a road point.
      if (isOnRoad(t.x, t.z)) t = { x: p.x, z: p.z + 20 };
      p.target = t;
      p.wait = 1 + Math.random() * 2;
    }
    return;
  }
  const a = Math.atan2(p.target.x - p.x, p.target.z - p.z);
  p.heading = a;
  const nx = p.x + Math.sin(a) * p.speed * dt;
  const nz = p.z + Math.cos(a) * p.speed * dt;
  if (!isBlocked(game.city, nx, nz)) {
    p.x = nx;
    p.z = nz;
  } else {
    // Blocked: pick a new target.
    p.target = randomSidewalkPoint(Math.random);
  }
}

export function stepPeds(game, dt) {
  for (const p of game.peds) stepPed(game, p, dt);
}

// Draw one ped: legs, torso, arms, head, hair, eyes at near LOD.
// Height/bulk vary per ped; gang members get bandanas (gangs.js).
export function pedBoxes(game, p, b, cam) {
  if (p.dead) return 0;
  const uv = tileUV('plain');
  const h = p.height;
  const w = 0.4 * p.bulk;
  const walk = p.activity === 'walk' ? Math.sin(game.time * 6 + p.x) * 0.2 : 0;
  const near = !cam || Math.hypot(p.x - cam.x, p.z - cam.z) < 40;
  pushBox(b, p.x - 0.15, 0, p.z + walk * 0.3, 0.28, h * 0.45, 0.28, p.pants, uv);
  pushBox(b, p.x + 0.15, 0, p.z - walk * 0.3, 0.28, h * 0.45, 0.28, p.pants, uv);
  pushBox(b, p.x, h * 0.45, p.z, w + 0.35, h * 0.35, 0.35, p.shirt, uv);
  pushBox(b, p.x - w / 2 - 0.2, h * 0.45, p.z, 0.18, h * 0.35, 0.18, p.skin, uv);
  pushBox(b, p.x + w / 2 + 0.2, h * 0.45, p.z, 0.18, h * 0.35, 0.18, p.skin, uv);
  pushBox(b, p.x, h * 0.8, p.z, 0.42, 0.42, 0.42, p.skin, uv);
  hairBox(b, p.x, h * 0.8 + 0.15, p.z, p.hair, p.hairStyle);
  if (near) {
    pushBox(b, p.x - 0.09, h * 0.82, p.z + 0.22, 0.06, 0.06, 0.02, [0.05, 0.05, 0.05], uv);
    pushBox(b, p.x + 0.09, h * 0.82, p.z + 0.22, 0.06, 0.06, 0.02, [0.05, 0.05, 0.05], uv);
  }
  return 8;
}
