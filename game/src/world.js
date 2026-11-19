// Solmar Bay — the voxel city generator.
//
// Pure data: generateCity(seed) returns the whole city as plain
// objects (buildings, roads, props, colliders, spawns, neon signs).
// The renderer turns it into boxes; the systems read its colliders.
// Deterministic: the same seed builds the same city every run.
//
// Layout (800 x 800, roads on a 100-unit grid):
//   downtown towers around the origin, beach + water on the west
//   (sand -340..-300, water x < -340), harbour + container yard on
//   the east, airport north-east, suburbs south-west, highway loop
//   at +-350, train loop at +-320 with the station on the west side.
//
// REQUIRED (round-4 play-test): spawns.hospital is on the STREET
// outside the hospital building, at least 30 units from every
// building collider — never inside a building.

import { makeRng, COL, FOOD_SHOPS } from './config.js';
import { BoxBatch } from './render.js';
import { INTERIOR_DOORS } from './interiors.js';

const ROAD_LINES = [-300, -200, -100, 0, 100, 200, 300];
const ROAD_HALF = 7; // road half-width
const CITY_HALF = 400;

export function isOnRoad(x, z) {
  for (const l of ROAD_LINES) {
    if (Math.abs(x - l) < ROAD_HALF + 1) return true;
    if (Math.abs(z - l) < ROAD_HALF + 1) return true;
  }
  // Highway ring.
  if (Math.abs(Math.abs(x) - 350) < 9 || Math.abs(Math.abs(z) - 350) < 9) return true;
  return false;
}

// Is (x, z) on a road? (city argument kept for a uniform signature.)
export function isRoadAt(city, x, z) {
  return isOnRoad(x, z);
}

// Is (x, z) in the water (the harbour basin or the ocean west of
// the beach)?
export function isWaterAt(city, x, z) {
  const b = city.harbourBasin;
  if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) return true;
  return x < -340;
}

// Fractional position inside a 100-unit block, 0..100.
function blockFrac(v) {
  return ((v % 100) + 100) % 100;
}

export function generateCity(seed) {
  const rng = makeRng(seed === undefined ? 1337 : seed);
  const city = {
    buildings: [], // {x, z, sx, sz, h, c, kind, roof}
    trees: [], // {x, z, kind: 'tree'|'palm', s}
    lamps: [], // {x, z}
    benches: [], // {x, z, rot}
    cans: [], // trash cans {x, z}
    lights: [], // traffic lights {x, z, state}
    neon: [], // neon sign boxes (drawn dynamically, they glow)
    flowers: [], // {x, z, c}
    pots: [], // {x, z}
    clouds: [], // {x, y, z, s}
    waves: [], // ocean wave crests {x, z, phase}
    spawns: {},
    anchors: {},
    tallestTower: null,
    elevator: null, // {x, z, towerH}
    pier: { x: -345, z: 100 },
    station: { x: -320, z: 0 },
    airport: { runway: { x: 200, z: -320, len: 160 }, hangars: [] },
    harbourBasin: { x0: 340, x1: 400, z0: -160, z1: -40 },
  };

  // ---- fixed landmark buildings (colliders the game depends on) ----
  function addBuilding(x, z, sx, sz, h, c, kind) {
    const b = { x, z, sx, sz, h, c, kind: kind || 'block' };
    city.buildings.push(b);
    return b;
  }
  // Hospital at (-150, 150), 56 x 40.
  addBuilding(-150, 150, 56, 40, 16, [0.92, 0.92, 0.94], 'hospital');
  // Garage (150, -150), 40 x 30.
  addBuilding(150, -150, 40, 30, 10, [0.6, 0.6, 0.65], 'garage');
  // Police station — street in front is the police spawn.
  addBuilding(-150, -130, 44, 30, 14, [0.25, 0.35, 0.6], 'police');
  // Fire station.
  addBuilding(150, 132, 44, 30, 12, [0.85, 0.2, 0.2], 'fire');
  // Food-shop buildings (fronts face south; food points sit just
  // outside the south face, on standable ground).
  addBuilding(-60, -44, 24, 20, 9, [0.9, 0.3, 0.2], 'shop-pizza');
  addBuilding(60, -40, 24, 20, 9, [0.95, 0.6, 0.1], 'shop-burger');
  addBuilding(-40, 58, 20, 20, 8, [0.95, 0.8, 0.2], 'shop-chicken');
  addBuilding(40, 120, 20, 20, 8, [0.95, 0.5, 0.7], 'shop-donut');
  addBuilding(120, 56, 20, 20, 8, [0.4, 0.8, 0.3], 'shop-taco');
  // Outfit shop (has an interior too).
  addBuilding(-120, 40, 24, 20, 9, [0.6, 0.3, 0.8], 'shop-outfit');
  // Safehouse (suburbs) and hideout (north).
  addBuilding(-250, 250, 18, 16, 7, [0.7, 0.6, 0.5], 'safehouse');
  addBuilding(250, -250, 18, 16, 7, [0.6, 0.55, 0.5], 'hideout');
  // Airport hangars.
  addBuilding(160, -330, 30, 22, 10, [0.7, 0.7, 0.72], 'hangar');
  addBuilding(240, -330, 30, 22, 10, [0.7, 0.7, 0.72], 'hangar');
  // Harbour vault container (kept clear of the x = 300 and z = -100
  // roads — the old spot (310, -100) sat on their intersection).
  addBuilding(320, -120, 24, 14, 8, [0.9, 0.75, 0.2], 'vault');

  // ---- downtown towers (blocks near the origin) ----
  // Towers sit at BLOCK CENTRES (bx + 50, bz + 50). The old code
  // centred them on the grid lines (bx, bz) — i.e. ON the roads —
  // so a tower straddled the x = 0 road and cars could not drive
  // south out of the taxi stand.
  let tallest = null;
  for (let bx = -100; bx <= 100; bx += 100) {
    for (let bz = -300; bz <= 100; bz += 100) {
      // Skip blocks that hold fixed landmarks.
      if (bx === -200 && bz === -200) continue; // police station block
      if (bx === 100 && bz === -200) continue; // garage block
      if (bx === -100 && bz === -100) continue; // pizza shop block
      if (bx === 0 && bz === -100) continue; // burger shop block
      if (bx === -100 && bz === 0) continue; // chicken shop block
      if (bx === 100 && bz === 0) continue; // taco shop block
      if (bx === -100 && bz === 100) continue; // hospital spawn block
      if (bx === 0 && bz === 100) continue; // donut shop block
      const h = 28 + Math.floor(rng() * 42);
      const w = 34 + Math.floor(rng() * 10);
      const d = 34 + Math.floor(rng() * 10);
      const cx = bx + 50 + (rng() - 0.5) * 8;
      const cz = bz + 50 + (rng() - 0.5) * 8;
      const pastel = [
        [0.85, 0.75, 0.7], [0.7, 0.8, 0.85], [0.9, 0.85, 0.75],
        [0.75, 0.7, 0.8], [0.85, 0.8, 0.7], [0.65, 0.75, 0.8],
      ];
      const b = addBuilding(cx, cz, w, d, h, pastel[Math.floor(rng() * pastel.length)], 'tower');
      b.roof = { ac: true, tank: h > 45 };
      if (!tallest || h > tallest.h) tallest = b;
      // Neon sign on most downtown towers.
      if (rng() < 0.8) {
        const nc = COL.neon[Math.floor(rng() * COL.neon.length)];
        city.neon.push({ x: cx - w / 2, y: h - 2, z: cz + d / 2 + 0.5, sx: 0.6, sy: 1.6, sz: 10, c: [...nc] });
      }
    }
  }
  city.tallestTower = tallest;
  // Glass elevator on the tallest tower (exterior platform).
  if (tallest) {
    city.elevator = { x: tallest.x + tallest.sx / 2 + 3, z: tallest.z, towerH: tallest.h, y: 0 };
  }

  // ---- mid-rise blocks + suburban houses ----
  // Same block-centre rule as the downtown towers: buildings sit
  // inside their 100 x 100 block, never on a road line.
  for (let bx = -300; bx <= 300; bx += 100) {
    for (let bz = -300; bz <= 300; bz += 100) {
      if (bx >= -100 && bx <= 100 && bz >= -300 && bz <= 100) continue; // downtown
      if (bx === -200 && bz === 100) continue; // hospital block
      if (bx === -100 && bz === 100) continue; // hospital spawn block (keep the respawn street clear)
      if (bx === 100 && bz === 100) continue; // fire block
      if (bx === -200 && bz === 0) continue; // outfit shop block
      if (bx === -300 && bz === 200) continue; // safehouse block
      if (bx >= 100 && bz <= -300) continue; // airport
      if (bx >= 300) continue; // harbour
      if (bx <= -300) continue; // beach
      if (rng() < 0.15) continue; // park / empty lot
      const isHouse = bz > 100 || bx < -100;
      const h = isHouse ? 6 + Math.floor(rng() * 4) : 12 + Math.floor(rng() * 14);
      const w = isHouse ? 12 + Math.floor(rng() * 8) : 26 + Math.floor(rng() * 10);
      const d = isHouse ? 12 + Math.floor(rng() * 8) : 26 + Math.floor(rng() * 10);
      const cx = bx + 50 + (rng() - 0.5) * 20;
      const cz = bz + 50 + (rng() - 0.5) * 20;
      const c = isHouse
        ? [[0.85, 0.7, 0.55], [0.7, 0.75, 0.65], [0.9, 0.8, 0.65]][Math.floor(rng() * 3)]
        : [[0.78, 0.74, 0.7], [0.7, 0.72, 0.78], [0.82, 0.78, 0.72]][Math.floor(rng() * 3)];
      addBuilding(cx, cz, w, d, h, c, isHouse ? 'house' : 'block');
      // A second, smaller building in the same block (blocks are 100
      // wide, two buildings fit with room to spare) — only if it
      // clears the first building and stays clear of the roads.
      if (rng() < 0.6) {
        const h2 = isHouse ? 5 + Math.floor(rng() * 3) : 10 + Math.floor(rng() * 10);
        const w2 = isHouse ? 10 + Math.floor(rng() * 6) : 20;
        const d2 = isHouse ? 10 + Math.floor(rng() * 6) : 20;
        const x2 = bx + 80, z2 = bz + 80;
        const overlapsFirst = (x2 - w2 / 2 < cx + w / 2 + 2) && (x2 + w2 / 2 > cx - w / 2 - 2)
          && (z2 - d2 / 2 < cz + d / 2 + 2) && (z2 + d2 / 2 > cz - d / 2 - 2);
        const roadClear = (x2 + w2 / 2 < bx + 93) && (z2 + d2 / 2 < bz + 93);
        if (!overlapsFirst && roadClear) addBuilding(x2, z2, w2, d2, h2, c, isHouse ? 'house' : 'block');
      }
    }
  }

  // ---- spawns (all on streets, clear of every collider) ----
  // Hospital spawn: on the road east of the hospital, 34 units from
  // its east face (x = -122) — clear of every collider.
  city.spawns = {
    player: { x: -50, z: 0 },
    hospital: { x: -88, z: 150 },
    police: { x: -150, z: -106 },
    fire: { x: -150, z: -106 },
    garage: { x: 150, z: -106 },
    safehouse: { x: -250, z: 210 },
    airport: { x: 200, z: -320 },
    beach: { x: -310, z: 100 },
    harbour: { x: 330, z: -100 },
    station: { x: -320, z: 0 },
    range: { x: 0, z: -350 },
    trial: { x: 100, z: -350 },
    pier: { x: -330, z: 100 },
  };
  city.anchors = {
    garage: { x: 150, z: -150, label: 'Garage' },
    harbour: { x: 330, z: -100, label: 'Harbour docks' },
    hideout: { x: 250, z: -250, label: 'Hideout' },
    safehouse: { x: -250, z: 250, label: 'Safehouse' },
  };

  // ---- trees, palms, lamps, benches, cans, flowers, pots ----
  for (let i = 0; i < 90; i++) {
    const x = -380 + rng() * 760;
    const z = -380 + rng() * 760;
    if (isOnRoad(x, z)) continue;
    if (x < -300) continue; // beach
    if (x > 300) continue; // harbour
    if (collideCircle(city, x, z, 3)) continue;
    city.trees.push({ x, z, kind: rng() < 0.3 ? 'palm' : 'tree', s: 0.8 + rng() * 0.6 });
  }
  // Palm row along the beach road.
  for (let z = -200; z <= 260; z += 40) {
    city.trees.push({ x: -292, z, kind: 'palm', s: 1.1 });
  }
  // Lamps along roads.
  for (const l of ROAD_LINES) {
    for (let t = -300; t <= 300; t += 100) {
      city.lamps.push({ x: l + 9, z: t });
      city.lamps.push({ x: t, z: l + 9 });
    }
  }
  // Benches (8, downtown) + trash cans (9, downtown intersections).
  const benchSpots = [[-40, 20], [40, 20], [-40, -60], [40, -60], [12, 40], [-80, 12], [80, 12], [12, -140]];
  for (const [x, z] of benchSpots) city.benches.push({ x, z, rot: rng() * Math.PI });
  const canSpots = [[-92, -92], [92, -92], [-92, 92], [92, 92], [-8, -8], [8, 8], [-92, 8], [8, -92], [0, 108]];
  for (const [x, z] of canSpots) city.cans.push({ x, z });
  // Flower beds along sidewalks + parks.
  for (let i = 0; i < 40; i++) {
    const x = -380 + rng() * 760;
    const z = -380 + rng() * 760;
    if (isOnRoad(x, z) || collideCircle(city, x, z, 2)) continue;
    city.flowers.push({ x, z, c: COL.neon[Math.floor(rng() * COL.neon.length)] });
  }
  // Plant pots near building entrances.
  for (const b of city.buildings.slice(0, 24)) {
    city.pots.push({ x: b.x - b.sx / 2 - 2, z: b.z + b.sz / 2 + 2 });
    city.pots.push({ x: b.x + b.sx / 2 + 2, z: b.z + b.sz / 2 + 2 });
  }
  // Traffic lights at 24 intersections.
  for (const lx of [-200, -100, 0, 100, 200]) {
    for (const lz of [-200, -100, 0, 100, 200]) {
      if (lx === 0 && lz === 0) continue;
      city.lights.push({ x: lx + 9, z: lz + 9, state: 'green', t: rng() * 8 });
    }
  }
  // Clouds + ocean wave crests.
  for (let i = 0; i < 10; i++) {
    city.clouds.push({ x: -400 + rng() * 800, y: 90 + rng() * 40, z: -400 + rng() * 800, s: 8 + rng() * 14 });
  }
  for (let i = 0; i < 12; i++) {
    city.waves.push({ x: -360 - rng() * 30, z: -300 + rng() * 600, phase: rng() * Math.PI * 2 });
  }

  // ---- derived lists the systems read ----
  // Roads as {vertical, coord} (the grid lines).
  city.roads = [];
  for (const l of ROAD_LINES) {
    city.roads.push({ vertical: true, coord: l });
    city.roads.push({ vertical: false, coord: l });
  }
  // Traffic lights (alias of city.lights, the name the systems use).
  city.trafficLights = city.lights;
  // Chat spots: downtown sidewalk points where peds gather in pairs.
  city.chatSpots = [
    { x: -40, z: 30 }, { x: 40, z: -30 }, { x: 20, z: 60 }, { x: -20, z: -60 },
    { x: 60, z: 30 }, { x: -60, z: -30 }, { x: 0, z: 80 }, { x: 80, z: 0 },
  ];
  // Food shops (same points as the food system).
  city.foodShops = FOOD_SHOPS.map((s) => ({ ...s }));
  // Circle-vs-building test, as a method the systems call.
  city.collidesCircle = (x, z, r) => collideCircle(city, x, z, r) !== null;

  // ---- static geometry batch (built once, drawn every frame) ----
  city.staticBatch = buildStaticBatch(city, rng);
  return city;
}

function buildStaticBatch(city, rng) {
  const b = new BoxBatch();
  const G = COL;
  // Ground base (grass texture).
  b.pushBox(0, -0.6, 0, 800, 1, 800, [0.45, 0.5, 0.38], undefined, 'grass');
  // Roads (dark strips) + sidewalks (lighter strips) on the grid.
  for (const l of ROAD_LINES) {
    b.pushBox(l, -0.05, 0, 14, 0.2, 800, G.road, undefined, 'asphalt');
    b.pushBox(0, -0.05, l, 800, 0.2, 14, G.road, undefined, 'asphalt');
    b.pushBox(l + 10.5, -0.02, 0, 7, 0.2, 800, G.sidewalk, undefined, 'sidewalk');
    b.pushBox(l - 10.5, -0.02, 0, 7, 0.2, 800, G.sidewalk, undefined, 'sidewalk');
    b.pushBox(0, -0.02, l + 10.5, 800, 0.2, 7, G.sidewalk, undefined, 'sidewalk');
    b.pushBox(0, -0.02, l - 10.5, 800, 0.2, 7, G.sidewalk, undefined, 'sidewalk');
  }
  // Highway ring.
  b.pushBox(0, -0.05, -350, 800, 0.2, 16, G.road, undefined, 'asphalt');
  b.pushBox(0, -0.05, 350, 800, 0.2, 16, G.road, undefined, 'asphalt');
  b.pushBox(-350, -0.05, 0, 16, 0.2, 800, G.road, undefined, 'asphalt');
  b.pushBox(350, -0.05, 0, 16, 0.2, 800, G.road, undefined, 'asphalt');
  // Lane dashes down the centre of every grid road (flat yellow
  // quads, skipped near intersections so crossings stay clear).
  for (const l of ROAD_LINES) {
    for (let t = -392; t <= 392; t += 16) {
      let nearCross = false;
      for (const c of ROAD_LINES) if (Math.abs(t - c) < 12) { nearCross = true; break; }
      if (nearCross) continue;
      b.pushFlat(l, 0.12, t, 0.7, 4, [0.95, 0.8, 0.2]);
      b.pushFlat(t, 0.12, l, 4, 0.7, [0.95, 0.8, 0.2]);
    }
  }
  // Beach sand + water.
  b.pushBox(-320, -0.02, 0, 40, 0.2, 800, G.sand, undefined, 'sand');
  b.pushBox(-380, -0.3, 0, 80, 0.2, 800, G.water, undefined, 'water');
  // Harbour basin.
  b.pushBox(370, -0.3, -100, 60, 0.2, 120, G.water, undefined, 'water');
  // Airport runway.
  b.pushBox(200, -0.02, -320, 30, 0.2, 180, G.road, undefined, 'asphalt');
  // Wooden pier.
  for (let x = -300; x >= -345; x -= 5) {
    b.pushBox(x, 0.4, 100, 5, 0.8, 6, [0.55, 0.4, 0.25]);
  }
  // Buildings with window bands, roofs, AC units, awnings.
  for (const bd of city.buildings) {
    b.pushBox(bd.x, bd.h / 2, bd.z, bd.sx, bd.h, bd.sz, bd.c, undefined, 'brick');
    // Roof slab.
    b.pushBox(bd.x, bd.h + 0.3, bd.z, bd.sx + 1, 0.6, bd.sz + 1, [0.5, 0.5, 0.52]);
    // Window bands on the tall faces.
    const floors = Math.max(1, Math.floor(bd.h / 5));
    for (let f = 0; f < floors; f++) {
      const wy = 3 + f * 5;
      const lit = rng() < 0.5;
      const wc = lit ? [1.0, 0.85, 0.5] : [0.4, 0.65, 0.85];
      const n = Math.max(1, Math.floor(bd.sx / 6));
      for (let i = 0; i < n; i++) {
        const wx = bd.x - bd.sx / 2 + 3 + i * 6;
        b.pushPanel(wx, wy, bd.z + bd.sz / 2 + 0.15, 3, 2.4, wc, 'z');
      }
    }
    if (bd.roof && bd.roof.ac) {
      b.pushBox(bd.x - bd.sx / 4, bd.h + 1.2, bd.z, 4, 1.6, 4, [0.6, 0.6, 0.62]);
    }
    if (bd.roof && bd.roof.tank) {
      b.pushBox(bd.x + bd.sx / 4, bd.h + 2, bd.z, 3, 3.4, 3, [0.45, 0.45, 0.48]);
    }
    // Ground-floor awning on shops.
    if (bd.kind.startsWith('shop')) {
      b.pushBox(bd.x, 3.4, bd.z + bd.sz / 2 + 1.5, bd.sx * 0.8, 0.4, 3, bd.c);
    }
    // Towers: corner pillars (proud of the wall so no face is
    // coplanar), a setback top, and ground-floor shopfront glass.
    if (bd.kind === 'tower') {
      for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        b.pushBox(bd.x + px * (bd.sx / 2 - 0.5), bd.h / 2, bd.z + pz * (bd.sz / 2 - 0.5), 1.4, bd.h, 1.4, [0.6, 0.6, 0.62]);
      }
      b.pushBox(bd.x, bd.h + 1.8, bd.z, bd.sx * 0.65, 3, bd.sz * 0.65, bd.c, undefined, 'brick');
      b.pushBox(bd.x, bd.h + 3.5, bd.z, bd.sx * 0.65 + 1, 0.5, bd.sz * 0.65 + 1, [0.5, 0.5, 0.52]);
      b.pushPanel(bd.x, 2, bd.z + bd.sz / 2 + 0.15, bd.sx * 0.7, 3, [0.5, 0.75, 0.9], 'z');
    }
    // Mid-rise blocks: a balcony slab + rail on the south face.
    if (bd.kind === 'block' && bd.h >= 12) {
      const by = Math.min(6, bd.h - 4);
      b.pushBox(bd.x, by, bd.z + bd.sz / 2 + 1, bd.sx * 0.5, 0.4, 2, [0.55, 0.55, 0.58]);
      b.pushBox(bd.x, by + 0.9, bd.z + bd.sz / 2 + 1.8, bd.sx * 0.5, 0.5, 0.3, [0.4, 0.4, 0.42]);
    }
  }
  // Trees + palms.
  for (const t of city.trees) {
    const s = t.s;
    if (t.kind === 'palm') {
      b.pushBox(t.x, 3 * s, t.z, 0.8, 6 * s, 0.8, G.trunk);
      b.pushBox(t.x, 6.4 * s, t.z, 5 * s, 0.7, 1.2, G.palmLeaf);
      b.pushBox(t.x, 6.4 * s, t.z, 1.2, 0.7, 5 * s, G.palmLeaf);
      // Diagonal fronds + a coconut cluster under the canopy.
      b.pushBoxRot(t.x, 6.4 * s, t.z, 4.4 * s, 0.7, 1.2, G.palmLeaf, Math.PI / 4);
      b.pushBoxRot(t.x, 6.4 * s, t.z, 1.2, 0.7, 4.4 * s, G.palmLeaf, Math.PI / 4);
      b.pushBox(t.x, 5.9 * s, t.z, 0.9, 0.7, 0.9, [0.45, 0.3, 0.15]);
    } else {
      b.pushBox(t.x, 1.5 * s, t.z, 1, 3 * s, 1, G.trunk);
      b.pushBox(t.x, 3.6 * s, t.z, 3.4 * s, 2.4 * s, 3.4 * s, G.leaf);
      // Second canopy layer on top.
      b.pushBox(t.x, 5.2 * s, t.z, 2.2 * s, 1.6 * s, 2.2 * s, G.leaf);
    }
  }
  // Lamps, benches, trash cans, pots, flowers.
  for (const l of city.lamps) {
    b.pushBox(l.x, 2.5, l.z, 0.4, 5, 0.4, [0.25, 0.25, 0.28]);
    b.pushBox(l.x, 5.1, l.z, 1.2, 0.5, 0.5, [1.0, 0.9, 0.6]);
  }
  for (const bn of city.benches) {
    b.pushBox(bn.x, 0.5, bn.z, 3, 0.4, 1, [0.5, 0.35, 0.2]);
    b.pushBox(bn.x, 1.0, bn.z - 0.4, 3, 0.8, 0.3, [0.5, 0.35, 0.2]);
  }
  for (const cn of city.cans) {
    b.pushBox(cn.x, 0.7, cn.z, 0.9, 1.4, 0.9, [0.2, 0.35, 0.2]);
  }
  for (const p of city.pots) {
    b.pushBox(p.x, 0.4, p.z, 1, 0.8, 1, [0.7, 0.4, 0.25]);
    b.pushBox(p.x, 1.0, p.z, 0.8, 0.8, 0.8, G.leaf);
  }
  for (const f of city.flowers) {
    b.pushBox(f.x, 0.25, f.z, 0.6, 0.5, 0.6, f.c);
  }
  // Traffic light poles.
  for (const tl of city.lights) {
    b.pushBox(tl.x, 2.5, tl.z, 0.4, 5, 0.4, [0.2, 0.2, 0.22]);
    b.pushBox(tl.x, 5.2, tl.z, 0.8, 1.6, 0.8, [0.15, 0.15, 0.15]);
  }
  // Beach umbrellas + towels (skipped where a road crosses the sand).
  const umbrellaCols = [[0.95, 0.3, 0.3], [0.3, 0.6, 0.95], [0.95, 0.8, 0.2], [0.4, 0.8, 0.4]];
  for (let i = 0; i < 8; i++) {
    const ux = -318 + (i % 2) * 8;
    const uz = -220 + i * 55;
    if (isOnRoad(ux, uz)) continue;
    const uc = umbrellaCols[i % umbrellaCols.length];
    b.pushBox(ux, 1.2, uz, 0.3, 2.4, 0.3, [0.9, 0.9, 0.85]); // pole
    b.pushBox(ux, 2.6, uz, 4, 0.4, 4, uc); // canopy
    if (!isOnRoad(ux + 3, uz + 2)) {
      b.pushFlat(ux + 3, 0.15, uz + 2, 2.5, 1.2, umbrellaCols[(i + 1) % umbrellaCols.length]); // towel
    }
  }
  // Harbour containers on the dock (clear of the road, the basin and
  // the vault) + a dock crane at the basin edge.
  const contCols = [[0.9, 0.3, 0.2], [0.2, 0.5, 0.9], [0.95, 0.75, 0.15], [0.3, 0.7, 0.3]];
  for (let i = 0; i < 6; i++) {
    const cx = 314 + (i % 3) * 8;
    const cz = -90 + Math.floor(i / 3) * 24;
    const cc = contCols[i % contCols.length];
    b.pushBox(cx, 1.4, cz, 10, 2.8, 4, cc);
    if (i % 2 === 0) b.pushBox(cx, 4.2, cz, 10, 2.8, 4, contCols[(i + 1) % contCols.length]);
  }
  b.pushBox(335, 12, -60, 2, 24, 2, [0.9, 0.75, 0.15]); // crane leg
  b.pushBox(335, 12, -80, 2, 24, 2, [0.9, 0.75, 0.15]); // crane leg
  b.pushBox(335, 24, -70, 3, 2, 24, [0.9, 0.75, 0.15]); // crane beam
  b.pushBox(335, 22, -70, 4, 3, 4, [0.3, 0.3, 0.32]); // crane cab
  // Fire hydrants at downtown intersections + bus stops (all on
  // sidewalks, never on a road line).
  for (const [hx, hz] of [[-92, -92], [92, -92], [-92, 92], [92, 92], [-8, -8], [8, 8], [-92, 8], [8, -92], [8, 108], [-108, 8], [108, 8], [8, -108]]) {
    b.pushBox(hx, 0.5, hz, 0.7, 1, 0.7, [0.85, 0.15, 0.15]);
  }
  for (const [sx, sz] of [[-108, 20], [108, -20]]) {
    b.pushBox(sx, 0.5, sz, 3, 0.4, 1, [0.5, 0.35, 0.2]); // bench
    b.pushBox(sx, 2.5, sz - 0.5, 0.3, 5, 0.3, [0.25, 0.25, 0.28]); // sign pole
    b.pushBox(sx, 5, sz - 0.5, 2, 1, 0.3, [0.2, 0.5, 0.9]); // sign
  }
  // Train track rectangle (rails as thin strips).
  for (const [cx, cz, sx, sz] of [[0, -320, 640, 1.2], [0, 320, 640, 1.2], [-320, 0, 1.2, 640], [320, 0, 1.2, 640]]) {
    b.pushBox(cx, 0.1, cz, sx, 0.2, sz, [0.3, 0.3, 0.32]);
  }
  // Station platform.
  b.pushBox(-318, 0.6, 0, 6, 1.2, 40, G.sidewalk);
  // ---- entrances: every enterable door gets a door panel + sign +
  // light, so it reads as an entrance from the street. Play-test #4:
  // the buildings read as "flat plates with window lines, no clear
  // entrances". Interior doors sit 2 m south of their shop's south
  // face, so the panel goes at door.z - 2.
  for (const d of INTERIOR_DOORS) {
    b.pushBox(d.x, 1.6, d.z - 2, 2.4, 3.2, 0.3, [0.25, 0.2, 0.15]); // door panel
    b.pushBox(d.x, 4.6, d.z - 2, 5, 1, 0.3, [0.95, 0.8, 0.15]); // sign
    b.pushBox(d.x, 3.8, d.z - 1.6, 1, 0.4, 0.4, [1.0, 0.9, 0.6]); // light
  }
  // Garage door (north face of the garage building, z = -135).
  b.pushBox(150, 3, -134.8, 10, 6, 0.4, [0.5, 0.5, 0.55]);
  b.pushBox(150, 7, -134.8, 12, 1.2, 0.4, [0.95, 0.8, 0.15]);
  b.pushBox(150, 5.5, -134, 1.5, 0.5, 0.5, [1.0, 0.9, 0.6]);
  // Food-shop doors: one panel + light on each shop's south face.
  for (const bd of city.buildings) {
    if (!bd.kind.startsWith('shop-')) continue;
    const fz = bd.z + bd.sz / 2;
    b.pushBox(bd.x, 1.6, fz + 0.15, 2.4, 3.2, 0.3, [0.25, 0.2, 0.15]);
    b.pushBox(bd.x, 3.8, fz + 0.3, 1, 0.4, 0.4, [1.0, 0.9, 0.6]);
  }
  return b;
}

// ---- collision + placement helpers ----

// Circle vs building colliders. Returns the corrected {x, z} if the
// circle overlaps a building, else null. Pushes out along the axis
// of least penetration so the player slides along walls.
export function collideCircle(city, x, z, r) {
  let nx = x;
  let nz = z;
  let hit = false;
  for (const bd of city.buildings) {
    const hx = bd.sx / 2 + r;
    const hz = bd.sz / 2 + r;
    const dx = nx - bd.x;
    const dz = nz - bd.z;
    if (Math.abs(dx) < hx && Math.abs(dz) < hz) {
      hit = true;
      const px = hx - Math.abs(dx);
      const pz = hz - Math.abs(dz);
      if (px < pz) nx = bd.x + (dx > 0 ? hx : -hx);
      else nz = bd.z + (dz > 0 ? hz : -hz);
    }
  }
  return hit ? { x: nx, z: nz } : null;
}

// True when a circle of radius r at (x, z) stands on walkable ground:
// not inside a building, not in the water, inside the city.
export function clearSpot(city, x, z, r) {
  if (x < -340 || x > CITY_HALF || z < -CITY_HALF || z > CITY_HALF) return false;
  if (x > city.harbourBasin.x0 && x < city.harbourBasin.x1 && z > city.harbourBasin.z0 && z < city.harbourBasin.z1) return false;
  if (collideCircle(city, x, z, r)) return false;
  return true;
}

// Distance from a point to the nearest building collider (0 inside).
export function distToCollider(city, x, z) {
  let best = Infinity;
  for (const bd of city.buildings) {
    const dx = Math.max(Math.abs(x - bd.x) - bd.sx / 2, 0);
    const dz = Math.max(Math.abs(z - bd.z) - bd.sz / 2, 0);
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < best) best = d;
  }
  return best;
}

// Find a standable point on the south face of a building: probe
// southward from the face until clearSpot passes. Used for shop
// fronts and interior doors.
export function shopFront(city, bx, bz, sx, sz) {
  for (let d = 2; d <= 12; d += 1) {
    const z = bz + sz / 2 + d;
    if (clearSpot(city, bx, z, 1.2) && !isOnRoad(bx, z)) return { x: bx, z };
  }
  for (let d = 2; d <= 12; d += 1) {
    const z = bz + sz / 2 + d;
    if (clearSpot(city, bx, z, 1.2)) return { x: bx, z };
  }
  return { x: bx, z: bz + sz / 2 + 4 };
}

// A random sidewalk point. FIX (graphics pass): the old generator
// only excluded the low side of road lines, so ~1 in 7 peds spawned
// ON a road and stepPed refused every step while on a road — the ped
// froze forever. This version rejects any point whose block fraction
// is within 12 units of a road line on EITHER side, and requires
// clearSpot, so sampled points are never on a road.
export function randomSidewalkPoint(city, rng) {
  for (let tries = 0; tries < 40; tries++) {
    const x = -380 + rng() * 760;
    const z = -380 + rng() * 760;
    const fx = blockFrac(x);
    const fz = blockFrac(z);
    if (fx < 12 || fx > 88) continue;
    if (fz < 12 || fz > 88) continue;
    if (x < -300 || x > 300) continue;
    if (isOnRoad(x, z)) continue; // also excludes the highway ring
    if (!clearSpot(city, x, z, 1)) continue;
    return { x, z };
  }
  return { x: -50, z: 0 };
}

export { ROAD_LINES, CITY_HALF };
