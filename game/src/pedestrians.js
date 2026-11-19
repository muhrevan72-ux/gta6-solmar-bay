// Solmar Bay — pedestrians: ambient life.
//
// 76 peds by default: ~42 walk the sidewalks, 7 sit on benches, 14
// chat in pairs, 7 queue at food shops, 6 are street vendors with
// stalls. Activities re-roll over time (vendors keep their stall).
// Peds flee from danger, fight back when punched, and gang members
// (gold Bay Kings downtown, teal Harbour Sharks at the harbour) turn
// hostile if the player causes trouble in their turf.
//
// FIX (graphics pass): the old generator only excluded the low side
// of road lines, so ~1 in 7 peds spawned ON a road, and stepPed
// refused every step while on a road — the ped froze forever (6-12
// of 42 walkers stuck per run). Two fixes here: spawn uses
// randomSidewalkPoint (rejects both sides of every road line), and
// stepPed lets an on-road ped step toward the nearest off-road
// direction instead of refusing to move.

import { TUNE, COL, GANGS, makeRng, clamp, dist2 } from './config.js';
import { randomSidewalkPoint, clearSpot, collideCircle, isOnRoad } from './world.js';
import { damagePlayer } from './state.js';

const ACTIVITIES = ['walk', 'sit', 'chat', 'queue', 'vendor'];

export function createPeds(city, rng) {
  const r = rng || Math.random;
  const list = [];
  const benchSpots = city.benches.map((b) => ({ x: b.x, z: b.z }));
  // Food points (the standable spot in front of each shop), NOT the
  // building centres — the old list used the donut shop's centre
  // (40, 120), so its queue spot (40, 122) was INSIDE the shop and
  // queuers spawned inside a building.
  const shopSpots = [
    { x: -60, z: -27 }, { x: 60, z: -23 }, { x: -40, z: 70 },
    { x: 40, z: 132 }, { x: 120, z: 68 },
  ];
  function basePed(activity) {
    const spot = randomSidewalkPoint(city, r);
    // Visual variety (visual overhaul): every ped gets a hair colour
    // + style, a height and a shoulder width, so the crowd stops
    // reading as clones. Hair is always exactly ONE box — the style
    // changes its dimensions, never the count (the LOD test asserts
    // exact box counts).
    const HAIR_STYLES = ['cap', 'long', 'mohawk', 'buzz', 'ponytail'];
    return {
      x: spot.x, z: spot.z,
      heading: r() * Math.PI * 2,
      speed: 1.5 + r() * 1.7, // 1.5-3.2 u/s
      target: null,
      activity,
      activityT: 20 + r() * 40,
      bob: r() * 6,
      skin: COL.skin[Math.floor(r() * COL.skin.length)],
      shirt: COL.shirt[Math.floor(r() * COL.shirt.length)],
      pants: [0.25, 0.35, 0.6],
      hair: COL.hair[Math.floor(r() * COL.hair.length)],
      hairStyle: HAIR_STYLES[Math.floor(r() * HAIR_STYLES.length)],
      height: 0.92 + r() * 0.16, // 0.92-1.08
      bulk: 0.72 + r() * 0.2, // shoulder width 0.72-0.92
      gang: null,
      hp: 100,
      hitT: 0, // attack cooldown (gang members, foot cops)
      fleeing: false,
      chatting: null, // partner ped for 'chat'
      queueSpot: null,
      vendorSpot: null,
      seated: false,
    };
  }
  // Walkers.
  for (let i = 0; i < 42; i++) list.push(basePed('walk'));
  // Sitters on benches.
  for (let i = 0; i < 7; i++) {
    const p = basePed('sit');
    const b = benchSpots[i % benchSpots.length];
    p.x = b.x;
    p.z = b.z;
    p.seated = true;
    list.push(p);
  }
  // Chatters in pairs (share a spot, face each other).
  for (let i = 0; i < 7; i++) {
    const spot = randomSidewalkPoint(city, r);
    const a = basePed('chat');
    const b = basePed('chat');
    a.x = spot.x; a.z = spot.z;
    b.x = spot.x + 1.2; b.z = spot.z + 0.4;
    a.chatting = b; b.chatting = a;
    a.heading = Math.atan2(b.x - a.x, b.z - a.z);
    b.heading = Math.atan2(a.x - b.x, a.z - b.z);
    list.push(a, b);
  }
  // Queuers at food shops.
  for (let i = 0; i < 7; i++) {
    const p = basePed('queue');
    const shop = shopSpots[i % shopSpots.length];
    // Stand a couple of metres out from the shop front, off-road.
    p.queueSpot = { x: shop.x + (r() - 0.5) * 2, z: shop.z + 2 + i * 0.2 };
    p.x = p.queueSpot.x + (r() - 0.5) * 6;
    p.z = p.queueSpot.z + 3 + r() * 4;
    list.push(p);
  }
  // Vendors with stalls (they keep their stall when activities re-roll).
  // A vendor stands on the sidewalk 8-12m from a road line and faces
  // it — close enough that the street is visibly in front of them.
  // (randomSidewalkPoint keeps peds >= 12m from every road, which put
  // vendors too far from the street to read as facing it.)
  function vendorSpot(city2) {
    for (let tries = 0; tries < 30; tries++) {
      const vertical = r() < 0.5;
      const line = (Math.floor(r() * 7) - 3) * 100; // -300..300
      const along = -300 + r() * 600;
      // The along-coordinate must also be clear of every road line,
      // or the vendor ends up standing ON the cross-road.
      const f = ((along % 100) + 100) % 100;
      if (f < 12 || f > 88) continue;
      const off = 8 + r() * 4; // 8-12m into the block
      const side = r() < 0.5 ? -1 : 1;
      const x = vertical ? line + side * off : along;
      const z = vertical ? along : line + side * off;
      if (clearSpot(city2, x, z, 1)) return { x, z, vertical, line, side };
    }
    const s = randomSidewalkPoint(city2, r);
    return { ...s, vertical: true, line: 0, side: 1 };
  }
  for (let i = 0; i < 6; i++) {
    const p = basePed('vendor');
    const spot = vendorSpot(city);
    p.vendorSpot = spot;
    p.x = spot.x;
    p.z = spot.z;
    // Face the road line.
    p.heading = spot.vertical ? Math.atan2(-spot.side, 0) : Math.atan2(0, -spot.side);
    list.push(p);
  }
  // Gang members: 25 total, gold downtown (Bay Kings) and teal at
  // the harbour (Harbour Sharks), hanging out in their turf. Spawn
  // points are re-rolled until they are clear of buildings — the old
  // raw rectangle put kings members inside the mid-rise at (50, -150).
  for (let i = 0; i < 25; i++) {
    const kings = i % 2 === 0;
    const p = basePed('walk');
    p.gang = kings ? 'kings' : 'sharks';
    p.shirt = [...GANGS[p.gang].colour];
    for (let tries = 0; tries < 30; tries++) {
      if (kings) {
        p.x = -80 + r() * 160;
        p.z = -180 + r() * 160;
      } else {
        p.x = 260 + r() * 100;
        p.z = -180 + r() * 120;
      }
      if (clearSpot(city, p.x, p.z, 1)) break;
    }
    list.push(p);
  }
  return { list };
}

export function stepPeds(game, dt) {
  const peds = game.peds.list;
  const player = game.state.player;
  for (const p of peds) {
    if (p.hp <= 0) continue;
    p.activityT -= dt;
    // Flee from danger (nearby explosion, gunfire, or the player
    // driving at them).
    const pd = dist2(p.x, p.z, player.x, player.z);
    p.fleeing = pd < 100 && (game.combat.recentShotT > 0 || game.combat.recentBombT > 0 || (player.inCar && player.speed > 10));
    if (p.fleeing) {
      stepPed(game, p, dt, true);
      continue;
    }
    if (p.activity === 'sit' || p.activity === 'vendor') {
      // Seated peds and vendors stay put; vendors face the street.
      p.bob += dt * 0.5;
      if (p.activityT <= 0 && p.activity === 'sit') {
        p.activity = 'walk';
        p.seated = false;
        p.activityT = 20 + Math.random() * 40;
        p.target = randomSidewalkPoint(game.city, Math.random);
      }
      continue;
    }
    if (p.activity === 'chat') {
      // Chatters stay near their partner, facing them.
      if (p.chatting && p.chatting.hp > 0) {
        p.heading = Math.atan2(p.chatting.x - p.x, p.chatting.z - p.z);
      }
      p.bob += dt * 0.5;
      if (p.activityT <= 0) {
        p.activity = 'walk';
        p.chatting = null;
        p.activityT = 20 + Math.random() * 40;
        p.target = randomSidewalkPoint(game.city, Math.random);
      }
      continue;
    }
    if (p.activity === 'queue') {
      // Advance toward the shop front; never walk away from it.
      if (p.queueSpot) {
        const d = Math.sqrt(dist2(p.x, p.z, p.queueSpot.x, p.queueSpot.z));
        if (d > 1.2) {
          const nx = p.x + ((p.queueSpot.x - p.x) / d) * p.speed * dt;
          const nz = p.z + ((p.queueSpot.z - p.z) / d) * p.speed * dt;
          // Only accept the step if it gets closer to the shop AND
          // stays out of buildings (the old code never collided).
          const nd = Math.sqrt(dist2(nx, nz, p.queueSpot.x, p.queueSpot.z));
          if (nd < d && !collideCircle(game.city, nx, nz, 0.8)) {
            p.x = nx;
            p.z = nz;
            p.heading = Math.atan2(p.queueSpot.x - p.x, p.queueSpot.z - p.z);
            p.bob += p.speed * dt * 1.6;
          }
        } else {
          p.heading = Math.atan2(p.queueSpot.x - p.x, p.queueSpot.z - p.z);
        }
      }
      if (p.activityT <= 0) {
        p.activity = 'walk';
        p.activityT = 20 + Math.random() * 40;
        p.target = randomSidewalkPoint(game.city, Math.random);
      }
      continue;
    }
    stepPed(game, p, dt, false);
    // Re-roll activity occasionally.
    if (p.activityT <= 0) {
      p.activityT = 25 + Math.random() * 45;
      if (Math.random() < 0.25) {
        p.activity = 'sit';
        p.seated = true;
      } else if (Math.random() < 0.15) {
        p.activity = 'queue';
        p.queueSpot = { x: p.x, z: p.z };
      }
    }
  }
}

// One walking step. If the ped somehow stands ON a road, it steps
// toward the nearest off-road direction instead of freezing.
export function stepPed(game, p, dt, fleeing) {
  const player = game.state.player;
  if (!p.target || dist2(p.x, p.z, p.target.x, p.target.z) < 4) {
    p.target = randomSidewalkPoint(game.city, Math.random);
  }
  let tx = p.target.x;
  let tz = p.target.z;
  if (fleeing) {
    // Run away from the player.
    const d = Math.sqrt(dist2(p.x, p.z, player.x, player.z)) || 1;
    tx = p.x + ((p.x - player.x) / d) * 30;
    tz = p.z + ((p.z - player.z) / d) * 30;
  }
  const d = Math.sqrt(dist2(p.x, p.z, tx, tz)) || 1;
  let dx = (tx - p.x) / d;
  let dz = (tz - p.z) / d;
  // On a road? Cross it toward the target: move along the road axis
  // (the axis whose block fraction is FARTHEST from the block centre)
  // in the direction of the target. DEAD ZONE (visual-overhaul fix):
  // if the target is already within 1.5 m on the crossing axis, do
  // NOT step on that axis — the old code took Math.sign of a ~0
  // difference, flipped every frame, and the ped oscillated in place
  // forever (2 of 12 diagnostic runs froze a ped on the highway
  // ring, target a fraction of a metre away on the crossing axis).
  // Instead step on the other axis toward the target.
  if (isOnRoad(p.x, p.z)) {
    const fx = ((p.x % 100) + 100) % 100;
    const fz = ((p.z % 100) + 100) % 100;
    const ddx = tx - p.x;
    const ddz = tz - p.z;
    if (Math.abs(fx - 50) > Math.abs(fz - 50)) {
      if (Math.abs(ddx) > 1.5) { dx = Math.sign(ddx); dz = 0; }
      else { dx = 0; dz = Math.sign(ddz) || 1; }
    } else {
      if (Math.abs(ddz) > 1.5) { dz = Math.sign(ddz); dx = 0; }
      else { dz = 0; dx = Math.sign(ddx) || 1; }
    }
  }
  const sp = (fleeing ? p.speed * 1.8 : p.speed);
  const nx = p.x + dx * sp * dt;
  const nz = p.z + dz * sp * dt;
  const hit = collideCircle(game.city, nx, nz, 0.8);
  if (!hit) {
    p.x = nx;
    p.z = nz;
  } else {
    // Slide along the wall: try the X-only and Z-only steps.
    if (!collideCircle(game.city, nx, p.z, 0.8)) p.x = nx;
    else if (!collideCircle(game.city, p.x, nz, 0.8)) p.z = nz;
    else p.target = randomSidewalkPoint(game.city, Math.random);
  }
  p.heading = Math.atan2(dx, dz);
  p.bob += sp * dt * 1.6;
}

// A ped hit by the player fights back (if close) and may drop cash
// when killed — handled by combat.js.
export function pedFightBack(game, p) {
  const s = game.state;
  if (p.hp <= 0) return;
  if (dist2(p.x, p.z, s.player.x, s.player.z) < 9) {
    // The ped swings at the player.
    if (Math.random() < 0.5) {
      damagePlayer(s, 5);
    }
    p.fleeing = false;
  }
}

// Voxel boxes for one ped: articulated humanoid with a walk cycle
// (legs/arms swing by sin(bob), body rotates to heading), per-ped
// proportions (height/bulk), hair styles, a face (eyes, near LOD
// only), a seated pose, and a gang bandana instead of hair for gang
// members. Far peds use LOD: 7 boxes (no shoes, shadow or eyes).
// Near peds draw 12 boxes. Box counts are exact — the LOD test
// asserts them — so every variant keeps the same counts: hair is
// always exactly one box (the style changes its dimensions), the
// bandana replaces the hair box, and the seated pose only moves
// boxes around.
export function pedBoxes(p, out, lod) {
  const h = p.height || 1;
  const bulk = p.bulk || 0.8;
  const swing = Math.sin(p.bob) * 0.5;
  const y = Math.abs(Math.sin(p.bob)) * 0.06;
  const seated = p.activity === 'sit' && p.seated;
  const drop = seated ? 0.35 : 0; // seated body sits lower
  const fx = Math.sin(p.heading); // forward
  const fz = Math.cos(p.heading);
  const rx = Math.cos(p.heading); // right
  const rz = -Math.sin(p.heading);
  const legY = y + 0.45 * h - drop;
  const torsoY = y + 1.25 * h - drop;
  const headY = y + 1.95 * h - drop;
  if (seated) {
    // Legs bent forward, horizontal (sitting on a bench).
    out.pushBoxRot(p.x - 0.2 + fx * 0.45, 0.5, p.z + fz * 0.45, 0.32, 0.32, 0.9, p.pants, p.heading);
    out.pushBoxRot(p.x + 0.2 + fx * 0.45, 0.5, p.z + fz * 0.45, 0.32, 0.32, 0.9, p.pants, p.heading);
  } else {
    out.pushBoxRot(p.x - 0.2, legY, p.z + swing * 0.35, 0.32, 0.9 * h, 0.32, p.pants, p.heading);
    out.pushBoxRot(p.x + 0.2, legY, p.z - swing * 0.35, 0.32, 0.9 * h, 0.32, p.pants, p.heading);
  }
  out.pushBoxRot(p.x, torsoY, p.z, bulk, 0.75 * h, 0.42, p.shirt, p.heading);
  out.pushBoxRot(p.x - (bulk / 2 + 0.12), torsoY, p.z - swing * 0.3, 0.24, 0.7 * h, 0.24, p.shirt, p.heading);
  out.pushBoxRot(p.x + (bulk / 2 + 0.12), torsoY, p.z + swing * 0.3, 0.24, 0.7 * h, 0.24, p.shirt, p.heading);
  out.pushBoxRot(p.x, headY, p.z, 0.52, 0.52 * h, 0.48, p.skin, p.heading);
  // Hair: exactly one box; the style changes its dimensions.
  // Gang members wear a bandana (gang colour) instead of hair.
  if (p.gang) {
    const bc = p.gang === 'kings' ? [0.95, 0.75, 0.15] : [0.1, 0.7, 0.7];
    out.pushBoxRot(p.x, headY + 0.12 * h, p.z, 0.56, 0.16, 0.52, bc, p.heading);
  } else {
    const hc = p.hair || [0.15, 0.12, 0.1];
    const hy = headY + 0.23 * h;
    if (p.hairStyle === 'long') out.pushBoxRot(p.x, hy - 0.1 * h, p.z - fz * 0.04, 0.54, 0.5 * h, 0.54, hc, p.heading);
    else if (p.hairStyle === 'mohawk') out.pushBoxRot(p.x, hy + 0.08 * h, p.z, 0.12, 0.45 * h, 0.5, hc, p.heading);
    else if (p.hairStyle === 'buzz') out.pushBoxRot(p.x, hy + 0.03 * h, p.z, 0.54, 0.08, 0.5, hc, p.heading);
    else if (p.hairStyle === 'ponytail') out.pushBoxRot(p.x, hy, p.z - fz * 0.08, 0.54, 0.2, 0.62, hc, p.heading);
    else out.pushBoxRot(p.x, hy, p.z, 0.54, 0.18, 0.5, hc, p.heading); // cap
  }
  if (!lod) {
    // Shoes (at the toes when seated, swinging when walking).
    const sx = seated ? fx * 0.85 : 0;
    const sz = seated ? fz * 0.85 : 0;
    out.pushBoxRot(p.x - 0.2 + sx, seated ? 0.15 : y + 0.08, p.z + sz + (seated ? 0 : swing * 0.35), 0.34, 0.16, 0.48, [0.2, 0.2, 0.22], p.heading);
    out.pushBoxRot(p.x + 0.2 + sx, seated ? 0.15 : y + 0.08, p.z + sz + (seated ? 0 : -swing * 0.35), 0.34, 0.16, 0.48, [0.2, 0.2, 0.22], p.heading);
    out.pushBox(p.x, 0.05, p.z, 1.0, 0.08, 1.0, [0.05, 0.05, 0.06]); // blob shadow
    // Eyes: two tiny dark boxes on the front of the head.
    const ey = headY + 0.03 * h;
    out.pushBox(p.x + fx * 0.26 + rx * 0.12, ey, p.z + fz * 0.26 + rz * 0.12, 0.09, 0.12, 0.06, [0.08, 0.08, 0.1]);
    out.pushBox(p.x + fx * 0.26 - rx * 0.12, ey, p.z + fz * 0.26 - rz * 0.12, 0.09, 0.12, 0.06, [0.08, 0.08, 0.1]);
  }
  // Vendor stall.
  if (p.activity === 'vendor' && p.vendorSpot) {
    out.pushBox(p.x, 0.6, p.z + 1.2, 2.2, 1.2, 1, [0.6, 0.4, 0.2]);
    out.pushBox(p.x, 1.35, p.z + 1.2, 2.4, 0.15, 1.2, [0.95, 0.75, 0.15]);
  }
}

export { ACTIVITIES };
