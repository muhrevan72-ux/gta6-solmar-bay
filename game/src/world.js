// Solmar Bay — the city.
//
// One deterministic build from seed 1337: a ~800x800 map with a
// grid of roads, a downtown of tall towers, houses, a harbour,
// a beach, an airport, parks, palms, and props. Every building
// sits on a BLOCK CENTRE (gx*60+30, gz*60+30) — never on a road
// line — because a building on a road line clips traffic and
// pushes hugging peds into its own collider. Static geometry is
// baked into a BoxBatch once at boot; dynamic things (neon signs,
// clouds, waves) are rebuilt every frame by main.js.
//
// Roads: every 60 units from -240 to +240, plus the ring road at
// ±360. ROAD_W is 12. The beach is the west strip (x < -300),
// the sea beyond it (x < -360).

import { makeRng, COL, SPAWNS, TUNE } from './config.js';
import { pushBox, pushBoxRot, pushQuad, batchReset } from './render.js';
import { tileUV } from './texture.js';

export const ROAD_W = 12;
export const ROAD_LINES = [-240, -180, -120, -60, 0, 60, 120, 180, 240];

export function isOnRoad(x, z) {
  for (const r of ROAD_LINES) {
    if (Math.abs(x - r) < ROAD_W / 2 + 1) return true;
    if (Math.abs(z - r) < ROAD_W / 2 + 1) return true;
  }
  if (Math.abs(x - 360) < ROAD_W / 2 + 1) return true;
  if (Math.abs(z - 360) < ROAD_W / 2 + 1) return true;
  if (Math.abs(x + 360) < ROAD_W / 2 + 1) return true;
  if (Math.abs(z + 360) < ROAD_W / 2 + 1) return true;
  return false;
}

export function pointOnRoad(x, z) {
  return isOnRoad(x, z);
}

export function isInCity(x, z) {
  return x >= -380 && x <= 380 && z >= -380 && z <= 380;
}

// A random point on a sidewalk (near a road, not on it).
export function randomSidewalkPoint(rng) {
  for (let tries = 0; tries < 20; tries++) {
    const road = ROAD_LINES[Math.floor(rng() * ROAD_LINES.length)];
    const along = -240 + rng() * 480;
    const side = rng() < 0.5 ? -1 : 1;
    const off = ROAD_W / 2 + 2 + rng() * 4;
    const horiz = rng() < 0.5;
    const x = horiz ? along : road + side * off;
    const z = horiz ? road + side * off : along;
    if (!isOnRoad(x, z) && isInCity(x, z)) return { x, z };
  }
  return { x: 0, z: 30 };
}

// A point on a road (for traffic spawns).
export function randomRoadPoint(rng) {
  const road = ROAD_LINES[Math.floor(rng() * ROAD_LINES.length)];
  const along = -240 + rng() * 480;
  if (rng() < 0.5) return { x: along, z: road, dir: rng() < 0.5 ? 0 : Math.PI };
  return { x: road, z: along, dir: rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2 };
}

export function districtAt(x, z) {
  if (x < -300) return 'Beach';
  if (x < -180 && z > 120) return 'Harbour';
  if (x > 240 && z < -120) return 'Airport';
  if (Math.abs(x) < 120 && Math.abs(z) < 120) return 'Downtown';
  if (z < -120) return 'Northside';
  if (z > 120) return 'Southside';
  if (x < 0) return 'Westside';
  return 'Eastside';
}

export function buildCity() {
  const rng = makeRng(1337);
  const city = {
    seed: 1337,
    buildings: [], // {x, z, w, h, d, col, kind, label}
    colliders: [], // {x, z, hw, hd}
    roads: ROAD_LINES.slice(),
    lamps: [],
    palms: [],
    trees: [],
    hydrants: [],
    benches: [],
    busStops: [],
    containers: [],
    towers: [],
    neon: [], // {x, y, z, w, h, col, text}
    clouds: [],
    waves: [],
    lights: [], // traffic lights {x, z, axis, state}
    houses: [],
    shops: [],
    landmarks: {},
    props: [],
  };

  const addBuilding = (x, z, w, h, d, col, kind, label) => {
    city.buildings.push({ x, z, w, h, d, col, kind, label: label || '' });
    city.colliders.push({ x, z, hw: w / 2 + 0.5, hd: d / 2 + 0.5 });
    return city.buildings[city.buildings.length - 1];
  };

  // B9 Minipoly polish: roof variety — 0 parapet rim, 1 stepped
  // pyramid (sloped), 2 AC unit + antenna. Deterministic from the
  // building size (no rng), returns the roof type name.
  const addRoof = (x, y, z, w, d, type) => {
    if (type === 0) {
      city.props.push({ kind: 'roof', x, y: y + 0.4, z, w: w + 1, h: 0.8, d: d + 1, col: [0.35, 0.35, 0.38] });
      return 'parapet';
    }
    if (type === 1) {
      city.props.push({ kind: 'roof', x, y: y + 1, z, w: w * 0.65, h: 2, d: d * 0.65, col: [0.6, 0.32, 0.25] });
      city.props.push({ kind: 'roof', x, y: y + 3, z, w: w * 0.35, h: 2, d: d * 0.35, col: [0.6, 0.32, 0.25] });
      return 'pyramid';
    }
    city.props.push({ kind: 'roof', x, y: y + 1, z, w: 4, h: 2, d: 4, col: [0.5, 0.5, 0.52] });
    city.props.push({ kind: 'roof', x: x + w / 4, y: y + 3, z: z - d / 4, w: 0.4, h: 6, d: 0.4, col: [0.25, 0.25, 0.28] });
    return 'ac';
  };

  // --- ground, beach, sea, runway ---
  city.ground = { x: 0, z: 0, w: 800, d: 800 };
  city.beach = { x: -330, z: 0, w: 60, d: 800 };
  city.sea = { x: -400, z: 0, w: 80, d: 800 };
  city.runway = { x: 300, z: -260, w: 30, d: 200 };

  // --- downtown towers (block centres) ---
  const towerCols = [
    [0.72, 0.68, 0.62],
    [0.6, 0.66, 0.75],
    [0.8, 0.72, 0.6],
    [0.55, 0.6, 0.68],
    [0.75, 0.6, 0.55],
    [0.95, 0.55, 0.45], // B9: Minipoly coral
    [0.35, 0.75, 0.75], // B9: Minipoly teal
  ];
  for (let gx = -1; gx <= 1; gx++) {
    for (let gz = -1; gz <= 1; gz++) {
      const x = gx * 60 + 30;
      const z = gz * 60 + 30;
      const h = 28 + rng() * 42;
      const w = 22 + rng() * 8;
      const col = towerCols[Math.floor(rng() * towerCols.length)];
      const b = addBuilding(x, z, w, h, w, col, 'tower', 'Tower');
      city.towers.push(b);
      // Balconies + roof detail on every tower.
      for (let f = 0; f < Math.floor(h / 8); f++) {
        city.props.push({ kind: 'balcony', x: x + w / 2 + 0.5, y: 6 + f * 8, z, w: 1, h: 0.8, d: 3, col: [0.4, 0.4, 0.42] });
      }
      // B9: roof variety by grid position (parapet / pyramid / AC).
      b.roof = addRoof(x, h, z, w, w, ((gx + 2) * 3 + (gz + 2)) % 3);
    }
  }
  // The elevator tower stands taller than the rest.
  const et = addBuilding(SPAWNS.elevatorTower.x, SPAWNS.elevatorTower.z, 24, 70, 24, [0.65, 0.6, 0.7], 'tower', 'Solmar Tower');
  et.roof = addRoof(SPAWNS.elevatorTower.x, 70, SPAWNS.elevatorTower.z, 24, 24, 1);
  city.landmarks.elevatorTower = { x: SPAWNS.elevatorTower.x, z: SPAWNS.elevatorTower.z, h: 70 };

  // --- houses (rings around downtown) ---
  const houseCols = [
    [0.9, 0.75, 0.55],
    [0.75, 0.85, 0.7],
    [0.9, 0.6, 0.6],
    [0.7, 0.8, 0.9],
    [0.95, 0.9, 0.75],
    [0.95, 0.85, 0.4], // B9: Minipoly sunny yellow
    [0.55, 0.85, 0.6], // B9: Minipoly mint
  ];
  for (let gx = -4; gx <= 4; gx++) {
    for (let gz = -4; gz <= 4; gz++) {
      if (Math.abs(gx) <= 1 && Math.abs(gz) <= 1) continue; // downtown
      if (gx === -5 || gz === 5) continue;
      const x = gx * 60 + 30;
      const z = gz * 60 + 30;
      if (x < -300 || x > 300 || z < -300 || z > 300) continue;
      if (rng() < 0.25) continue; // leave gaps for parks
      const h = 6 + rng() * 6;
      const col = houseCols[Math.floor(rng() * houseCols.length)];
      const hw = 14 + rng() * 6;
      const hd = 14 + rng() * 6;
      const b = addBuilding(x, z, hw, h, hd, col, 'house', 'House');
      city.houses.push(b);
      // B9: roof variety by grid position (same 3 types as towers).
      b.roof = addRoof(x, h, z, hw, hd, (Math.abs(gx * 5 + gz * 3)) % 3);
    }
  }

  // --- landmarks (block centres, clear of roads) ---
  const hosp = SPAWNS.hospitalBuilding;
  addBuilding(hosp.x, hosp.z, hosp.w, 18, hosp.d, [0.95, 0.95, 0.95], 'hospital', 'Solmar General');
  city.landmarks.hospital = { x: hosp.x, z: hosp.z, w: hosp.w, d: hosp.d };
  const ps = SPAWNS.policeStation;
  addBuilding(ps.x, ps.z, ps.w, 14, ps.d, [0.25, 0.35, 0.65], 'police', 'Police HQ');
  city.landmarks.police = { x: ps.x, z: ps.z };
  const fs = SPAWNS.fireStation;
  addBuilding(fs.x, fs.z, fs.w, 12, fs.d, [0.85, 0.2, 0.15], 'fire', 'Fire Station');
  city.landmarks.fire = { x: fs.x, z: fs.z };
  // Garage (south face -129: 3 m clear of road z=-120).
  addBuilding(SPAWNS.garage.x, SPAWNS.garage.z, 36, 10, 18, [0.4, 0.45, 0.55], 'garage', 'Bay Garage');
  city.landmarks.garage = { x: SPAWNS.garage.x, z: SPAWNS.garage.z };
  // Airport hangars + control tower.
  addBuilding(280, -180, 30, 12, 24, [0.7, 0.7, 0.72], 'hangar', 'Hangar 1');
  addBuilding(330, -180, 30, 12, 24, [0.7, 0.7, 0.72], 'hangar', 'Hangar 2');
  addBuilding(300, -320, 12, 40, 12, [0.8, 0.8, 0.82], 'control', 'Control Tower');
  city.landmarks.airport = { x: 300, z: -260 };
  // Food shops (their fronts are the interact points).
  const shopDefs = [
    { x: -60, z: -30, w: 18, d: 12, col: [0.9, 0.3, 0.2], label: 'Pizza Palace' },
    { x: 60, z: -30, w: 18, d: 12, col: [0.95, 0.6, 0.1], label: 'Burger Barn' },
    { x: -40, z: 78, w: 16, d: 12, col: [0.95, 0.8, 0.2], label: "Clucky's Chicken" },
    { x: 40, z: 140, w: 16, d: 12, col: [0.95, 0.5, 0.7], label: 'Donut Dock' },
    { x: 120, z: 75, w: 16, d: 12, col: [0.4, 0.8, 0.3], label: 'Taco Tide' },
  ];
  for (const s of shopDefs) {
    addBuilding(s.x, s.z, s.w, 8, s.d, s.col, 'shop', s.label);
    city.shops.push({ ...s });
  }
  // Outfit shop.
  addBuilding(-120, 60, 18, 8, 12, [0.7, 0.3, 0.8], 'outfit', 'Vice Threads');
  city.landmarks.outfit = { x: -120, z: 60 };

  // --- harbour: containers, crane, pier ---
  // B9: 16 containers (was 10) — new rows at z=208, 232.
  for (let i = 0; i < 16; i++) {
    const x = -260 - (i % 5) * 22;
    const z = 160 + Math.floor(i / 5) * 24;
    const col = COL.carPaint[i % COL.carPaint.length];
    city.containers.push({ x, z, w: 18, h: 6, d: 8, col });
    city.colliders.push({ x, z, hw: 9.5, hd: 4.5 });
  }
  city.props.push({ kind: 'crane', x: -240, y: 0, z: 220, w: 4, h: 30, d: 4, col: [0.9, 0.7, 0.1] });
  city.props.push({ kind: 'craneArm', x: -240, y: 28, z: 200, w: 3, h: 3, d: 40, col: [0.9, 0.7, 0.1] });
  city.landmarks.harbour = { x: -240, z: 200 };
  city.landmarks.pier = { x: SPAWNS.pier.x, z: SPAWNS.pier.z };

  // --- beach: umbrellas, palms, beach house ---
  for (let i = 0; i < 8; i++) {
    const z = -200 + i * 55;
    city.props.push({ kind: 'umbrella', x: -330, y: 0, z, w: 6, h: 3, d: 6, col: COL.carPaint[i % COL.carPaint.length] });
  }
  // B9: four more umbrellas on the west sand + one lounger chair beside
  // every umbrella (12 chairs), same colour as its umbrella.
  for (const z of [-320, -210, -100, 10]) {
    city.props.push({ kind: 'umbrella', x: -340, y: 0, z, w: 6, h: 3, d: 6, col: COL.carPaint[(city.props.length + 2) % COL.carPaint.length] });
  }
  for (const u of city.props.filter((p) => p.kind === 'umbrella')) {
    city.props.push({ kind: 'chair', x: u.x + 4, y: 0, z: u.z + 5, w: 1.6, h: 0.4, d: 2.4, col: u.col });
  }
  addBuilding(-320, 40, 20, 9, 16, [0.95, 0.85, 0.65], 'beachhouse', 'Beach House');
  city.landmarks.beachHouse = { x: -320, z: 40 };

  // --- palms + trees + lamps + benches + hydrants + bus stops ---
  for (let i = 0; i < 60; i++) {
    const x = -360 + rng() * 720;
    const z = -360 + rng() * 720;
    if (isOnRoad(x, z)) continue;
    if (x < -300) {
      city.palms.push({ x, z, h: 7 + rng() * 3 });
    } else if (rng() < 0.5) {
      city.trees.push({ x, z, h: 5 + rng() * 3 });
    }
  }
  for (const r of ROAD_LINES) {
    for (const s of [-240, -120, 0, 120, 240]) {
      city.lamps.push({ x: r + 8, z: s + 8 });
      city.lamps.push({ x: r - 8, z: s - 8 });
    }
  }
  // B9 Minipoly polish: palm rows on a deterministic grid (no extra
  // main-stream rng — the 60-placement loop above keeps its 9 palms).
  // Beach row A just off the ring road, beach row B mid-sand, and
  // both sidewalks of the main avenue (x=±8). Every candidate is
  // checked against roads, building colliders, the pier and the
  // beach house, so no palm ever blocks traffic or a doorway.
  const palmRows = [];
  for (let z = -330; z <= 330; z += 60) palmRows.push({ x: -352, z });
  for (let z = -340; z <= 340; z += 40) palmRows.push({ x: -318, z });
  for (const x of [-8, 8]) {
    for (const z of [-210, -150, -90, -30, 30, 90, 150, 210]) palmRows.push({ x, z });
  }
  // B9: the grid slot (-352,210) is blocked by the new container row
  // (-348,208), so the palm moves 20 m south to (-352,230) — clear of
  // the containers, the ring road and the pier.
  palmRows.push({ x: -352, z: 230 });
  for (const p of palmRows) {
    if (isOnRoad(p.x, p.z)) continue;
    if (isBlocked(city, p.x, p.z, 2)) continue;
    if (Math.hypot(p.x - SPAWNS.pier.x, p.z - SPAWNS.pier.z) < 16) continue;
    if (Math.hypot(p.x + 320, p.z - 40) < 16) continue; // beach house
    city.palms.push({ x: p.x, z: p.z, h: 7 + (Math.abs(p.x * 7 + p.z * 13) % 3) });
  }
  for (let i = 0; i < 24; i++) {
    const p = randomSidewalkPoint(rng);
    city.benches.push({ x: p.x, z: p.z });
    const p2 = randomSidewalkPoint(rng);
    city.hydrants.push({ x: p2.x, z: p2.z });
  }
  for (let i = 0; i < 6; i++) {
    const p = randomSidewalkPoint(rng);
    city.busStops.push({ x: p.x, z: p.z });
  }
  // B9: +6 benches, +6 hydrants, +2 bus stops on a separate stream
  // (main-stream rng untouched, so neon/clouds/waves do not move).
  const propRng = makeRng(9002);
  for (let i = 0; i < 6; i++) {
    const p = randomSidewalkPoint(propRng);
    city.benches.push({ x: p.x, z: p.z });
    const p2 = randomSidewalkPoint(propRng);
    city.hydrants.push({ x: p2.x, z: p2.z });
  }
  for (let i = 0; i < 2; i++) {
    const p = randomSidewalkPoint(propRng);
    city.busStops.push({ x: p.x, z: p.z });
  }
  // B9: rust-red barrels (procedural; colour differs from the GLB barrel's
  // red so the GLB test is not confused) — harbour cluster + one by the
  // fishing spot. All off-road (checked against road bands).
  for (const [bx, bz] of [[-270, 200], [-266, 204], [-274, 204], [-326, 106]]) {
    city.props.push({ kind: 'barrel', x: bx, y: 0, z: bz, w: 1.2, h: 1.6, d: 1.2, col: [0.75, 0.3, 0.15] });
  }

  // --- traffic lights at the 24 inner intersections ---
  for (const rx of [-180, -60, 60, 180]) {
    for (const rz of [-180, -60, 60, 180]) {
      city.lights.push({ x: rx, z: rz, axis: 'x', phase: (rx + rz) / 120 });
      city.lights.push({ x: rx, z: rz, axis: 'z', phase: (rx + rz) / 120 + 0.5 });
    }
  }

  // --- neon signs on downtown towers (~42) ---
  const neonTexts = ['HOTEL', 'CASINO', 'BAR', 'CLUB', 'PIZZA', 'TACOS', '24H', 'NEON', 'VICE', 'BAY'];
  for (const t of city.towers) {
    for (let i = 0; i < 4; i++) {
      const col = COL.neon[Math.floor(rng() * COL.neon.length)];
      city.neon.push({
        x: t.x + (rng() < 0.5 ? -1 : 1) * (t.w / 2 + 0.4),
        y: 8 + rng() * (t.h - 12),
        z: t.z + (rng() - 0.5) * t.d * 0.7,
        w: 1.2,
        h: 3 + rng() * 2,
        col,
        text: neonTexts[Math.floor(rng() * neonTexts.length)],
      });
    }
  }
  // A few more on the beachfront.
  for (let i = 0; i < 6; i++) {
    city.neon.push({
      x: -300,
      y: 6 + i * 2,
      z: -150 + i * 60,
      w: 1.2,
      h: 4,
      col: COL.neon[i % COL.neon.length],
      text: neonTexts[i % neonTexts.length],
    });
  }
  // B9: six more on Solmar Tower (elevator tower, 24x24, 70 tall), on a
  // separate stream so the main-stream neon does not move.
  const towerRng = makeRng(9004);
  for (let i = 0; i < 6; i++) {
    city.neon.push({
      x: SPAWNS.elevatorTower.x + (towerRng() < 0.5 ? -1 : 1) * (24 / 2 + 0.4),
      y: 8 + towerRng() * (70 - 12),
      z: SPAWNS.elevatorTower.z + (towerRng() - 0.5) * 24 * 0.7,
      w: 1.2,
      h: 3 + towerRng() * 2,
      col: COL.neon[Math.floor(towerRng() * COL.neon.length)],
      text: neonTexts[Math.floor(towerRng() * neonTexts.length)],
    });
  }

  // --- clouds + wave crests (dynamic, rebuilt per frame) ---
  for (let i = 0; i < 10; i++) {
    city.clouds.push({ x: -350 + rng() * 700, y: 90 + rng() * 30, z: -350 + rng() * 700, w: 20 + rng() * 20, h: 6, d: 12 + rng() * 8 });
  }
  for (let i = 0; i < 12; i++) {
    city.waves.push({ x: -380 - rng() * 30, y: 0.3, z: -350 + i * 60 + rng() * 20, w: 6, h: 0.5, d: 30 });
  }
  // B9: 12 more wave crests on a separate stream (main-stream rng
  // untouched), a second line further out to sea.
  const waveRng = makeRng(9003);
  for (let i = 0; i < 12; i++) {
    city.waves.push({ x: -398 - waveRng() * 20, y: 0.3, z: -330 + i * 60 + waveRng() * 20, w: 6, h: 0.5, d: 30 });
  }

  // --- parks: grass patches + trees ---
  city.parks = [];
  for (const [px, pz] of [[-150, -150], [150, 150], [-150, 210], [210, -150]]) {
    city.parks.push({ x: px, z: pz, w: 50, d: 50 });
  }

  return city;
}

// Point-collider test: is (x, z) inside any building?
export function isBlocked(city, x, z, margin = 0.4) {
  if (!city) return false;
  for (const c of city.colliders) {
    if (Math.abs(x - c.x) < c.hw + margin && Math.abs(z - c.z) < c.hd + margin) return true;
  }
  return false;
}

// Traffic light state at a clock: green 20 s, yellow 3 s, red 20 s,
// offset per intersection so the city never syncs.
export function lightState(light, t) {
  const cycle = 46;
  const tt = ((t + light.phase * cycle) % cycle + cycle) % cycle;
  if (tt < 20) return 'green';
  if (tt < 23) return 'yellow';
  return 'red';
}

// Bake the static city into a batch. Ground, roads, sidewalks,
// buildings, palms, trees, lamps, benches, hydrants, bus stops,
// containers, crane, beach, sea, runway, parks.
export function buildStaticBoxes(city, b) {
  batchReset(b);
  const uvPlain = tileUV('plain');
  const uvBrick = tileUV('brick');
  const uvAsphalt = tileUV('asphalt');
  const uvSidewalk = tileUV('sidewalk');
  const uvSand = tileUV('sand');
  const uvGrass = tileUV('grass');
  const uvWater = tileUV('water');
  const uvWindow = tileUV('window'); // B9: framed windows
  const ground = city.ground;
  // Ground top at y=0: it must sit BELOW roads (0.38), sidewalks/beach
  // (0.45) and sea (0.5), or the grass slab buries the whole city floor.
  // (#8 had top 0; #9 briefly had top 0.5, which the rasterizer could not
  // see — it skips near-plane-crossing giant triangles — but real GL clips
  // them and the ground would occlude every road.)
  pushBox(b, ground.x, -1, ground.z, ground.w, 1, ground.d, [0.42, 0.62, 0.38], uvGrass);
  // Parks: grass slabs on top of the ground.
  for (const p of city.parks) {
    pushBox(b, p.x, 0.05, p.z, p.w, 0.4, p.d, [0.35, 0.6, 0.3], uvGrass);
  }
  // Beach + sea.
  pushBox(b, city.beach.x, 0.05, city.beach.z, city.beach.w, 0.4, city.beach.d, COL.sand, uvSand);
  pushBox(b, city.sea.x, 0.1, city.sea.z, city.sea.w, 0.4, city.sea.d, COL.water, uvWater);
  // B9: shallow-water strip lapping the sand (top 0.52, just above the
  // sea's 0.5 so it reads as foam over the water, on the beach edge).
  pushBox(b, -364, 0.12, 0, 6, 0.4, 800, [0.35, 0.8, 0.95], uvWater);
  // Runway.
  pushBox(b, city.runway.x, 0.06, city.runway.z, city.runway.w, 0.4, city.runway.d, [0.2, 0.2, 0.22], uvAsphalt);
  // Roads: asphalt strips + centre dashes.
  for (const r of ROAD_LINES) {
    pushBox(b, 0, 0.08, r, 800, 0.3, ROAD_W, COL.road, uvAsphalt);
    pushBox(b, r, 0.08, 0, ROAD_W, 0.3, 800, COL.road, uvAsphalt);
    for (let s = -360; s < 360; s += 24) {
      pushBox(b, s, 0.28, r, 8, 0.1, 0.6, COL.roadLine, uvPlain);
      pushBox(b, r, 0.28, s, 0.6, 0.1, 8, COL.roadLine, uvPlain);
    }
  }
  // Sidewalk strips along every road.
  for (const r of ROAD_LINES) {
    pushBox(b, 0, 0.1, r + ROAD_W / 2 + 2, 800, 0.35, 4, COL.sidewalk, uvSidewalk);
    pushBox(b, 0, 0.1, r - ROAD_W / 2 - 2, 800, 0.35, 4, COL.sidewalk, uvSidewalk);
    pushBox(b, r + ROAD_W / 2 + 2, 0.1, 0, 4, 0.35, 800, COL.sidewalk, uvSidewalk);
    pushBox(b, r - ROAD_W / 2 - 2, 0.1, 0, 4, 0.35, 800, COL.sidewalk, uvSidewalk);
  }
  // Buildings: brick texture, framed glass windows on the front face.
  for (const bd of city.buildings) {
    pushBox(b, bd.x, 0, bd.z, bd.w, bd.h, bd.d, bd.col, uvBrick);
    // Windows: framed glass quads on the front (+Z) face.
    const rows = Math.max(1, Math.floor(bd.h / 6));
    const cols = Math.max(1, Math.floor(bd.w / 6));
    for (let ri = 0; ri < rows; ri++) {
      for (let ci = 0; ci < cols; ci++) {
        const wx = bd.x - bd.w / 2 + 3 + ci * 6;
        const wy = 3 + ri * 6;
        if (wx > bd.x + bd.w / 2 - 2) continue;
        pushQuad(
          b,
          [wx - 1.2, wy, bd.z + bd.d / 2 + 0.05],
          [wx + 1.2, wy, bd.z + bd.d / 2 + 0.05],
          [wx + 1.2, wy + 2, bd.z + bd.d / 2 + 0.05],
          [wx - 1.2, wy + 2, bd.z + bd.d / 2 + 0.05],
          COL.glass,
          uvWindow,
        );
      }
    }
  }
  // Roofs + balconies.
  for (const p of city.props) {
    if (p.kind === 'roof' || p.kind === 'balcony') {
      pushBox(b, p.x, p.y, p.z, p.w, p.h, p.d, p.col, uvPlain);
    }
  }
  // Harbour containers + crane.
  for (const c of city.containers) {
    pushBox(b, c.x, 0, c.z, c.w, c.h, c.d, c.col, uvBrick);
  }
  for (const p of city.props) {
    if (p.kind === 'crane' || p.kind === 'craneArm') {
      pushBox(b, p.x, p.y, p.z, p.w, p.h, p.d, p.col, uvPlain);
    }
  }
  // Beach umbrellas.
  for (const p of city.props) {
    if (p.kind === 'umbrella') {
      pushBox(b, p.x, 2.4, p.z, 0.3, 2.4, 0.3, [0.5, 0.4, 0.3], uvPlain);
      pushBox(b, p.x, 4.6, p.z, p.w, 0.4, p.d, p.col, uvPlain);
    }
  }
  // B9: lounger chairs, one beside each umbrella.
  for (const p of city.props) {
    if (p.kind === 'chair') {
      pushBox(b, p.x, 0, p.z, p.w, p.h, p.d, p.col, uvPlain);
    }
  }
  // B9: rust-red barrels (harbour + fishing spot).
  for (const p of city.props) {
    if (p.kind === 'barrel') {
      pushBox(b, p.x, 0, p.z, p.w, p.h, p.d, p.col, uvPlain);
    }
  }
  // Palms: trunk + 4 fronds. Trees: trunk + canopy.
  for (const p of city.palms) {
    pushBox(b, p.x, 0, p.z, 0.6, p.h, 0.6, COL.trunk, uvPlain);
    for (let f = 0; f < 4; f++) {
      const a = (f / 4) * Math.PI * 2;
      pushBox(b, p.x + Math.cos(a) * 1.6, p.h, p.z + Math.sin(a) * 1.6, 3.4, 0.3, 1.2, COL.palmLeaf, uvPlain);
    }
    pushBox(b, p.x, p.h + 0.5, p.z, 1.2, 1, 1.2, [0.5, 0.35, 0.2], uvPlain); // coconuts
  }
  for (const t of city.trees) {
    pushBox(b, t.x, 0, t.z, 0.8, 3, 0.8, COL.trunk, uvPlain);
    pushBox(b, t.x, 3, t.z, 4, t.h, 4, COL.leaf, uvPlain);
  }
  // Lamps, benches, hydrants, bus stops.
  for (const l of city.lamps) {
    pushBox(b, l.x, 0, l.z, 0.4, 5, 0.4, [0.25, 0.25, 0.28], uvPlain);
    pushBox(b, l.x, 5, l.z, 1.2, 0.4, 1.2, [1, 0.9, 0.6], uvPlain);
  }
  for (const bn of city.benches) {
    pushBox(b, bn.x, 0.4, bn.z, 3, 0.4, 1, [0.55, 0.4, 0.25], uvPlain);
    pushBox(b, bn.x, 0, bn.z, 0.3, 0.4, 0.3, [0.2, 0.2, 0.22], uvPlain);
  }
  for (const hy of city.hydrants) {
    pushBox(b, hy.x, 0, hy.z, 0.8, 1.2, 0.8, [0.9, 0.2, 0.15], uvPlain);
  }
  for (const bs of city.busStops) {
    pushBox(b, bs.x, 0, bs.z, 0.4, 3, 0.4, [0.3, 0.5, 0.8], uvPlain);
    pushBox(b, bs.x, 3, bs.z, 4, 0.3, 1.5, [0.3, 0.5, 0.8], uvPlain);
  }
  return b;
}

export { TUNE };
