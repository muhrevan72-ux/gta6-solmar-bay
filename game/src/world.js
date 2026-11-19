// Solmar Bay — the voxel city. Deterministic (seeded) generation:
// downtown grid, beach + water west, harbour east, suburbs south,
// airport north-east, highway loop. Roads, buildings, props, traffic
// lights, train loop, spawns and mission anchors.
//
// REQUIRED (round-4 play-test): spawns.hospital is on the STREET
// outside the hospital building, at least 30 units from every
// building collider — never inside a building.

import { COL, makeRng, clamp } from './config.js';

export const ROAD_STEP = 100;
export const ROAD_HALF = 6; // road half-width
export const CITY_HALF = 400;

// Special sites, at block centres (blocks sit between roads).
export const SITES = {
  police: { x: -150, z: -150, sx: 56, sz: 40, h: 14, c: [0.75, 0.78, 0.85], kind: 'police' },
  hospital: { x: -150, z: 150, sx: 56, sz: 40, h: 16, c: [0.92, 0.92, 0.94], kind: 'hospital' },
  fire: { x: 150, z: 150, sx: 44, sz: 30, h: 12, c: [0.9, 0.25, 0.15], kind: 'fire' },
  garage: { x: 150, z: -150, sx: 40, sz: 30, h: 10, c: [0.6, 0.6, 0.65], kind: 'garage' },
  safehouse: { x: -250, z: 250, sx: 40, sz: 26, h: 12, c: [0.5, 0.45, 0.4], kind: 'safehouse' },
  hideout: { x: 250, z: -250, sx: 34, sz: 26, h: 10, c: [0.7, 0.65, 0.55], kind: 'hideout' },
  // The tallest downtown tower — carries the glass elevator.
  tallest: { x: 50, z: 50, sx: 46, sz: 46, h: 72, c: [0.65, 0.6, 0.8], kind: 'tower' },
};

export function buildCity() {
  const rng = makeRng(1337);
  const city = {
    half: CITY_HALF,
    buildings: [],
    boxes: [], // static opaque boxes for the renderer
    waterBoxes: [],
    trees: [],
    lamps: [],
    lights: [], // traffic lights
    containers: [],
    props: [],
    spawns: {},
    anchors: {},
    trainTrack: null,
    roadNodes: [],
  };

  const nearSpawn = (x, z, r) => {
    for (const s of Object.values(city.spawns)) {
      const dx = x - s.x;
      const dz = z - s.z;
      if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
  };

  // Spawns first — the generator keeps buildings away from them.
  // Hospital spawn: on the road/sidewalk east of the hospital,
  // 34 units from its east face (x=-122) — clear of every collider.
  city.spawns = {
    player: { x: -50, z: 0 },
    hospital: { x: -88, z: 150 },
    police: { x: -150, z: -106 },
    fire: { x: 150, z: 112 },
    garage: { x: 150, z: -106 },
    safehouse: { x: -250, z: 210 },
    airport: { x: 200, z: -320 },
    beach: { x: -310, z: 100 },
    harbour: { x: 330, z: -100 },
    station: { x: -320, z: 0 },
  };
  city.anchors = {
    garage: { x: 150, z: -150, label: 'Garage' },
    harbour: { x: 330, z: -100, label: 'Harbour docks' },
    hideout: { x: 250, z: -250, label: 'Hideout' },
    safehouse: { x: -250, z: 250, label: 'Safehouse' },
    beachHouse: { x: -310, z: 120, label: 'Maya\u2019s beach house' },
    range: { x: 260, z: 260, label: 'Shooting range' },
    course: { x: 0, z: -350, label: 'Driving course' },
    outfit: { x: -50, z: 150, label: 'Outfit shop' },
    taxiStand: { x: 0, z: 50, label: 'Taxi stand' },
  };

  function addBuilding(x, z, sx, sz, h, c, kind) {
    const b = { x, z, sx, sz, h, c, kind };
    city.buildings.push(b);
    city.boxes.push({ x, y: h / 2, z, sx, sy: h, sz, c });
    return b;
  }
  function addBox(x, y, z, sx, sy, sz, c, a) {
    city.boxes.push({ x, y, z, sx, sy, sz, c, a });
  }

  // ---- ground: grass base, sand beach, asphalt roads ----
  addBox(0, -0.05, 0, 800, 0.1, 800, [0.32, 0.6, 0.28]);
  // sand strip on the west edge
  addBox(-365, 0.02, 0, 70, 0.12, 800, COL.sand);
  // water plane (translucent, animated by main.js shifting y)
  city.waterBoxes = [
    { x: -365, y: 0.25, z: 0, sx: 72, sy: 0.3, sz: 800, c: COL.water, a: 0.8 },
  ];

  // roads: grid at -300..300 step 100, plus highway ring at +-350
  const gridLines = [-300, -200, -100, 0, 100, 200, 300];
  for (const g of gridLines) {
    addBox(g, 0.06, 0, 12, 0.1, 700, COL.asphalt); // north-south
    addBox(0, 0.06, g, 700, 0.1, 12, COL.asphalt); // east-west
    // sidewalks alongside
    addBox(g + 9, 0.05, 0, 6, 0.08, 700, COL.sidewalk);
    addBox(g - 9, 0.05, 0, 6, 0.08, 700, COL.sidewalk);
    addBox(0, 0.05, g + 9, 700, 0.08, 6, COL.sidewalk);
    addBox(0, 0.05, g - 9, 700, 0.08, 6, COL.sidewalk);
    // lane dashes
    for (let d = -340; d <= 340; d += 24) {
      addBox(g, 0.12, d, 0.7, 0.06, 5, COL.lane);
      addBox(d, 0.12, g, 5, 0.06, 0.7, COL.lane);
    }
  }
  // highway loop
  for (const g of [-350, 350]) {
    addBox(g, 0.06, 0, 12, 0.1, 700, COL.asphalt);
    addBox(0, 0.06, g, 700, 0.1, 12, COL.asphalt);
  }

  // ---- special sites ----
  for (const key of Object.keys(SITES)) {
    const s = SITES[key];
    addBuilding(s.x, s.z, s.sx, s.sz, s.h, s.c, s.kind);
  }

  // ---- downtown towers (blocks |x|,|z| <= 150, skipping site blocks) ----
  const siteBlocks = new Set();
  for (const s of Object.values(SITES)) siteBlocks.add(s.x + ',' + s.z);
  const blockCenters = [-250, -150, -50, 50, 150, 250];
  for (const bx of blockCenters) {
    for (const bz of blockCenters) {
      if (siteBlocks.has(bx + ',' + bz)) continue;
      if (nearSpawn(bx, bz, 45)) continue;
      if (Math.abs(bx) <= 150 && Math.abs(bz) <= 150) {
        // downtown: two towers per block (crowded skyline)
        addBuilding(bx - 18, bz, 30, 34, 22 + rng() * 30, COL.buildings[Math.floor(rng() * COL.buildings.length)], 'tower');
        addBuilding(bx + 18, bz + 4, 30, 30, 18 + rng() * 28, COL.buildings[Math.floor(rng() * COL.buildings.length)], 'tower');
      } else if (bz >= 200 && Math.abs(bx) <= 250) {
        // suburbs south: three small houses per block
        addBuilding(bx - 22, bz - 12, 20, 16, 6 + rng() * 4, COL.buildings[Math.floor(rng() * COL.buildings.length)], 'house');
        addBuilding(bx + 20, bz - 10, 20, 16, 5 + rng() * 4, COL.buildings[Math.floor(rng() * COL.buildings.length)], 'house');
        addBuilding(bx, bz + 18, 22, 16, 6 + rng() * 3, COL.buildings[Math.floor(rng() * COL.buildings.length)], 'house');
      } else if (bx >= 200 && bz <= -200) {
        // airport district handled below; skip houses here
        continue;
      } else if (Math.abs(bx) <= 250 && Math.abs(bz) <= 250) {
        // mid blocks: two shops / low buildings with awnings
        const h = 8 + rng() * 8;
        addBuilding(bx - 16, bz, 32, 34, h, COL.buildings[Math.floor(rng() * COL.buildings.length)], 'shop');
        addBox(bx - 16, h + 0.4, bz + 18, 24, 0.8, 6, COL.neon[Math.floor(rng() * COL.neon.length)]);
        const h2 = 8 + rng() * 8;
        addBuilding(bx + 18, bz + 6, 30, 30, h2, COL.buildings[Math.floor(rng() * COL.buildings.length)], 'shop');
        addBox(bx + 18, h2 + 0.4, bz + 22, 22, 0.8, 6, COL.neon[Math.floor(rng() * COL.neon.length)]);
      }
    }
  }

  // ---- airport (north-east): runway + hangars ----
  addBox(250, 0.08, -320, 320, 0.1, 26, [0.2, 0.2, 0.22]); // runway
  for (let d = -300; d <= 300; d += 40) {
    addBox(250 + d - 90, 0.14, -320, 8, 0.06, 1.2, [0.95, 0.95, 0.95]);
  }
  addBuilding(180, -360, 50, 30, 12, [0.7, 0.72, 0.75], 'hangar');
  addBuilding(300, -360, 50, 30, 12, [0.7, 0.72, 0.75], 'hangar');

  // ---- harbour (east): docks + containers ----
  addBox(360, 0.3, -100, 80, 0.6, 160, [0.45, 0.38, 0.3]); // dock slab
  for (let i = 0; i < 12; i++) {
    const cx = 330 + rng() * 50;
    const cz = -160 + rng() * 120;
    const cc = [[0.8, 0.3, 0.2], [0.2, 0.5, 0.8], [0.9, 0.7, 0.15], [0.3, 0.7, 0.3]][i % 4];
    city.containers.push({ x: cx, z: cz, sx: 12, sz: 6, h: 6 });
    city.buildings.push({ x: cx, z: cz, sx: 12, sz: 6, h: 6, c: cc, kind: 'container' });
    city.boxes.push({ x: cx, y: 3, z: cz, sx: 12, sy: 6, sz: 6, c: cc });
  }

  // ---- window bands + neon + rooftops on towers ----
  for (const b of city.buildings) {
    if (b.kind !== 'tower' && b.kind !== 'police' && b.kind !== 'hospital') continue;
    const floors = Math.max(1, Math.floor(b.h / 4));
    for (let f = 1; f <= floors; f++) {
      const y = (f * b.h) / (floors + 1);
      const lit = rng() < 0.45;
      const wc = lit ? [1, 0.9, 0.55] : [0.35, 0.45, 0.6];
      addBox(b.x, y, b.z + b.sz / 2 + 0.15, b.sx * 0.8, 1.6, 0.3, wc);
      addBox(b.x, y, b.z - b.sz / 2 - 0.15, b.sx * 0.8, 1.6, 0.3, wc);
    }
    // rooftop details
    addBox(b.x - b.sx / 4, b.h + 1, b.z, 6, 2, 6, [0.5, 0.5, 0.52]);
    addBox(b.x + b.sx / 4, b.h + 2, b.z - b.sz / 4, 1, 4, 1, [0.3, 0.3, 0.32]);
    // neon sign on most downtown towers
    if (b.kind === 'tower' && Math.abs(b.x) <= 200 && Math.abs(b.z) <= 200 && rng() < 0.85) {
      const nc = COL.neon[Math.floor(rng() * COL.neon.length)];
      addBox(b.x, b.h - 2, b.z + b.sz / 2 + 0.4, Math.min(24, b.sx * 0.6), 2.4, 0.6, nc);
    }
  }

  // ---- trees, palms, lamps, props ----
  function addTree(x, z, palm) {
    city.trees.push({ x, z, palm: !!palm });
    if (palm) {
      addBox(x, 3, z, 1.2, 6, 1.2, [0.55, 0.4, 0.25]);
      addBox(x, 6.6, z, 7, 1.4, 7, [0.25, 0.7, 0.3]);
    } else {
      addBox(x, 2, z, 1.4, 4, 1.4, [0.5, 0.35, 0.2]);
      addBox(x, 5.5, z, 6, 5, 6, [0.3, 0.65, 0.28]);
    }
  }
  // palms along the beach road
  for (let z = -320; z <= 320; z += 40) {
    addTree(-306, z, true);
    if (rng() < 0.5) addTree(-294, z + 20, true);
  }
  // park trees + flower beds + pots in mid blocks
  for (let i = 0; i < 60; i++) {
    const x = -280 + rng() * 560;
    const z = -280 + rng() * 560;
    if (Math.abs(x) % 100 < 14 || Math.abs(z) % 100 < 14) continue; // keep off roads
    if (nearSpawn(x, z, 40)) continue;
    if (x < -300 || x > 300) continue;
    addTree(x, z, false);
    if (rng() < 0.5) {
      const fc = [[1, 0.4, 0.5], [1, 0.85, 0.2], [0.7, 0.4, 1], [1, 0.6, 0.2]][Math.floor(rng() * 4)];
      addBox(x + 6, 0.5, z + 4, 5, 1, 3, fc);
      city.props.push({ kind: 'flowers', x: x + 6, z: z + 4 });
    }
    if (rng() < 0.4) {
      addBox(x - 5, 0.8, z - 4, 2, 1.6, 2, [0.6, 0.35, 0.2]);
      city.props.push({ kind: 'pot', x: x - 5, z: z - 4 });
    }
  }
  // street lamps at intersections
  for (const ix of [-200, -100, 0, 100, 200]) {
    for (const iz of [-200, -100, 0, 100, 200]) {
      addBox(ix + 8, 3.5, iz + 8, 0.8, 7, 0.8, [0.3, 0.3, 0.32]);
      addBox(ix + 8, 7.2, iz + 8, 2.4, 0.8, 2.4, [1, 0.95, 0.6]);
      city.lamps.push({ x: ix + 8, z: iz + 8 });
    }
  }
  // beach umbrellas + towels
  for (let i = 0; i < 14; i++) {
    const z = -300 + i * 44 + rng() * 20;
    const uc = [[1, 0.3, 0.3], [0.3, 0.7, 1], [1, 0.85, 0.2], [0.9, 0.4, 0.9]][i % 4];
    addBox(-350, 2.6, z, 8, 0.4, 8, uc);
    addBox(-350, 1.4, z, 0.8, 2.8, 0.8, [0.6, 0.5, 0.4]);
    addBox(-342, 0.3, z + 8, 5, 0.5, 2.5, [0.95, 0.6, 0.5]);
    city.props.push({ kind: 'umbrella', x: -350, z });
  }

  // ---- traffic lights at 24 inner intersections ----
  let lightIndex = 0;
  for (const ix of [-200, -100, 0, 100, 200]) {
    for (const iz of [-200, -100, 0, 100, 200]) {
      if (ix === 0 && iz === 0) continue; // 24, not 25
      city.lights.push({
        x: ix + 9,
        z: iz + 9,
        phase: (lightIndex % 3) * 6, // staggered cycle
        index: lightIndex,
      });
      addBox(ix + 9, 3, iz + 9, 0.8, 6, 0.8, [0.25, 0.25, 0.28]);
      lightIndex++;
    }
  }

  // ---- road graph nodes (traffic waypoints) ----
  for (const gx of gridLines) {
    for (const gz of gridLines) {
      city.roadNodes.push({ x: gx, z: gz });
    }
  }

  // ---- train loop: rectangle at +-320, station on the west side ----
  city.trainTrack = {
    corners: [
      { x: -320, z: -320 },
      { x: 320, z: -320 },
      { x: 320, z: 320 },
      { x: -320, z: 320 },
    ],
    station: { x: -320, z: 0 },
  };
  // station platform
  addBox(-332, 0.6, 0, 10, 1.2, 40, [0.6, 0.6, 0.62]);
  addBox(-336, 3, 0, 2, 6, 40, [0.5, 0.55, 0.6]);

  city.boxCount = city.boxes.length;
  return city;
}

// Circle (player/car, radius r) vs building AABBs: push out.
// Returns a corrected {x, z}. Buildings are solid columns.
export function collideCircle(city, x, z, r) {
  let px = x;
  let pz = z;
  for (let i = 0; i < city.buildings.length; i++) {
    const b = city.buildings[i];
    const bx0 = b.x - b.sx / 2;
    const bx1 = b.x + b.sx / 2;
    const bz0 = b.z - b.sz / 2;
    const bz1 = b.z + b.sz / 2;
    const cx = clamp(px, bx0, bx1);
    const cz = clamp(pz, bz0, bz1);
    const dx = px - cx;
    const dz = pz - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      px = cx + (dx / d) * r;
      pz = cz + (dz / d) * r;
    } else {
      // centre inside the box: push out along the smallest axis
      const pushL = px - bx0 + r;
      const pushR = bx1 - px + r;
      const pushU = pz - bz0 + r;
      const pushD = bz1 - pz + r;
      const m = Math.min(pushL, pushR, pushU, pushD);
      if (m === pushL) px = bx0 - r;
      else if (m === pushR) px = bx1 + r;
      else if (m === pushU) pz = bz0 - r;
      else pz = bz1 + r;
    }
  }
  // world bounds
  px = clamp(px, -395, 395);
  pz = clamp(pz, -395, 395);
  return { x: px, z: pz };
}

// Distance from a point to the nearest building collider (0 if inside).
export function distToNearestBuilding(city, x, z) {
  let best = Infinity;
  for (const b of city.buildings) {
    const bx0 = b.x - b.sx / 2;
    const bx1 = b.x + b.sx / 2;
    const bz0 = b.z - b.sz / 2;
    const bz1 = b.z + b.sz / 2;
    const cx = clamp(x, bx0, bx1);
    const cz = clamp(z, bz0, bz1);
    const dx = x - cx;
    const dz = z - cz;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < best) best = d;
  }
  return best;
}

export function inWater(x, z) {
  return x < -330;
}

export function onRoad(x, z) {
  const fx = Math.abs(x) % 100;
  const fz = Math.abs(z) % 100;
  const nearLine = (f) => f < 7 || f > 93;
  return nearLine(fx) || nearLine(fz);
}

// Traffic light state at time t (seconds): 'green' | 'yellow' | 'red'.
// Cycle: green 8s, yellow 2s, red 8s (18s total), staggered by phase.
export function lightState(light, t) {
  const c = (t + light.phase) % 18;
  if (c < 8) return 'green';
  if (c < 10) return 'yellow';
  return 'red';
}
