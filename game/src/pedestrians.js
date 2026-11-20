// Solmar Bay — pedestrians: the living city.
//
// 76 peds with routines: ~42 walk the sidewalks, 7 sit on benches,
// 14 chat in pairs, 7 queue at food shops, 6 vendors run stalls.
// Routines re-roll over time, so the city never looks frozen.
//
// Spawn rule (fixed by the graphics pass): a ped's sidewalk point
// must have its road-line fraction in [12, 88] — BOTH sides of the
// road line are excluded, so nobody spawns ON a road. The old rule
// only excluded the low side, so ~1 in 7 peds spawned on a road and
// stepPed froze them forever (they could never leave the road).
// stepPed also steps a ped off a road if it ever ends up on one
// (with a 1.5 m dead zone at the road edge so crossing peds do not
// oscillate).

import { TUNE, COL, makeRng, clamp } from './config.js';
import { randomSidewalkPoint, isRoadAt } from './world.js';
import { showToast, addCash } from './state.js';

export function createPedestrians(city) {
  const list = [];
  for (let i = 0; i < TUNE.pedCap; i++) {
    list.push(spawnPed(city, i));
  }
  return list;
}

function spawnPed(city, i) {
  const roll = (i * 37) % 100;
  let role = 'walk';
  if (roll < 55) role = 'walk';
  else if (roll < 64) role = 'sit';
  else if (roll < 82) role = 'chat';
  else if (roll < 91) role = 'queue';
  else role = 'vendor';
  const pt = randomSidewalkPoint(city, makeRng(i + 1));
  const ped = {
    x: pt.x, z: pt.z,
    heading: Math.random() * Math.PI * 2,
    speed: 1.5 + ((i * 13) % 17) / 10, // 1.5-3.2 u/s
    role,
    target: null,
    waitT: 0,
    roadT: 0, // seconds spent standing on a road while walking
    bob: Math.random() * Math.PI * 2,
    shirt: COL.shirt[i % COL.shirt.length],
    pants: COL.pants[i % COL.pants.length],
    skin: COL.skin[i % COL.skin.length],
    hair: COL.hair[i % COL.hair.length],
    hairStyle: ['cap', 'long', 'mohawk', 'buzz', 'ponytail'][i % 5],
    height: 0.92 + ((i * 7) % 16) / 100,
    bulk: 0.72 + ((i * 11) % 20) / 100,
    gang: null,
    hp: 30,
    dead: false,
    activity: 'walk',
    shop: null, // the food shop this ped queues at / vends for
  };
  if (role === 'sit') {
    const bench = city.benches[i % city.benches.length];
    ped.x = bench.x;
    ped.z = bench.z;
    ped.heading = bench.rot || 0;
  } else if (role === 'chat') {
    const spot = city.chatSpots[i % city.chatSpots.length];
    ped.x = spot.x + ((i % 2) - 0.5) * 1.6;
    ped.z = spot.z + ((i % 3) - 1) * 1.2;
  } else if (role === 'queue') {
    const shop = city.foodShops[i % city.foodShops.length];
    ped.shop = shop;
    ped.x = shop.x + ((i % 3) - 1) * 1.5;
    ped.z = shop.z + 6 + (i % 3);
  } else if (role === 'vendor') {
    const shop = city.foodShops[i % city.foodShops.length];
    ped.shop = shop;
    ped.x = shop.x + 4;
    ped.z = shop.z + 2;
    ped.heading = Math.PI / 2;
  }
  return ped;
}

function pickWalkTarget(city, ped, i) {
  // A nearby sidewalk point; if the ped is on a road, step off it
  // first (the 1.5 m dead zone keeps crossing peds from oscillating
  // at the road edge).
  const pt = randomSidewalkPoint(city, Math.random);
  return pt;
}

export function stepPed(game, ped, dt, i) {
  if (ped.dead) return;
  const city = game.city;
  ped.waitT -= dt;
  // Routine re-roll: every 20-40 s a ped may change activity.
  if (ped.waitT <= 0) {
    ped.waitT = 20 + Math.random() * 20;
    const roll = Math.random();
    if (ped.role === 'walk') {
      ped.activity = roll < 0.7 ? 'walk' : 'idle';
    } else if (ped.role === 'chat' || ped.role === 'queue' || ped.role === 'sit' || ped.role === 'vendor') {
      ped.activity = ped.role;
    }
    if (ped.activity === 'walk') ped.target = pickWalkTarget(city, ped, i);
  }
  // Queuers walk toward their shop until they are in line (< 4 m),
  // then stand in the queue. (The old code left them standing 6-8 m
  // from the shop forever; the re-roll overwrote any walk target.)
  if (ped.role === 'queue' && ped.shop) {
    const d = Math.hypot(ped.x - ped.shop.x, ped.z - ped.shop.z);
    if (d > 4) {
      ped.activity = 'walk';
      ped.target = { x: ped.shop.x, z: ped.shop.z + 4 };
    } else {
      ped.activity = 'queue';
      ped.target = null;
    }
  }
  // If the ped has been stuck ON a road for > 1 s (walking in place),
  // step it off toward the nearest edge. The old sideways step ran
  // ALONG a north-south road (perpendicular to an eastward heading),
  // so a ped in the middle of a road could never leave it. The 1 s
  // grace matters: a ped only briefly on a road (placed there, or
  // standing next to the player on a road during combat) must NOT be
  // teleported away before the player can punch it.
  if (isRoadAt(city, ped.x, ped.z)) {
    ped.roadT += dt;
    if (ped.roadT > 1) {
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      let escaped = false;
      for (let dist = 2; dist <= 12 && !escaped; dist += 2) {
        for (const [dx, dz] of dirs) {
          const nx = ped.x + dx * dist;
          const nz = ped.z + dz * dist;
          if (!isRoadAt(city, nx, nz)) { ped.x = nx; ped.z = nz; escaped = true; break; }
        }
      }
      ped.roadT = 0;
      ped.target = pickWalkTarget(city, ped, i);
      ped.bob += dt * ped.speed * 2.2;
      return;
    }
  } else {
    ped.roadT = 0;
  }
  if (ped.activity === 'walk' && ped.target) {
    const dx = ped.target.x - ped.x;
    const dz = ped.target.z - ped.z;
    const d = Math.hypot(dx, dz);
    if (d < 1) {
      ped.target = pickWalkTarget(city, ped, i);
    } else {
      ped.heading = Math.atan2(dx, dz);
      const nx = ped.x + (dx / d) * ped.speed * dt;
      const nz = ped.z + (dz / d) * ped.speed * dt;
      // Never stand on a road: if the next step is on a road, step
      // off it sideways instead of freezing.
      if (isRoadAt(city, nx, nz)) {
        const off = 1.5;
        const px = ped.x + Math.cos(ped.heading) * off;
        const pz = ped.z - Math.sin(ped.heading) * off;
        if (!isRoadAt(city, px, pz)) { ped.x = px; ped.z = pz; }
        ped.target = pickWalkTarget(city, ped, i);
      } else {
        ped.x = nx;
        ped.z = nz;
      }
      ped.bob += dt * ped.speed * 2.2;
    }
  }
  // Flee: if the player punches nearby, peds run away.
  const p = game.state.player;
  const dp = Math.hypot(p.x - ped.x, p.z - ped.z);
  if (dp < 4 && game.state.wanted > 0) {
    const away = Math.atan2(ped.x - p.x, ped.z - p.z);
    ped.x += Math.sin(away) * 4 * dt;
    ped.z += Math.cos(away) * 4 * dt;
    ped.heading = away;
    ped.bob += dt * 8;
  }
}

export function stepPedestrians(game, dt) {
  game.peds.forEach((ped, i) => stepPed(game, ped, dt, i));
}

// The nearest living ped within range (for punching / talking).
export function findNearbyPed(game, x, z, range) {
  let best = null;
  let bestD = range;
  for (const ped of game.peds) {
    if (ped.dead) continue;
    const d = Math.hypot(ped.x - x, ped.z - z);
    if (d < bestD) { bestD = d; best = ped; }
  }
  return best;
}

// Peds as humanoids: legs + arms swing with the walk cycle, torso,
// head, hair by style, gang bandana when they belong to a gang.
// Seated peds sit (legs forward, torso upright). Far LOD: 5 boxes.
export function pedBoxes(game, out, near) {
  const p = game.state.player;
  for (const ped of game.peds) {
    if (ped.dead) continue;
    const d = Math.hypot(ped.x - p.x, ped.z - p.z);
    if (d > 220) continue;
    const h = ped.height * 1.9;
    const w = 0.5 * ped.bulk;
    const swing = ped.activity === 'walk' ? Math.sin(ped.bob) * 0.5 : 0;
    const legSwing = swing * 0.35;
    const seated = ped.role === 'sit' || ped.activity === 'sit';
    if (seated) {
      // Seated: legs forward, torso upright.
      out.pushBoxRot(ped.x, 0.35, ped.z + 0.3, 0.18, 0.7, 0.18, ped.pants, ped.heading);
      out.pushBoxRot(ped.x + 0.11, 0.35, ped.z + 0.3, 0.18, 0.7, 0.18, ped.pants, ped.heading);
      out.pushBoxRot(ped.x, 1.0, ped.z, w, 0.7, 0.28, ped.shirt, ped.heading);
      out.pushBoxRot(ped.x, 1.55, ped.z, 0.34, 0.36, 0.32, ped.skin, ped.heading);
      hairBox(out, ped, 1.75, ped.heading);
    } else {
      out.pushBoxRot(ped.x - 0.11, 0.45 * ped.height, ped.z, 0.18, 0.9 * ped.height, 0.18, ped.pants, ped.heading + legSwing * 0.3);
      out.pushBoxRot(ped.x + 0.11, 0.45 * ped.height, ped.z, 0.18, 0.9 * ped.height, 0.18, ped.pants, ped.heading - legSwing * 0.3);
      out.pushBoxRot(ped.x, 1.25 * ped.height, ped.z, w, 0.7 * ped.height, 0.28, ped.shirt, ped.heading);
      out.pushBoxRot(ped.x - 0.32, 1.25 * ped.height, ped.z, 0.14, 0.65 * ped.height, 0.14, ped.skin, ped.heading + swing * 0.4);
      out.pushBoxRot(ped.x + 0.32, 1.25 * ped.height, ped.z, 0.14, 0.65 * ped.height, 0.14, ped.skin, ped.heading - swing * 0.4);
      out.pushBoxRot(ped.x, 1.82 * ped.height, ped.z, 0.34, 0.36, 0.32, ped.skin, ped.heading);
      hairBox(out, ped, 2.02 * ped.height, ped.heading);
      if (near && d <= 80) {
        // Eyes (near LOD only).
        out.pushBoxRot(ped.x - 0.08, 1.84 * ped.height, ped.z + 0.17, 0.05, 0.05, 0.02, [0.1, 0.1, 0.1], ped.heading);
        out.pushBoxRot(ped.x + 0.08, 1.84 * ped.height, ped.z + 0.17, 0.05, 0.05, 0.02, [0.1, 0.1, 0.1], ped.heading);
      }
      if (near && d <= 40) {
        // Shoes (near LOD only): dark boxes at the feet, swinging
        // with the legs. Seated peds have no shoes here — their legs
        // are forward, so the feet are not under them.
        out.pushBoxRot(ped.x - 0.11, 0.06, ped.z + 0.04, 0.2, 0.12, 0.3, [0.12, 0.1, 0.1], ped.heading + legSwing * 0.3);
        out.pushBoxRot(ped.x + 0.11, 0.06, ped.z + 0.04, 0.2, 0.12, 0.3, [0.12, 0.1, 0.1], ped.heading - legSwing * 0.3);
      }
      if (ped.gang) {
        // Gang bandana.
        out.pushBoxRot(ped.x, 1.78 * ped.height, ped.z, 0.36, 0.08, 0.34, ped.gang === 'kings' ? COL.gangKings : COL.gangSharks, ped.heading);
      }
    }
    // Blob shadow.
    out.pushFlat(ped.x, 0.06, ped.z, 0.7, 0.7, [0, 0, 0], ped.heading);
  }
}

export function hairBox(out, ped, y, heading) {
  const style = ped.hairStyle;
  if (style === 'cap') {
    out.pushBoxRot(ped.x, y, ped.z, 0.38, 0.1, 0.36, [0.2, 0.2, 0.2], heading);
    out.pushBoxRot(ped.x, y - 0.02, ped.z + 0.22, 0.3, 0.04, 0.15, [0.2, 0.2, 0.2], heading);
  } else if (style === 'mohawk') {
    out.pushBoxRot(ped.x, y + 0.06, ped.z, 0.08, 0.18, 0.3, ped.hair, heading);
  } else if (style === 'long') {
    out.pushBoxRot(ped.x, y - 0.05, ped.z - 0.1, 0.36, 0.25, 0.15, ped.hair, heading);
  } else if (style === 'ponytail') {
    out.pushBoxRot(ped.x, y, ped.z, 0.36, 0.1, 0.34, ped.hair, heading);
    out.pushBoxRot(ped.x, y - 0.1, ped.z - 0.25, 0.1, 0.3, 0.1, ped.hair, heading);
  } else {
    // buzz
    out.pushBoxRot(ped.x, y, ped.z, 0.36, 0.08, 0.34, ped.hair, heading);
  }
}

// A killed ped drops cash on the ground (a pickup, collected with a
// toast — never silently).
export function dropCash(game, x, z) {
  const amount = TUNE.cashDropMin + Math.floor(Math.random() * (TUNE.cashDropMax - TUNE.cashDropMin));
  game.pickups.push({ x, z, amount, label: 'cash' });
}
