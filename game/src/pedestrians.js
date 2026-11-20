// Solmar Bay — pedestrians.
//
// 76 peds with visible routines: most walk the sidewalks, some
// sit on benches, some chat in pairs, some queue at food shops,
// a few sell things as vendors. They flee from danger (bombs,
// gunfire, fast cars). Hair is drawn by the shared hairBox()
// helper — the player uses the same one, so the outfit fix in
// player.js (hair colour from the outfit itself) applies here
// too. Peds get dark shoe boxes at near LOD (d <= 40), seated
// peds excluded — their feet are not under them.

import { TUNE, COL, makeRng, clamp, dist } from './config.js';
import { randomSidewalkPoint, isBlocked, ROAD_X, ROAD_Z, ROAD_W } from './world.js';

const HAIR_STYLES = ['flat', 'flat', 'ridge', 'flat', 'ridge', 'flat'];

// Shared hair box: a flat cap for crop/buzz, a standing ridge
// for mohawk/spikes. `ped` carries hairStyle + hair (colour).
// Exported so player.js draws the player with the same code.
export function hairBox(out, ped, y, heading) {
  const style = ped.hairStyle || 'flat';
  if (style === 'ridge') {
    out.push({ x: ped.x, y, z: ped.z, w: 0.22, h: 0.5, d: 0.62, c: ped.hair });
  } else {
    out.push({ x: ped.x, y, z: ped.z, w: 0.66, h: 0.22, d: 0.58, c: ped.hair });
  }
  return out;
}

export function spawnPeds(game) {
  const rng = makeRng(777);
  game.peds = [];
  const benches = game.city.benches;
  const shops = game.city.shops;
  for (let i = 0; i < TUNE.pedCap; i++) {
    const spot = randomSidewalkPoint(game.city, rng);
    const ped = {
      x: spot.x,
      z: spot.z,
      heading: rng() * Math.PI * 2,
      speed: 1.5 + rng() * 1.7,
      hp: 100,
      height: 0.92 + rng() * 0.16,
      bulk: 0.85 + rng() * 0.3,
      skin: COL.skin[Math.floor(rng() * COL.skin.length)],
      shirt: COL.shirt[Math.floor(rng() * COL.shirt.length)],
      pants: [0.25, 0.35, 0.6],
      hair: COL.hair[Math.floor(rng() * COL.hair.length)],
      hairStyle: HAIR_STYLES[Math.floor(rng() * HAIR_STYLES.length)],
      activity: 'walk',
      target: null,
      wait: 0,
      walkPhase: rng() * Math.PI * 2,
      fleeing: false,
      stuckTimer: 0,
    };
    // Assign activities: ~42 walk, 7 sit, 14 chat (7 pairs),
    // 7 queue, 6 vendors.
    if (i < 7 && benches.length > 0) {
      ped.activity = 'sit';
      const b = benches[i % benches.length];
      ped.x = b.x;
      ped.z = b.z + 0.2;
      ped.heading = b.facing || 0;
    } else if (i < 21) {
      ped.activity = 'chat';
      const partner = game.peds[i - 7];
      if (partner && partner.activity === 'chat') {
        ped.x = partner.x + 1.2;
        ped.z = partner.z + 0.4;
        ped.heading = Math.atan2(partner.x - ped.x, partner.z - ped.z);
        partner.heading = Math.atan2(ped.x - partner.x, ped.z - partner.z);
      }
    } else if (i < 28 && shops.length > 0) {
      ped.activity = 'queue';
      const s = shops[i % shops.length];
      ped.x = s.x + (rng() - 0.5) * 3;
      // The queue forms on the side AWAY from the shop building:
      // the building sits on the +z side of its front point, so a
      // queue at s.z + 2..+6 would spawn INSIDE the building
      // (round-8 probe: a queuer at (-39,72) inside Clucky's).
      ped.z = s.z - 2 - rng() * 4;
      ped.heading = Math.atan2(s.x - ped.x, s.z - ped.z);
    } else if (i < 34) {
      ped.activity = 'vendor';
      ped.x = spot.x;
      ped.z = spot.z;
    }
    game.peds.push(ped);
  }
}

// One ped step. dt seconds.
export function stepPed(game, ped, dt) {
  if (ped.hp <= 0) return;
  // Flee from the player when the player is violent or fast.
  const p = game.player;
  const pd = dist(p.x, p.z, ped.x, ped.z);
  const danger = (p.inCar && Math.abs(p.inCar.speed) > 12 && pd < 10) || game.flags.bombJustWentOff;
  ped.fleeing = danger && pd < 14;
  if (ped.activity === 'sit' || ped.activity === 'vendor') {
    // Sitters and vendors stay put (vendors face the street).
    if (ped.activity === 'vendor') ped.heading += Math.sin(game.time * 0.5 + ped.x) * 0.01;
    return;
  }
  if (ped.activity === 'chat') {
    ped.wait -= dt;
    if (ped.wait <= 0) {
      ped.wait = 2 + Math.random() * 3;
      ped.heading += (Math.random() - 0.5) * 0.4;
    }
    return;
  }
  if (ped.activity === 'queue') {
    // Queuers shuffle toward their shop; they must END UP closer,
    // not further away (round-5 flaky test).
    const shop = nearestShop(game, ped);
    if (shop) {
      const d = dist(ped.x, ped.z, shop.x, shop.z);
      if (d > 3.5) {
        const a = Math.atan2(shop.x - ped.x, shop.z - ped.z);
        ped.x += Math.sin(a) * 0.8 * dt;
        ped.z += Math.cos(a) * 0.8 * dt;
        ped.heading = a;
      }
    }
    return;
  }
  // Walkers: head for a target sidewalk point, pick a new one on
  // arrival. If stuck on a road for over a second, escape toward
  // the nearest road edge (the round-5 flaky ped bug).
  if (!ped.target || dist(ped.x, ped.z, ped.target.x, ped.target.z) < 2) {
    ped.target = randomSidewalkPoint(game.city, Math.random);
  }
  const a = Math.atan2(ped.target.x - ped.x, ped.target.z - ped.z);
  let diff = a - ped.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  ped.heading += clamp(diff, -3 * dt, 3 * dt);
  const speed = ped.fleeing ? ped.speed * 2.2 : ped.speed;
  const nx = ped.x + Math.sin(ped.heading) * speed * dt;
  const nz = ped.z + Math.cos(ped.heading) * speed * dt;
  if (!isBlocked(game.city, nx, ped.z, 0.6)) ped.x = nx;
  if (!isBlocked(game.city, ped.x, nz, 0.6)) ped.z = nz;
  ped.walkPhase += dt * speed * 2;
  // Stuck-on-road escape: a ped that ends up on a road (e.g. after
  // being knocked) walks to the nearest edge after a 1 s grace.
  // The grace matters — a ped briefly on a road during combat must
  // NOT be teleported.
  if (isOnRoad(ped.x, ped.z)) {
    ped.stuckTimer += dt;
    if (ped.stuckTimer > 1) {
      const edge = nearestRoadEdge(ped.x, ped.z);
      // The escape must not push the ped INTO a building: a wall
      // can stand right next to a road edge (round-8 flake: peds
      // hugging the hospital wall were lerped into its collider).
      // Move per axis, only into unblocked space.
      const tx = ped.x + (edge.x - ped.x) * Math.min(1, dt * 4);
      const tz = ped.z + (edge.z - ped.z) * Math.min(1, dt * 4);
      if (!isBlocked(game.city, tx, ped.z, 0.6)) ped.x = tx;
      if (!isBlocked(game.city, ped.x, tz, 0.6)) ped.z = tz;
      if (dist(ped.x, ped.z, edge.x, edge.z) < 0.5) ped.stuckTimer = 0;
    }
  } else {
    ped.stuckTimer = 0;
  }
}

function isOnRoad(x, z) {
  for (const rx of ROAD_X) if (Math.abs(x - rx) < ROAD_W / 2 && Math.abs(z) <= 400) return true;
  for (const rz of ROAD_Z) if (Math.abs(z - rz) < ROAD_W / 2 && Math.abs(x) <= 400) return true;
  return false;
}

function nearestRoadEdge(x, z) {
  let best = { x: x + 10, z };
  let bestD = Infinity;
  for (const rx of ROAD_X) {
    for (const side of [-1, 1]) {
      const ex = rx + side * (ROAD_W / 2 + 2);
      const d = Math.abs(ex - x);
      if (d < bestD) {
        bestD = d;
        best = { x: ex, z };
      }
    }
  }
  for (const rz of ROAD_Z) {
    for (const side of [-1, 1]) {
      const ez = rz + side * (ROAD_W / 2 + 2);
      const d = Math.abs(ez - z);
      if (d < bestD) {
        bestD = d;
        best = { x, z: ez };
      }
    }
  }
  return best;
}

function nearestShop(game, ped) {
  let best = null;
  let bestD = Infinity;
  for (const s of game.city.shops) {
    const d = dist(ped.x, ped.z, s.x, s.z);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

export function stepPeds(game, dt) {
  for (const ped of game.peds) stepPed(game, ped, dt);
}

// Draw a ped as voxel boxes into `out`.
export function pedBoxes(game, ped, out) {
  const bob = ped.activity === 'walk' || ped.fleeing ? Math.sin(ped.walkPhase) * 0.1 : 0;
  const legSwing = ped.activity === 'walk' || ped.fleeing ? Math.sin(ped.walkPhase) * 0.3 : 0;
  const h = ped.height;
  const w = 0.85 * ped.bulk;
  const sitY = ped.activity === 'sit' ? -0.45 : 0;
  const shoe = [0.12, 0.1, 0.1];
  const near = dist(game.player.x, game.player.z, ped.x, ped.z) <= 40;
  // Legs.
  out.push({ x: ped.x - 0.2 * w, y: 0.15 + Math.max(0, legSwing) * 0.35 + sitY, z: ped.z, w: 0.32, h: 0.7 * h, d: 0.32, c: ped.pants });
  out.push({ x: ped.x + 0.2 * w, y: 0.15 + Math.max(0, -legSwing) * 0.35 + sitY, z: ped.z, w: 0.32, h: 0.7 * h, d: 0.32, c: ped.pants });
  // Shoes at near LOD (seated peds excluded — feet are not under them).
  if (near && ped.activity !== 'sit') {
    out.push({ x: ped.x - 0.2 * w, y: 0, z: ped.z, w: 0.36, h: 0.16, d: 0.5, c: shoe });
    out.push({ x: ped.x + 0.2 * w, y: 0, z: ped.z, w: 0.36, h: 0.16, d: 0.5, c: shoe });
  }
  // Torso + arms + head.
  out.push({ x: ped.x, y: 0.85 * h + bob + sitY, z: ped.z, w: 0.8 * w, h: 0.8 * h, d: 0.45, c: ped.shirt });
  out.push({ x: ped.x - 0.5 * w, y: 0.85 * h + bob + sitY, z: ped.z, w: 0.24, h: 0.75 * h, d: 0.28, c: ped.shirt });
  out.push({ x: ped.x + 0.5 * w, y: 0.85 * h + bob + sitY, z: ped.z, w: 0.24, h: 0.75 * h, d: 0.28, c: ped.shirt });
  out.push({ x: ped.x, y: 1.65 * h + bob + sitY, z: ped.z, w: 0.58, h: 0.55 * h, d: 0.5, c: ped.skin });
  hairBox(out, ped, (1.65 + 0.55) * h + bob + sitY + 0.12, ped.heading);
  // Eyes at near LOD.
  if (near) {
    out.push({ x: ped.x - 0.13, y: 1.72 * h + bob + sitY, z: ped.z + 0.26, w: 0.08, h: 0.1, d: 0.05, c: [0.05, 0.05, 0.05] });
    out.push({ x: ped.x + 0.13, y: 1.72 * h + bob + sitY, z: ped.z + 0.26, w: 0.08, h: 0.1, d: 0.05, c: [0.05, 0.05, 0.05] });
  }
  // Vendors carry a tray.
  if (ped.activity === 'vendor') {
    out.push({ x: ped.x, y: 1.1, z: ped.z + 0.45, w: 0.9, h: 0.15, d: 0.5, c: [0.7, 0.55, 0.3] });
  }
  return out;
}
