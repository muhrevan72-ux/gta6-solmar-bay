// Solmar Bay — the city.
//
// buildCity is deterministic (seed 1337): the same seed builds the
// same streets, towers and props every time, so the static batch is
// byte-identical across resizes. Roads run on the multiples of 60;
// buildings sit on the block centres between them. The ground slab
// tops out at y=0, roads at 0.38, sidewalks and beach at 0.45 and the
// sea at 0.5 — the slab never buries the roads.

import { FOOD_SHOPS, COL, SPAWNS } from './config.js';
import { tileUV } from './texture.js';

export const ROAD_LINES = [-300, -240, -180, -120, -60, 0, 60, 120, 180, 240, 300];

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BUILDING_COLOURS = [
  [0.75, 0.6, 0.5],
  [0.6, 0.65, 0.7],
  [0.85, 0.7, 0.55],
  [0.55, 0.6, 0.65],
  [0.9, 0.75, 0.6],
  [0.65, 0.55, 0.6],
  [0.7, 0.75, 0.6],
  [0.5, 0.55, 0.6],
];

// Is (x, z) on a road? A road line is a multiple of 60; the road is
// 12 m wide, so within 6 m of a line (and inside the map) counts.
export function isOnRoad(x, z) {
  if (Math.abs(x) > 306 || Math.abs(z) > 306) return false;
  const nearLine = (v) => Math.abs(v - Math.round(v / 60) * 60) <= 6;
  return nearLine(x) || nearLine(z);
}

export function isBlocked(city, x, z) {
  for (const b of city.buildings) {
    if (Math.abs(x - b.x) < b.w / 2 && Math.abs(z - b.z) < b.d / 2) return true;
  }
  return false;
}

// A random point on a sidewalk (never on a road, never inside a
// building). The caller passes the rng so the suites can drive it.
export function randomSidewalkPoint(rng) {
  for (let i = 0; i < 100; i++) {
    const x = (rng() * 2 - 1) * 280;
    const z = (rng() * 2 - 1) * 280;
    if (!isOnRoad(x, z)) return { x, z };
  }
  return { x: 30, z: 30 };
}

export function districtAt(x, z) {
  if (x < -300) return 'Beach';
  if (x > 240 && z < -200) return 'Airport';
  if (x < -180 && z > 150) return 'Harbour';
  return 'Downtown';
}

// The 46 s light cycle: green 20 s, yellow 2 s, red 24 s. `phase`
// staggers neighbouring intersections (phase is x/60 in the city).
export function lightState(light, t) {
  const tt = (((t + (light.phase || 0)) % 46) + 46) % 46;
  if (tt < 20) return 'green';
  if (tt < 22) return 'yellow';
  return 'red';
}

export function buildCity() {
  const rng = mulberry32(1337);
  const city = {
    buildings: [],
    towers: [],
    landmarks: {},
    neon: [],
    palms: [],
    clouds: [],
    waves: [],
    containers: [],
    lamps: [],
    benches: [],
    hydrants: [],
    busStops: [],
    props: [],
    lights: [],
    runway: { x: 300, z: -260 },
  };

  // ---- landmarks (placed first, so the grid skips around them) ----
  const hospital = { x: -150, z: 150, w: 44, h: 18, d: 44, kind: 'hospital', label: 'Hospital', roof: 'parapet', colour: [0.9, 0.9, 0.92] };
  const solmarTower = { x: 30, z: -90, w: 24, h: 42, d: 24, kind: 'tower', label: 'Solmar Tower', roof: 'parapet', colour: [0.55, 0.6, 0.75] };
  const beachHouse = { x: -315, z: 60, w: 16, h: 8, d: 14, kind: 'house', label: 'Beach House', roof: 'pyramid', colour: [0.9, 0.8, 0.65] };
  const fireStation = { x: -150, z: -90, w: 16, h: 10, d: 16, kind: 'fire', label: 'Fire Station', roof: 'parapet', colour: [0.85, 0.3, 0.25] };
  const garage = { x: 150, z: -150, w: 20, h: 8, d: 20, kind: 'garage', label: 'Garage', roof: 'parapet', colour: [0.6, 0.6, 0.65] };
  const controlTower = { x: 270, z: -240, w: 12, h: 26, d: 12, kind: 'control', label: 'Control Tower', roof: 'ac', colour: [0.7, 0.75, 0.8] };
  const hangar1 = { x: 240, z: -270, w: 30, h: 12, d: 20, kind: 'hangar', label: 'Hangar 1', roof: 'parapet', colour: [0.65, 0.68, 0.7] };
  const hangar2 = { x: 240, z: -210, w: 30, h: 12, d: 20, kind: 'hangar', label: 'Hangar 2', roof: 'parapet', colour: [0.6, 0.63, 0.66] };
  city.buildings.push(hospital, solmarTower, beachHouse, fireStation, garage, controlTower, hangar1, hangar2);
  city.landmarks.hospital = hospital;
  city.landmarks.elevatorTower = solmarTower;
  city.landmarks.solmarTower = solmarTower;
  city.landmarks.beachHouse = beachHouse;
  city.landmarks.fireStation = fireStation;

  // Food-shop fronts: a small shop building sits 14 m behind the
  // counter so the front (where the player stands) stays clear.
  const shopBuildings = FOOD_SHOPS.map((s) => {
    const b = { x: s.x, z: s.z + 14, w: 18, h: 9, d: 16, kind: 'shop', label: s.name, roof: 'parapet', colour: [0.8, 0.65, 0.5] };
    city.buildings.push(b);
    return b;
  });

  // ---- the block grid ----
  const towerSpots = new Set([
    '-90,-90', '-30,-90', '90,-90',
    '-30,-30', '30,-30', '90,-30',
    '-90,30', '-30,30', '90,30',
  ]);
  const skip = (cx, cz) => {
    if (cx >= 240 && cz <= -180) return true; // airport / runway
    if (cx < -180 && cz > 150) return true; // harbour docks
    if (cx === -150 && cz === 150) return true; // hospital
    if (cx === -90 && cz === 150) return true; // hospital respawn stays clear
    if (cx === 30 && cz === -90) return true; // Solmar Tower
    if (cx === -150 && cz === -90) return true; // fire station
    if (cx === 150 && cz === -150) return true; // garage
    if (cx === 270 && cz === -240) return true; // control tower
    if (cx === 240 && cz === -270) return true; // hangar 1
    if (cx === 240 && cz === -210) return true; // hangar 2
    if (cx === -315 && cz === 60) return true; // beach house (off-grid anyway)
    if (Math.hypot(cx - 250, cz - 250) < 45) return true; // shooting range
    if ((cx === 210 || cx === 270) && cz === 210) return true; // slalom course
    for (const sb of shopBuildings) {
      if (Math.hypot(cx - sb.x, cz - sb.z) < 30) return true;
    }
    return false;
  };
  // A few blocks stay parks (never a tower spot).
  const parks = new Set();
  while (parks.size < 5) {
    const px = 30 + 60 * Math.floor(rng() * 10 - 5);
    const pz = 30 + 60 * Math.floor(rng() * 10 - 5);
    if (towerSpots.has(`${px},${pz}`)) continue;
    parks.add(`${px},${pz}`);
  }
  for (let i = -5; i <= 4; i++) {
    for (let j = -5; j <= 4; j++) {
      const cx = 30 + 60 * i;
      const cz = 30 + 60 * j;
      if (skip(cx, cz)) continue;
      if (parks.has(`${cx},${cz}`)) continue;
      const isTower = towerSpots.has(`${cx},${cz}`);
      const w = isTower ? 26 + rng() * 8 : 20 + rng() * 16;
      const d = isTower ? 26 + rng() * 8 : 20 + rng() * 16;
      const h = isTower ? 26 + rng() * 18 : 8 + rng() * 16;
      const roof = isTower ? (rng() < 0.5 ? 'parapet' : 'ac') : (rng() < 0.4 ? 'pyramid' : rng() < 0.7 ? 'parapet' : 'ac');
      const b = {
        x: cx, z: cz, w, h, d,
        kind: isTower ? 'tower' : 'building',
        label: isTower ? 'Tower' : 'Building',
        roof,
        colour: BUILDING_COLOURS[Math.floor(rng() * BUILDING_COLOURS.length)],
      };
      city.buildings.push(b);
      if (isTower) city.towers.push(b);
    }
  }

  // ---- neon: 36 on the 9 towers, 6 beachfront, 6 on Solmar Tower ----
  const neonCols = [[1, 0.3, 0.5], [0.3, 0.9, 1], [1, 0.8, 0.2], [0.6, 1, 0.4], [1, 0.5, 0.9], [0.4, 0.6, 1]];
  for (const t of city.towers) {
    for (let k = 0; k < 4; k++) {
      const side = k % 2 === 0 ? 1 : -1;
      city.neon.push({
        x: t.x + side * (t.w / 2 + 0.4),
        z: t.z + (k < 2 ? -t.d / 4 : t.d / 4),
        y: 6 + k * 5,
        col: neonCols[(city.neon.length + k) % neonCols.length],
      });
    }
  }
  for (let k = 0; k < 6; k++) {
    city.neon.push({ x: -300, z: -200 + k * 80, y: 5, col: neonCols[k % neonCols.length] });
  }
  for (let k = 0; k < 6; k++) {
    city.neon.push({
      x: 30 + (k % 2 === 0 ? -12.5 : 12.5),
      z: -90 + (k < 3 ? -8 : 8),
      y: 8 + k * 5,
      col: neonCols[k % neonCols.length],
    });
  }

  // ---- palms: 9 seeded strays + beach rows + an avenue row = 50 ----
  for (let k = 0; k < 9; k++) {
    city.palms.push({ x: -380 + rng() * 50, z: -280 + rng() * 560, h: 5 + rng() * 2 });
  }
  for (let k = 0; k < 11; k++) {
    city.palms.push({ x: -340, z: -220 + k * 44, h: 5.5 + (k % 3) });
  }
  for (let k = 0; k < 14; k++) {
    city.palms.push({ x: -325, z: -260 + k * 40, h: 5 + (k % 4) * 0.5 });
  }
  for (let k = 0; k < 16; k++) {
    city.palms.push({ x: 12, z: -240 + k * 32, h: 5 + (k % 3) });
  }

  // ---- sky, sea and harbour ----
  for (let k = 0; k < 10; k++) {
    city.clouds.push({ x: -300 + rng() * 600, y: 60 + rng() * 30, z: -300 + rng() * 600 });
  }
  for (let k = 0; k < 24; k++) {
    city.waves.push({ x: -390 + rng() * 50, z: -280 + rng() * 560 });
  }
  for (let k = 0; k < 16; k++) {
    city.containers.push({
      x: -270 + (k % 4) * 14,
      z: 170 + Math.floor(k / 4) * 14,
      col: [[0.8, 0.3, 0.2], [0.2, 0.5, 0.8], [0.8, 0.7, 0.2], [0.3, 0.7, 0.4]][k % 4],
    });
  }
  city.props.push({ kind: 'crane', x: -260, z: 190 });
  city.props.push({ kind: 'craneArm', x: -260, z: 190 });

  // ---- street furniture ----
  for (let k = 0; k < 24; k++) {
    const lx = ROAD_LINES[Math.floor(rng() * ROAD_LINES.length)];
    const lz = -280 + rng() * 560;
    city.lamps.push({ x: lx + 7, z: lz });
  }
  for (let k = 0; k < 30; k++) {
    const p = randomSidewalkPoint(rng);
    city.benches.push({ x: p.x, z: p.z });
  }
  for (let k = 0; k < 30; k++) {
    const p = randomSidewalkPoint(rng);
    city.hydrants.push({ x: p.x, z: p.z });
  }
  for (let k = 0; k < 8; k++) {
    city.busStops.push({ x: ROAD_LINES[2 + k] + 8, z: -120 + k * 30 });
  }
  // Umbrellas + matching chairs on the beach.
  const umbrellaCols = [[1, 0.3, 0.3], [0.3, 0.6, 1], [1, 0.8, 0.2], [0.4, 0.9, 0.5]];
  for (let k = 0; k < 12; k++) {
    const col = umbrellaCols[k % umbrellaCols.length];
    const ux = -345 + (k % 3) * 12;
    const uz = -220 + Math.floor(k / 3) * 110;
    city.props.push({ kind: 'umbrella', x: ux, z: uz, col });
    city.props.push({ kind: 'chair', x: ux + 2, z: uz + 2, col });
  }
  // Rust-red dock barrels.
  for (let k = 0; k < 4; k++) {
    city.props.push({ kind: 'barrel', x: -250 + k * 4, z: 185, col: [0.75, 0.3, 0.15] });
  }
  // Balconies and roof props on the towers.
  for (const t of city.towers) {
    for (let k = 0; k < 3; k++) {
      city.props.push({ kind: 'balcony', x: t.x, z: t.z + t.d / 2 + 0.5, y: 8 + k * 8 });
    }
    city.props.push({ kind: 'roof', x: t.x, z: t.z, y: t.h });
  }

  // ---- traffic lights at every other intersection ----
  for (const lx of ROAD_LINES) {
    for (const lz of ROAD_LINES) {
      if (((lx / 60 + lz / 60) % 2 + 2) % 2 !== 0) continue;
      city.lights.push({ x: lx, z: lz, axis: 'x', phase: lx / 60 });
    }
  }
  return city;
}

// ---- the static batch ----
// Everything that never moves: ground, roads, buildings, palms and
// props. Deterministic — the same city bakes the same triangles, so a
// resize re-bakes byte-identical buffers.
export function buildStaticBoxes(city, b) {
  const plainUV = tileUV('plain');
  const windowUV = tileUV('window');
  const grassUV = tileUV('grass');
  const roadUV = tileUV('asphalt');
  const sandUV = tileUV('sand');
  const waterUV = tileUV('water');
  const brickUV = tileUV('brick');

  // Ground: one grass quad per block, top at y=0.
  for (let i = -5; i <= 4; i++) {
    for (let j = -5; j <= 4; j++) {
      const cx = 30 + 60 * i;
      const cz = 30 + 60 * j;
      pushQuadLocal(b,
        [cx - 30, 0, cz - 30], [cx + 30, 0, cz - 30],
        [cx + 30, 0, cz + 30], [cx - 30, 0, cz + 30],
        COL.grass, grassUV);
    }
  }
  // Beach sand (west strip) and the sea beyond it.
  for (let j = 0; j < 10; j++) {
    const z0 = -300 + j * 60;
    pushQuadLocal(b,
      [-400, 0.45, z0], [-300, 0.45, z0],
      [-300, 0.45, z0 + 60], [-400, 0.45, z0 + 60],
      COL.sand, sandUV);
    pushQuadLocal(b,
      [-520, 0.5, z0], [-400, 0.5, z0],
      [-400, 0.5, z0 + 60], [-520, 0.5, z0 + 60],
      COL.water, waterUV);
  }
  // Roads: one quad per 60 m segment, top at y=0.38, plus a dash.
  for (const lx of ROAD_LINES) {
    for (let s = -5; s < 5; s++) {
      const z0 = s * 60;
      pushQuadLocal(b,
        [lx - 6, 0.38, z0], [lx + 6, 0.38, z0],
        [lx + 6, 0.38, z0 + 60], [lx - 6, 0.38, z0 + 60],
        COL.road, roadUV);
      pushQuadLocal(b,
        [lx - 0.4, 0.39, z0 + 20], [lx + 0.4, 0.39, z0 + 20],
        [lx + 0.4, 0.39, z0 + 40], [lx - 0.4, 0.39, z0 + 40],
        COL.dash, plainUV);
    }
  }
  for (const lz of ROAD_LINES) {
    for (let s = -5; s < 5; s++) {
      const x0 = s * 60;
      pushQuadLocal(b,
        [x0, 0.38, lz - 6], [x0 + 60, 0.38, lz - 6],
        [x0 + 60, 0.38, lz + 6], [x0, 0.38, lz + 6],
        COL.road, roadUV);
      pushQuadLocal(b,
        [x0 + 20, 0.39, lz - 0.4], [x0 + 40, 0.39, lz - 0.4],
        [x0 + 40, 0.39, lz + 0.4], [x0 + 20, 0.39, lz + 0.4],
        COL.dash, plainUV);
    }
  }
  // Sidewalk pads: one per block, top at y=0.45.
  for (let i = -5; i <= 4; i++) {
    for (let j = -5; j <= 4; j++) {
      const cx = 30 + 60 * i;
      const cz = 30 + 60 * j;
      pushQuadLocal(b,
        [cx - 20, 0.45, cz - 20], [cx + 20, 0.45, cz - 20],
        [cx + 20, 0.45, cz + 20], [cx - 20, 0.45, cz + 20],
        COL.sidewalk, plainUV);
    }
  }

  // Buildings: the box, a roof, and framed glass windows.
  for (const bd of city.buildings) {
    pushBoxLocal(b, bd.x, 0, bd.z, bd.w, bd.h, bd.d, bd.colour, brickUV);
    // Roof: parapet rim, pyramid cap, or an AC box.
    if (bd.roof === 'pyramid') {
      pushBoxLocal(b, bd.x, bd.h, bd.z, bd.w * 0.5, 2.5, bd.d * 0.5, [0.6, 0.35, 0.3], plainUV);
    } else if (bd.roof === 'ac') {
      pushBoxLocal(b, bd.x - bd.w / 4, bd.h, bd.z, 3, 1.5, 3, [0.7, 0.7, 0.72], plainUV);
      pushBoxLocal(b, bd.x + bd.w / 4, bd.h, bd.z, 3, 1.5, 3, [0.7, 0.7, 0.72], plainUV);
    } else {
      pushBoxLocal(b, bd.x, bd.h, bd.z, bd.w + 0.6, 0.8, bd.d + 0.6, [0.5, 0.5, 0.55], plainUV);
    }
    // Windows: two per floor on the front and back faces.
    const floors = Math.max(1, Math.floor(bd.h / 3));
    for (let f = 0; f < floors; f++) {
      const wy = 2 + f * 3;
      if (wy + 1.5 > bd.h) break;
      for (const wx of [-bd.w / 4, bd.w / 4]) {
        const zf = bd.z + bd.d / 2 + 0.06;
        pushQuadLocal(b,
          [bd.x + wx - 1, wy, zf], [bd.x + wx + 1, wy, zf],
          [bd.x + wx + 1, wy + 1.6, zf], [bd.x + wx - 1, wy + 1.6, zf],
          COL.glass, windowUV);
        const zb = bd.z - bd.d / 2 - 0.06;
        pushQuadLocal(b,
          [bd.x + wx + 1, wy, zb], [bd.x + wx - 1, wy, zb],
          [bd.x + wx - 1, wy + 1.6, zb], [bd.x + wx + 1, wy + 1.6, zb],
          COL.glass, windowUV);
      }
    }
  }

  // Palms: a trunk, four fronds and a coconut cluster.
  for (const p of city.palms) {
    pushBoxLocal(b, p.x, 0, p.z, 0.5, p.h, 0.5, [0.5, 0.35, 0.2], plainUV);
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2 + 0.4;
      const dx = Math.cos(a) * 1.6;
      const dz = Math.sin(a) * 1.6;
      pushQuadLocal(b,
        [p.x, p.h, p.z], [p.x + dx, p.h - 0.9, p.z + dz * 0.4],
        [p.x + dx * 1.4, p.h - 1.2, p.z + dz], [p.x + dx * 0.4, p.h - 0.4, p.z + dz * 0.4],
        COL.palmLeaf, plainUV);
    }
    pushBoxLocal(b, p.x + 0.4, p.h - 0.6, p.z, 0.5, 0.5, 0.5, COL.coconut, plainUV);
  }

  // Neon signs glow as flat quads on the walls.
  for (const n of city.neon) {
    pushQuadLocal(b,
      [n.x - 0.1, n.y, n.z - 1.5], [n.x + 0.1, n.y, n.z - 1.5],
      [n.x + 0.1, n.y + 1, n.z + 1.5], [n.x - 0.1, n.y + 1, n.z + 1.5],
      n.col, plainUV);
  }

  // Containers, clouds, waves, lamps, benches, hydrants, bus stops.
  for (const c of city.containers) {
    pushBoxLocal(b, c.x, 0, c.z, 12, 2.6, 2.6, c.col, plainUV);
  }
  for (const c of city.clouds) {
    pushBoxLocal(b, c.x, c.y, c.z, 18, 3, 10, [0.95, 0.95, 0.98], plainUV);
  }
  for (const w of city.waves) {
    pushQuadLocal(b,
      [w.x - 3, 0.52, w.z], [w.x + 3, 0.52, w.z],
      [w.x + 3, 0.52, w.z + 1], [w.x - 3, 0.52, w.z + 1],
      [0.9, 0.95, 1], plainUV);
  }
  for (const l of city.lamps) {
    pushBoxLocal(b, l.x, 0, l.z, 0.3, 5, 0.3, [0.25, 0.25, 0.28], plainUV);
    pushBoxLocal(b, l.x, 5, l.z, 0.8, 0.4, 0.8, [1, 0.9, 0.6], plainUV);
  }
  for (const bn of city.benches) {
    pushBoxLocal(b, bn.x, 0.45, bn.z, 2, 0.15, 0.6, [0.6, 0.4, 0.25], plainUV);
    pushBoxLocal(b, bn.x, 0.45, bn.z - 0.3, 2, 0.8, 0.15, [0.6, 0.4, 0.25], plainUV);
  }
  for (const hy of city.hydrants) {
    pushBoxLocal(b, hy.x, 0.45, hy.z, 0.5, 0.9, 0.5, [0.85, 0.2, 0.15], plainUV);
  }
  for (const bs of city.busStops) {
    pushBoxLocal(b, bs.x, 0.45, bs.z, 3, 2.6, 0.4, [0.3, 0.5, 0.8], plainUV);
    pushBoxLocal(b, bs.x, 0.45, bs.z + 1, 3, 0.3, 2, [0.3, 0.5, 0.8], plainUV);
  }

  // Props: umbrellas, chairs, barrels, balconies, roof props, crane.
  for (const p of city.props) {
    if (p.kind === 'umbrella') {
      pushBoxLocal(b, p.x, 0.45, p.z, 0.2, 2.4, 0.2, [0.4, 0.4, 0.4], plainUV);
      pushBoxLocal(b, p.x, 2.8, p.z, 3, 0.3, 3, p.col, plainUV);
    } else if (p.kind === 'chair') {
      pushBoxLocal(b, p.x, 0.45, p.z, 1, 0.6, 1, p.col, plainUV);
    } else if (p.kind === 'barrel') {
      pushBoxLocal(b, p.x, 0.45, p.z, 1, 1.1, 1, p.col, plainUV);
    } else if (p.kind === 'balcony') {
      pushBoxLocal(b, p.x, p.y, p.z, 4, 0.3, 1.2, [0.7, 0.7, 0.75], plainUV);
    } else if (p.kind === 'roof') {
      pushBoxLocal(b, p.x, p.y, p.z, 2, 1, 2, [0.6, 0.6, 0.62], plainUV);
    } else if (p.kind === 'crane') {
      pushBoxLocal(b, p.x, 0, p.z, 2, 22, 2, [0.9, 0.7, 0.2], plainUV);
    } else if (p.kind === 'craneArm') {
      pushBoxLocal(b, p.x + 8, 20, p.z, 18, 1.5, 1.5, [0.9, 0.7, 0.2], plainUV);
    }
  }

  // Traffic lights: a pole and a signal head.
  for (const l of city.lights) {
    pushBoxLocal(b, l.x + 6.5, 0.38, l.z + 6.5, 0.3, 4.5, 0.3, [0.2, 0.2, 0.22], plainUV);
    pushBoxLocal(b, l.x + 6.5, 4.5, l.z + 6.5, 0.6, 1.2, 0.6, [0.15, 0.15, 0.15], plainUV);
  }

  // The three dock barrels (the GLB's procedural stand-ins in the
  // static pass): barrel red, down by the harbour.
  for (const [bx, bz] of [[-240, 180], [-236, 184], [-244, 184]]) {
    pushBoxLocal(b, bx, 0.45, bz, 1, 1.1, 1, COL.barrelRed, plainUV);
  }
  return b;
}

// Local push helpers (kept in this file so world.js never imports the
// renderer — the batch is just three arrays).
function pushQuadLocal(b, p0, p1, p2, p3, color, uv) {
  const c = color || [1, 1, 1];
  const t = uv || [0, 0, 1, 1];
  const pts = [p0, p1, p2, p0, p2, p3];
  const uvs = [[t[0], t[1]], [t[2], t[1]], [t[2], t[3]], [t[0], t[1]], [t[2], t[3]], [t[0], t[3]]];
  for (let i = 0; i < 6; i++) {
    b.pos.push(pts[i][0], pts[i][1], pts[i][2]);
    b.col.push(c[0], c[1], c[2]);
    b.uv.push(uvs[i][0], uvs[i][1]);
  }
}

function pushBoxLocal(b, x, y, z, w, h, d, color, uv) {
  const x0 = x - w / 2;
  const x1 = x + w / 2;
  const y0 = y;
  const y1 = y + h;
  const z0 = z - d / 2;
  const z1 = z + d / 2;
  const faces = [
    { v: [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x0, y1, z0], [x1, y1, z1], [x1, y1, z0]], s: 1.0 },
    { v: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z0], [x1, y0, z1], [x0, y0, z1]], s: 0.7 },
    { v: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y0, z1], [x1, y1, z1], [x0, y1, z1]], s: 0.85 },
    { v: [[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x0, y0, z0], [x1, y1, z0], [x1, y0, z0]], s: 0.85 },
    { v: [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z0], [x1, y1, z1], [x1, y0, z1]], s: 0.85 },
    { v: [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y0, z0], [x0, y1, z1], [x0, y1, z0]], s: 0.85 },
  ];
  const c = color || [1, 1, 1];
  const t = uv || [0, 0, 1, 1];
  for (const f of faces) {
    const r = c[0] * f.s;
    const g = c[1] * f.s;
    const bl = c[2] * f.s;
    for (let i = 0; i < 6; i++) {
      b.pos.push(f.v[i][0], f.v[i][1], f.v[i][2]);
      b.col.push(r, g, bl);
    }
    b.uv.push(t[0], t[1], t[0], t[3], t[2], t[3], t[0], t[1], t[2], t[3], t[2], t[1]);
  }
}
