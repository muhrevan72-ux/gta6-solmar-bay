// Solmar Bay — the city.
//
// An 800x800 m island: downtown blocks on a 60 m road grid, a beach and
// sea to the west, a harbour to the south-west, an airport to the
// north-east. buildCity is deterministic (seed 1337), so the same seed
// always builds the same city and the same static batch. Ground and
// roads are tiled in ~100 m segments — never one huge slab — because
// the rasterizer drops triangles with a vertex behind the camera.

import { mulberry32 } from './state.js';
import { pushBox, batchReset, batchTris } from './render.js';
import { tileUV } from './texture.js';
import { SPAWNS } from './config.js';

export { mulberry32 };

export const ROAD_LINES = [-360, -300, -240, -180, -120, -60, 0, 60, 120, 180, 240, 300, 360];
const ROAD_HALF = 6;

export const COLOURS = {
  grass: [0.42, 0.62, 0.38],
  road: [0.16, 0.16, 0.18],
  sidewalk: [0.65, 0.65, 0.6],
  sand: [0.85, 0.76, 0.55],
  sea: [0.2, 0.65, 0.9],
  laneDash: [0.95, 0.8, 0.2],
  coconut: [0.5, 0.35, 0.2],
  palmLeaf: [0.25, 0.65, 0.3],
  glass: [0.4, 0.65, 0.9],
  barrelRed: [0.85, 0.2, 0.15],
  barrelRust: [0.75, 0.3, 0.15],
};

const BUILDING_PALETTE = [
  [0.9, 0.55, 0.45],
  [0.95, 0.75, 0.4],
  [0.55, 0.8, 0.6],
  [0.45, 0.65, 0.9],
  [0.9, 0.6, 0.75],
  [0.65, 0.55, 0.85],
  [0.95, 0.85, 0.6],
  [0.5, 0.75, 0.85],
  [0.85, 0.5, 0.4],
  [0.6, 0.85, 0.55],
];

const NEON_COLOURS = [
  [1, 0.3, 0.6],
  [0.3, 0.9, 1],
  [1, 0.8, 0.2],
  [0.5, 1, 0.4],
  [0.9, 0.4, 1],
  [1, 0.5, 0.2],
];

function nearLine(v, lines, half) {
  for (const L of lines) {
    if (Math.abs(v - L) <= half) return true;
  }
  return false;
}

export function isOnRoad(x, z) {
  return nearLine(x, ROAD_LINES, ROAD_HALF) || nearLine(z, ROAD_LINES, ROAD_HALF);
}

export function districtAt(x, z) {
  if (x >= 240 && z <= -180) return 'Airport';
  if (x < -300) return 'Beach';
  if (x < -180 && z > 150) return 'Harbour';
  return 'Downtown';
}

// Traffic-light cycle: 46 s — green 21 s, yellow 9 s, red 16 s.
export function lightState(light, t) {
  const tt = (t + (light.phase || 0)) % 46;
  if (tt < 21) return 'green';
  if (tt < 30) return 'yellow';
  return 'red';
}

export function lightAt(city, x, z) {
  for (const l of city.lights) {
    if (l.x === x && l.z === z) return l;
  }
  return null;
}

export function isBlocked(city, x, z) {
  for (const b of city.blockers) {
    if (Math.abs(x - b.x) < b.hw && Math.abs(z - b.z) < b.hd) return true;
  }
  return false;
}

export function randomSidewalkPoint(rng) {
  const vertical = rng() < 0.5;
  const line = ROAD_LINES[Math.floor(rng() * ROAD_LINES.length)];
  // 'along' stays inside a block, 9..51 m from any road line, so the
  // point can never sit on a road (the old uniform -360..360 range
  // could land within the road half-width of a cross street).
  const block = Math.floor(rng() * 12) - 6;
  const along = block * 60 + 9 + rng() * 42;
  const side = (rng() < 0.5 ? -1 : 1) * (ROAD_HALF + 3);
  if (vertical) return { x: line + side, z: along };
  return { x: along, z: line + side };
}

// Blocks that never get a regular building (landmarks, open lots).
const SKIP_BLOCKS = new Set([
  '-5,-5', '-5,-4', '-5,-3', '-5,-2', '-5,-1', '-5,0', '-5,1', '-5,2', '-5,3', '-5,4', '-5,5',
  '-4,3', '-4,4', '-4,5',
  '5,-5', '5,-4',
  '-3,2',
  // The block the hospital respawn (-150, 100) sits in: it stays an
  // open lot so the respawn is never inside a building.
  '-3,1',
  '2,-3',
  '-2,1',
  '4,4',
  '3,3', '4,3',
  '1,0',
  '-1,1',
  '1,-1',
  '0,2',
  '-2,-3',
  '-1,-2',
]);

// The nine towers (the Solmar Tower plus eight more).
const TOWER_BLOCKS = new Set([
  '0,-2', '-2,-1', '0,0', '-1,-1', '1,1', '-3,-2', '2,0', '3,-1', '-4,0',
]);

export function buildCity() {
  const rng = mulberry32(1337);
  const city = {
    seed: 1337,
    buildings: [],
    towers: [],
    landmarks: {},
    palms: [],
    waves: [],
    umbrellas: [],
    chairs: [],
    neon: [],
    clouds: [],
    containers: [],
    lamps: [],
    benches: [],
    hydrants: [],
    busStops: [],
    lights: [],
    props: [],
    dockBarrels: [],
    runway: { x: 300, z: -260 },
    hangars: [],
    blockers: [],
  };

  const addBlocker = (x, z, w, d) => {
    city.blockers.push({ x, z, hw: w / 2, hd: d / 2 });
  };

  // ---------- landmarks ----------
  const hospital = { x: -150, z: 150, w: 44, d: 40, h: 18, kind: 'hospital', label: 'Hospital', colour: [0.92, 0.92, 0.9] };
  city.landmarks.hospital = hospital;
  city.buildings.push(hospital);
  addBlocker(hospital.x, hospital.z, hospital.w, hospital.d);

  const solmarTower = { x: 30, z: -90, w: 28, d: 28, h: 65, kind: 'tower', label: 'Solmar Tower', roof: 'parapet', colour: [0.55, 0.7, 0.9] };
  city.landmarks.elevatorTower = solmarTower;

  const garage = { x: 150, z: -140, w: 30, d: 16, h: 7, kind: 'garage', label: 'Garage', colour: [0.7, 0.7, 0.68] };
  city.landmarks.garage = garage;
  city.buildings.push(garage);
  addBlocker(garage.x, garage.z, garage.w, garage.d);

  const fireStation = { x: -90, z: 90, w: 30, d: 20, h: 9, kind: 'fire', label: 'Fire Station', colour: [0.9, 0.3, 0.25] };
  city.landmarks.fireStation = fireStation;
  city.buildings.push(fireStation);
  addBlocker(fireStation.x, fireStation.z, fireStation.w, fireStation.d);

  const beachHouse = { x: -320, z: 60, w: 10, d: 8, h: 5, kind: 'house', label: 'Beach House', colour: [0.95, 0.8, 0.55] };
  city.landmarks.beachHouse = beachHouse;
  city.buildings.push(beachHouse);
  addBlocker(beachHouse.x, beachHouse.z, beachHouse.w, beachHouse.d);

  const controlTower = { x: 270, z: -300, w: 12, d: 12, h: 55, kind: 'control', label: 'Control Tower', colour: [0.85, 0.85, 0.8] };
  city.landmarks.controlTower = controlTower;
  city.buildings.push(controlTower);
  addBlocker(controlTower.x, controlTower.z, controlTower.w, controlTower.d);

  city.hangars = [
    { x: 340, z: -300, w: 40, d: 24, h: 12, kind: 'hangar', label: 'Hangar 1', colour: [0.75, 0.75, 0.7] },
    { x: 340, z: -210, w: 40, d: 24, h: 12, kind: 'hangar', label: 'Hangar 2', colour: [0.7, 0.75, 0.7] },
  ];
  for (const hg of city.hangars) {
    city.buildings.push(hg);
    addBlocker(hg.x, hg.z, hg.w, hg.d);
  }

  // Food shops and the outfit shop occupy their own blocks.
  const shops = [
    { name: 'Pizza Palace', x: -40, z: 70, w: 24, d: 18, h: 8, colour: [0.95, 0.5, 0.35] },
    { name: 'Burger Barn', x: 90, z: -30, w: 24, d: 18, h: 8, colour: [0.9, 0.7, 0.3] },
    { name: 'Taco Truck', x: 30, z: 150, w: 18, d: 14, h: 6, colour: [0.95, 0.8, 0.3] },
    { name: 'Noodle House', x: -90, z: -150, w: 24, d: 18, h: 8, colour: [0.85, 0.3, 0.3] },
    { name: 'Chicken Shack', x: -40, z: -70, w: 20, d: 16, h: 7, colour: [0.95, 0.85, 0.4] },
    { name: 'Vice Threads', x: 90, z: 30, w: 24, d: 18, h: 8, colour: [0.6, 0.4, 0.85] },
  ];
  city.shops = shops;
  for (const s of shops) {
    const b = { x: s.x, z: s.z, w: s.w, d: s.d, h: s.h, kind: 'shop', label: s.name, roof: 'parapet', colour: s.colour };
    city.buildings.push(b);
    addBlocker(b.x, b.z, b.w, b.d);
  }

  // ---------- regular blocks ----------
  const roofs = ['parapet', 'pyramid', 'ac'];
  for (let bx = -5; bx <= 5; bx++) {
    for (let bz = -5; bz <= 5; bz++) {
      const key = `${bx},${bz}`;
      if (SKIP_BLOCKS.has(key)) continue;
      // The Solmar Tower landmark covers its own block, and the block
      // west of the player spawn stays open as the plaza where the
      // starter Comet parks — the car must never spawn inside a building.
      if (key === '0,-2' || key === '-1,0') continue;
      const cx = bx * 60 + 30;
      const cz = bz * 60 + 30;
      const isTower = TOWER_BLOCKS.has(key);
      const w = isTower ? 24 + rng() * 6 : 20 + rng() * 16;
      const d = isTower ? 24 + rng() * 6 : 20 + rng() * 16;
      const h = isTower ? 55 + rng() * 30 : 8 + rng() * 20;
      const colour = isTower
        ? [0.5 + rng() * 0.2, 0.6 + rng() * 0.2, 0.85]
        : BUILDING_PALETTE[Math.floor(rng() * BUILDING_PALETTE.length)];
      const b = {
        x: cx,
        z: cz,
        w,
        d,
        h,
        kind: isTower ? 'tower' : 'building',
        label: isTower ? 'Tower' : 'Building',
        roof: roofs[Math.floor(rng() * 3)],
        colour,
        balcony: rng() < 0.3,
        roofProp: rng() < 0.15,
      };
      city.buildings.push(b);
      if (isTower) city.towers.push(b);
      addBlocker(cx, cz, w, d);
      // Balconies and roof props are recorded as props so the city
      // data (and the static batch) can show them.
      if (b.balcony) city.props.push({ kind: 'balcony', x: b.x, z: b.z, w: b.w, d: b.d, h: b.h });
      if (b.roofProp) city.props.push({ kind: 'roof', x: b.x, z: b.z, w: b.w, d: b.d, h: b.h });
    }
  }

  // The Solmar Tower is one of the nine towers.
  city.towers.push(solmarTower);
  city.buildings.push(solmarTower);
  addBlocker(solmarTower.x, solmarTower.z, solmarTower.w, solmarTower.d);

  // ---------- palms: 50 ----------
  // 9 from seeded random scatter (only x < -300 counts), then three
  // deterministic rows: beach A 11, beach B 14, avenue 16.
  const palmSet = [];
  while (palmSet.length < 9) {
    const x = -400 + rng() * 800;
    const z = -400 + rng() * 800;
    if (x < -300) palmSet.push({ x, z, h: 6 + rng() * 3 });
  }
  for (let i = 0; i < 11; i++) palmSet.push({ x: -315, z: -300 + i * 60, h: 7 });
  for (let i = 0; i < 14; i++) palmSet.push({ x: -325, z: -325 + i * 50, h: 6 + (i % 3) });
  for (let i = 0; i < 8; i++) {
    palmSet.push({ x: -9, z: -210 + i * 60, h: 7 });
    palmSet.push({ x: 9, z: -210 + i * 60, h: 7 });
  }
  city.palms = palmSet;

  // ---------- beach life ----------
  const umbrellaColours = [
    [0.95, 0.3, 0.3], [0.3, 0.7, 0.95], [0.95, 0.8, 0.2], [0.4, 0.9, 0.5],
    [0.9, 0.4, 0.9], [0.95, 0.55, 0.2], [0.3, 0.95, 0.85], [0.95, 0.95, 0.4],
    [0.6, 0.4, 0.95], [0.95, 0.35, 0.6], [0.35, 0.85, 0.4], [0.4, 0.6, 0.95],
  ];
  for (let i = 0; i < 12; i++) {
    const z = -275 + i * 50;
    city.umbrellas.push({ x: -315, z, colour: umbrellaColours[i], col: umbrellaColours[i] });
    city.props.push({ kind: 'umbrella', x: -315, z, colour: umbrellaColours[i], col: umbrellaColours[i] });
    city.chairs.push({ x: -311, z: z + 3, colour: umbrellaColours[i], col: umbrellaColours[i] });
    city.props.push({ kind: 'chair', x: -311, z: z + 3, colour: umbrellaColours[i], col: umbrellaColours[i] });
  }
  for (let i = 0; i < 24; i++) {
    city.waves.push({ x: -350, z: -360 + i * 30 });
  }

  // ---------- street furniture ----------
  for (let i = 0; i < 12; i++) {
    city.lamps.push({ x: -9, z: -330 + i * 60 });
    city.lamps.push({ x: 9, z: -330 + i * 60 });
  }
  for (let i = 0; i < 30; i++) {
    const line = ROAD_LINES[1 + (i % 11)];
    // Bench z stays inside a block, 9..51 m from any road line, so a
    // sitter on a bench is never on a road (the old i*23 stride landed
    // within the road half-width of a cross street).
    const block = -5 + (i % 10);
    const offset = 9 + (Math.floor(i / 10) * 17) % 43;
    city.benches.push({ x: line + 9, z: block * 60 + offset });
    city.hydrants.push({ x: line - 9, z: -280 + (i * 29) % 560 });
  }
  const stopSpots = [[0, 0], [60, 60], [-60, -60], [120, 0], [0, 120], [-120, 0], [0, -120], [180, 180]];
  for (const [x, z] of stopSpots) city.busStops.push({ x: x + 9, z: z + 9 });

  // ---------- harbour ----------
  for (let i = 0; i < 16; i++) {
    city.containers.push({
      x: -280 + (i % 4) * 22,
      z: 190 + Math.floor(i / 4) * 14,
      y: (i % 3 === 2) ? 2.6 : 0,
      colour: [[0.9, 0.3, 0.25], [0.3, 0.6, 0.9], [0.9, 0.75, 0.2], [0.35, 0.8, 0.4]][i % 4],
    });
  }
  city.props.push({ kind: 'crane', x: -260, z: 220 });
  city.props.push({ kind: 'craneArm', x: -260, z: 220 });
  for (let i = 0; i < 4; i++) {
    city.props.push({ kind: 'barrel', x: -250 + i * 3, z: 205, colour: COLOURS.barrelRust, col: COLOURS.barrelRust });
  }
  city.dockBarrels = [
    { x: -270, z: 180 },
    { x: -268, z: 182 },
    { x: -272, z: 182 },
  ];

  // ---------- sky ----------
  for (let i = 0; i < 10; i++) {
    city.clouds.push({
      x: -350 + rng() * 700,
      z: -350 + rng() * 700,
      y: 70 + rng() * 20,
      w: 18 + rng() * 14,
    });
  }

  // ---------- neon: 48 ----------
  // 4 per tower (9 towers), 6 along the beachfront, 6 by the Solmar Tower.
  for (const t of city.towers) {
    for (let k = 0; k < 4; k++) {
      city.neon.push({
        x: t.x + (k % 2 === 0 ? t.w / 2 + 0.4 : -t.w / 2 - 0.4),
        z: t.z + (k < 2 ? -t.d / 4 : t.d / 4),
        y: 6 + k * 8,
        colour: NEON_COLOURS[(city.neon.length) % NEON_COLOURS.length],
        col: NEON_COLOURS[(city.neon.length) % NEON_COLOURS.length],
      });
    }
  }
  for (let i = 0; i < 6; i++) {
    city.neon.push({ x: -300, z: -250 + i * 100, y: 5, colour: NEON_COLOURS[i % NEON_COLOURS.length], col: NEON_COLOURS[i % NEON_COLOURS.length] });
  }
  // Six signs on the Solmar Tower itself, inside the tower's footprint
  // (within 13 m in x and 9 m in z of the tower centre at (30, -90)).
  for (let i = 0; i < 6; i++) {
    city.neon.push({
      x: 30 + (i % 2 === 0 ? 8 : -8),
      z: -90 + (Math.floor(i / 2) - 1) * 5,
      y: 4 + i * 3,
      colour: NEON_COLOURS[i % NEON_COLOURS.length],
      col: NEON_COLOURS[i % NEON_COLOURS.length],
    });
  }

  // ---------- traffic lights ----------
  const lightSpots = [
    [-180, -180, 0], [-120, -120, 23], [-60, -60, 0], [0, 0, 23],
    [60, 60, 0], [120, 120, 23], [180, 180, 0], [-180, 120, 23],
    [120, -180, 0], [0, 180, 23], [180, 0, 0], [-120, 60, 23],
  ];
  for (const [x, z, phase] of lightSpots) {
    city.lights.push({ x, z, phase });
  }

  return city;
}

// ---------- static batch ----------
// Everything that never moves, baked once into the static batch. The
// batch is deterministic: same city, same boxes, same order, so a
// resize re-bakes byte-identical data. Ground and roads are tiled in
// ~100 m segments; nothing spans more than 400 m.
export function buildStaticBoxes(city, b) {
  batchReset(b);
  const plain = tileUV('plain');

  // Ground: grass tiles over the land, sand on the beach, sea to the west.
  for (let cx = -250; cx <= 350; cx += 100) {
    for (let cz = -350; cz <= 350; cz += 100) {
      pushBox(b, cx, -0.5, cz, 100, 0.5, 100, COLOURS.grass, tileUV('grass'));
    }
  }
  for (let cz = -350; cz <= 350; cz += 100) {
    pushBox(b, -320, 0, cz, 40, 0.45, 100, COLOURS.sand, tileUV('sand'));
    pushBox(b, -370, 0, cz, 60, 0.5, 100, COLOURS.sea, tileUV('water'));
  }

  // Roads: vertical lines (except the one in the sea) and horizontal
  // lines (except the sea segment), each in 100 m pieces.
  for (const L of ROAD_LINES) {
    if (L === -360) continue;
    for (let cz = -350; cz <= 350; cz += 100) {
      pushBox(b, L, 0, cz, 12, 0.38, 100, COLOURS.road, tileUV('asphalt'));
    }
  }
  for (const L of ROAD_LINES) {
    for (let cx = -250; cx <= 350; cx += 100) {
      pushBox(b, cx, 0, L, 100, 0.38, 12, COLOURS.road, tileUV('asphalt'));
    }
  }

  // Yellow lane dashes on the two main avenues.
  for (let z = -380; z <= 380; z += 20) {
    pushBox(b, 0, 0.38, z, 1.5, 0.02, 6, COLOURS.laneDash, plain);
    pushBox(b, z, 0.38, 0, 6, 0.02, 1.5, COLOURS.laneDash, plain);
  }

  // Sidewalks along the central avenues, in 400 m strips.
  for (const L of [-60, 0, 60, 120]) {
    for (const side of [-9, 9]) {
      for (const cz of [-200, 200]) {
        pushBox(b, L + side, 0, cz, 5, 0.45, 400, COLOURS.sidewalk, tileUV('sidewalk'));
        pushBox(b, cz, 0, L + side, 400, 0.45, 5, COLOURS.sidewalk, tileUV('sidewalk'));
      }
    }
  }

  // Runway: two dark strips at the airport.
  pushBox(b, 240, 0, -260, 120, 0.38, 40, COLOURS.road, tileUV('asphalt'));
  pushBox(b, 360, 0, -260, 120, 0.38, 40, COLOURS.road, tileUV('asphalt'));

  // Buildings, roofs, balconies, roof props.
  for (const bd of city.buildings) {
    const uv = bd.kind === 'tower' || bd.kind === 'control' ? tileUV('window') : tileUV('brick');
    pushBox(b, bd.x, 0, bd.z, bd.w, bd.h, bd.d, bd.colour, uv);
    if (bd.roof === 'parapet') {
      pushBox(b, bd.x, bd.h, bd.z, bd.w + 1, 0.8, bd.d + 1, [0.4, 0.4, 0.42], plain);
    } else if (bd.roof === 'pyramid') {
      pushBox(b, bd.x, bd.h, bd.z, bd.w * 0.6, 3, bd.d * 0.6, [0.55, 0.3, 0.25], plain);
    } else if (bd.roof === 'ac') {
      pushBox(b, bd.x, bd.h, bd.z, 4, 1.5, 4, [0.7, 0.7, 0.72], plain);
    }
    if (bd.roofProp) {
      pushBox(b, bd.x + bd.w / 4, bd.h, bd.z - bd.d / 4, 3, 1.2, 3, [0.7, 0.7, 0.72], plain);
    }
    if (bd.balcony) {
      pushBox(b, bd.x - bd.w / 4, bd.h * 0.45, bd.z + bd.d / 2 + 0.3, 3, 0.4, 1, bd.colour, plain);
      pushBox(b, bd.x + bd.w / 4, bd.h * 0.7, bd.z + bd.d / 2 + 0.3, 3, 0.4, 1, bd.colour, plain);
    }
    if (bd.kind === 'hospital') {
      // Red cross on the roof.
      pushBox(b, bd.x, bd.h, bd.z, 8, 1, 2, [0.9, 0.15, 0.15], plain);
      pushBox(b, bd.x, bd.h, bd.z, 2, 1, 8, [0.9, 0.15, 0.15], plain);
    }
    if (bd.kind === 'tower') {
      // Glass band near the top so towers read as glass towers.
      pushBox(b, bd.x, bd.h * 0.8, bd.z, bd.w + 0.4, 2, bd.d + 0.4, COLOURS.glass, tileUV('window'));
    }
  }

  // Palms: trunk, leaf crown, coconut.
  for (const p of city.palms) {
    pushBox(b, p.x, 0, p.z, 0.7, p.h, 0.7, [0.45, 0.3, 0.18], plain);
    pushBox(b, p.x, p.h, p.z, 4, 1, 4, COLOURS.palmLeaf, tileUV('grass'));
    pushBox(b, p.x + 1, p.h - 0.5, p.z, 0.6, 0.6, 0.6, COLOURS.coconut, plain);
  }

  // Street furniture.
  for (const l of city.lamps) {
    pushBox(b, l.x, 0, l.z, 0.3, 5, 0.3, [0.2, 0.2, 0.22], plain);
    pushBox(b, l.x, 5, l.z, 1, 0.4, 0.4, [1, 0.9, 0.6], plain);
  }
  for (const bn of city.benches) {
    pushBox(b, bn.x, 0.45, bn.z, 2, 0.8, 0.8, [0.55, 0.4, 0.25], plain);
  }
  for (const hy of city.hydrants) {
    pushBox(b, hy.x, 0.45, hy.z, 0.8, 1, 0.8, [0.85, 0.2, 0.15], plain);
  }
  for (const bs of city.busStops) {
    pushBox(b, bs.x, 0.45, bs.z, 3, 2.5, 1.5, [0.35, 0.5, 0.65], tileUV('window'));
    pushBox(b, bs.x, 0.45, bs.z + 1, 2, 0.7, 0.6, [0.55, 0.4, 0.25], plain);
  }

  // Harbour containers, crane and barrels.
  for (const c of city.containers) {
    pushBox(b, c.x, c.y, c.z, 10, 2.6, 3, c.colour, plain);
  }
  for (const p of city.props) {
    if (p.kind === 'crane') {
      pushBox(b, p.x, 0, p.z, 2, 30, 2, [0.95, 0.75, 0.2], plain);
    } else if (p.kind === 'craneArm') {
      pushBox(b, p.x, 28, p.z, 22, 1.5, 1.5, [0.95, 0.75, 0.2], plain);
    } else if (p.kind === 'barrel') {
      pushBox(b, p.x, 0, p.z, 0.9, 1.1, 0.9, p.colour, plain);
    } else if (p.kind === 'balcony') {
      pushBox(b, p.x, (p.h || 10) * 0.6, p.z + (p.d || 20) / 2 + 0.5, (p.w || 20) * 0.7, 0.15, 1, [0.7, 0.7, 0.75], plain);
    } else if (p.kind === 'roof') {
      pushBox(b, p.x, p.h || 10, p.z, 2, 1.2, 2, [0.6, 0.6, 0.65], plain);
    }
  }
  for (const db of city.dockBarrels) {
    pushBox(b, db.x, 0, db.z, 0.9, 1.1, 0.9, COLOURS.barrelRed, plain);
  }

  // Beach: umbrellas, chairs, waves, clouds, neon.
  for (const u of city.umbrellas) {
    pushBox(b, u.x, 0.45, u.z, 0.2, 2.5, 0.2, [0.8, 0.8, 0.8], plain);
    pushBox(b, u.x, 2.8, u.z, 4, 0.3, 4, u.colour, plain);
  }
  for (const ch of city.chairs) {
    pushBox(b, ch.x, 0.45, ch.z, 1.2, 0.8, 1.2, ch.colour, plain);
  }
  for (const wv of city.waves) {
    pushBox(b, wv.x, 0.5, wv.z, 6, 0.3, 3, [0.9, 0.95, 1], plain);
  }
  for (const cl of city.clouds) {
    pushBox(b, cl.x, cl.y, cl.z, cl.w, 2, 12, [0.95, 0.95, 0.98], plain);
  }
  for (const n of city.neon) {
    pushBox(b, n.x, n.y, n.z, 0.4, 6, 0.4, n.colour, plain);
  }

  return b;
}

// Line of sight: true when the straight segment between two points
// never crosses a building. Sampled every 2 m.
export function hasLineOfSight(city, x1, z1, x2, z2) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const d = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(d / 2));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (isBlocked(city, x1 + dx * t, z1 + dz * t)) return false;
  }
  return true;
}
