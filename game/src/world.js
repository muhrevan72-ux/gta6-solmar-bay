// Solmar Bay — the city: layout, buildings, props, and the
// static geometry baked from them. The city is deterministic
// (seeded RNG), 800x800 m, with roads on a 60 m grid, a beach
// and sea on the west, and an airport in the north-east.

import { BoxBatch, pushBox, pushQuad, pushBoxRot } from './render.js';
import { tileUV } from './texture.js';
import { COL, SPAWNS } from './config.js';

// Seeded RNG (mulberry32) — deterministic city generation.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const ROAD_LINES = [];
for (let v = -360; v <= 360; v += 60) ROAD_LINES.push(v);
const ROAD_HALF = 6;

export function isOnRoad(x, z) {
  for (const r of ROAD_LINES) {
    if (Math.abs(x - r) <= ROAD_HALF) return true;
    if (Math.abs(z - r) <= ROAD_HALF) return true;
  }
  return false;
}

export function districtAt(x, z) {
  if (x < -300) return 'Beach';
  if (x > 240 && z < -200) return 'Airport';
  if (x < -100 && z > 150) return 'Harbour';
  if (Math.abs(x) < 150 && Math.abs(z) < 150) return 'Downtown';
  return 'Suburbs';
}

// Traffic-light cycle: 46 s. Green 0-20, yellow 20-23,
// red 23-43, green 43-46. A light's phase shifts its cycle.
export function lightState(light, t) {
  const ph = (((t + (light.phase || 0)) % 46) + 46) % 46;
  if (ph < 20) return 'green';
  if (ph < 23) return 'yellow';
  if (ph < 43) return 'red';
  return 'green';
}

export function isBlocked(city, x, z) {
  for (const b of city.buildings) {
    if (Math.abs(x - b.x) < b.w / 2 && Math.abs(z - b.z) < b.d / 2) return true;
  }
  return false;
}

export function randomSidewalkPoint(rng) {
  // Pick a block centre, then a point inside the block (never a road).
  const bx = ROAD_LINES[Math.floor(rng() * ROAD_LINES.length)] + 30;
  const bz = ROAD_LINES[Math.floor(rng() * ROAD_LINES.length)] + 30;
  const x = Math.max(-390, Math.min(390, bx + (rng() * 2 - 1) * 18));
  const z = Math.max(-390, Math.min(390, bz + (rng() * 2 - 1) * 18));
  return { x, z };
}

const ROOFS = ['parapet', 'pyramid', 'ac'];
const BUILD_COLOURS = [
  [0.85, 0.6, 0.45], [0.7, 0.75, 0.8], [0.9, 0.8, 0.6], [0.6, 0.7, 0.6],
  [0.8, 0.5, 0.5], [0.55, 0.6, 0.85], [0.95, 0.85, 0.7], [0.65, 0.55, 0.7],
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
    containers: [],
    lamps: [],
    benches: [],
    hydrants: [],
    busStops: [],
    // Props is a flat array of {kind, x, z, col, ...} objects.
    props: [],
    trafficLights: [],
    runway: { x: 300, z: -260 },
  };

  const addBuilding = (b) => {
    city.buildings.push(b);
    if (b.kind === 'tower') city.towers.push(b);
    return b;
  };

  // ----- landmark buildings (placed first) -----
  const hospital = addBuilding({ x: -150, z: 150, w: 40, d: 32, h: 18, kind: 'hospital', label: 'Hospital', roof: 'parapet', color: [0.95, 0.95, 0.95] });
  city.landmarks.hospital = hospital;
  const solmar = addBuilding({ x: 30, z: -90, w: 30, d: 30, h: 60, kind: 'tower', label: 'Solmar Tower', roof: 'pyramid', color: [0.75, 0.65, 0.9] });
  city.landmarks.elevatorTower = solmar;
  addBuilding({ x: -300, z: 60, w: 16, d: 14, h: 8, kind: 'house', label: 'Beach House', roof: 'pyramid', color: [0.95, 0.8, 0.6] });
  addBuilding({ x: 270, z: -240, w: 34, d: 22, h: 12, kind: 'hangar', label: 'Hangar', roof: 'parapet', color: [0.7, 0.7, 0.75] });
  addBuilding({ x: 330, z: -280, w: 34, d: 22, h: 12, kind: 'hangar', label: 'Hangar', roof: 'parapet', color: [0.7, 0.7, 0.75] });
  addBuilding({ x: 300, z: -220, w: 12, d: 12, h: 35, kind: 'control', label: 'Control Tower', roof: 'ac', color: [0.85, 0.85, 0.9] });

  // ----- the other 8 downtown towers (9 total with Solmar) -----
  const towerSpots = [[30, -30], [150, 30], [90, -30], [-90, -30], [30, 90], [-30, -90], [90, 90], [-90, 90]];
  for (const [tx, tz] of towerSpots) {
    const h = 45 + Math.floor(rng() * 25);
    addBuilding({ x: tx, z: tz, w: 26, d: 26, h, kind: 'tower', label: 'Tower', roof: ROOFS[Math.floor(rng() * 3)], color: BUILD_COLOURS[Math.floor(rng() * BUILD_COLOURS.length)] });
  }

  // ----- fill the remaining blocks with regular buildings -----
  const HOSP_RESPAWN = { x: -150, z: 200 };
  for (const rx of ROAD_LINES) {
    for (const rz of ROAD_LINES) {
      const cx = rx + 30, cz = rz + 30;
      // Only inside the city grid, not the beach/sea or the airport.
      if (cx < -290 || cx > 390 || cz < -390 || cz > 390) continue;
      if (cx > 240 && cz < -200) continue; // airport reserve
      // Skip blocks that already hold a landmark/tower.
      let taken = false;
      for (const b of city.buildings) {
        if (Math.abs(b.x - cx) < 26 && Math.abs(b.z - cz) < 26) { taken = true; break; }
      }
      if (taken) continue;
      // Keep the hospital respawn point clear (30 m buffer).
      if (Math.abs(HOSP_RESPAWN.x - cx) <= 20 + 30 && Math.abs(HOSP_RESPAWN.z - cz) <= 20 + 30) continue;
      const w = 18 + Math.floor(rng() * 14);
      const d = 18 + Math.floor(rng() * 14);
      // Never cover a spawn point (starter car, garage door, etc.).
      // The starter Comet sits at (-25, 20) — not in SPAWNS, so it
      // is listed here explicitly.
      let coversSpawn = false;
      const clearPts = [...Object.values(SPAWNS), { x: -25, z: 20 }];
      for (const s of clearPts) {
        if (Math.abs(s.x - cx) < w / 2 + 3 && Math.abs(s.z - cz) < d / 2 + 3) { coversSpawn = true; break; }
      }
      if (coversSpawn) continue;
      const h = 10 + Math.floor(rng() * 22);
      addBuilding({ x: cx, z: cz, w, d, h, kind: 'building', label: '', roof: ROOFS[Math.floor(rng() * 3)], color: BUILD_COLOURS[Math.floor(rng() * BUILD_COLOURS.length)] });
      // Some blocks get a second, smaller building (also kept off spawns).
      if (rng() < 0.25) {
        const w2 = 10 + Math.floor(rng() * 8);
        const d2 = 10 + Math.floor(rng() * 8);
        const bx2 = cx + 12, bz2 = cz + 10;
        let covers2 = false;
        const clearPts2 = [...Object.values(SPAWNS), { x: -25, z: 20 }];
        for (const s of clearPts2) {
          if (Math.abs(s.x - bx2) < w2 / 2 + 3 && Math.abs(s.z - bz2) < d2 / 2 + 3) { covers2 = true; break; }
        }
        if (!covers2) {
          addBuilding({ x: bx2, z: bz2, w: w2, d: d2, h: 7 + Math.floor(rng() * 8), kind: 'building', label: '', roof: ROOFS[Math.floor(rng() * 3)], color: BUILD_COLOURS[Math.floor(rng() * BUILD_COLOURS.length)] });
        }
      }
    }
  }

  // ----- neon signs: 4 per tower (36), 6 beachfront, 6 at Solmar -----
  for (const t of city.towers) {
    const hw = t.w / 2, hd = t.d / 2;
    city.neon.push({ x: t.x + hw + 0.3, z: t.z, y: t.h * 0.6, col: [1, 0.3, 0.6] });
    city.neon.push({ x: t.x - hw - 0.3, z: t.z, y: t.h * 0.6, col: [0.2, 0.9, 1] });
    city.neon.push({ x: t.x, z: t.z + hd + 0.3, y: t.h * 0.7, col: [1, 0.8, 0.2] });
    city.neon.push({ x: t.x, z: t.z - hd - 0.3, y: t.h * 0.7, col: [0.6, 1, 0.4] });
  }
  for (let i = 0; i < 6; i++) {
    city.neon.push({ x: -300, z: -120 + i * 60, y: 6, col: [1, 0.5, 0.8] });
  }
  for (let i = 0; i < 6; i++) {
    city.neon.push({ x: 30 - 8 + i * 3, z: -90 + (i % 2) * 4 - 2, y: 4 + i, col: [1, 0.7, 0.2] });
  }

  // ----- sky, sea, street props -----
  for (let i = 0; i < 10; i++) {
    city.clouds.push({ x: -350 + rng() * 700, y: 60 + rng() * 40, z: -350 + rng() * 700, s: 20 + rng() * 25 });
  }
  for (let i = 0; i < 24; i++) {
    city.waves.push({ x: -390 + rng() * 45, z: -380 + i * 33, s: 8 + rng() * 6 });
  }
  for (let i = 0; i < 50; i++) {
    // Palms line the beach and a few streets.
    const beach = i < 30;
    const x = beach ? -320 + rng() * 18 : -280 + rng() * 650;
    const z = beach ? -380 + rng() * 760 : -380 + rng() * 760;
    city.palms.push({ x, z, h: 5 + rng() * 3 });
  }
  for (let i = 0; i < 16; i++) {
    city.containers.push({ x: -260 + (i % 4) * 12, z: 180 + Math.floor(i / 4) * 14, color: [[0.9, 0.3, 0.2], [0.2, 0.5, 0.9], [0.9, 0.7, 0.2], [0.2, 0.8, 0.4]][i % 4] });
  }
  for (const r of ROAD_LINES) {
    city.lamps.push({ x: r + 8, z: -200 });
    city.lamps.push({ x: r - 8, z: 100 });
  }
  for (let i = 0; i < 30; i++) {
    const p = randomSidewalkPoint(rng);
    city.benches.push({ x: p.x, z: p.z });
    const q = randomSidewalkPoint(rng);
    city.hydrants.push({ x: q.x, z: q.z });
  }
  // Balconies + roof props on the taller buildings.
  for (const b of city.buildings) {
    if (b.h > 20 && city.props.filter((p) => p.kind === 'balcony').length < 40) {
      city.props.push({ kind: 'balcony', x: b.x + b.w / 2 + 0.5, z: b.z, y: b.h * 0.5, w: 3, d: 2 });
      city.props.push({ kind: 'balcony', x: b.x - b.w / 2 - 0.5, z: b.z, y: b.h * 0.6, w: 3, d: 2 });
    }
    if (b.h > 15 && city.props.filter((p) => p.kind === 'roof').length < 20) {
      city.props.push({ kind: 'roof', x: b.x, z: b.z, y: b.h });
    }
  }
  // Beach umbrellas + matching chairs (the chair shares the
  // umbrella's colour array by reference).
  const umbrellaCols = [[1, 0.3, 0.3], [0.3, 0.6, 1], [1, 0.8, 0.2], [0.4, 0.9, 0.4]];
  for (let i = 0; i < 12; i++) {
    const col = umbrellaCols[i % 4];
    const x = -325 + (i % 6) * 8;
    const z = -150 + Math.floor(i / 6) * 120 + (i % 3) * 20;
    city.props.push({ kind: 'umbrella', x, z, col });
    city.props.push({ kind: 'chair', x: x + 2, z: z + 2, col });
  }
  // Rust-red prop barrels at the harbour.
  const barrelSpots = [[-240, 210], [-232, 214], [-248, 216], [-236, 222]];
  for (const [bx, bz] of barrelSpots) {
    city.props.push({ kind: 'barrel', x: bx, z: bz, col: [0.75, 0.3, 0.15] });
  }
  city.props.push({ kind: 'crane', x: -260, z: 170, h: 45 });
  city.props.push({ kind: 'craneArm', x: -260, z: 170, y: 42, len: 30, angle: 0.6 });
  // Bus stops (8).
  for (let i = 0; i < 8; i++) {
    const r = ROAD_LINES[2 + i];
    city.busStops.push({ x: r + 8, z: -100 + i * 40 });
  }
  // Traffic lights at a sparse checkerboard of intersections.
  for (const rx of ROAD_LINES) {
    for (const rz of ROAD_LINES) {
      const isKey = rx === -180 && rz === -180;
      if (!isKey && ((rx / 60) + (rz / 60)) % 4 !== 0) continue;
      if (rx < -300 || rx > 360 || rz < -360 || rz > 360) continue;
      const phase = isKey ? -3 : ((rx + rz) / 60) % 10;
      city.trafficLights.push({ x: rx, z: rz, phase });
    }
  }
  return city;
}

// Bake the static geometry: ground tiles, roads, sidewalks,
// buildings, palms, props. Ground is tiled in ~100 m segments
// (never one huge slab) so the software rasterizer keeps it.
export function buildStaticBoxes(city, batch) {
  const plain = tileUV('plain');
  const grass = tileUV('grass');
  const asphalt = tileUV('asphalt');
  const sidewalkUV = tileUV('sidewalk');
  const sand = tileUV('sand');
  const water = tileUV('water');
  const winUV = tileUV('window');
  const brick = tileUV('brick');

  // ----- ground: grass tiles (city area), sand (beach), water (sea) -----
  for (let gx = -300; gx < 400; gx += 100) {
    for (let gz = -400; gz < 400; gz += 100) {
      pushBox(batch, gx + 50, -0.2, gz + 50, 100, 0.2, 100, COL.grass, grass);
    }
  }
  for (let gz = -400; gz < 400; gz += 100) {
    // Beach slab, top at 0.45; sea slab, top at 0.5.
    pushBox(batch, -320, 0, gz + 50, 40, 0.45, 100, COL.sand, sand);
    pushBox(batch, -370, 0, gz + 50, 60, 0.5, 100, COL.sea, water);
  }

  // ----- roads: vertical (along z) and horizontal (along x) -----
  for (const r of ROAD_LINES) {
    if (r < -300 || r > 360) continue;
    for (let gz = -400; gz < 400; gz += 100) {
      pushBox(batch, r, 0, gz + 50, 12, 0.38, 100, COL.road, asphalt);
    }
  }
  for (const r of ROAD_LINES) {
    for (let gx = -400; gx < 400; gx += 100) {
      pushBox(batch, gx + 50, 0, r, 100, 0.38, 12, COL.road, asphalt);
    }
  }
  // Road centre lines (yellow dashes, flat quads).
  for (const r of ROAD_LINES) {
    if (r < -300 || r > 360) continue;
    for (let gz = -400; gz < 400; gz += 40) {
      pushQuad(batch, [r - 0.3, 0.39, gz + 2], [r + 0.3, 0.39, gz + 2], [r + 0.3, 0.39, gz + 8], [r - 0.3, 0.39, gz + 8], COL.roadLine, plain);
    }
  }

  // ----- sidewalk slabs (one per block), top 0.45 -----
  for (const rx of ROAD_LINES) {
    for (const rz of ROAD_LINES) {
      const cx = rx + 30, cz = rz + 30;
      if (cx < -290 || cx > 390 || cz < -390 || cz > 390) continue;
      if (cx > 240 && cz < -200) continue;
      pushBox(batch, cx, 0, cz, 48, 0.45, 48, COL.sidewalk, sidewalkUV);
    }
  }

  // ----- runway (tiled) -----
  for (let gz = -300; gz < -220; gz += 20) {
    pushBox(batch, 300, 0, gz + 10, 30, 0.38, 20, [0.12, 0.12, 0.14], asphalt);
  }

  // ----- buildings -----
  for (const b of city.buildings) {
    const base = 0.45; // buildings sit on the sidewalk slabs
    pushBox(batch, b.x, base, b.z, b.w, b.h, b.d, b.color, brick);
    // Roof.
    if (b.roof === 'pyramid') {
      pushBox(batch, b.x, base + b.h, b.z, b.w * 0.5, b.h * 0.25, b.d * 0.5, [0.5, 0.3, 0.25], plain);
    } else if (b.roof === 'ac') {
      pushBox(batch, b.x, base + b.h, b.z, 3, 1.5, 3, [0.7, 0.7, 0.75], plain);
    } else {
      pushBox(batch, b.x, base + b.h, b.z, b.w + 0.4, 0.6, b.d + 0.4, [0.4, 0.4, 0.45], plain);
    }
    // Windows on the front face (glass-blue quads).
    const floors = Math.max(1, Math.floor(b.h / 8));
    const cols = Math.max(1, Math.floor(b.w / 8));
    for (let f = 0; f < floors; f++) {
      for (let c = 0; c < cols; c++) {
        const wy = base + 2 + f * 4;
        const wx = b.x - b.w / 2 + 3 + c * 6;
        if (wx > b.x + b.w / 2 - 2) continue;
        pushQuad(batch, [wx, wy, b.z + b.d / 2 + 0.05], [wx + 2.5, wy, b.z + b.d / 2 + 0.05], [wx + 2.5, wy + 2, b.z + b.d / 2 + 0.05], [wx, wy + 2, b.z + b.d / 2 + 0.05], COL.glassBlue, winUV);
      }
    }
  }

  // ----- palms (trunk + leaves + coconuts) -----
  for (const p of city.palms) {
    pushBox(batch, p.x, 0, p.z, 0.5, p.h, 0.5, [0.5, 0.35, 0.2], plain);
    for (let i = 0; i < 2; i++) {
      const a = (i / 2) * Math.PI * 2;
      pushBoxRot(batch, p.x + Math.cos(a) * 1.2, p.h - 0.5, p.z + Math.sin(a) * 1.2, 2.6, 0.3, 1.2, a, COL.palmLeaf, plain);
    }
    pushBox(batch, p.x + 0.4, p.h - 1, p.z, 0.5, 0.5, 0.5, COL.coconut, plain);
  }

  // ----- containers, benches, hydrants, lamps, bus stops -----
  for (const c of city.containers) {
    pushBox(batch, c.x, 0.45, c.z, 6, 2.6, 2.6, c.color, plain);
  }
  for (const bn of city.benches) {
    pushBox(batch, bn.x, 0.45, bn.z, 2, 0.5, 0.8, [0.6, 0.4, 0.2], plain);
  }
  for (const hy of city.hydrants) {
    pushBox(batch, hy.x, 0.45, hy.z, 0.6, 1, 0.6, [0.9, 0.2, 0.1], plain);
  }
  for (const l of city.lamps) {
    pushBox(batch, l.x, 0.45, l.z, 0.3, 5, 0.3, [0.2, 0.2, 0.25], plain);
    pushBox(batch, l.x, 5.2, l.z, 1.2, 0.4, 0.4, [1, 0.9, 0.6], plain);
  }
  for (const bs of city.busStops) {
    pushBox(batch, bs.x, 0.45, bs.z, 3, 2.5, 1, [0.3, 0.6, 0.9], plain);
  }

  // ----- umbrellas + chairs (chair colour matches its umbrella) -----
  const umbrellas = city.props.filter((p) => p.kind === 'umbrella');
  const chairs = city.props.filter((p) => p.kind === 'chair');
  for (let i = 0; i < umbrellas.length; i++) {
    const u = umbrellas[i];
    const ch = chairs[i] || { x: u.x + 2, z: u.z + 2, col: u.col };
    pushBox(batch, u.x, 0.45, u.z, 0.2, 2.2, 0.2, [0.8, 0.8, 0.8], plain);
    pushBox(batch, u.x, 2.6, u.z, 3, 0.2, 3, u.col, plain);
    pushBox(batch, ch.x, 0.45, ch.z, 1.2, 0.6, 1.2, ch.col, plain);
  }

  // ----- barrels: 4 rust prop barrels + 3 red dock barrels -----
  for (const bar of city.props.filter((p) => p.kind === 'barrel')) {
    pushBox(batch, bar.x, 0.45, bar.z, 1.2, 1.8, 1.2, bar.col, plain);
  }
  const dockBarrels = [[-252, 196], [-246, 200], [-250, 206]];
  for (const [bx, bz] of dockBarrels) {
    pushBox(batch, bx, 0.45, bz, 1.2, 1.8, 1.2, COL.barrelRed, plain);
  }

  // ----- crane + arm -----
  const crane = city.props.find((p) => p.kind === 'crane');
  if (crane) {
    pushBox(batch, crane.x, 0.45, crane.z, 3, crane.h, 3, [0.9, 0.6, 0.1], plain);
    pushBoxRot(batch, crane.x + 12, crane.h - 3, crane.z, 24, 1.5, 1.5, 0.6, [0.9, 0.6, 0.1], plain);
  }

  // ----- balconies + roof props -----
  for (const bal of city.props.filter((p) => p.kind === 'balcony')) {
    pushBox(batch, bal.x, bal.y, bal.z, bal.w, 0.3, bal.d, [0.7, 0.7, 0.75], plain);
  }
  for (const rp of city.props.filter((p) => p.kind === 'roof')) {
    pushBox(batch, rp.x, rp.y + 0.45, rp.z, 2, 1.2, 2, [0.6, 0.6, 0.65], plain);
  }

  // ----- neon signs (thin glowing quads) -----
  for (const n of city.neon) {
    pushQuad(batch, [n.x - 1.5, n.y, n.z], [n.x + 1.5, n.y, n.z], [n.x + 1.5, n.y + 1, n.z], [n.x - 1.5, n.y + 1, n.z], n.col, plain);
  }

  // ----- waves (sea surface quads) + clouds -----
  for (const wv of city.waves) {
    pushQuad(batch, [wv.x - wv.s / 2, 0.5, wv.z], [wv.x + wv.s / 2, 0.5, wv.z], [wv.x + wv.s / 2, 0.5, wv.z + 2], [wv.x - wv.s / 2, 0.5, wv.z + 2], [0.9, 0.95, 1], plain);
  }
  for (const cl of city.clouds) {
    pushBox(batch, cl.x, cl.y, cl.z, cl.s, 3, cl.s * 0.6, [1, 1, 1], plain);
  }

  // ----- traffic lights -----
  for (const tl of city.trafficLights) {
    pushBox(batch, tl.x + 7, 0.45, tl.z + 7, 0.4, 4.5, 0.4, [0.15, 0.15, 0.18], plain);
    pushBox(batch, tl.x + 7, 4.2, tl.z + 7, 0.8, 1.2, 0.8, [0.2, 0.8, 0.2], plain);
  }
  return batch;
}
