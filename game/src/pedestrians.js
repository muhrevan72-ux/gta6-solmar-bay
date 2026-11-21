// Solmar Bay — pedestrians: walkers, sitters, chatters, queues, vendors.
// Written fresh for rebuild #18. 76 peds total, never on a road,
// varied hair, height and bulk.

import { mulberry32, COL, TUNE } from './config.js';
import { isOnRoad, isBlocked, randomSidewalkPoint } from './world.js';
import { pushBox, pushBoxRot } from './render.js';

export function makePed(x, z, activity) {
  return {
    x, z, activity: activity || 'walk',
    hp: 100,
    dead: false,
    hair: Math.floor(Math.random() * 6),
    hairStyle: Math.floor(Math.random() * 5),
    style: Math.floor(Math.random() * 5),
    height: 1.7 + Math.random() * 0.3,
    bulk: 0.7 + Math.random() * 0.5,
    shirt: [Math.random(), Math.random(), Math.random()],
    pants: [Math.random() * 0.5, Math.random() * 0.5, Math.random() * 0.5],
    tx: x, tz: z,
    speed: 1 + Math.random() * 1.2,
    flee: false,
    chatPartner: null,
  };
}

export function spawnPeds(g) {
  const rng = mulberry32(2026);
  const peds = [];
  const counts = [
    ['sit', 7], ['chat', 14], ['queue', 7], ['vendor', 6], ['walk', 42],
  ];
  for (const [activity, n] of counts) {
    for (let i = 0; i < n; i++) {
      let x = 0, z = 0;
      let tries = 0;
      do {
        const p = randomSidewalkPoint(rng);
        x = p.x; z = p.z;
        tries++;
      } while ((isOnRoad(x, z) || isBlocked(g.city, x, z) || Math.hypot(x, z - 20) < 8) && tries < 40);
      const ped = makePed(x, z, activity);
      ped.hair = Math.floor(rng() * 6);
      ped.hairStyle = Math.floor(rng() * 5);
      ped.style = ped.hairStyle;
      ped.height = 1.7 + rng() * 0.3;
      ped.bulk = 0.7 + rng() * 0.5;
      ped.shirt = [rng(), rng(), rng()];
      ped.pants = [rng() * 0.5, rng() * 0.5, rng() * 0.5];
      ped.speed = 1 + rng() * 1.2;
      if (activity === 'walk') {
        const t = randomSidewalkPoint(rng);
        ped.tx = t.x; ped.tz = t.z;
      }
      peds.push(ped);
    }
  }
  g.peds = peds;
  return peds;
}

export function stepPed(g, ped, dt) {
  if (ped.dead) return;
  if (ped.flee) {
    // Run away from the player.
    const dx = ped.x - g.player.x, dz = ped.z - g.player.z;
    const d = Math.hypot(dx, dz) || 1;
    ped.x += (dx / d) * 5 * dt;
    ped.z += (dz / d) * 5 * dt;
    return;
  }
  if (ped.activity === 'walk') {
    const dx = ped.tx - ped.x, dz = ped.tz - ped.z;
    const d = Math.hypot(dx, dz);
    if (d < 2) {
      const t = randomSidewalkPoint(Math.random);
      ped.tx = t.x; ped.tz = t.z;
      return;
    }
    ped.x += (dx / d) * ped.speed * dt;
    ped.z += (dz / d) * ped.speed * dt;
  }
  // Sitters, chatters, queuers and vendors hold their spot.
}

export function stepPeds(g, dt) {
  for (const ped of g.peds) stepPed(g, ped, dt);
}

// 8 boxes for a live ped (incl. eyes when near), 0 when dead.
// `cam` is the camera; eyes are drawn when the camera is null or
// the ped is within 40 m of it.
export function pedBoxes(g, p, b, cam) {
  if (p.dead) return 0;
  const h = p.height;
  const w = p.bulk * 0.45;
  const hairCol = COL.hair[p.hair % COL.hair.length];
  const skin = [0.85, 0.65, 0.5];
  const legH = h * 0.5;
  const torsoH = h * 0.35;
  // Legs.
  pushBox(b, p.x - w * 0.2, 0, p.z, w * 0.25, legH, w * 0.3, p.pants, [0, 0, 1, 1]);
  pushBox(b, p.x + w * 0.2, 0, p.z, w * 0.25, legH, w * 0.3, p.pants, [0, 0, 1, 1]);
  // Torso.
  pushBox(b, p.x, legH, p.z, w, torsoH, w * 0.5, p.shirt, [0, 0, 1, 1]);
  // Arms.
  pushBox(b, p.x - w * 0.6, legH + 0.05, p.z, w * 0.2, torsoH * 0.85, w * 0.2, p.shirt, [0, 0, 1, 1]);
  pushBox(b, p.x + w * 0.6, legH + 0.05, p.z, w * 0.2, torsoH * 0.85, w * 0.2, p.shirt, [0, 0, 1, 1]);
  // Head.
  pushBox(b, p.x, legH + torsoH, p.z, w * 0.5, h * 0.18, w * 0.5, skin, [0, 0, 1, 1]);
  // Hair.
  pushBox(b, p.x, legH + torsoH + h * 0.18, p.z, w * 0.55, h * 0.07, w * 0.55, hairCol, [0, 0, 1, 1]);
  // Eyes — only when near (or when no camera was passed).
  const near = !cam || Math.hypot(p.x - cam.x, p.z - cam.z) < 40;
  if (near) {
    pushBox(b, p.x - w * 0.1, legH + torsoH + h * 0.08, p.z - w * 0.26, 0.04, 0.04, 0.04, [0.05, 0.05, 0.05], [0, 0, 1, 1]);
    return 8;
  }
  return 7;
}
