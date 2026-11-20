// Solmar Bay — the voxel city.
//
// A deterministic city (~800x800) built from a fixed seed, so the
// map never changes between sessions: downtown grid in the middle,
// beach + ocean on the west, harbour docks in the south, suburbs
// around the edges, an airport in the east, a highway loop around
// it all. Colliders are plain AABBs; the renderer gets its static
// geometry from buildStaticBoxes().

import { makeRng, clamp, COL, FOOD_SHOPS, SPAWNS } from './config.js';

export const CITY_HALF = 400;

// Road centrelines. Vertical roads run along z at these x values;
// horizontal roads run along x at these z values.
export const ROAD_X = [-240, -180, -120, -60, 0, 60, 120, 180, 240];
export const ROAD_Z = [-240, -180, -120, -60, 0, 60, 120, 180, 240];
export const ROAD_W = 12;

export function buildCity(seed = 1337) {
  const rng = makeRng(seed);
  const city = {
    buildings: [], // {x, z, w, d, h, colour, kind, district, yaw}
    colliders: [], // {x, z, hw, hd}
    roads: [], // road strips for the renderer
    neon: [], // {x, y, z, c, w} dynamic neon signs
    clouds: [], // {x, z, y, s}
    waves: [], // {x, z, phase}
    trees: [], // {x, z, palm}
    lamps: [],
    benches: [],
    lights: [], // traffic lights {x, z, t}
    containers: [],
    props: [], // {x, z, kind, colour}
    shops: [], // food shops + outfit shop (with door positions)
    doors: [], // interior/garage doors {x, z, id, label}
    districts: [],
    fishSpots: [],
  };

  const addCollider = (x, z, w, d) => {
    city.colliders.push({ x, z, hw: w / 2, hd: d / 2 });
  };
  const addBuilding = (b) => {
    city.buildings.push(b);
    addCollider(b.x, b.z, b.w, b.d);
    return b;
  };

  // ---- downtown towers (central grid blocks) ----
  const towerColours = [
    [0.72, 0.68, 0.62], [0.6, 0.62, 0.68], [0.78, 0.7, 0.58],
    [0.65, 0.6, 0.66], [0.7, 0.72, 0.6], [0.58, 0.66, 0.7],
  ];
  // Downtown towers stand on BLOCK CENTRES (+/-30, +/-90, ...),
  // never on road lines. Roads run at multiples of 60; a tower
  // centred on a road line would block the road, make traffic
  // clip through it, and kill line-of-sight along the road
  // (round-8 probe: a tower at (0,60) sat in the middle of road
  // x=0). The four blocks around the central plaza stay open.
  for (let gx = -2; gx <= 2; gx++) {
    for (let gz = -2; gz <= 2; gz++) {
      const bx = gx * 60 + 30;
      const bz = gz * 60 + 30;
      if (Math.abs(bx) < 45 && Math.abs(bz) < 45) continue; // central plaza
      // The elevator tower stands at (40,-80); skip its block.
      if (Math.abs(bx - 40) < 40 && Math.abs(bz + 80) < 40) continue;
      const h = 18 + Math.floor(rng() * 38);
      const w = 24 + Math.floor(rng() * 14);
      const d = 24 + Math.floor(rng() * 14);
      addBuilding({
        x: bx, z: bz, w, d, h,
        colour: towerColours[Math.floor(rng() * towerColours.length)],
        kind: 'tower', district: 'Downtown',
        yaw: rng() < 0.25 ? 0.12 : 0,
      });
    }
  }
  // The tallest tower, with the glass elevator on its side.
  // On the block centre (30,-90) (was 40,-80): the old spot's
  // faces intruded 4 m into roads x=60 and z=-60, so traffic on
  // lanes x=57 and z=-63 clipped its corner. The block centre
  // clears every road by 6 m; the tower loop already skips it.
  addBuilding({
    x: SPAWNS.elevatorTower.x, z: SPAWNS.elevatorTower.z,
    w: 36, d: 36, h: 70, colour: [0.62, 0.64, 0.72],
    kind: 'elevatorTower', district: 'Downtown', yaw: 0,
  });

  // ---- central plaza (open, benches + lamps + flowers) ----
  // Benches and lamps stay off the road bands: road x=0 runs
  // through the plaza, so a bench at x=-4 would sit ON the road
  // (round-8 probe: a sitter at (-4,-8) on road x=0).
  const benchXs = [-28, -18, -10, 10, 18, 28];
  for (let i = 0; i < 6; i++) {
    city.benches.push({ x: benchXs[i], z: -8, facing: 0 });
    city.benches.push({ x: benchXs[i], z: 8, facing: Math.PI });
  }
  const lampXs = [-32, -24, -16, 16, 24, 32, -40, 40];
  for (let i = 0; i < 8; i++) {
    city.lamps.push({ x: lampXs[i], z: i % 2 ? -16 : 16 });
  }

  // ---- suburb houses (ring around downtown) ----
  const houseColours = [
    [0.9, 0.75, 0.6], [0.75, 0.85, 0.9], [0.9, 0.85, 0.75],
    [0.85, 0.7, 0.7], [0.7, 0.85, 0.7], [0.95, 0.9, 0.8],
  ];
  for (let i = 0; i < 42; i++) {
    const ang = rng() * Math.PI * 2;
    const r = 220 + rng() * 110;
    const x = Math.round(Math.cos(ang) * r);
    const z = Math.round(Math.sin(ang) * r);
    if (x < -290) continue; // beach side stays open
    if (z > 250) continue; // harbour stays open
    if (x > 250 && z < -130) continue; // airport stays open
    if (Math.abs(x) < 200 && Math.abs(z) < 200) continue; // downtown
    const onRoad = ROAD_X.some((rx) => Math.abs(x - rx) < 14) || ROAD_Z.some((rz) => Math.abs(z - rz) < 14);
    if (onRoad) continue;
    addBuilding({
      x, z, w: 14 + Math.floor(rng() * 8), d: 12 + Math.floor(rng() * 8),
      h: 5 + Math.floor(rng() * 4),
      colour: houseColours[Math.floor(rng() * houseColours.length)],
      kind: 'house', district: 'Suburbs', yaw: 0,
    });
  }

  // ---- special buildings (fixed positions, from the design docs) ----
  addBuilding({
    x: SPAWNS.hospitalBuilding.x, z: SPAWNS.hospitalBuilding.z,
    w: SPAWNS.hospitalBuilding.w, d: SPAWNS.hospitalBuilding.d, h: 14,
    colour: [0.92, 0.92, 0.9], kind: 'hospital', district: 'Downtown', yaw: 0,
  });
  addBuilding({
    x: SPAWNS.policeStation.x, z: SPAWNS.policeStation.z,
    w: SPAWNS.policeStation.w, d: SPAWNS.policeStation.d, h: 12,
    colour: [0.2, 0.3, 0.65], kind: 'police', district: 'Downtown', yaw: 0,
  });
  addBuilding({
    x: SPAWNS.fireStation.x, z: SPAWNS.fireStation.z,
    w: SPAWNS.fireStation.w, d: SPAWNS.fireStation.d, h: 12,
    colour: [0.85, 0.2, 0.15], kind: 'fire', district: 'Downtown', yaw: 0,
  });
  addBuilding({
    x: SPAWNS.garage.x, z: SPAWNS.garage.z,
    w: 34, d: 22, h: 9, colour: [0.5, 0.55, 0.6],
    kind: 'garage', district: 'Downtown', yaw: 0,
  });
  city.doors.push({ x: SPAWNS.garageDoor.x, z: SPAWNS.garageDoor.z, id: 'garage', label: 'Garage' });

  // Food shops + outfit shop (doors on the shop fronts).
  // The shop BUILDING is set back off the road its front faces:
  // a building centred on a road line blocks the road (round-8
  // probe: all five shop buildings sat on road lines). The front
  // point and door stay where the player interacts; only the
  // building moves, to the nearest block interior.
  const SHOP_OFFSETS = {
    'Pizza Palace': { dx: 17, dz: -8 },
    'Burger Barn': { dx: -17, dz: -8 },
    "Clucky's Chicken": { dx: 0, dz: 9 },
    'Donut Dock': { dx: 0, dz: 9 },
    'Taco Tide': { dx: -17, dz: 9 },
  };
  for (const s of FOOD_SHOPS) {
    const off = SHOP_OFFSETS[s.name] || { dx: 0, dz: -8 };
    const bx = s.x + off.dx;
    const bz = s.z + off.dz;
    addBuilding({
      x: bx, z: bz, w: 18, d: 14, h: 8,
      colour: s.colour, kind: 'shop', district: 'Downtown', yaw: 0,
    });
    city.shops.push({ ...s, doorX: s.x, doorZ: s.z - 1 });
    city.doors.push({ x: s.x, z: s.z - 1, id: 'shop-' + s.name, label: s.name });
  }
  // Outfit shop: building set back east off road x=-120; the
  // door stays at the front point (-120, 52).
  addBuilding({
    x: -103, z: 44, w: 18, d: 14, h: 9,
    colour: [0.85, 0.6, 0.9], kind: 'outfit', district: 'Downtown', yaw: 0,
  });
  city.doors.push({ x: SPAWNS.outfitDoor.x, z: SPAWNS.outfitDoor.z, id: 'outfit', label: 'Outfit Shop' });

  // Interior rooms live far away at (0, 380); the room shells are
  // built by interiors.js, not here.

  // ---- harbour (south): docks, containers, crane ----
  for (let i = 0; i < 10; i++) {
    const cx = -160 + i * 36;
    const cz = 300 + (i % 2) * 22;
    const h = 6 + (i % 3) * 6;
    city.containers.push({ x: cx, z: cz, w: 12, d: 8, h, colour: [[0.9, 0.3, 0.2], [0.2, 0.6, 0.9], [0.95, 0.75, 0.15], [0.3, 0.8, 0.4]][i % 4] });
    addCollider(cx, cz, 12, 8);
  }
  city.props.push({ x: 60, z: 320, kind: 'crane', colour: [0.95, 0.75, 0.15] });
  addCollider(60, 320, 10, 10);
  // Docks: wooden strips over the harbour water.
  city.props.push({ x: -60, z: 330, kind: 'dock', colour: [0.6, 0.45, 0.3] });
  city.props.push({ x: 120, z: 330, kind: 'dock', colour: [0.6, 0.45, 0.3] });

  // ---- airport (east): runway, hangars, control tower ----
  city.props.push({ x: SPAWNS.runway.x, z: SPAWNS.runway.z, kind: 'runway', colour: [0.14, 0.14, 0.16] });
  // Hangars at z=-150 (was -170): the old row straddled road
  // z=-180 and the first hangar straddled road x=240, so traffic
  // clipped through them. The new row clears both roads, and the
  // control tower clears the hangars.
  for (let i = 0; i < 3; i++) {
    addBuilding({
      x: 276 + i * 44, z: -150, w: 30, d: 24, h: 10,
      colour: [0.7, 0.72, 0.75], kind: 'hangar', district: 'Airport', yaw: 0,
    });
  }
  addBuilding({
    x: 340, z: -105, w: 10, d: 10, h: 26,
    colour: [0.8, 0.82, 0.85], kind: 'tower', district: 'Airport', yaw: 0,
  });

  // ---- beach (west): sand, palms, umbrellas, pier ----
  for (let i = 0; i < 14; i++) {
    city.trees.push({ x: -308, z: -280 + i * 44, palm: true });
  }
  for (let i = 0; i < 8; i++) {
    const ux = -360 + (i % 4) * 18;
    const uz = -140 + Math.floor(i / 4) * 120;
    city.props.push({ x: ux, z: uz, kind: 'umbrella', colour: [[0.95, 0.3, 0.3], [0.3, 0.6, 0.95], [0.95, 0.8, 0.2], [0.4, 0.85, 0.4]][i % 4] });
  }
  city.props.push({ x: SPAWNS.pier.x, z: SPAWNS.pier.z, kind: 'pier', colour: [0.6, 0.45, 0.3] });
  city.fishSpots.push({ x: -360, z: 120 }, { x: -350, z: -60 }, { x: -100, z: 340 });

  // ---- parks: trees, flowers, pots, benches ----
  const parks = [{ x: -90, z: 90 }, { x: 150, z: 150 }, { x: -150, z: -150 }];
  for (const p of parks) {
    for (let i = 0; i < 5; i++) {
      city.trees.push({ x: p.x - 16 + rng() * 32, z: p.z - 16 + rng() * 32, palm: false });
    }
    for (let i = 0; i < 10; i++) {
      city.props.push({
        x: p.x - 18 + rng() * 36, z: p.z - 18 + rng() * 36, kind: 'flower',
        colour: [[0.95, 0.3, 0.5], [0.95, 0.8, 0.2], [0.6, 0.4, 0.95], [0.95, 0.95, 0.95]][Math.floor(rng() * 4)],
      });
    }
    for (let i = 0; i < 4; i++) {
      city.props.push({ x: p.x - 14 + i * 9, z: p.z + 20, kind: 'pot', colour: [0.6, 0.35, 0.2] });
    }
    city.benches.push({ x: p.x, z: p.z - 20, facing: Math.PI });
  }

  // ---- street props: lamps along main roads, hydrants, bus stops ----
  for (const rx of [-120, 0, 120]) {
    for (let z = -220; z <= 220; z += 44) city.lamps.push({ x: rx + 8, z });
  }
  for (let i = 0; i < 9; i++) {
    city.props.push({ x: -60 + (i % 3) * 60, z: -180 + Math.floor(i / 3) * 120, kind: 'hydrant', colour: [0.9, 0.15, 0.15] });
  }
  for (const bx of [-60, 60]) {
    city.props.push({ x: bx, z: 132, kind: 'busstop', colour: [0.2, 0.5, 0.9] });
  }
  for (let i = 0; i < 12; i++) {
    city.props.push({ x: -200 + (i % 4) * 130, z: -200 + Math.floor(i / 4) * 140, kind: 'trash', colour: [0.3, 0.3, 0.33] });
  }

  // ---- neon signs on downtown towers (~42) ----
  for (const b of city.buildings) {
    if (b.kind !== 'tower' && b.kind !== 'elevatorTower') continue;
    const n = b.kind === 'elevatorTower' ? 4 : 2;
    for (let i = 0; i < n; i++) {
      city.neon.push({
        x: b.x + (rng() < 0.5 ? -1 : 1) * (b.w / 2 + 0.3),
        y: 4 + rng() * (b.h - 8),
        z: b.z + (rng() - 0.5) * b.d * 0.7,
        c: COL.neon[Math.floor(rng() * COL.neon.length)],
        w: 3 + rng() * 3,
      });
    }
  }

  // ---- clouds (10) + ocean wave crests (12) ----
  for (let i = 0; i < 10; i++) {
    city.clouds.push({ x: -350 + rng() * 700, z: -350 + rng() * 700, y: 85 + rng() * 35, s: 10 + rng() * 14 });
  }
  for (let i = 0; i < 12; i++) {
    city.waves.push({ x: -390 + rng() * 60, z: -360 + rng() * 720, phase: rng() * Math.PI * 2 });
  }

  // ---- traffic lights at 24 intersections ----
  for (const rx of [-120, 0, 120]) {
    for (const rz of [-180, -60, 60, 180]) {
      city.lights.push({ x: rx + 7, z: rz + 7, t: Math.floor(rng() * 18) });
      city.lights.push({ x: rx - 7, z: rz - 7, t: Math.floor(rng() * 18) });
    }
  }

  // ---- train loop (rectangle around the city) + station ----
  city.trainTrack = { x0: -300, z0: -300, x1: 300, z1: 300 };
  city.props.push({ x: SPAWNS.trainStation.x, z: SPAWNS.trainStation.z, kind: 'station', colour: [0.7, 0.7, 0.75] });

  return city;
}

// ---------- collision + placement ----------

export function isBlocked(city, x, z, r) {
  for (const c of city.colliders) {
    if (Math.abs(x - c.x) < c.hw + r && Math.abs(z - c.z) < c.hd + r) return true;
  }
  return false;
}

// True when the point is on a road strip (not sidewalk/building).
export function pointOnRoad(x, z) {
  for (const rx of ROAD_X) {
    if (Math.abs(x - rx) < ROAD_W / 2 && Math.abs(z) <= CITY_HALF) return true;
  }
  for (const rz of ROAD_Z) {
    if (Math.abs(z - rz) < ROAD_W / 2 && Math.abs(x) <= CITY_HALF) return true;
  }
  return false;
}

// A random point on a sidewalk: near a road, not on the road
// itself, not inside a building, not in the water, not on the
// highway ring. Peds spawn here.
export function randomSidewalkPoint(city, rng) {
  for (let tries = 0; tries < 40; tries++) {
    const horizontal = rng() < 0.5;
    const road = (horizontal ? ROAD_Z : ROAD_X)[Math.floor(rng() * ROAD_Z.length)];
    const along = (rng() * 2 - 1) * (CITY_HALF - 20);
    const side = rng() < 0.5 ? -1 : 1;
    const off = ROAD_W / 2 + 1.5 + rng() * 3;
    const x = horizontal ? along : road + side * off;
    const z = horizontal ? road + side * off : along;
    if (x < -300) continue; // beach water edge
    if (z > 280) continue; // harbour water edge
    if (Math.abs(x) > 300 || Math.abs(z) > 300) continue; // highway ring
    // The point must be off EVERY road, not just the one it runs
    // alongside: the `along` coordinate can land on a crossing
    // road (round-5 flaky test: ~1 in 7 peds spawned ON a road).
    if (pointOnRoad(x, z)) continue;
    if (isBlocked(city, x, z, 1)) continue;
    return { x, z };
  }
  return { x: 10, z: 10 };
}

// District name for a position (HUD location line).
export function districtAt(x, z) {
  if (x < -300) return 'Beach';
  if (z > 260) return 'Harbour';
  if (x > 250 && z < -130) return 'Airport';
  if (Math.abs(x) < 180 && Math.abs(z) < 180) return 'Downtown';
  if (Math.abs(x) > 300 || Math.abs(z) > 300) return 'Highway';
  return 'Suburbs';
}

// ---------- static geometry ----------

// Emit every static box into a batch. Ground first (so the depth
// buffer has something under everything), then roads, buildings,
// props. The batch is built once at boot and drawn every frame.
export function buildStaticBoxes(city, batch) {
  // Ground: one big grass slab, top at y=0.
  batch.pushBox(0, -1, 0, CITY_HALF * 2, 1, CITY_HALF * 2, [0.42, 0.62, 0.35], 'grass');
  // Beach sand (west strip).
  batch.pushBox(-360, 0, 0, 80, 0.3, CITY_HALF * 2, COL.sand, 'sand');
  // Ocean (west of the beach) + harbour basin (south).
  batch.pushBox(-420, -0.8, 0, 80, 0.6, CITY_HALF * 2 + 200, COL.water, 'water');
  batch.pushBox(0, -0.8, 360, 500, 0.6, 80, COL.water, 'water');
  // Roads: asphalt strips + lane dashes + sidewalks.
  for (const rx of ROAD_X) {
    batch.pushBox(rx, 0.02, 0, ROAD_W, 0.08, CITY_HALF * 2, COL.road, 'asphalt');
    batch.pushBox(rx - ROAD_W / 2 - 2, 0.02, 0, 4, 0.08, CITY_HALF * 2, COL.sidewalk, 'sidewalk');
    batch.pushBox(rx + ROAD_W / 2 + 2, 0.02, 0, 4, 0.08, CITY_HALF * 2, COL.sidewalk, 'sidewalk');
    for (let z = -380; z < 380; z += 24) {
      batch.pushBox(rx, 0.08, z, 0.6, 0.05, 8, COL.roadLine, 'plain');
    }
  }
  for (const rz of ROAD_Z) {
    batch.pushBox(0, 0.02, rz, CITY_HALF * 2, 0.08, ROAD_W, COL.road, 'asphalt');
    batch.pushBox(0, 0.02, rz - ROAD_W / 2 - 2, CITY_HALF * 2, 0.08, 4, COL.sidewalk, 'sidewalk');
    batch.pushBox(0, 0.02, rz + ROAD_W / 2 + 2, CITY_HALF * 2, 0.08, 4, COL.sidewalk, 'sidewalk');
    for (let x = -380; x < 380; x += 24) {
      batch.pushBox(x, 0.08, rz, 8, 0.05, 0.6, COL.roadLine, 'plain');
    }
  }
  // Highway loop (outer rectangle).
  batch.pushBox(0, 0.02, -330, 680, 0.08, 10, COL.road, 'asphalt');
  batch.pushBox(0, 0.02, 330, 680, 0.08, 10, COL.road, 'asphalt');
  batch.pushBox(-330, 0.02, 0, 10, 0.08, 680, COL.road, 'asphalt');
  batch.pushBox(330, 0.02, 0, 10, 0.08, 680, COL.road, 'asphalt');

  // Buildings: brick body, glass window bands, roof details.
  for (const b of city.buildings) {
    if (b.yaw) batch.pushBoxRot(b.x, 0, b.z, b.w, b.h, b.d, b.yaw, b.colour, 'brick');
    else batch.pushBox(b.x, 0, b.z, b.w, b.h, b.d, b.colour, 'brick');
    // Window bands on the two long faces.
    const floors = Math.max(1, Math.floor(b.h / 4));
    for (let f = 1; f <= floors; f++) {
      const wy = f * 4 - 1.5;
      if (wy > b.h - 1) break;
      batch.pushBox(b.x, wy, b.z + b.d / 2 + 0.15, b.w * 0.8, 1.6, 0.3, COL.glass, 'plain');
      batch.pushBox(b.x, wy, b.z - b.d / 2 - 0.15, b.w * 0.8, 1.6, 0.3, COL.glass, 'plain');
    }
    // Roof: AC unit + antenna on towers.
    if (b.kind === 'tower' || b.kind === 'elevatorTower') {
      batch.pushBox(b.x - b.w / 4, b.h, b.z, 4, 2, 4, [0.6, 0.6, 0.62], 'plain');
      batch.pushBox(b.x + b.w / 4, b.h, b.z, 0.4, 8, 0.4, [0.4, 0.4, 0.42], 'plain');
      // Balconies on the south face.
      for (let f = 2; f * 5 < b.h; f++) {
        batch.pushBox(b.x, f * 5, b.z + b.d / 2 + 0.8, b.w * 0.5, 0.4, 1.6, [0.55, 0.5, 0.45], 'plain');
      }
    }
    // Ground-floor shop awnings + sign boards.
    if (b.kind === 'shop' || b.kind === 'outfit') {
      batch.pushBox(b.x, 3.4, b.z + b.d / 2 + 1, b.w * 0.9, 0.3, 2.4, b.colour, 'plain');
      batch.pushBox(b.x, 5.2, b.z + b.d / 2 + 0.4, b.w * 0.7, 1.4, 0.5, [1.2, 1.2, 1.2], 'plain');
    }
    // Hospital cross, police + fire signs.
    if (b.kind === 'hospital') {
      batch.pushBox(b.x, b.h + 0.5, b.z, 6, 1.2, 0.5, [1.2, 0.2, 0.2], 'plain');
    }
    if (b.kind === 'elevatorTower') {
      // Glass elevator shaft on the south face.
      batch.pushBox(b.x + b.w / 2 + 1, 0, b.z, 3, b.h, 4, [0.5, 0.8, 1.0], 'plain');
    }
  }

  // Trees (trunk + canopy, palms get fronds).
  for (const t of city.trees) {
    batch.pushBox(t.x, 0, t.z, 0.8, 4, 0.8, COL.trunk, 'plain');
    if (t.palm) {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        batch.pushBoxRot(t.x + Math.cos(a) * 1.6, 4.2, t.z + Math.sin(a) * 1.6, 3.2, 0.3, 0.8, a, COL.palmLeaf, 'plain');
      }
      batch.pushBox(t.x, 4.6, t.z, 1.2, 1, 1.2, [0.5, 0.3, 0.15], 'plain'); // coconuts
    } else {
      batch.pushBox(t.x, 4, t.z, 4, 3.5, 4, COL.leaf, 'plain');
      batch.pushBox(t.x, 6.5, t.z, 2.6, 2, 2.6, [0.25, 0.62, 0.3], 'plain');
    }
  }

  // Lamps, benches, traffic lights.
  for (const l of city.lamps) {
    batch.pushBox(l.x, 0, l.z, 0.4, 5, 0.4, [0.25, 0.25, 0.28], 'plain');
    batch.pushBox(l.x, 5, l.z, 1.4, 0.5, 1.4, [1.3, 1.25, 0.9], 'plain');
  }
  for (const b of city.benches) {
    batch.pushBox(b.x, 0.4, b.z, 3, 0.4, 1.2, [0.55, 0.4, 0.25], 'plain');
    batch.pushBox(b.x, 0.4, b.z - 0.6, 3, 1.4, 0.3, [0.55, 0.4, 0.25], 'plain');
  }
  for (const l of city.lights) {
    batch.pushBox(l.x, 0, l.z, 0.5, 6, 0.5, [0.2, 0.2, 0.22], 'plain');
    batch.pushBox(l.x, 6, l.z, 1, 2.4, 1, [0.15, 0.15, 0.15], 'plain');
  }

  // Harbour: containers, crane, docks.
  for (const c of city.containers) {
    batch.pushBox(c.x, 0, c.z, c.w, c.h, c.d, c.colour, 'plain');
  }
  for (const p of city.props) {
    if (p.kind === 'crane') {
      batch.pushBox(p.x - 4, 0, p.z, 2, 26, 2, p.colour, 'plain');
      batch.pushBox(p.x + 4, 0, p.z, 2, 26, 2, p.colour, 'plain');
      batch.pushBox(p.x, 24, p.z, 22, 2, 2, p.colour, 'plain');
      batch.pushBox(p.x + 10, 22, p.z, 1, 6, 1, [0.3, 0.3, 0.3], 'plain');
    } else if (p.kind === 'dock') {
      batch.pushBox(p.x, 0, p.z, 30, 0.8, 8, p.colour, 'plain');
    } else if (p.kind === 'pier') {
      batch.pushBox(p.x, 0, p.z, 10, 0.8, 60, p.colour, 'plain');
      for (let i = 0; i < 4; i++) {
        batch.pushBox(p.x - 4, 0.8, p.z - 24 + i * 16, 0.8, 2.4, 0.8, [0.4, 0.3, 0.2], 'plain');
      }
    } else if (p.kind === 'umbrella') {
      batch.pushBox(p.x, 0, p.z, 0.4, 2.6, 0.4, [0.5, 0.4, 0.3], 'plain');
      batch.pushBox(p.x, 2.6, p.z, 4, 0.3, 4, p.colour, 'plain');
    } else if (p.kind === 'flower') {
      batch.pushBox(p.x, 0, p.z, 0.5, 0.7, 0.5, p.colour, 'plain');
    } else if (p.kind === 'pot') {
      batch.pushBox(p.x, 0, p.z, 1.2, 1, 1.2, p.colour, 'plain');
    } else if (p.kind === 'hydrant') {
      batch.pushBox(p.x, 0, p.z, 0.9, 1.4, 0.9, p.colour, 'plain');
    } else if (p.kind === 'busstop') {
      batch.pushBox(p.x, 0, p.z, 4, 0.4, 1.6, p.colour, 'plain');
      batch.pushBox(p.x - 1.8, 0.4, p.z, 0.4, 3, 0.4, p.colour, 'plain');
      batch.pushBox(p.x + 1.8, 0.4, p.z, 0.4, 3, 0.4, p.colour, 'plain');
      batch.pushBox(p.x, 3.4, p.z, 4.4, 0.4, 2, p.colour, 'plain');
    } else if (p.kind === 'trash') {
      batch.pushBox(p.x, 0, p.z, 1.2, 1.6, 1.2, p.colour, 'plain');
    } else if (p.kind === 'runway') {
      batch.pushBox(p.x, 0.02, p.z, 40, 0.08, 220, p.colour, 'asphalt');
      for (let z = -360; z < -160; z += 20) {
        batch.pushBox(p.x, 0.08, z, 2, 0.05, 8, [0.95, 0.95, 0.95], 'plain');
      }
    } else if (p.kind === 'station') {
      batch.pushBox(p.x, 0, p.z, 30, 1, 10, [0.6, 0.6, 0.62], 'plain');
      batch.pushBox(p.x, 5, p.z, 30, 0.5, 12, [0.4, 0.45, 0.55], 'plain');
    }
  }

  // Train loop track: dark strips + sleepers on the rectangle.
  const t = city.trainTrack;
  const track = (x, z, w, d) => batch.pushBox(x, 0.05, z, w, 0.1, d, [0.2, 0.2, 0.22], 'plain');
  track(0, t.z0, t.x1 - t.x0, 2);
  track(0, t.z1, t.x1 - t.x0, 2);
  track(t.x0, 0, 2, t.z1 - t.z0);
  track(t.x1, 0, 2, t.z1 - t.z0);

  return batch;
}

// Traffic-light state: 18 s cycle — green 8, yellow 2, red 8.
export function lightState(light, time) {
  const c = (time + light.t) % 18;
  if (c < 8) return 'green';
  if (c < 10) return 'yellow';
  return 'red';
}

export { COL };
