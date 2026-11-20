// Solmar Bay — city generation + static geometry (rebuild #13).
// Deterministic: every random choice comes from a seeded RNG
// (mulberry32, seed 1337), so two builds are byte-identical.
// Roads run on multiples of 60 (half-width 7); buildings sit on
// block centres (multiples of 60 + 30).
import { BoxBatch, batchTris, pushBox, pushQuad } from './render.js';
import { tileUV } from './texture.js';
import { COL } from './config.js';

export const ROAD_LINES = [];
for (let v = -360; v <= 360; v += 60) ROAD_LINES.push(v);

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function isOnRoad(x, z) {
  const nearLine = (v) => {
    const m = Math.round(v / 60) * 60;
    return Math.abs(v - m) < 7;
  };
  return nearLine(x) || nearLine(z);
}

export function isBlocked(city, x, z) {
  for (const b of city.buildings) {
    if (Math.abs(x - b.x) < b.w / 2 + 0.5 && Math.abs(z - b.z) < b.d / 2 + 0.5) return true;
  }
  return false;
}

export function randomSidewalkPoint(rng) {
  // A block centre (multiple of 60 + 30) plus an offset that keeps
  // the point at least 10 m from any road line.
  const bx = (Math.floor(rng() * 12) - 6) * 60 + 30;
  const bz = (Math.floor(rng() * 12) - 6) * 60 + 30;
  const ox = (rng() * 2 - 1) * 10;
  const oz = (rng() * 2 - 1) * 10;
  return { x: bx + ox, z: bz + oz };
}

export function districtAt(x, z) {
  if (x < -300) return 'Beach';
  if (x > 240 && z < -180) return 'Airport';
  if (x < -180 && z > 120) return 'Harbour';
  return 'Downtown';
}

export function lightState(light, t) {
  const tt = (((t + light.phase * 46) % 46) + 46) % 46;
  if (tt < 21) return 'green';
  if (tt < 30) return 'yellow';
  return 'red';
}

const BUILDING_COLOURS = [
  [0.85, 0.6, 0.45], [0.7, 0.75, 0.8], [0.9, 0.75, 0.5],
  [0.6, 0.7, 0.9], [0.85, 0.5, 0.55], [0.55, 0.8, 0.6],
  [0.95, 0.85, 0.6], [0.75, 0.6, 0.8], [0.5, 0.65, 0.7],
];

export function buildCity() {
  const rng = mulberry32(1337);
  const buildings = [];
  const towers = [];
  const props = [];
  const neon = [];
  const clouds = [];
  const waves = [];
  const palms = [];
  const containers = [];
  const lamps = [];
  const benches = [];
  const hydrants = [];
  const busStops = [];
  const lights = [];

  // --- buildings on the block grid ---
  const towerSpots = [
    [30, -90], [-30, -30], [90, -30], [30, 30], [-30, 90],
    [90, 90], [-90, -90], [150, -30], [-90, 150],
  ];
  const isTowerSpot = (bx, bz) => towerSpots.some(([x, z]) => x === bx && z === bz);
  const roofCycle = ['parapet', 'pyramid', 'ac'];
  let roofIdx = 0;
  for (let gx = -5; gx <= 4; gx++) {
    for (let gz = -5; gz <= 4; gz++) {
      const bx = gx * 60 + 30;
      const bz = gz * 60 + 30;
      const tower = isTowerSpot(bx, bz);
      // Airport zone: hangars + control tower instead of blocks.
      if (bx > 240 && bz < -180) continue;
      // Harbour yard: containers instead of blocks (never a tower spot).
      if (!tower && bx < -180 && bz > 120 && bx > -300) {
        if (rng() < 0.5) continue;
      }
      if (!tower && rng() < 0.18) continue; // empty lot / park
      const w = tower ? 26 + rng() * 8 : 24 + rng() * 14;
      const d = tower ? 26 + rng() * 8 : 24 + rng() * 14;
      const h = tower ? 42 + rng() * 28 : 8 + rng() * 16;
      const col = BUILDING_COLOURS[Math.floor(rng() * BUILDING_COLOURS.length)];
      const roof = roofCycle[roofIdx++ % 3];
      const b = {
        x: bx, z: bz, w, d, h, col, roof,
        kind: tower ? 'tower' : 'building',
        label: null,
      };
      buildings.push(b);
      if (tower) towers.push(b);
    }
  }
  // Hospital replaces the block building at (-150, 150).
  const hospIdx = buildings.findIndex((b) => b.x === -150 && b.z === 150);
  const hospital = { x: -150, z: 150, w: 44, d: 44, h: 18, col: [0.92, 0.92, 0.9], roof: 'parapet', kind: 'hospital', label: 'Hospital' };
  if (hospIdx >= 0) buildings[hospIdx] = hospital;
  else buildings.push(hospital);
  // Beach House near the sand.
  const bhIdx = buildings.findIndex((b) => b.x === -270 && b.z === 60);
  const beachHouse = { x: -270, z: 60, w: 30, d: 26, h: 10, col: [0.95, 0.8, 0.6], roof: 'pyramid', kind: 'house', label: 'Beach House' };
  if (bhIdx >= 0) buildings[bhIdx] = beachHouse;
  else buildings.push(beachHouse);
  // Airport: 2 hangars + control tower.
  buildings.push({ x: 270, z: -270, w: 40, d: 30, h: 14, col: [0.7, 0.72, 0.75], roof: 'parapet', kind: 'hangar', label: 'Hangar 1' });
  buildings.push({ x: 330, z: -270, w: 40, d: 30, h: 14, col: [0.68, 0.7, 0.73], roof: 'parapet', kind: 'hangar', label: 'Hangar 2' });
  buildings.push({ x: 240, z: -300, w: 16, d: 16, h: 34, col: [0.8, 0.82, 0.85], roof: 'ac', kind: 'control', label: 'Control Tower' });

  const landmarks = {
    hospital,
    elevatorTower: towers.find((t) => t.x === 30 && t.z === -90) || towers[0],
    beachHouse,
  };

  // --- neon signs: 36 on towers (4 each) + 6 beachfront + 6 Solmar Tower ---
  const neonCols = [[1, 0.3, 0.5], [0.2, 0.9, 1], [1, 0.8, 0.2], [0.6, 1, 0.4], [0.9, 0.4, 1], [1, 0.5, 0.2]];
  for (const t of towers) {
    for (let i = 0; i < 4; i++) {
      neon.push({ x: t.x + (i % 2 === 0 ? -t.w / 2 - 0.5 : t.w / 2 + 0.5), y: 8 + i * 9, z: t.z + (i < 2 ? -t.d / 2 : t.d / 2), col: neonCols[(towers.indexOf(t) + i) % neonCols.length] });
    }
  }
  for (let i = 0; i < 6; i++) {
    neon.push({ x: -300, y: 6 + i * 2, z: -180 + i * 60, col: neonCols[i % neonCols.length] });
  }
  for (let i = 0; i < 6; i++) {
    neon.push({ x: 30 + (i % 3) * 8 - 8, y: 10 + Math.floor(i / 3) * 12, z: -90 + (i % 2 === 0 ? -6 : 6), col: neonCols[i % neonCols.length] });
  }

  // --- clouds + waves ---
  for (let i = 0; i < 10; i++) {
    clouds.push({ x: -300 + rng() * 600, y: 55 + rng() * 20, z: -300 + rng() * 600 });
  }
  for (let i = 0; i < 24; i++) {
    waves.push({ x: -380 + rng() * 60, y: 0.51, z: -300 + i * 26 });
  }

  // --- palms: 9 seeded beach palms + rows (beach A 11, beach B 14, avenue 16) ---
  for (let i = 0; i < 9; i++) {
    palms.push({ x: -360 + rng() * 50, z: -200 + rng() * 400, h: 7 + rng() * 3 });
  }
  for (let i = 0; i < 11; i++) palms.push({ x: -318, z: -180 + i * 36, h: 8 });
  for (let i = 0; i < 14; i++) palms.push({ x: -344, z: -195 + i * 30, h: 7.5 });
  for (let i = 0; i < 16; i++) palms.push({ x: -240 + i * 32, z: -306, h: 8 });

  // --- harbour containers + crane ---
  const contCols = [[0.8, 0.3, 0.2], [0.2, 0.5, 0.8], [0.9, 0.7, 0.2], [0.3, 0.7, 0.3]];
  for (let i = 0; i < 16; i++) {
    containers.push({ x: -270 + (i % 4) * 14, z: 150 + Math.floor(i / 4) * 12, col: contCols[i % contCols.length] });
  }
  props.push({ kind: 'crane', x: -240, z: 210, col: [0.9, 0.7, 0.2] });
  props.push({ kind: 'craneArm', x: -240, z: 210, col: [0.9, 0.7, 0.2] });

  // --- street furniture ---
  for (let i = 0; i < 24; i++) {
    const x = (i % 2 === 0 ? -1 : 1) * (60 * Math.floor(i / 2) - 240);
    lamps.push({ x, z: 8 });
  }
  for (let i = 0; i < 30; i++) benches.push({ x: -270 + (i % 10) * 60, z: -150 + Math.floor(i / 10) * 120 });
  for (let i = 0; i < 30; i++) hydrants.push({ x: -240 + (i % 10) * 55, z: -210 + Math.floor(i / 10) * 140 });
  for (let i = 0; i < 8; i++) busStops.push({ x: -240 + i * 60, z: 52 });

  // --- balconies + roof props on towers ---
  for (const t of towers) {
    for (let i = 0; i < 3; i++) {
      props.push({ kind: 'balcony', x: t.x + t.w / 2 + 0.6, y: 10 + i * 12, z: t.z - 6 + i * 6, col: [0.7, 0.7, 0.72] });
    }
    props.push({ kind: 'roof', x: t.x, y: t.h, z: t.z, col: [0.5, 0.5, 0.52] });
  }

  // --- umbrellas + chairs (chair shares its umbrella's colour array) ---
  const umbCols = [[1, 0.3, 0.3], [0.3, 0.6, 1], [1, 0.8, 0.2], [0.4, 0.9, 0.4]];
  for (let i = 0; i < 12; i++) {
    const col = umbCols[i % umbCols.length];
    const u = { kind: 'umbrella', x: -322 + (i % 4) * 4, y: 0.45, z: -150 + Math.floor(i / 4) * 40, col };
    props.push(u);
    props.push({ kind: 'chair', x: -320 + (i % 4) * 4, y: 0.45, z: -148 + Math.floor(i / 4) * 40, col });
  }
  // --- rust-red barrels ---
  for (let i = 0; i < 4; i++) {
    props.push({ kind: 'barrel', x: -220 + i * 5, y: 0, z: 190, col: [0.75, 0.3, 0.15] });
  }

  // --- traffic lights at intersections ---
  for (const x of ROAD_LINES) {
    for (const z of ROAD_LINES) {
      if (Math.abs(x) > 300 || Math.abs(z) > 300) continue;
      lights.push({ x, z, axis: 'x', phase: (x + z) / 60 });
    }
  }

  return {
    buildings, towers, landmarks, neon, clouds, waves, palms,
    containers, lamps, benches, hydrants, busStops, props, lights,
    runway: { x: 300, z: -260 },
  };
}

export function buildStaticBoxes(city, batch) {
  const plain = tileUV('plain');
  const brick = tileUV('brick');
  const winUV = tileUV('window');
  // Ground slab: top y=0 (must stay BELOW the road tops at 0.38).
  pushBox(batch, 0, -1, 0, 800, 1, 800, COL.grass, plain);
  // Sea (west) and beach sand.
  pushBox(batch, -365, 0, 0, 70, 0.5, 800, COL.water, tileUV('water'));
  pushBox(batch, -345, 0, 0, 30, 0.45, 720, [0.85, 0.75, 0.5], tileUV('sand'));
  // Roads: one long slab per road line, top y=0.38.
  for (const v of ROAD_LINES) {
    pushBox(batch, v, 0, 0, 14, 0.38, 720, COL.road, tileUV('asphalt'));
    pushBox(batch, 0, 0, v, 720, 0.38, 14, COL.road, tileUV('asphalt'));
  }
  // Lane dashes (flat quads on the road tops).
  for (const v of ROAD_LINES) {
    for (let s = -348; s <= 348; s += 24) {
      pushQuad(batch, [v - 0.4, 0.39, s - 1.5], [v + 0.4, 0.39, s - 1.5], [v + 0.4, 0.39, s + 1.5], [v - 0.4, 0.39, s + 1.5], COL.roadLine, plain);
      pushQuad(batch, [s - 1.5, 0.39, v - 0.4], [s + 1.5, 0.39, v - 0.4], [s + 1.5, 0.39, v + 0.4], [s - 1.5, 0.39, v + 0.4], COL.roadLine, plain);
    }
  }
  // Runway.
  pushBox(batch, 300, 0, -260, 60, 0.4, 200, [0.12, 0.12, 0.14], tileUV('asphalt'));
  // Buildings: box + glass window quads on the front face + roof prop.
  for (const b of city.buildings) {
    pushBox(batch, b.x, 0, b.z, b.w, b.h, b.d, b.col, brick);
    const rows = b.kind === 'tower' ? 3 : 1;
    for (let r = 0; r < rows; r++) {
      const wy = 3 + r * 6;
      if (wy > b.h - 2) break;
      const zf = b.z + b.d / 2 + 0.06;
      const ww = Math.min(3, b.w / 4);
      for (let c = -1; c <= 1; c++) {
        const wx = b.x + c * (b.w / 3);
        pushQuad(batch, [wx - ww / 2, wy, zf], [wx + ww / 2, wy, zf], [wx + ww / 2, wy + 2, zf], [wx - ww / 2, wy + 2, zf], COL.glass, winUV);
      }
    }
    if (b.roof === 'parapet') {
      pushBox(batch, b.x, b.h, b.z, b.w + 0.6, 0.8, b.d + 0.6, [0.45, 0.45, 0.47], plain);
    } else if (b.roof === 'pyramid') {
      pushBox(batch, b.x, b.h, b.z, b.w * 0.5, 2, b.d * 0.5, [0.6, 0.3, 0.25], plain);
    } else {
      pushBox(batch, b.x, b.h, b.z, 3, 1.2, 3, [0.6, 0.6, 0.62], plain);
      pushBox(batch, b.x + 4, b.h, b.z, 0.4, 4, 0.4, [0.3, 0.3, 0.32], plain);
    }
  }
  // Balconies + roof props.
  for (const p of city.props) {
    if (p.kind === 'balcony') pushBox(batch, p.x, p.y, p.z, 1.2, 0.3, 3, p.col, plain);
    else if (p.kind === 'roof') pushBox(batch, p.x, p.y, p.z, 4, 1.5, 4, p.col, plain);
  }
  // Palms: trunk + 4 fronds + coconuts.
  for (const p of city.palms) {
    pushBox(batch, p.x, 0, p.z, 0.7, p.h, 0.7, [0.45, 0.3, 0.15], plain);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      pushBox(batch, p.x + Math.cos(a) * 1.4, p.h, p.z + Math.sin(a) * 1.4, 2.6, 0.25, 0.8, COL.palmLeaf, plain);
    }
    pushBox(batch, p.x + 0.5, p.h - 0.6, p.z, 0.7, 0.7, 0.7, COL.coconut, plain);
  }
  // Neon signs.
  for (const n of city.neon) {
    pushBox(batch, n.x, n.y, n.z, 2.4, 1.2, 0.3, n.col, plain);
  }
  // Clouds + waves.
  for (const c of city.clouds) pushBox(batch, c.x, c.y, c.z, 18, 3, 10, [0.95, 0.95, 0.98], plain);
  for (const w of city.waves) {
    pushQuad(batch, [w.x - 3, w.y, w.z - 1], [w.x + 3, w.y, w.z - 1], [w.x + 3, w.y, w.z + 1], [w.x - 3, w.y, w.z + 1], [0.9, 0.95, 1], plain);
  }
  // Harbour: containers, crane, dock barrels.
  for (const c of city.containers) pushBox(batch, c.x, 0, c.z, 12, 3, 4, c.col, plain);
  for (const p of city.props) {
    if (p.kind === 'crane') pushBox(batch, p.x, 0, p.z, 3, 30, 3, p.col, plain);
    else if (p.kind === 'craneArm') pushBox(batch, p.x + 12, 26, p.z, 24, 2, 2, p.col, plain);
  }
  for (const [bx, bz] of [[-200, 180], [-195, 186], [-200, 192]]) {
    pushBox(batch, bx, 0, bz, 1.4, 2.2, 1.4, COL.barrelRed, plain);
  }
  // Street furniture.
  for (const l of city.lamps) {
    pushBox(batch, l.x, 0, l.z, 0.4, 6, 0.4, [0.2, 0.2, 0.22], plain);
    pushBox(batch, l.x, 6, l.z, 1.2, 0.5, 1.2, [1, 0.95, 0.7], plain);
  }
  for (const b of city.benches) pushBox(batch, b.x, 0, b.z, 2.4, 0.9, 0.8, [0.5, 0.35, 0.2], plain);
  for (const h of city.hydrants) pushBox(batch, h.x, 0, h.z, 0.8, 1.2, 0.8, [0.85, 0.2, 0.15], plain);
  for (const s of city.busStops) {
    pushBox(batch, s.x, 0, s.z, 0.4, 3, 0.4, [0.25, 0.25, 0.28], plain);
    pushBox(batch, s.x, 3, s.z, 3, 0.3, 2, [0.3, 0.5, 0.8], plain);
  }
  // Beach umbrellas + chairs + rust-red barrels.
  for (const p of city.props) {
    if (p.kind === 'umbrella') {
      pushBox(batch, p.x, p.y, p.z, 0.3, 2.4, 0.3, [0.6, 0.6, 0.62], plain);
      pushBox(batch, p.x, p.y + 2.4, p.z, 3.4, 0.25, 3.4, p.col, plain);
    } else if (p.kind === 'chair') {
      pushBox(batch, p.x, p.y, p.z, 1, 0.8, 1.8, p.col, plain);
    } else if (p.kind === 'barrel') {
      pushBox(batch, p.x, p.y, p.z, 1.2, 2, 1.2, p.col, plain);
    }
  }
  return batchTris(batch);
}
