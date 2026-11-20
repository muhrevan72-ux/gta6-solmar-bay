// Solmar Bay — the city of Solmar Bay (rebuild #15).
// An 800x800 m grid city: roads on multiples of 60, buildings on
// the blocks between them, a beach and sea on the west edge, an
// airport in the north-east, a harbour in the south-west.
// Deterministic: buildCity() always uses seed 1337, so two builds
// are byte-identical (the round-9 determinism test).

import { BoxBatch, pushBox, pushBoxRot, pushQuad } from './render.js';
import { tileUV } from './texture.js';
import { COL, SPAWNS } from './config.js';
import { mulberry32 } from './state.js';

export const ROAD_LINES = [-360, -300, -240, -180, -120, -60, 0, 60, 120, 180, 240, 300, 360];
export const ROAD_HALF = 6;

// Distance from v to the nearest multiple of 60.
function distToRoadLine(v) {
  const m = ((v % 60) + 60) % 60;
  return Math.min(m, 60 - m);
}

export function isOnRoad(x, z) {
  return distToRoadLine(x) <= ROAD_HALF || distToRoadLine(z) <= ROAD_HALF;
}

export function districtAt(x, z) {
  if (x < -300) return 'Beach';
  if (x > 240 && z < -180) return 'Airport';
  if (x < -180 && z > 150) return 'Harbour';
  return 'Downtown';
}

// Traffic-light cycle: 46 s — green <21, yellow 21-29, red 30-45.
// The phase is an offset in seconds (light at (-180,-180) has
// phase -3, so it is red at t=168).
export function lightState(light, t) {
  const phase = light.phase || 0;
  const tt = (((t - phase) % 46) + 46) % 46;
  if (tt < 21) return 'green';
  if (tt < 30) return 'yellow';
  return 'red';
}

// A random point on a sidewalk (never on a road): pick a block
// centre and offset inside the block, clear of the road edges.
export function randomSidewalkPoint(rng) {
  const bx = (Math.floor(rng() * 12) - 6) * 60 + 30;
  const bz = (Math.floor(rng() * 12) - 6) * 60 + 30;
  return {
    x: bx + (rng() * 2 - 1) * 20,
    z: bz + (rng() * 2 - 1) * 20,
  };
}

export function isBlocked(city, x, z) {
  for (const b of city.buildings) {
    if (Math.abs(x - b.x) < b.w / 2 && Math.abs(z - b.z) < b.d / 2) return true;
  }
  return false;
}

const PALETTE = [
  [0.92, 0.55, 0.45], [0.45, 0.75, 0.8], [0.95, 0.8, 0.35],
  [0.75, 0.55, 0.85], [0.55, 0.85, 0.6], [0.95, 0.65, 0.55],
  [0.4, 0.6, 0.9], [0.9, 0.7, 0.8], [0.6, 0.8, 0.5],
  [0.85, 0.6, 0.4], [0.5, 0.7, 0.7], [0.95, 0.85, 0.5],
];
const ROOF_TYPES = ['parapet', 'pyramid', 'ac'];
const NEON_COLS = [
  [1, 0.2, 0.4], [0.2, 0.9, 1], [1, 0.85, 0.1], [0.6, 1, 0.3],
  [1, 0.5, 0.9], [0.3, 0.6, 1],
];

export function buildCity() {
  const rng = mulberry32(1337);
  const buildings = [];
  const towers = [];

  // --- special buildings (fixed, so tests can rely on them) ---
  // The hospital is 44 wide (half-width 22): the collision test
  // puts the player at -150+23, just outside its east wall.
  const hospital = { x: -150, z: 150, w: 44, h: 18, d: 40, col: [0.92, 0.92, 0.86], roof: 'parapet', kind: 'hospital', label: 'Hospital' };
  buildings.push(hospital);
  const solmar = { x: 30, z: -90, w: 24, h: 70, d: 24, col: [0.25, 0.35, 0.6], roof: 'parapet', kind: 'tower', label: 'Solmar Tower' };
  buildings.push(solmar);
  buildings.push({ x: -310, z: 60, w: 20, h: 10, d: 16, col: [0.95, 0.8, 0.6], roof: 'pyramid', kind: 'house', label: 'Beach House' });
  buildings.push({ x: 150, z: -160, w: 40, h: 8, d: 20, col: [0.5, 0.5, 0.55], roof: 'parapet', kind: 'garage', label: 'Garage' });
  buildings.push({ x: 280, z: -240, w: 36, h: 14, d: 24, col: [0.7, 0.7, 0.75], roof: 'parapet', kind: 'hangar', label: 'Hangar 1' });
  buildings.push({ x: 330, z: -280, w: 36, h: 14, d: 24, col: [0.7, 0.7, 0.75], roof: 'parapet', kind: 'hangar', label: 'Hangar 2' });
  buildings.push({ x: 300, z: -300, w: 14, h: 45, d: 14, col: [0.8, 0.8, 0.85], roof: 'ac', kind: 'control', label: 'Control Tower' });
  buildings.push({ x: -60, z: 165, w: 30, h: 12, d: 16, col: [0.85, 0.2, 0.15], roof: 'parapet', kind: 'fire', label: 'Fire Station' });

  // --- regular buildings on the block grid ---
  const towerBlocks = new Set(['-90,-90', '90,-90', '-90,30', '90,30', '-30,-30', '30,90', '90,90', '150,-30', '-30,90']);
  const skipBlocks = new Set([
    '-150,150', '30,-90', '150,-150', '30,30', '-30,30',
    '-90,150', '-30,150',
  ]);
  for (let bx = -330; bx <= 330; bx += 60) {
    for (let bz = -330; bz <= 330; bz += 60) {
      if (bx === -330) continue; // beach strip
      if (bx >= 270 && bz <= -210) continue; // airport
      if (bx <= -210 && bz >= 210) continue; // harbour
      if (skipBlocks.has(bx + ',' + bz)) continue;
      const isTower = towerBlocks.has(bx + ',' + bz);
      // Towers are never skipped (the suite needs exactly 9);
      // ordinary blocks are sometimes parks / parking lots.
      if (!isTower && rng() < 0.1) continue;
      const w = 18 + rng() * 16;
      const d = 18 + rng() * 16;
      const h = isTower ? 40 + rng() * 35 : 8 + rng() * 16;
      const col = PALETTE[Math.floor(rng() * PALETTE.length)];
      const roof = ROOF_TYPES[Math.floor(rng() * ROOF_TYPES.length)];
      const b = { x: bx, z: bz, w, h, d, col, roof, kind: isTower ? 'tower' : 'building' };
      buildings.push(b);
      if (isTower) towers.push(b);
    }
  }

  // --- neon signs: 36 on the 9 towers (4 each) + 6 beachfront +
  // 6 on the Solmar Tower = 48 ---
  const neon = [];
  for (const t of towers) {
    for (let i = 0; i < 4; i++) {
      neon.push({
        x: t.x + (i % 2 === 0 ? -t.w / 2 - 0.5 : t.w / 2 + 0.5),
        z: t.z + (i < 2 ? -t.d / 2 - 0.5 : t.d / 2 + 0.5),
        y: 12 + i * 6,
        col: NEON_COLS[Math.floor(rng() * NEON_COLS.length)],
      });
    }
  }
  for (let i = 0; i < 6; i++) {
    neon.push({ x: -300, z: -250 + i * 100, y: 8, col: NEON_COLS[i % NEON_COLS.length] });
  }
  for (let i = 0; i < 6; i++) {
    neon.push({
      x: 30 + (i % 3 - 1) * 8,
      z: -90 + (i < 3 ? -5 : 5),
      y: 20 + i * 7,
      col: NEON_COLS[(i + 2) % NEON_COLS.length],
    });
  }

  // --- clouds (10) and wave crests (24) ---
  const clouds = [];
  for (let i = 0; i < 10; i++) {
    clouds.push({ x: -350 + rng() * 700, y: 60 + rng() * 25, z: -350 + rng() * 700 });
  }
  const waves = [];
  for (let i = 0; i < 24; i++) {
    waves.push({ x: -355 + rng() * 12, z: -360 + i * 30 + rng() * 8 });
  }

  // --- palms: exactly 50 ---
  // 9 seeded beach palms + row A (11) + row B (14) + avenue (16).
  const palms = [];
  for (let i = 0; i < 9; i++) {
    palms.push({ x: -375 + rng() * 60, z: -340 + rng() * 680 });
  }
  for (let i = 0; i < 11; i++) palms.push({ x: -320, z: -300 + i * 55 });
  for (let i = 0; i < 14; i++) palms.push({ x: -345, z: -320 + i * 48 });
  for (let i = 0; i < 16; i++) palms.push({ x: -18 + (i % 2) * 36, z: -330 + i * 42 });

  // --- street props ---
  const props = [];
  // Balconies on the towers (4 per tower = 36).
  for (const t of towers) {
    for (let i = 0; i < 4; i++) {
      props.push({ kind: 'balcony', x: t.x + (i % 2 === 0 ? -t.w / 2 : t.w / 2), z: t.z + (i < 2 ? -t.d / 2 : t.d / 2), y: 10 + i * 9, col: [0.9, 0.9, 0.9] });
    }
  }
  // Roof props (AC units / parapets) on a dozen buildings.
  for (let i = 0; i < 12; i++) {
    const b = buildings[8 + i * 7];
    if (b) props.push({ kind: 'roof', x: b.x, z: b.z, y: b.h, col: [0.6, 0.6, 0.62] });
  }
  // Beach umbrellas + matching chairs (12 each, same colour order).
  const umbrellaCols = [];
  for (let i = 0; i < 12; i++) {
    const col = PALETTE[i % PALETTE.length];
    umbrellaCols.push(col);
    props.push({ kind: 'umbrella', x: -318, z: -280 + i * 50, col });
  }
  for (let i = 0; i < 12; i++) {
    props.push({ kind: 'chair', x: -312, z: -280 + i * 50, col: umbrellaCols[i] });
  }
  // Rust barrels (4) near the harbour.
  for (let i = 0; i < 4; i++) {
    props.push({ kind: 'barrel', x: -220 + i * 6, z: 190 + (i % 2) * 8, col: [0.75, 0.3, 0.15] });
  }
  // Harbour crane + arm.
  props.push({ kind: 'crane', x: -250, z: 240, col: [0.95, 0.75, 0.1] });
  props.push({ kind: 'craneArm', x: -250, z: 240, col: [0.95, 0.75, 0.1] });

  // --- harbour containers (16) ---
  const containers = [];
  const contCols = [[0.85, 0.2, 0.15], [0.2, 0.5, 0.85], [0.3, 0.7, 0.3], [0.95, 0.75, 0.1]];
  for (let i = 0; i < 16; i++) {
    containers.push({
      x: -270 + (i % 4) * 14,
      z: 210 + Math.floor(i / 4) * 14,
      col: contCols[i % contCols.length],
    });
  }

  // --- lamps (24), benches (30), hydrants (30), bus stops (8) ---
  const lamps = [];
  for (let i = 0; i < 24; i++) {
    lamps.push({ x: -330 + (i % 8) * 90 + 8, z: -300 + Math.floor(i / 8) * 180 + 8 });
  }
  const benches = [];
  for (let i = 0; i < 30; i++) {
    benches.push({ x: -330 + (i % 10) * 66 + 12, z: -300 + Math.floor(i / 10) * 150 + 12 });
  }
  const hydrants = [];
  for (let i = 0; i < 30; i++) {
    hydrants.push({ x: -300 + (i % 10) * 60 + 8, z: -270 + Math.floor(i / 10) * 140 + 8 });
  }
  const busStops = [];
  for (let i = 0; i < 8; i++) {
    busStops.push({ x: -300 + i * 80, z: 60 });
  }

  // --- traffic lights (phase = x/60, so (-180,-180) is -3) ---
  const lightAt = (x, z, axis) => ({ x, z, axis, phase: x / 60 });
  const lights = [
    lightAt(0, 0, 'x'), lightAt(60, 0, 'z'), lightAt(-60, 0, 'x'),
    lightAt(0, 60, 'z'), lightAt(0, -60, 'x'), lightAt(60, 60, 'z'),
    lightAt(-60, -60, 'x'), lightAt(-180, -180, 'x'), lightAt(120, 0, 'z'),
    lightAt(-120, 120, 'x'),
  ];

  return {
    buildings, towers,
    landmarks: { hospital, elevatorTower: solmar },
    neon, clouds, waves, palms, props, containers,
    lamps, benches, hydrants, busStops, lights,
    runway: { x: 300, z: -260 },
  };
}

// ---------- static geometry ----------
// Build the whole static city into a batch. Ground slab top y=0,
// road tops y=0.38, sidewalks/beach 0.45, sea 0.5 (the #9 fix:
// the grass slab must sit BELOW the roads, never bury them).
export function buildStaticBoxes(city, b) {
  const grassUV = tileUV('grass');
  const asphaltUV = tileUV('asphalt');
  const sidewalkUV = tileUV('sidewalk');
  const sandUV = tileUV('sand');
  const waterUV = tileUV('water');
  const brickUV = tileUV('brick');
  const windowUV = tileUV('window');

  // Ground: 8x8 tiles of 100 m (top y=0), NOT one 800 m slab.
  // A single 800 m slab is one huge triangle pair spanning
  // behind the camera, so a rasterizer (or any clipper that
  // drops whole triangles with a vertex behind the eye) drops
  // the entire ground — the play-test saw a flat sky-coloured
  // plane and floating buildings. Tiles are small enough that
  // only the tile under the camera is ever dropped.
  for (let tx = -350; tx <= 350; tx += 100) {
    for (let tz = -350; tz <= 350; tz += 100) {
      pushBox(b, tx, -1, tz, 100, 1, 100, COL.grass, grassUV);
    }
  }
  // Roads in 100 m segments: x-lines (top 0.38) and z-lines
  // (top 0.375, avoids coplanar z-fighting at the crossings).
  // Same reason as the ground: no 800 m triangle spanning the
  // camera, so the roads actually render instead of vanishing.
  for (const x of ROAD_LINES) {
    for (let s = 0; s < 8; s++) {
      pushBox(b, x, -0.02, -350 + s * 100, 12, 0.4, 100, COL.road, asphaltUV);
    }
  }
  for (const z of ROAD_LINES) {
    for (let s = 0; s < 8; s++) {
      pushBox(b, -350 + s * 100, -0.025, z, 100, 0.4, 12, COL.road, asphaltUV);
    }
  }
  // Sidewalks flanking every road (top 0.45), in 400 m halves
  // so a strip under the camera is the only part ever dropped.
  const walkCol = [0.62, 0.62, 0.58];
  for (const x of ROAD_LINES) {
    for (const zc of [-200, 200]) {
      pushBox(b, x - 9, 0.05, zc, 6, 0.4, 400, walkCol, sidewalkUV);
      pushBox(b, x + 9, 0.05, zc, 6, 0.4, 400, walkCol, sidewalkUV);
    }
  }
  for (const z of ROAD_LINES) {
    for (const xc of [-200, 200]) {
      pushBox(b, xc, 0.05, z - 9, 400, 0.4, 6, walkCol, sidewalkUV);
      pushBox(b, xc, 0.05, z + 9, 400, 0.4, 6, walkCol, sidewalkUV);
    }
  }
  // Beach sand (x -340..-300, top 0.45) and sea (x -400..-340, top
  // 0.5), in 100 m segments so they survive the same clipping.
  for (let s = 0; s < 8; s++) {
    pushBox(b, -320, -0.05, -350 + s * 100, 40, 0.5, 100, [0.85, 0.75, 0.5], sandUV);
    pushBox(b, -370, 0, -350 + s * 100, 60, 0.5, 100, COL.water, waterUV);
  }
  // Airport runway (dark strip, top 0.38), in two halves.
  for (const zc of [-315, -205]) {
    pushBox(b, 300, -0.02, zc, 30, 0.4, 110, [0.12, 0.12, 0.14], asphaltUV);
  }

  // Road dashes (lane markings, yellow quads on the road tops).
  for (const x of ROAD_LINES) {
    for (let z = -360; z <= 360; z += 24) {
      pushQuad(b, [x - 0.4, 0.39, z - 2], [x + 0.4, 0.39, z - 2], [x + 0.4, 0.39, z + 2], [x - 0.4, 0.39, z + 2], COL.roadLine, [0, 0, 1, 1]);
    }
  }
  for (const z of ROAD_LINES) {
    for (let x = -360; x <= 360; x += 24) {
      pushQuad(b, [x - 2, 0.385, z - 0.4], [x + 2, 0.385, z - 0.4], [x + 2, 0.385, z + 0.4], [x - 2, 0.385, z + 0.4], COL.roadLine, [0, 0, 1, 1]);
    }
  }

  // Buildings: body + windows (window-tile quads) + rooftop box.
  for (const bd of city.buildings) {
    pushBox(b, bd.x, 0, bd.z, bd.w, bd.h, bd.d, bd.col, brickUV);
    // Windows on the +Z and -Z faces, in a floor x column grid.
    const floors = Math.max(1, Math.floor(bd.h / 5));
    const cols = Math.max(1, Math.floor(bd.w / 7));
    for (let f = 0; f < floors; f++) {
      const wy = 2.5 + f * 5;
      if (wy + 2 > bd.h) break;
      for (let c = 0; c < cols; c++) {
        const wx = bd.x - bd.w / 2 + 3 + c * 7;
        if (wx + 3 > bd.x + bd.w / 2 - 1) break;
        // Front (+Z) and back (-Z) window quads.
        pushQuad(b,
          [wx, wy, bd.z + bd.d / 2 + 0.06], [wx + 3, wy, bd.z + bd.d / 2 + 0.06],
          [wx + 3, wy + 2.5, bd.z + bd.d / 2 + 0.06], [wx, wy + 2.5, bd.z + bd.d / 2 + 0.06],
          COL.glass, windowUV);
        pushQuad(b,
          [wx + 3, wy, bd.z - bd.d / 2 - 0.06], [wx, wy, bd.z - bd.d / 2 - 0.06],
          [wx, wy + 2.5, bd.z - bd.d / 2 - 0.06], [wx + 3, wy + 2.5, bd.z - bd.d / 2 - 0.06],
          COL.glass, windowUV);
      }
    }
    // Rooftop box (parapet rim / pyramid cap / AC unit).
    const cap = bd.roof === 'pyramid' ? 0.6 : bd.roof === 'ac' ? 0.9 : 0.35;
    pushBox(b, bd.x, bd.h, bd.z, bd.w * cap, 1.2, bd.d * cap, [0.55, 0.55, 0.58], [0, 0, 1, 1]);
  }

  // Balconies, roof props, umbrellas, chairs, barrels, crane.
  for (const p of city.props) {
    if (p.kind === 'balcony') {
      pushBox(b, p.x, p.y, p.z, 4, 0.4, 2, p.col, [0, 0, 1, 1]);
    } else if (p.kind === 'roof') {
      pushBox(b, p.x, p.y, p.z, 3, 1.5, 3, p.col, [0, 0, 1, 1]);
    } else if (p.kind === 'umbrella') {
      pushBox(b, p.x, 0, p.z, 0.3, 3, 0.3, [0.6, 0.45, 0.3], [0, 0, 1, 1]);
      pushBox(b, p.x, 3, p.z, 5, 0.3, 5, p.col, [0, 0, 1, 1]);
    } else if (p.kind === 'chair') {
      pushBox(b, p.x, 0, p.z, 1.6, 1, 1.6, p.col, [0, 0, 1, 1]);
    } else if (p.kind === 'barrel') {
      pushBox(b, p.x, 0, p.z, 1.6, 2.4, 1.6, p.col, [0, 0, 1, 1]);
    } else if (p.kind === 'crane') {
      pushBox(b, p.x, 0, p.z, 4, 40, 4, p.col, [0, 0, 1, 1]);
    } else if (p.kind === 'craneArm') {
      pushBox(b, p.x + 14, 36, p.z, 28, 2, 2, p.col, [0, 0, 1, 1]);
    }
  }

  // Harbour containers.
  for (const c of city.containers) {
    pushBox(b, c.x, 0, c.z, 12, 5, 5, c.col, [0, 0, 1, 1]);
  }

  // Palms: trunk + 4 fronds (quads) + coconuts.
  for (const p of city.palms) {
    pushBox(b, p.x, 0, p.z, 0.8, 7, 0.8, [0.55, 0.4, 0.25], [0, 0, 1, 1]);
    for (let f = 0; f < 4; f++) {
      const a = (f / 4) * Math.PI * 2;
      const dx = Math.cos(a) * 2.2, dz = Math.sin(a) * 2.2;
      pushQuad(b,
        [p.x, 7, p.z], [p.x + dx, 6.2, p.z + dz],
        [p.x + dx * 1.4, 5.6, p.z + dz * 1.4], [p.x + dx * 0.4, 6.6, p.z + dz * 0.4],
        COL.palmLeaf, [0, 0, 1, 1]);
    }
    pushBox(b, p.x + 0.6, 6.4, p.z, 0.7, 0.7, 0.7, COL.coconut, [0, 0, 1, 1]);
  }

  // Lamps (pole + head), benches, hydrants, bus stops.
  for (const l of city.lamps) {
    pushBox(b, l.x, 0, l.z, 0.4, 6, 0.4, [0.25, 0.25, 0.28], [0, 0, 1, 1]);
    pushBox(b, l.x, 6, l.z, 1.2, 0.5, 0.5, [1, 0.95, 0.7], [0, 0, 1, 1]);
  }
  for (const bn of city.benches) {
    pushBox(b, bn.x, 0, bn.z, 3, 1, 1.2, [0.6, 0.45, 0.3], [0, 0, 1, 1]);
  }
  for (const hy of city.hydrants) {
    pushBox(b, hy.x, 0, hy.z, 0.9, 1.4, 0.9, [0.85, 0.2, 0.15], [0, 0, 1, 1]);
  }
  for (const bs of city.busStops) {
    pushBox(b, bs.x, 0, bs.z, 5, 4, 2, [0.3, 0.5, 0.8], [0, 0, 1, 1]);
    pushBox(b, bs.x, 0, bs.z + 1.5, 4, 1, 1, [0.6, 0.45, 0.3], [0, 0, 1, 1]);
  }

  // Neon signs (bright quads on the tower faces).
  for (const n of city.neon) {
    pushQuad(b,
      [n.x - 1.5, n.y, n.z], [n.x + 1.5, n.y, n.z],
      [n.x + 1.5, n.y + 2, n.z], [n.x - 1.5, n.y + 2, n.z],
      n.col, [0, 0, 1, 1]);
  }

  // Clouds (white boxes in the sky) and wave crests (white quads).
  for (const c of city.clouds) {
    pushBox(b, c.x, c.y, c.z, 14, 3, 8, [1, 1, 1], [0, 0, 1, 1]);
  }
  for (const w of city.waves) {
    pushQuad(b,
      [w.x - 2, 0.55, w.z - 0.5], [w.x + 2, 0.55, w.z - 0.5],
      [w.x + 2, 0.55, w.z + 0.5], [w.x - 2, 0.55, w.z + 0.5],
      [0.95, 0.98, 1], [0, 0, 1, 1]);
  }

  // Three red dock barrels at the harbour (the GLB barrel colour).
  for (const [dx, dz] of [[-200, 180], [-196, 184], [-200, 188]]) {
    pushBox(b, dx, 0, dz, 1.6, 2.4, 1.6, COL.barrelRed, [0, 0, 1, 1]);
  }

  // Traffic-light poles + heads at the intersections.
  for (const l of city.lights) {
    pushBox(b, l.x + 7, 0, l.z + 7, 0.5, 7, 0.5, [0.2, 0.2, 0.22], [0, 0, 1, 1]);
    pushBox(b, l.x + 7, 6.5, l.z + 7, 1, 2.4, 0.6, [0.15, 0.15, 0.16], [0, 0, 1, 1]);
  }
  return b;
}
