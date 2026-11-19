// Solmar Bay — pedestrians: walk sidewalks in small groups, varied
// pace and colours, flee from danger, wander with smooth turns.
// Crowded: ~76 peds by default (the design cap).

import { TUNE, COL, FOOD_SHOPS, clamp, angleLerp, dist2 } from './config.js';
import { collideCircle, onRoad } from './world.js';

// Activities (feature pass 6, F1): most peds walk, but some sit on
// benches, some chat in pairs, some queue at food shops, and a few
// are street vendors. Activities change over time (except vendors).
const ACTIVITY = ['walk', 'walk', 'walk', 'walk', 'walk', 'walk', 'sit', 'chat', 'chat', 'queue', 'vendor'];

function spawnPed(city, index) {
  const activity = ACTIVITY[index % ACTIVITY.length];
  const ped = {
    id: index,
    x: 0,
    z: 0,
    heading: Math.random() * Math.PI * 2,
    targetHeading: Math.random() * Math.PI * 2,
    speed: 1.5 + Math.random() * 1.7, // varied pace, brisk enough to read as moving
    baseSpeed: 1.5 + Math.random() * 1.7,
    fleeing: 0,
    group: Math.floor(index / 4),
    skin: COL.skin[Math.floor(Math.random() * COL.skin.length)],
    shirt: COL.shirt[Math.floor(Math.random() * COL.shirt.length)],
    pants: [0.25, 0.35, 0.6],
    wanderT: 2 + Math.random() * 4,
    bob: Math.random() * 6,
    alive: true,
    activity,
    activityT: 20 + Math.random() * 20,
    spot: null, // fixed spot for sit / chat / queue / vendor
    partner: null, // ped id this ped chats with
  };
  const pt = randomSidewalkPoint(city);
  ped.x = pt.x;
  ped.z = pt.z;
  // place the ped at its activity spot
  if (activity === 'sit' && city.benches && city.benches.length) {
    const bench = city.benches[index % city.benches.length];
    ped.spot = { x: bench.x, z: bench.z };
    ped.x = bench.x;
    ped.z = bench.z;
    ped.heading = bench.heading;
    ped.targetHeading = bench.heading;
  } else if (activity === 'chat') {
    // pairs: the two 'chat' slots in each 11-ped block share a spot
    // and face each other (the first chat slot pairs with the next).
    const firstChat = ACTIVITY.indexOf('chat');
    const pair = Math.floor(index / ACTIVITY.length);
    const spot = chatSpot(city, pair);
    ped.spot = spot;
    const side = index % 2 === 0 ? -0.75 : 0.75;
    ped.x = spot.x + side;
    ped.z = spot.z;
    ped.heading = index % 2 === 0 ? Math.PI / 2 : -Math.PI / 2;
    ped.targetHeading = ped.heading;
    ped.partner = index % ACTIVITY.length === firstChat ? index + 1 : index - 1;
  } else if (activity === 'queue') {
    const shop = FOOD_SHOPS[index % FOOD_SHOPS.length];
    const front = shopFront(city, shop);
    const line = Math.floor(index / FOOD_SHOPS.length) % 4;
    // the line forms behind the front, away from the shop
    const dx = front.x - shop.x;
    const dz = front.z - shop.z;
    const len = Math.hypot(dx, dz) || 1;
    const ux = dx / len;
    const uz = dz / len;
    ped.spot = { x: front.x + ux * line * 1.6, z: front.z + uz * line * 1.6, shop, fx: front.x, fz: front.z, ux, uz };
    ped.x = ped.spot.x;
    ped.z = ped.spot.z;
  } else if (activity === 'vendor') {
    const shop = FOOD_SHOPS[index % FOOD_SHOPS.length];
    const spot = clearSpot(city, shop.x + 9, shop.z + 8);
    ped.spot = { x: spot.x, z: spot.z, shop };
    ped.x = ped.spot.x;
    ped.z = ped.spot.z;
    ped.heading = Math.atan2(shop.x - ped.x, shop.z - ped.z);
    ped.targetHeading = ped.heading;
  }
  return ped;
}

// Push a point out of any building collider, stepping in the
// direction collideCircle pushes (the nearest exit), so a spot near
// a shop is actually standable. The food-shop points sit inside
// their shop buildings, so a raw offset from one (a queue front, a
// vendor stall) would land inside the geometry and the ped would
// slide along the wall forever.
function clearSpot(city, x, z) {
  for (let i = 0; i < 24; i++) {
    const fixed = collideCircle(city, x, z, 0.6);
    if (fixed.x === x && fixed.z === z) return { x, z };
    const dx = fixed.x - x;
    const dz = fixed.z - z;
    const len = Math.hypot(dx, dz) || 1;
    x = fixed.x + (dx / len) * 1.5;
    z = fixed.z + (dz / len) * 1.5;
  }
  return { x, z };
}

// The front of a food shop's queue: just outside the shop building.
function shopFront(city, shop) {
  return clearSpot(city, shop.x, shop.z + 6);
}

// Deterministic-ish chat spots on sidewalks (seeded by pair index).
function chatSpot(city, pair) {
  const spots = [
    { x: -91, z: 20 }, { x: 109, z: -20 }, { x: -191, z: -91 }, { x: 191, z: 91 },
    { x: -91, z: 220 }, { x: 109, z: -220 }, { x: 9, z: 120 }, { x: -9, z: -120 },
  ];
  return spots[pair % spots.length];
}

export function createPedestrians(city, count) {
  const peds = [];
  const n = count || TUNE.pedCap;
  for (let i = 0; i < n; i++) {
    peds.push(spawnPed(city, peds.length));
  }
  return peds;
}

function randomSidewalkPoint(city) {
  for (let tries = 0; tries < 20; tries++) {
    const x = -300 + Math.random() * 600;
    const z = -300 + Math.random() * 600;
    // a road is within 7 units of a grid line on EITHER side
    // (onRoad is true for f < 7 or f > 93): the old check only
    // excluded the low side, so ~1 in 7 peds spawned ON a road and
    // could never step off it — the F4 flaky test's root cause
    const fx = Math.abs(x) % 100;
    const fz = Math.abs(z) % 100;
    if (fx < 12 || fx > 88 || fz < 12 || fz > 88) continue;
    if (city.spawns && Math.hypot(x - city.spawns.player.x, z - city.spawns.player.z) < 8) continue;
    return { x, z };
  }
  return { x: 40 + Math.random() * 40, z: 40 + Math.random() * 40 };
}

export function updatePedestrians(game, dt) {
  const peds = game.peds;
  const player = game.player;
  for (const ped of peds) {
    if (!ped.alive) continue;
    ped.bob += ped.speed * dt * 2;
    // flee if the player is close and fast/dangerous, or a bomb went off
    const d2p = dist2(ped.x, ped.z, player.x, player.z);
    if (d2p < 100 && (Math.abs(player.speed) > 8 || game.combat.bombWentOff)) {
      ped.fleeing = 2;
      if (ped.activity !== 'walk' && ped.activity !== 'vendor') ped.activity = 'walk';
    }
    if (ped.fleeing > 0) {
      ped.fleeing -= dt;
      const away = Math.atan2(ped.x - player.x, ped.z - player.z);
      ped.targetHeading = away;
      ped.speed = ped.baseSpeed * 3.2;
    } else if (ped.activity === 'sit') {
      // sitting on a bench: stay put, look around slowly
      ped.speed = 0;
      ped.wanderT -= dt;
      if (ped.wanderT <= 0) {
        ped.wanderT = 4 + Math.random() * 6;
        ped.targetHeading += (Math.random() - 0.5) * 1.2;
      }
    } else if (ped.activity === 'chat') {
      // chatting in a pair: stay at the spot, face the partner
      ped.speed = 0;
      const partner = peds[ped.partner];
      if (partner && partner.alive) {
        ped.targetHeading = Math.atan2(partner.x - ped.x, partner.z - ped.z);
      }
      ped.wanderT -= dt;
      if (ped.wanderT <= 0) {
        ped.wanderT = 3 + Math.random() * 4;
        ped.bob += 0.5; // a little gesture while talking
      }
    } else if (ped.activity === 'queue') {
      // queue at a food shop: inch toward the front, loop to the back
      const shop = ped.spot && ped.spot.shop;
      if (shop && ped.spot.fx !== undefined) {
        const fx = ped.spot.fx;
        const fz = ped.spot.fz;
        const d = Math.hypot(fx - ped.x, fz - ped.z);
        if (d < 1.5) {
          ped.x = fx + ped.spot.ux * (6 + Math.random() * 2);
          ped.z = fz + ped.spot.uz * (6 + Math.random() * 2);
        } else {
          ped.targetHeading = Math.atan2(fx - ped.x, fz - ped.z);
          ped.speed = 0.4;
        }
      } else {
        ped.speed = 0;
      }
    } else if (ped.activity === 'vendor') {
      // street vendor: stays at the stall, waves at passers-by
      ped.speed = 0;
      ped.bob += dt * 2;
    } else {
      ped.speed = ped.baseSpeed;
      ped.wanderT -= dt;
      if (ped.wanderT <= 0) {
        ped.wanderT = 3 + Math.random() * 5;
        ped.targetHeading = Math.random() * Math.PI * 2;
      }
    }
    // activities change over time (vendors keep their stall)
    if (ped.activity !== 'vendor' && ped.fleeing <= 0) {
      ped.activityT -= dt;
      if (ped.activityT <= 0) {
        ped.activityT = 20 + Math.random() * 20;
        if (ped.activity === 'walk') {
          const r = Math.random();
          if (r < 0.08) {
            const bench = game.city.benches && game.city.benches[Math.floor(Math.random() * game.city.benches.length)];
            if (bench) {
              ped.activity = 'sit';
              ped.spot = { x: bench.x, z: bench.z };
              ped.x = bench.x;
              ped.z = bench.z;
              ped.heading = bench.heading;
              ped.targetHeading = bench.heading;
            }
          } else if (r < 0.16) {
            const shop = FOOD_SHOPS[Math.floor(Math.random() * FOOD_SHOPS.length)];
            const front = shopFront(game.city, shop);
            const dx = front.x - shop.x;
            const dz = front.z - shop.z;
            const len = Math.hypot(dx, dz) || 1;
            ped.activity = 'queue';
            ped.spot = { x: front.x + (dx / len) * 6, z: front.z + (dz / len) * 6, shop, fx: front.x, fz: front.z, ux: dx / len, uz: dz / len };
            ped.x = ped.spot.x;
            ped.z = ped.spot.z;
          }
        } else {
          // sitters / chatters / queuers stand up and walk off
          if (Math.random() < 0.3) {
            ped.activity = 'walk';
            ped.spot = null;
          }
        }
      }
    }
    ped.heading = angleLerp(ped.heading, ped.targetHeading, 1 - Math.pow(0.001, dt));
    if (ped.speed <= 0) continue; // stationary activities do not move
    // queuers walk to their shop front; everyone else just wanders
    const goal = ped.activity === 'queue' && ped.spot && ped.spot.fx !== undefined
      ? { x: ped.spot.fx, z: ped.spot.fz }
      : null;
    stepPed(game, ped, dt, goal);
  }
}

// One movement step with local steering: try the current heading
// first, then deflections, so a ped never spins in place against a
// road or a wall. The old code skipped the whole frame when the next
// step landed on a road (turning 90 degrees and trying again next
// frame), which could pin a ped for seconds — the play-test saw
// peds that looked frozen, and two headless tests flaked on it.
// `target` (optional) makes the step prefer the heading that gets
// closest to a goal — used by queuers walking to a shop front.
function stepPed(game, ped, dt, target) {
  const step = ped.speed * dt;
  if (step <= 0) return false;
  const base = ped.heading;
  const offs = [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, (Math.PI * 3) / 4, (-Math.PI * 3) / 4, Math.PI];
  const onRoadNow = onRoad(ped.x, ped.z);
  let best = null;
  let bestD = Infinity;
  let bestOffRoad = false;
  for (const off of offs) {
    const h = base + off;
    const nx = ped.x + Math.sin(h) * step;
    const nz = ped.z + Math.cos(h) * step;
    // peds stay off roads: never step onto one from the sidewalk.
    // A ped already standing on a road — it fled there, or spawned
    // there before the spawn fix — must be able to step OFF it, so
    // the check is skipped while the ped is on the road.
    if (!onRoadNow && onRoad(nx, nz) && ped.fleeing <= 0) continue;
    const fixed = collideCircle(game.city, nx, nz, 0.6);
    const moved = Math.hypot(fixed.x - ped.x, fixed.z - ped.z);
    if (moved < step * 0.5) continue; // blocked by a wall: keep looking
    if (target) {
      const d = Math.hypot(target.x - fixed.x, target.z - fixed.z);
      if (d < bestD) {
        bestD = d;
        best = { x: fixed.x, z: fixed.z, heading: h };
      }
    } else if (onRoadNow) {
      // prefer a step that leaves the road; else the smallest deflection
      const offRoad = !onRoad(nx, nz);
      if (!best || (offRoad && !bestOffRoad)) {
        best = { x: fixed.x, z: fixed.z, heading: h };
        bestOffRoad = offRoad;
      }
      if (offRoad) break;
    } else {
      best = { x: fixed.x, z: fixed.z, heading: h };
      break; // smallest deflection that actually moves
    }
  }
  if (!best) return false;
  ped.x = best.x;
  ped.z = best.z;
  ped.heading = best.heading;
  return true;
}

// Voxel boxes for one pedestrian. Sitters get a seated pose, vendors
// a stall box in front of them. Graphics pass: the body faces the
// ped's heading (every box carries yaw), and walkers swing their
// legs/arms forward and back in body space by sin(bob) — a real
// walk cycle, not a sliding statue. A dark blob shadow grounds
// each ped (dropped for far peds by the LOD slice in main.js).
export function pedBoxes(ped) {
  const bobY = Math.sin(ped.bob) * 0.05;
  const yaw = ped.heading;
  const s = Math.sin(yaw);
  const c = Math.cos(yaw);
  // local (dx, dz) offset (right, forward) rotated by the heading
  const at = (dx, dz) => ({ x: ped.x + dx * c + dz * s, z: ped.z - dx * s + dz * c });
  const put = (boxes, dx, y, dz, sx, sy, sz, col) => {
    const p = at(dx, dz);
    boxes.push({ x: p.x, y, z: p.z, sx, sy, sz, c: col, yaw });
  };
  const boxes = [];
  if (ped.activity === 'sit') {
    // seated: legs forward, torso low on the bench
    put(boxes, 0, 0.5 + bobY, 0.5, 0.8, 0.4, 1.0, ped.pants);
    put(boxes, 0, 1.0 + bobY, 0, 0.9, 0.8, 0.5, ped.shirt);
    put(boxes, 0, 1.65 + bobY, 0, 0.6, 0.55, 0.55, ped.skin);
    put(boxes, 0, 1.95 + bobY, 0, 0.64, 0.2, 0.6, [0.15, 0.12, 0.1]);
    boxes.push({ x: ped.x, y: 0.06, z: ped.z, sx: 1.2, sy: 0.05, sz: 1.2, c: [0, 0, 0], yaw, a: 0.22 });
    return boxes;
  }
  // walking/queuing/fleeing peds swing; stationary ones stand still
  const moving = ped.activity === 'walk' || ped.activity === 'queue' || ped.fleeing > 0;
  const swing = moving ? Math.sin(ped.bob) * 0.28 : 0;
  // legs: opposite phases, swinging along the facing direction
  put(boxes, -0.22, 0.4 + bobY, swing, 0.4, 0.8, 0.4, ped.pants);
  put(boxes, 0.22, 0.4 + bobY, -swing, 0.4, 0.8, 0.4, ped.pants);
  // torso
  put(boxes, 0, 1.2 + bobY, 0, 0.9, 0.8, 0.5, ped.shirt);
  // arms: opposite to the legs, like a real gait
  put(boxes, -0.6, 1.2 + bobY, -swing * 0.8, 0.3, 0.7, 0.35, ped.shirt);
  put(boxes, 0.6, 1.2 + bobY, swing * 0.8, 0.3, 0.7, 0.35, ped.shirt);
  // head + hair
  put(boxes, 0, 1.85 + bobY, 0, 0.6, 0.55, 0.55, ped.skin);
  put(boxes, 0, 2.15 + bobY, 0, 0.64, 0.2, 0.6, [0.15, 0.12, 0.1]);
  if (ped.activity === 'vendor') {
    // stall table + goods in front of the vendor
    const f = at(0, 1.2);
    boxes.push({ x: f.x, y: 0.6, z: f.z, sx: 2.0, sy: 1.2, sz: 1.0, c: [0.6, 0.4, 0.2], yaw });
    boxes.push({ x: f.x, y: 1.4, z: f.z, sx: 1.6, sy: 0.5, sz: 0.8, c: [0.95, 0.7, 0.2], yaw });
  }
  boxes.push({ x: ped.x, y: 0.06, z: ped.z, sx: 1.2, sy: 0.05, sz: 1.2, c: [0, 0, 0], yaw, a: 0.22 });
  return boxes;
}
