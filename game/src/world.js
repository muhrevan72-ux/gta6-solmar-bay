// Solmar Bay — the city: layout, districts, roads, buildings.
// Written fresh for rebuild #18. Deterministic (seed 1337): two
// buildCity() calls produce identical batches.

import { mulberry32, COL, SPAWNS, FOOD_SHOPS } from './config.js';
import { tileUV } from './texture.js';
import { BoxBatch, pushBox, pushQuad } from './render.js';

export const ROAD_LINES = [-360, -300, -240, -180, -120, -60, 0, 60, 120, 180, 240, 300, 360];
const ROAD_HALF = 6;
const CITY = 400;

export function isOnRoad(x, z) {
  const onLine = (v) => {
    for (const r of ROAD_LINES) {
      if (Math.abs(v - r) <= ROAD_HALF) return true;
    }
    return false;
  };
  return onLine(x) || onLine(z);
}

export function districtAt(x, z) {
  if (x < -300) return 'Beach';
  if (x > 250 && z < -200) return 'Airport';
  if (x < -200 && z > 100) return 'Harbour';
  return 'Downtown';
}

// Traffic light cycle: 46 s — green < 21, yellow < 30, red after.
export function lightState(light, t) {
  const phase = (((t || 0) + (light && light.offset ? light.offset : 0)) % 46 + 46) % 46;
  if (phase < 21) return 'green';
  if (phase < 30) return 'yellow';
  return 'red';
}

const BUILDING_COLORS = [
  [0.85, 0.55, 0.45], [0.7, 0.6, 0.5], [0.55, 0.65, 0.8], [0.9, 0.7, 0.4],
  [0.6, 0.75, 0.6], [0.8, 0.5, 0.6], [0.5, 0.55, 0.65], [0.95, 0.8, 0.55],
  [0.65, 0.5, 0.7], [0.75, 0.65, 0.45],
];
const NEON_COLORS = [
  [1, 0.3, 0.5], [0.3, 1, 0.9], [1, 0.8, 0.2], [0.6, 0.4, 1],
  [1, 0.5, 0.1], [0.2, 0.9, 1], [1, 0.9, 0.4], [0.9, 0.3, 0.9],
];

export function buildCity() {
  const rng = mulberry32(1337);
  const city = {
    buildings: [],
    towers: [],
    landmarks: {},
    neon: [],
    clouds: [],
    waves: [],
    palms: [],
    props: [],
    containers: [],
    lamps: [],
    benches: [],
    hydrants: [],
    busStops: [],
    runway: { x: 300, z: -260 },
  };

  const addBuilding = (b) => {
    city.buildings.push(b);
    if (b.kind === 'tower') city.towers.push(b);
    return b;
  };

  // ---- landmarks (fixed) ----
  const hospital = addBuilding({
    x: -150, z: 150, w: 44, d: 44, h: 18,
    color: [0.95, 0.95, 0.9], roof: 'parapet', kind: 'hospital', label: 'Hospital',
  });
  city.landmarks.hospital = hospital;
  const tower = addBuilding({
    x: 30, z: -90, w: 24, d: 24, h: 62,
    color: [0.35, 0.45, 0.65], roof: 'ac', kind: 'tower', label: 'Solmar Tower',
  });
  city.landmarks.elevatorTower = tower;
  addBuilding({
    x: 330, z: -240, w: 14, d: 14, h: 34,
    color: [0.8, 0.8, 0.75], roof: 'ac', kind: 'control', label: 'Control Tower',
  });
  addBuilding({
    x: 270, z: -300, w: 30, d: 20, h: 12,
    color: [0.7, 0.7, 0.68], roof: 'parapet', kind: 'hangar', label: 'Hangar 1',
  });
  addBuilding({
    x: 330, z: -300, w: 30, d: 20, h: 12,
    color: [0.7, 0.7, 0.68], roof: 'parapet', kind: 'hangar', label: 'Hangar 2',
  });
  addBuilding({
    x: -320, z: 60, w: 16, d: 12, h: 8,
    color: [0.95, 0.85, 0.6], roof: 'pyramid', kind: 'house', label: 'Beach House',
  });
  addBuilding({
    x: SPAWNS.fireStation.x, z: SPAWNS.fireStation.z, w: 20, d: 16, h: 10,
    color: [0.9, 0.3, 0.25], roof: 'parapet', kind: 'fire', label: 'Fire Station',
  });
  addBuilding({
    x: 150, z: -150, w: 20, d: 24, h: 8,
    color: [0.6, 0.6, 0.58], roof: 'parapet', kind: 'garage', label: 'Garage',
  });
  // Food shops + the outfit shop.
  for (const s of FOOD_SHOPS) {
    addBuilding({
      x: s.x, z: s.z, w: 18, d: 14, h: 9,
      color: BUILDING_COLORS[Math.floor(rng() * BUILDING_COLORS.length)],
      roof: 'parapet', kind: 'shop', label: s.name,
    });
  }
  addBuilding({
    x: SPAWNS.outfitDoor.x, z: SPAWNS.outfitDoor.z, w: 18, d: 14, h: 9,
    color: [0.6, 0.4, 0.8], roof: 'parapet', kind: 'shop', label: 'Vice Threads',
  });

  // ---- generated buildings on the block grid ----
  // Block centres sit at 30 + 60i. Skip the beach, the airport,
  // the hospital plaza, and any block hugging a landmark.
  const nearLandmark = (x, z) => {
    for (const b of city.buildings) {
      if (Math.abs(x - b.x) < 32 && Math.abs(z - b.z) < 32) return true;
    }
    return false;
  };
  const towerSpots = new Set([
    '-90,-30', '30,150', '90,-30', '-90,90', '90,90',
    '-30,-150', '210,30', '150,-210',
  ]);
  for (let i = 0; i < 12; i++) {
    for (let j = 0; j < 12; j++) {
      const x = -330 + i * 60;
      const z = -330 + j * 60;
      if (x < -300) continue; // beach
      if (x > 250 && z < -200) continue; // airport
      if (x === -150 && z === 90) continue; // hospital plaza
      const isTower = towerSpots.has(`${x},${z}`);
      if (!isTower && (i * 7 + j * 13) % 3 === 0) continue; // breathing room
      if (nearLandmark(x, z)) continue;
      const w = 16 + Math.floor(rng() * 18);
      const d = 16 + Math.floor(rng() * 18);
      const h = isTower ? 42 + Math.floor(rng() * 18) : 8 + Math.floor(rng() * 20);
      const roofs = ['parapet', 'pyramid', 'ac'];
      addBuilding({
        x, z, w, d, h,
        color: BUILDING_COLORS[Math.floor(rng() * BUILDING_COLORS.length)],
        roof: roofs[Math.floor(rng() * 3)],
        kind: isTower ? 'tower' : 'building',
        label: isTower ? 'Tower' : 'Building',
      });
    }
  }

  // ---- neon signs: 4 per tower, 6 beachfront, 6 Solmar Tower ----
  for (const t of city.towers) {
    for (let k = 0; k < 4; k++) {
      const sx = t.x + (k % 2 === 0 ? -1 : 1) * (t.w / 2 + 3);
      const sz = t.z + (k < 2 ? -1 : 1) * (t.d / 2 + 3);
      city.neon.push({
        x: sx, z: sz, y: t.h * (0.5 + 0.1 * k),
        col: NEON_COLORS[Math.floor(rng() * NEON_COLORS.length)],
      });
    }
  }
  // 6 extra signs on the Solmar Tower face (near 30, -90).
  for (let k = 0; k < 6; k++) {
    city.neon.push({
      x: 25 + (k % 3) * 5, z: -90 + (k < 3 ? -4 : 4), y: 20 + Math.floor(k / 3) * 18,
      col: NEON_COLORS[k % NEON_COLORS.length],
    });
  }
  // 6 beachfront signs at x = -300.
  for (let k = 0; k < 6; k++) {
    city.neon.push({
      x: -300, z: -250 + k * 100, y: 8,
      col: NEON_COLORS[(k + 2) % NEON_COLORS.length],
    });
  }

  // ---- sky, sea, palms ----
  for (let k = 0; k < 10; k++) {
    city.clouds.push({
      x: -350 + rng() * 700, z: -350 + rng() * 700,
      y: 90 + rng() * 40, s: 18 + rng() * 22,
    });
  }
  for (let k = 0; k < 24; k++) {
    city.waves.push({ x: -362 + rng() * 4, z: -360 + k * 30 + rng() * 8 });
  }
  // Palms: beach A 11 + beach B 14 + avenue 16 + 9 seeded randoms.
  for (let i = 0; i < 11; i++) city.palms.push({ x: -320, z: -300 + i * 60 });
  for (let i = 0; i < 14; i++) city.palms.push({ x: -340, z: -300 + i * 46 });
  for (let i = 0; i < 16; i++) city.palms.push({ x: 70, z: -280 + i * 40 });
  for (let i = 0; i < 9; i++) {
    city.palms.push({ x: -355 + rng() * 40, z: -350 + rng() * 700 });
  }

  // ---- street props ----
  for (const t of city.towers) {
    for (let k = 0; k < 4; k++) {
      city.props.push({
        kind: 'balcony', x: t.x, z: t.z + (t.d / 2 + 1),
        y: 8 + k * 10, w: t.w * 0.7, d: 2,
      });
    }
    city.props.push({ kind: 'roof', x: t.x, z: t.z, y: t.h, w: 4, d: 4 });
  }
  for (const b of city.buildings) {
    if (b.kind === 'building' && b.h > 20) {
      city.props.push({ kind: 'roof', x: b.x, z: b.z, y: b.h, w: 3, d: 3 });
    }
  }
  // Beach umbrellas + matching chairs.
  const umbrellaCols = [
    [1, 0.4, 0.4], [1, 0.8, 0.2], [0.3, 0.8, 1], [0.9, 0.4, 0.9],
    [0.4, 1, 0.5], [1, 0.6, 0.2], [0.5, 0.5, 1], [1, 0.9, 0.4],
    [0.4, 0.9, 0.9], [0.9, 0.5, 0.7], [0.6, 1, 0.4], [1, 0.5, 0.5],
  ];
  for (let k = 0; k < 12; k++) {
    const x = -330 + (k % 4) * 12;
    const z = -180 + Math.floor(k / 4) * 120;
    city.props.push({ kind: 'umbrella', x, z, y: 0, col: umbrellaCols[k] });
    city.props.push({ kind: 'chair', x: x + 3, z: z + 2, y: 0, col: umbrellaCols[k] });
  }
  // Harbour: 16 containers + a crane.
  for (let k = 0; k < 16; k++) {
    city.containers.push({
      x: -280 + (k % 4) * 14, z: 140 + Math.floor(k / 4) * 14,
      col: BUILDING_COLORS[k % BUILDING_COLORS.length],
    });
  }
  city.props.push({ kind: 'crane', x: -260, z: 180, y: 0 });
  city.props.push({ kind: 'craneArm', x: -260, z: 180, y: 26 });
  // Barrels at the docks (rust red).
  for (let k = 0; k < 4; k++) {
    city.props.push({ kind: 'barrel', x: -250 + k * 3, z: 200, y: 0, col: [0.75, 0.3, 0.15] });
  }
  // Lamps, benches, hydrants, bus stops.
  for (let k = 0; k < 24; k++) {
    city.lamps.push({ x: -300 + (k % 12) * 60 + 8, z: -300 + Math.floor(k / 12) * 600 });
  }
  for (let k = 0; k < 30; k++) {
    city.benches.push({ x: -300 + (k % 10) * 60 + 10, z: -240 + Math.floor(k / 10) * 180 });
  }
  for (let k = 0; k < 30; k++) {
    city.hydrants.push({ x: -290 + (k % 10) * 60, z: -270 + Math.floor(k / 10) * 180 });
  }
  for (let k = 0; k < 8; k++) {
    city.busStops.push({ x: -240 + k * 60, z: 66 });
  }

  return city;
}

export function isBlocked(city, x, z) {
  if (!city) return false;
  for (const b of city.buildings) {
    if (Math.abs(x - b.x) < b.w / 2 && Math.abs(z - b.z) < b.d / 2) return true;
  }
  return false;
}

export function randomSidewalkPoint(rng) {
  const r = rng || Math.random;
  for (let i = 0; i < 20; i++) {
    const road = ROAD_LINES[Math.floor(r() * ROAD_LINES.length)];
    const along = -360 + r() * 720;
    const side = r() > 0.5 ? 1 : -1;
    const p = r() > 0.5
      ? { x: road + side * 8, z: along }
      : { x: along, z: road + side * 8 };
    if (!isOnRoad(p.x, p.z)) return p;
  }
  // Fallback: a spot known to be off-road.
  return { x: 30, z: 45 };
}

// ---------- static geometry ----------
// Builds the whole city into a batch. Ground is tiled in ~100 m
// segments (never one huge slab — the rasterizer drops triangles
// with a vertex behind the eye). Ground top y=0, roads 0.38,
// sidewalks/beach 0.45, sea 0.5.

export function buildStaticBoxes(city, b) {
  const batch = b || BoxBatch();
  const grassUV = tileUV('grass');
  const roadUV = tileUV('asphalt');
  const walkUV = tileUV('sidewalk');
  const sandUV = tileUV('sand');
  const waterUV = tileUV('water');
  const brickUV = tileUV('brick');
  const plainUV = tileUV('plain');
  const windowUV = tileUV('window');

  // ---- ground: grass 100 m tiles (x -300..400), sand, sea ----
  for (let gx = -300; gx < 400; gx += 100) {
    for (let gz = -400; gz < 400; gz += 100) {
      pushBox(batch, gx + 50, -0.5, gz + 50, 100, 0.5, 100, COL.grass, grassUV);
    }
  }
  for (let gz = -400; gz < 400; gz += 100) {
    pushBox(batch, -330, 0, gz + 50, 60, 0.45, 100, COL.sand, sandUV);
    pushBox(batch, -380, 0, gz + 50, 40, 0.5, 100, COL.water, waterUV);
  }

  // ---- roads: flat quads (top surface only). A box's vertical
  // side face right at the camera would fill the screen in the
  // old NDC-depth fog model, so roads and sidewalks are flat.
  for (const rz of ROAD_LINES) {
    if (rz < -300 || rz > 300) continue;
    pushQuad(batch, [-300, 0.38, rz - 6], [-300, 0.38, rz + 6], [0, 0.38, rz + 6], [0, 0.38, rz - 6], COL.road, roadUV);
    pushQuad(batch, [0, 0.38, rz - 6], [0, 0.38, rz + 6], [300, 0.38, rz + 6], [300, 0.38, rz - 6], COL.road, roadUV);
  }
  for (const rx of ROAD_LINES) {
    if (rx < -300 || rx > 300) continue;
    for (let k = 0; k < 10; k++) {
      const z0 = -300 + k * 60 + 6;
      // Tile into 6 m segments so no single quad stretches from
      // right at the camera to far away (the old NDC-depth fog
      // model would show the whole quad as "near").
      for (let s = 0; s < 8; s++) {
        const za = z0 + s * 6, zb = za + 6;
        pushQuad(batch, [rx - 6, 0.38, za], [rx - 6, 0.38, zb], [rx + 6, 0.38, zb], [rx + 6, 0.38, za], COL.road, roadUV);
      }
    }
  }
  // Sidewalks along the X-roads (flat quads, same reason).
  for (const rz of ROAD_LINES) {
    if (rz < -300 || rz > 300) continue;
    for (const s of [-1, 1]) {
      const zc = rz + s * 7.5;
      pushQuad(batch, [-300, 0.45, zc - 1.5], [-300, 0.45, zc + 1.5], [0, 0.45, zc + 1.5], [0, 0.45, zc - 1.5], COL.sidewalk, walkUV);
      pushQuad(batch, [0, 0.45, zc - 1.5], [0, 0.45, zc + 1.5], [300, 0.45, zc + 1.5], [300, 0.45, zc - 1.5], COL.sidewalk, walkUV);
    }
  }
  // Lane dashes (yellow) along the X-roads.
  for (const rz of ROAD_LINES) {
    if (rz < -300 || rz > 300) continue;
    for (let k = 0; k < 10; k++) {
      const x = -270 + k * 60;
      pushBox(batch, x, 0.38, rz, 6, 0.06, 0.8, COL.roadLine, plainUV);
    }
  }

  // ---- runway ----
  pushBox(batch, city.runway.x, 0, city.runway.z, 200, 0.38, 30, [0.12, 0.12, 0.14], roadUV);

  // ---- buildings ----
  for (const bd of city.buildings) {
    pushBox(batch, bd.x, 0, bd.z, bd.w, bd.h, bd.d, bd.color, brickUV);
    // Roof cap by type.
    if (bd.roof === 'pyramid') {
      pushBox(batch, bd.x, bd.h, bd.z, bd.w * 0.6, Math.max(1, bd.h * 0.2), bd.d * 0.6, bd.color, brickUV);
    } else if (bd.roof === 'ac') {
      pushBox(batch, bd.x, bd.h, bd.z, 4, 1.5, 4, [0.75, 0.75, 0.72], plainUV);
    } else {
      pushBox(batch, bd.x, bd.h, bd.z, bd.w + 0.4, 1, bd.d + 0.4, bd.color, plainUV);
    }
    // Windows on the front (+Z) and back (-Z) faces.
    const cols = Math.max(1, Math.min(4, Math.floor(bd.w / 10)));
    const rows = Math.max(1, Math.min(5, Math.floor(bd.h / 8)));
    const fz = bd.z + bd.d / 2 + 0.06;
    const bz = bd.z - bd.d / 2 - 0.06;
    for (let r = 0; r < rows; r++) {
      const wy = 3 + r * 6;
      if (wy > bd.h - 2) break;
      for (let c = 0; c < cols; c++) {
        const wx = bd.x - ((cols - 1) * 6) / 2 + c * 6;
        const ww = 2.4, wh = 3;
        pushQuad(batch,
          [wx - ww / 2, wy - wh / 2, fz], [wx + ww / 2, wy - wh / 2, fz],
          [wx + ww / 2, wy + wh / 2, fz], [wx - ww / 2, wy + wh / 2, fz],
          COL.glass, windowUV);
        if (c % 2 === 0) {
          pushQuad(batch,
            [wx - ww / 2, wy - wh / 2, bz], [wx + ww / 2, wy - wh / 2, bz],
            [wx + ww / 2, wy + wh / 2, bz], [wx - ww / 2, wy + wh / 2, bz],
            COL.glass, windowUV);
        }
      }
    }
  }

  // ---- palms: trunk + 4 fronds + coconuts on some ----
  city.palms.forEach((p, i) => {
    pushBox(batch, p.x, 0, p.z, 0.6, 5, 0.6, COL.palmTrunk, plainUV);
    pushBox(batch, p.x + 1.5, 5, p.z, 3, 0.2, 1, COL.palmLeaf, plainUV);
    pushBox(batch, p.x - 1.5, 5, p.z, 3, 0.2, 1, COL.palmLeaf, plainUV);
    pushBox(batch, p.x, 5, p.z + 1.5, 1, 0.2, 3, COL.palmLeaf, plainUV);
    pushBox(batch, p.x, 5, p.z - 1.5, 1, 0.2, 3, COL.palmLeaf, plainUV);
    if (i % 5 === 0) {
      pushBox(batch, p.x + 0.5, 4.6, p.z, 0.5, 0.5, 0.5, COL.coconut, plainUV);
    }
  });

  // ---- props ----
  for (const pr of city.props) {
    if (pr.kind === 'balcony') {
      pushBox(batch, pr.x, pr.y, pr.z, pr.w, 0.4, pr.d, [0.7, 0.7, 0.68], plainUV);
    } else if (pr.kind === 'roof') {
      pushBox(batch, pr.x, pr.y, pr.z, pr.w, 1.5, pr.d, [0.75, 0.75, 0.72], plainUV);
    } else if (pr.kind === 'umbrella') {
      pushBox(batch, pr.x, 2.2, pr.z, 4, 0.2, 4, pr.col, plainUV);
      pushBox(batch, pr.x, 0, pr.z, 0.3, 2.4, 0.3, [0.8, 0.8, 0.75], plainUV);
    } else if (pr.kind === 'chair') {
      pushBox(batch, pr.x, 0, pr.z, 1.2, 0.8, 1.2, pr.col, plainUV);
    } else if (pr.kind === 'barrel') {
      pushBox(batch, pr.x, 0, pr.z, 1, 1.2, 1, pr.col, plainUV);
    } else if (pr.kind === 'crane') {
      pushBox(batch, pr.x, 0, pr.z, 3, 26, 3, [0.95, 0.75, 0.15], plainUV);
    } else if (pr.kind === 'craneArm') {
      pushBox(batch, pr.x + 10, pr.y, pr.z, 22, 1.5, 1.5, [0.95, 0.75, 0.15], plainUV);
    }
  }

  // ---- harbour containers ----
  for (const c of city.containers) {
    pushBox(batch, c.x, 0, c.z, 12, 3, 3, c.col, brickUV);
  }

  // ---- street furniture ----
  for (const l of city.lamps) {
    pushBox(batch, l.x, 0, l.z, 0.4, 6, 0.4, [0.3, 0.3, 0.32], plainUV);
    pushBox(batch, l.x, 6, l.z, 1.2, 0.5, 1.2, [1, 0.9, 0.6], plainUV);
  }
  for (const bn of city.benches) {
    pushBox(batch, bn.x, 0, bn.z, 3, 1, 1, [0.6, 0.45, 0.3], plainUV);
  }
  for (const hy of city.hydrants) {
    pushBox(batch, hy.x, 0, hy.z, 0.8, 1.2, 0.8, [0.9, 0.2, 0.15], plainUV);
  }
  for (const bs of city.busStops) {
    pushBox(batch, bs.x, 0, bs.z, 4, 3, 1, [0.3, 0.6, 0.9], plainUV);
    pushBox(batch, bs.x, 3, bs.z, 4.5, 0.4, 1.5, [0.3, 0.6, 0.9], plainUV);
  }

  // ---- neon signs (thin glowing boxes) ----
  for (const n of city.neon) {
    pushBox(batch, n.x, n.y, n.z, 3, 1, 0.4, n.col, plainUV);
  }

  // ---- waves + clouds ----
  for (const wv of city.waves) {
    pushBox(batch, wv.x, 0.5, wv.z, 4, 0.15, 1.5, [0.95, 0.98, 1], plainUV);
  }
  for (const cl of city.clouds) {
    pushBox(batch, cl.x, cl.y, cl.z, cl.s, 3, cl.s * 0.6, [0.98, 0.98, 1], plainUV);
  }

  // ---- dock barrels (barrel red) ----
  pushBox(batch, 60, 0, 318, 1, 1.2, 1, COL.barrel, plainUV);
  pushBox(batch, 63, 0, 318, 1, 1.2, 1, COL.barrel, plainUV);
  pushBox(batch, 66, 0, 318, 1, 1.2, 1, COL.barrel, plainUV);

  // ---- train platform + fishing pier ----
  pushBox(batch, SPAWNS.trainStation.x, 0, SPAWNS.trainStation.z, 10, 1, 6, COL.sidewalk, walkUV);
  pushBox(batch, -355, 0.45, 60, 12, 0.3, 4, [0.6, 0.45, 0.3], plainUV);
  pushBox(batch, -362, 0.45, 60, 4, 0.3, 4, [0.6, 0.45, 0.3], plainUV);

  return batch;
}
