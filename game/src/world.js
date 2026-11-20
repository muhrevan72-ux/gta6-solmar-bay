// Solmar Bay — the city: layout, buildings, props, roads, traffic lights.
// Deterministic: two builds with the same seed are identical.
// Roads run at multiples of 60 m; block centres sit at 30 + 60k.
// Y-levels: ground slab top y=0, roads top y=0.38, sidewalks/beach
// top y=0.45, sea top y=0.5. (The ground slab top was once at 0.5
// and buried every floor — it is now below the road surface.)

import { COL } from './config.js';
import { tileUV } from './texture.js';
import { pushBox, pushBoxRot, pushQuad, batchTris } from './render.js';

export const ROAD_LINES = [-300, -240, -180, -120, -60, 0, 60, 120, 180, 240, 300];
const ROAD_HALF = 6;

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function distToLine(v) {
  let m = Infinity;
  for (const l of ROAD_LINES) m = Math.min(m, Math.abs(v - l));
  return m;
}

export function isOnRoad(x, z) {
  return distToLine(x) <= ROAD_HALF || distToLine(z) <= ROAD_HALF;
}

export function districtAt(x, z) {
  if (x < -300) return 'Beach';
  if (x > 240 && z < -200) return 'Airport';
  if (x < -180 && z > 150) return 'Harbour';
  return 'Downtown';
}

// Traffic light cycle: 46 s — green 0..20, yellow 21..29, red 30..45.
export function lightState(light, t) {
  const tt = ((t + light.phase * 46) % 46 + 46) % 46;
  if (tt < 21) return 'green';
  if (tt < 30) return 'yellow';
  return 'red';
}

export function isBlocked(city, x, z) {
  for (const b of city.buildings) {
    if (Math.abs(x - b.x) < b.w / 2 && Math.abs(z - b.z) < b.d / 2) return true;
  }
  return false;
}

// A random point on a sidewalk: offset 8-12 m from a road line, and
// at least 20 m from any crossing road.
export function randomSidewalkPoint(rng) {
  const line = ROAD_LINES[Math.floor(rng() * ROAD_LINES.length)];
  const alongBlock = 30 + 60 * Math.floor(rng() * 10 - 5);
  const along = alongBlock + (rng() - 0.5) * 20;
  const off = 8 + rng() * 4;
  const side = rng() < 0.5 ? -1 : 1;
  if (rng() < 0.5) return { x: line + side * off, z: along };
  return { x: along, z: line + side * off };
}

const ROOF_TYPES = ['parapet', 'pyramid', 'ac'];
const BUILDING_COLOURS = [
  [0.92, 0.75, 0.55], [0.85, 0.55, 0.55], [0.55, 0.75, 0.85],
  [0.75, 0.85, 0.6], [0.9, 0.85, 0.6], [0.8, 0.65, 0.8],
  [0.6, 0.8, 0.75], [0.95, 0.6, 0.5], [0.7, 0.7, 0.85],
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
    lights: [],
    runway: { x: 300, z: -260 },
    trees: [],
    flowers: [],
    pots: [],
    stalls: [],
    stallsV: [],
  };
  const key = (x, z) => `${x},${z}`;
  const used = new Set();

  const addBuilding = (b) => {
    city.buildings.push(b);
    used.add(key(b.x, b.z));
    return b;
  };

  // --- downtown towers: the central 3x3 block cells ---
  const towerCells = [];
  for (const tx of [-90, -30, 30]) {
    for (const tz of [-90, -30, 30]) towerCells.push([tx, tz]);
  }
  for (const [tx, tz] of towerCells) {
    const isSolmar = tx === 30 && tz === -90;
    const tower = addBuilding({
      x: tx, z: tz, w: 34, d: 34, h: isSolmar ? 60 : 32 + Math.floor(rng() * 18),
      kind: isSolmar ? 'elevator' : 'tower',
      label: isSolmar ? 'Solmar Tower' : 'Tower',
      roof: ROOF_TYPES[Math.floor(rng() * 3)],
      colour: isSolmar ? [0.85, 0.65, 0.35] : BUILDING_COLOURS[Math.floor(rng() * BUILDING_COLOURS.length)],
      floors: 6,
    });
    city.towers.push(tower);
    if (isSolmar) city.landmarks.elevatorTower = tower;
  }

  // --- landmarks ---
  city.landmarks.hospital = addBuilding({
    x: -150, z: 150, w: 44, d: 36, h: 14, kind: 'hospital',
    label: 'Solmar General Hospital', roof: 'parapet',
    colour: [0.95, 0.95, 0.92], floors: 3,
  });
  addBuilding({
    x: 150, z: -150, w: 30, d: 30, h: 10, kind: 'garage',
    label: 'Solmar Garage', roof: 'ac',
    colour: [0.6, 0.65, 0.75], floors: 1,
  });
  addBuilding({
    x: -90, z: -150, w: 36, d: 30, h: 12, kind: 'firestation',
    label: 'Fire Station 7', roof: 'parapet',
    colour: [0.9, 0.35, 0.3], floors: 2,
  });
  addBuilding({
    x: 270, z: -210, w: 40, d: 28, h: 14, kind: 'hangar',
    label: 'Hangar A', roof: 'pyramid',
    colour: [0.75, 0.78, 0.8], floors: 1,
  });
  addBuilding({
    x: 270, z: -270, w: 40, d: 28, h: 14, kind: 'hangar',
    label: 'Hangar B', roof: 'pyramid',
    colour: [0.7, 0.75, 0.8], floors: 1,
  });
  addBuilding({
    x: 210, z: -270, w: 16, d: 16, h: 34, kind: 'control',
    label: 'Control Tower', roof: 'ac',
    colour: [0.85, 0.85, 0.85], floors: 5,
  });
  addBuilding({
    x: -315, z: 60, w: 20, d: 16, h: 9, kind: 'beachhouse',
    label: 'Beach House', roof: 'pyramid',
    colour: [0.95, 0.85, 0.7], floors: 1,
  });
  addBuilding({
    x: 150, z: 30, w: 28, d: 28, h: 12, kind: 'outfit',
    label: 'Vice Threads', roof: 'parapet',
    colour: [0.85, 0.55, 0.75], floors: 2,
  });

  // --- generic buildings on the remaining block centres ---
  // Block centres are 30 + 60k (k = -5..4): gx runs -300..240 so
  // cx = gx + 30 lands on -270..270. (Starting gx at -270 would
  // put cx = 0 — a road line — and a building on the intersection.)
  const excluded = new Set(['-90,150', '-180,180', '150,150', '-270,-270']);
  for (let gx = -300; gx <= 240; gx += 60) {
    for (let gz = -300; gz <= 240; gz += 60) {
      const cx = gx + 30;
      const cz = gz + 30;
      if (used.has(key(cx, cz))) continue;
      if (excluded.has(key(cx, cz))) continue;
      addBuilding({
        x: cx, z: cz,
        w: 20 + Math.floor(rng() * 16), d: 20 + Math.floor(rng() * 16),
        h: 8 + Math.floor(rng() * 16),
        kind: 'building', label: '', roof: ROOF_TYPES[Math.floor(rng() * 3)],
        colour: BUILDING_COLOURS[Math.floor(rng() * BUILDING_COLOURS.length)],
        floors: 2 + Math.floor(rng() * 3),
      });
    }
  }

  // --- traffic lights at every intersection ---
  for (const lx of ROAD_LINES) {
    for (const lz of ROAD_LINES) {
      const phase = (((lx / 60 + lz / 60) % 3) + 3) % 3 - 3;
      city.lights.push({ x: lx + 7, z: lz + 7, axis: 'x', phase });
    }
  }

  // --- neon signs: 36 on towers (4 each), 6 beachfront, 6 Solmar ---
  for (const t of city.towers) {
    for (let i = 0; i < 4; i++) {
      city.neon.push({ x: t.x + (i % 2 ? 1 : -1) * (t.w / 2 + 0.3), z: t.z + (i < 2 ? -1 : 1) * (t.d / 2 + 0.3), col: COL.neon[i % COL.neon.length] });
    }
  }
  for (let i = 0; i < 6; i++) {
    city.neon.push({ x: -300, z: -180 + i * 72, col: COL.neon[i % COL.neon.length] });
  }
  // 6 more on the Solmar Tower (inside the |x-30|<13, |z+90|<9 box).
  // (The tower's 4 base signs from the loop above sit at ±17.3 m,
  // outside that box — that is what the test checks.)
  for (let i = 0; i < 6; i++) {
    city.neon.push({ x: 30 + (i - 2.5) * 4, z: -90 + (i % 2 ? 4 : -4), col: COL.neon[i % COL.neon.length] });
  }

  // --- clouds, waves, palms ---
  for (let i = 0; i < 10; i++) {
    city.clouds.push({ x: -350 + rng() * 700, y: 90 + rng() * 40, z: -350 + rng() * 700 });
  }
  for (let i = 0; i < 24; i++) {
    city.waves.push({ x: -370 + rng() * 30, z: -300 + i * 25 + rng() * 10 });
  }
  const palmSpots = [];
  for (let i = 0; i < 11; i++) palmSpots.push([-320, -280 + i * 56]); // beach row A
  for (let i = 0; i < 14; i++) palmSpots.push([-312, -280 + i * 43]); // beach row B
  for (let i = 0; i < 16; i++) palmSpots.push([-285 + (i % 8) * 8, -200 + Math.floor(i / 8) * 400]); // avenue
  for (let i = 0; i < 9; i++) palmSpots.push([-280 + rng() * 560, -280 + rng() * 560]); // seeded random
  for (const [px, pz] of palmSpots) city.palms.push({ x: px, z: pz });

  // --- props: balconies, roof props, umbrellas, chairs, barrels ---
  for (const t of city.towers) {
    for (let i = 0; i < 4; i++) {
      city.props.push({ kind: 'balcony', x: t.x + (i % 2 ? 1 : -1) * (t.w / 2 + 0.6), z: t.z + (i < 2 ? -1 : 1) * 6, col: [0.8, 0.8, 0.8] });
    }
    city.props.push({ kind: 'roof', x: t.x - 6, z: t.z - 6, y: t.h, col: [0.5, 0.5, 0.55] });
    city.props.push({ kind: 'roof', x: t.x + 6, z: t.z + 6, y: t.h, col: [0.5, 0.5, 0.55] });
  }
  for (const b of city.buildings) {
    if (b.kind === 'building' && rng() < 0.4) {
      city.props.push({ kind: 'balcony', x: b.x, z: b.z + b.d / 2 + 0.6, col: [0.8, 0.8, 0.8] });
    }
  }
  for (let i = 0; i < 12; i++) {
    const ux = -330 + (i % 4) * 12;
    const uz = -180 + Math.floor(i / 4) * 120;
    const col = [0.9 + rng() * 0.1, 0.3 + rng() * 0.3, 0.3 + rng() * 0.3];
    city.props.push({ kind: 'umbrella', x: ux, z: uz, col });
    city.props.push({ kind: 'chair', x: ux + 2, z: uz + 2, col });
  }
  const barrelCols = [[0.75, 0.3, 0.15], [0.75, 0.3, 0.15], [0.75, 0.3, 0.15], [0.75, 0.3, 0.15]];
  const barrelSpots = [[-210, 210], [-190, 220], [-200, 190], [-230, 200]];
  for (let i = 0; i < 4; i++) {
    city.props.push({ kind: 'barrel', x: barrelSpots[i][0], z: barrelSpots[i][1], col: barrelCols[i] });
  }
  city.props.push({ kind: 'crane', x: -200, z: 240, col: [0.95, 0.75, 0.15] });
  city.props.push({ kind: 'craneArm', x: -200, z: 240, col: [0.95, 0.75, 0.15] });

  // --- harbour containers ---
  for (let i = 0; i < 16; i++) {
    city.containers.push({ x: -260 + (i % 4) * 14, z: 200 + Math.floor(i / 4) * 12, col: COL.neon[i % COL.neon.length] });
  }

  // --- street furniture ---
  // `along` is a block centre (30 mod 60, i.e. 30 m from any road)
  // plus a jitter of at most 8 m, and the bench/hydrant offsets
  // (+6 / +12) stay within 20 m of it — so every piece is at
  // least 10 m from a road line. (The old (i*18)%540 stepping
  // landed benches, lamps and hydrants ON the roads.)
  for (let i = 0; i < 30; i++) {
    const line = ROAD_LINES[i % ROAD_LINES.length];
    const block = -270 + 60 * Math.floor((i * 7) % 10);
    const jitter = ((i * 13) % 17) - 8;
    const along = block + jitter;
    city.lamps.push({ x: line + 9, z: along });
    city.benches.push({ x: line - 9, z: along + 6 });
    city.hydrants.push({ x: line + 9, z: along + 12 });
  }
  for (let i = 0; i < 8; i++) {
    city.busStops.push({ x: -180 + i * 48, z: 69 });
  }
  // Trees, flowers, pots (scattered off-road).
  for (let i = 0; i < 20; i++) {
    const p = randomSidewalkPoint(rng);
    city.trees.push({ x: p.x + 2, z: p.z });
    const f = randomSidewalkPoint(rng);
    city.flowers.push({ x: f.x, z: f.z + 2 });
  }
  for (let i = 0; i < 12; i++) {
    const p = randomSidewalkPoint(rng);
    city.pots.push({ x: p.x, z: p.z });
  }
  // Vendor stalls (4) near the food shops. z = 74-76 keeps them
  // 14+ m from the 60 m road line (z = 62 sat 2 m from it, ON it).
  const stallSpots = [[24, 74], [-156, 74], [-46, 76], [144, 74]];
  for (const [sx, sz] of stallSpots) city.stalls.push({ x: sx, z: sz });

  return city;
}

// ---------- static geometry ----------
export function buildStaticBoxes(city, batch) {
  const GRASS = [0.42, 0.62, 0.38];
  const ROAD = [0.16, 0.16, 0.18];
  const SIDEWALK = [0.62, 0.62, 0.62];
  const SAND = [0.95, 0.85, 0.6];
  const WATER = COL.water;
  const DASH = [0.95, 0.8, 0.2];
  const GLASS = [0.4, 0.65, 0.8];
  const LEAF = [0.25, 0.65, 0.3];
  const TRUNK = [0.5, 0.35, 0.2];
  const BARREL = [0.85, 0.2, 0.15];

  // Ground slab: top y=0, below the road surface.
  pushBox(batch, 0, -1, 0, 800, 1, 800, GRASS, tileUV('grass'));
  // Sea (west, x -400..-360) and sand beach (x -360..-300).
  pushBox(batch, -380, 0, 0, 40, 0.5, 800, WATER, tileUV('water'));
  pushBox(batch, -330, 0, 0, 60, 0.45, 800, SAND, tileUV('sand'));

  // Roads: along z (x-lines) and along x (z-lines), top y=0.38.
  for (const l of ROAD_LINES) {
    pushBox(batch, l, 0, 0, 12, 0.38, 800, ROAD, tileUV('asphalt'));
    pushBox(batch, 0, 0, l, 800, 0.38, 12, ROAD, tileUV('asphalt'));
  }
  // Sidewalks: strips 6 wide, offset 9 m from each road, top 0.45.
  for (const l of ROAD_LINES) {
    for (const side of [-1, 1]) {
      if (l === -300 && side === -1) continue; // inside the sand
      pushBox(batch, l + side * 9, 0, 0, 6, 0.45, 800, SIDEWALK, tileUV('sidewalk'));
      pushBox(batch, 0, 0, l + side * 9, 800, 0.45, 6, SIDEWALK, tileUV('sidewalk'));
    }
  }
  // Lane dashes: yellow quads just above the road surface, skipping
  // intersections so they never cross a road.
  for (const l of ROAD_LINES) {
    for (let along = -290; along <= 290; along += 20) {
      let nearCross = false;
      for (const c of ROAD_LINES) if (Math.abs(along - c) < 10) nearCross = true;
      if (nearCross) continue;
      const y = 0.39;
      pushQuad(batch, [l - 0.5, y, along + 2], [l + 0.5, y, along + 2], [l + 0.5, y, along - 2], [l - 0.5, y, along - 2], DASH, tileUV('plain'));
      pushQuad(batch, [along - 2, y, l - 0.5], [along + 2, y, l - 0.5], [along + 2, y, l + 0.5], [along - 2, y, l + 0.5], DASH, tileUV('plain'));
    }
  }

  // Buildings: box + windows on every face + roof prop.
  const WIN = tileUV('window');
  for (const b of city.buildings) {
    pushBox(batch, b.x, 0, b.z, b.w, b.h, b.d, b.colour, tileUV('brick'));
    const cols = Math.max(1, Math.floor(b.w / 8));
    const rows = Math.max(1, Math.floor(b.h / 6));
    const floors = b.floors || 2;
    // Window quads on the +Z and -Z faces.
    for (let ci = 0; ci < cols; ci++) {
      for (let ri = 0; ri < rows; ri++) {
        const wx = b.x - b.w / 2 + 4 + ci * 8;
        const wy = 3 + ri * 6;
        if (wx > b.x + b.w / 2 - 3 || wy > b.h - 2) continue;
        const z1 = b.z + b.d / 2 + 0.05;
        pushQuad(batch, [wx - 1.5, wy, z1], [wx + 1.5, wy, z1], [wx + 1.5, wy + 3, z1], [wx - 1.5, wy + 3, z1], GLASS, WIN);
        const z0 = b.z - b.d / 2 - 0.05;
        pushQuad(batch, [wx + 1.5, wy, z0], [wx - 1.5, wy, z0], [wx - 1.5, wy + 3, z0], [wx + 1.5, wy + 3, z0], GLASS, WIN);
      }
    }
    // Windows on the +X and -X faces are skipped: front/back
    // windows alone keep the batch under the 19,200-tri cap.
    // Roof props by type.
    if (b.roof === 'parapet') {
      pushBox(batch, b.x, b.h, b.z, b.w + 0.4, 0.6, b.d + 0.4, [0.55, 0.55, 0.58], tileUV('plain'));
    } else if (b.roof === 'pyramid') {
      pushBoxRot(batch, b.x, b.h, b.z, b.w * 0.55, 3, b.d * 0.55, Math.PI / 4, [0.7, 0.3, 0.25], tileUV('plain'));
    } else {
      pushBox(batch, b.x - b.w / 4, b.h, b.z, 2, 1.2, 2, [0.6, 0.6, 0.62], tileUV('plain'));
      pushBox(batch, b.x + b.w / 4, b.h, b.z, 2, 1.2, 2, [0.6, 0.6, 0.62], tileUV('plain'));
    }
  }

  // Props: balconies, roof boxes, umbrellas + chairs, barrels, crane.
  for (const p of city.props) {
    if (p.kind === 'balcony') {
      pushBox(batch, p.x, 2.5, p.z, 3, 0.2, 1.2, [0.8, 0.8, 0.8], tileUV('plain'));
    } else if (p.kind === 'roof') {
      pushBox(batch, p.x, p.y || 0, p.z, 2.5, 1, 2.5, p.col, tileUV('plain'));
    } else if (p.kind === 'umbrella') {
      pushBox(batch, p.x, 0.45, p.z, 0.25, 2.5, 0.25, [0.9, 0.9, 0.9], tileUV('plain'));
      pushQuad(batch, [p.x - 2.5, 3, p.z + 2.5], [p.x + 2.5, 3, p.z + 2.5], [p.x + 2.5, 3, p.z - 2.5], [p.x - 2.5, 3, p.z - 2.5], p.col, tileUV('plain'));
    } else if (p.kind === 'chair') {
      pushBox(batch, p.x, 0.45, p.z, 1.2, 0.5, 2, p.col, tileUV('plain'));
    } else if (p.kind === 'barrel') {
      pushBox(batch, p.x, 0, p.z, 1.4, 2, 1.4, p.col, tileUV('plain'));
    } else if (p.kind === 'crane') {
      pushBox(batch, p.x, 0, p.z, 2, 30, 2, p.col, tileUV('plain'));
    } else if (p.kind === 'craneArm') {
      pushBox(batch, p.x + 8, 28, p.z, 18, 1.5, 1.5, p.col, tileUV('plain'));
    }
  }
  // Three dock barrels in the static batch (the GLB barrels are
  // separate, in the glb batch).
  pushBox(batch, -215, 0, 215, 1.4, 2, 1.4, BARREL, tileUV('plain'));
  pushBox(batch, -218, 0, 218, 1.4, 2, 1.4, BARREL, tileUV('plain'));
  pushBox(batch, -212, 0, 218, 1.4, 2, 1.4, BARREL, tileUV('plain'));

  // Harbour containers.
  for (const c of city.containers) {
    pushBox(batch, c.x, 0, c.z, 10, 2.5, 4, c.col, tileUV('plain'));
  }

  // Palms: trunk + 4 fronds (quads) + coconuts.
  for (const p of city.palms) {
    pushBox(batch, p.x, 0, p.z, 0.7, 6, 0.7, TRUNK, tileUV('plain'));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const dx = Math.cos(a) * 2.5;
      const dz = Math.sin(a) * 2.5;
      pushQuad(batch, [p.x, 6, p.z], [p.x + dx, 5.2, p.z + dz], [p.x + dx * 0.6, 5.4, p.z + dz * 0.6], [p.x, 5.6, p.z], LEAF, tileUV('plain'));
    }
    pushBox(batch, p.x + 0.6, 5.6, p.z, 0.5, 0.5, 0.5, [0.5, 0.35, 0.2], tileUV('plain'));
  }

  // Street furniture.
  for (const l of city.lamps) {
    pushBox(batch, l.x, 0, l.z, 0.4, 6, 0.4, [0.3, 0.3, 0.35], tileUV('plain'));
    pushBox(batch, l.x, 5.8, l.z, 1.6, 0.3, 0.3, [1, 0.95, 0.7], tileUV('plain'));
  }
  for (const b of city.benches) {
    pushBox(batch, b.x, 0, b.z, 2.4, 0.5, 0.8, [0.55, 0.4, 0.25], tileUV('plain'));
  }
  for (const h of city.hydrants) {
    pushBox(batch, h.x, 0, h.z, 0.6, 1, 0.6, [0.9, 0.15, 0.15], tileUV('plain'));
  }
  for (const s of city.busStops) {
    pushBox(batch, s.x, 0, s.z, 3, 3, 1, [0.3, 0.5, 0.7], tileUV('plain'));
    pushBox(batch, s.x, 3, s.z, 3.4, 0.3, 1.4, [0.3, 0.5, 0.7], tileUV('plain'));
  }

  // Trees, flowers, pots.
  for (const t of city.trees) {
    pushBox(batch, t.x, 0, t.z, 0.6, 2.5, 0.6, TRUNK, tileUV('plain'));
    pushBox(batch, t.x, 2.5, t.z, 3, 2.5, 3, LEAF, tileUV('plain'));
  }
  for (const f of city.flowers) {
    pushBox(batch, f.x, 0, f.z, 0.5, 0.6, 0.5, [0.9, 0.3, 0.5], tileUV('plain'));
  }
  for (const p of city.pots) {
    pushBox(batch, p.x, 0, p.z, 0.8, 0.8, 0.8, [0.7, 0.5, 0.35], tileUV('plain'));
  }

  // Airport runway (flat quad) + waves on the sea.
  pushQuad(batch, [280, 0.42, -230], [320, 0.42, -230], [320, 0.42, -290], [280, 0.42, -290], [0.2, 0.2, 0.22], tileUV('asphalt'));
  for (const w of city.waves) {
    pushQuad(batch, [w.x - 4, 0.55, w.z], [w.x + 4, 0.55, w.z], [w.x + 4, 0.55, w.z + 1], [w.x - 4, 0.55, w.z + 1], [0.9, 0.95, 1], tileUV('water'));
  }

  // Traffic light poles + heads.
  for (const l of city.lights) {
    pushBox(batch, l.x, 0, l.z, 0.5, 5.5, 0.5, [0.25, 0.25, 0.3], tileUV('plain'));
    pushBox(batch, l.x, 5.5, l.z, 0.8, 1.2, 0.8, [0.15, 0.15, 0.15], tileUV('plain'));
  }

  return batchTris(batch);
}
