// Solmar Bay — voxel city generation (800x800), deterministic.
// Districts: downtown grid, beach + water (west), harbour (south-west),
// suburbs (east), airport (south-east), highway loop. Pure data — no
// DOM, no WebGL — so headless tests can import it directly.

import { MAP, COL, mulberry32, dist } from './config.js';

export function generateCity() {
  const rng = mulberry32(1337);
  const city = {
    buildings: [], // {x,z,w,d,h,color,kind,neon,neonColor,floors}
    colliders: [], // {x,z,hw,hd}
    roads: [], // {x,z,w,d} flat strips
    dashes: [], // {x,z,yaw} lane dash boxes
    sidewalks: [],
    lanes: [], // traffic lanes: {points: [[x,z],...], loop: bool}
    trees: [], // {x,z,scale,palm}
    lamps: [], // {x,z}
    flowers: [], // {x,z,color}
    pots: [], // {x,z}
    benches: [], // {x,z,yaw}
    umbrellas: [], // {x,z,color}
    containers: [], // {x,z,color,yaw}
    shops: [], // food shops {name,kind,x,z,color}
    props: [], // misc {x,z,kind}
    spawns: {},
    train: null,
    elevator: null,
  };

  function addBuilding(x, z, w, d, h, color, kind) {
    const b = {
      x, z, w, d, h, color, kind,
      neon: kind === 'tower' && rng() < 0.85,
      neonColor: COL.neon[Math.floor(rng() * COL.neon.length)],
      floors: Math.max(2, Math.round(h / 4)),
    };
    city.buildings.push(b);
    city.colliders.push({ x, z, hw: w / 2, hd: d / 2 });
    return b;
  }

  // ---- roads (flat strips) ----
  function roadV(x, z0, z1, w) {
    city.roads.push({ x, z: (z0 + z1) / 2, w, d: z1 - z0 });
  }
  function roadH(z, x0, x1, w) {
    city.roads.push({ x: (x0 + x1) / 2, z, w: x1 - x0, d: w });
  }
  const AVE = [-150, -50, 50, 150];
  const ST = [-150, -50, 50, 150];
  for (const x of AVE) roadV(x, -200, 200, 12);
  for (const z of ST) roadH(z, -200, 200, 12);
  roadV(-300, -350, 350, 12); // beach road
  roadV(-200, -350, 350, 12); // highway west
  roadV(200, -350, 350, 12); // highway east
  roadH(-200, -350, 350, 12); // highway north
  roadH(200, -350, 350, 12); // highway south
  roadH(-350, -350, 350, 12); // north ring
  roadH(350, -350, 350, 12); // south ring
  roadH(250, -300, 300, 12); // harbour / airport road
  roadV(250, -350, 150, 12); // suburb road
  roadH(-250, 150, 380, 12); // suburb north road
  // runway (airport)
  city.roads.push({ x: 225, z: 330, w: 180, d: 16 });

  // lane dashes along the main roads
  function dashesV(x, z0, z1) {
    for (let z = z0 + 10; z < z1 - 5; z += 20) city.dashes.push({ x, z, yaw: 0 });
  }
  function dashesH(z, x0, x1) {
    for (let x = x0 + 10; x < x1 - 5; x += 20) city.dashes.push({ x, z, yaw: Math.PI / 2 });
  }
  for (const x of AVE) dashesV(x, -200, 200);
  for (const z of ST) dashesH(z, -200, 200);
  dashesV(-300, -350, 350);
  dashesV(200, -350, 350);

  // ---- traffic lanes (polylines traffic cars follow) ----
  function lane(points, loop) { city.lanes.push({ points, loop: !!loop }); }
  for (const x of AVE) {
    lane([[-3 + x, -200], [-3 + x, 200]], false);
    lane([[3 + x, 200], [3 + x, -200]], false);
  }
  for (const z of ST) {
    lane([[-200, -3 + z], [200, -3 + z]], false);
    lane([[200, 3 + z], [-200, 3 + z]], false);
  }
  lane([[-303, -350], [-303, 350]], false);
  lane([[-297, 350], [-297, -350]], false);
  lane([[-200, -200], [200, -200], [200, 200], [-200, 200], [-200, -200]], true); // highway loop
  lane([[200, 200], [200, -200], [-200, -200], [-200, 200], [200, 200]], true);
  lane([[-300, 253], [300, 253]], false);
  lane([[300, 247], [-300, 247]], false);
  lane([[253, -350], [253, 150]], false);
  lane([[247, 150], [247, -350]], false);

  // ---- downtown towers (9 blocks, 1-2 towers each) ----
  const blocks = [];
  const xs = [-150, -50, 50, 150];
  const zs = [-150, -50, 50, 150];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      blocks.push({ x0: xs[i] + 8, x1: xs[i + 1] - 8, z0: zs[j] + 8, z1: zs[j + 1] - 8 });
    }
  }
  // keep two blocks as special sites (police station, hospital)
  let towerCount = 0;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (i === 1) continue; // police station block
    if (i === 7) continue; // hospital block
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    if (rng() < 0.4) {
      // one big tower
      const h = 34 + rng() * 28;
      addBuilding(cx, cz, 46 + rng() * 14, 46 + rng() * 14, h,
        COL.buildings[Math.floor(rng() * COL.buildings.length)], 'tower');
      towerCount++;
    } else {
      // two mid towers
      addBuilding(cx - 16, cz, 34, 34, 20 + rng() * 18,
        COL.buildings[Math.floor(rng() * COL.buildings.length)], 'tower');
      addBuilding(cx + 16, cz, 34, 34, 24 + rng() * 22,
        COL.buildings[Math.floor(rng() * COL.buildings.length)], 'tower');
      towerCount += 2;
    }
  }
  // tallest tower (elevator site)
  let tallest = null;
  for (const b of city.buildings) if (!tallest || b.h > tallest.h) tallest = b;
  city.elevator = { x: tallest.x + tallest.w / 2 + 3, z: tallest.z, topY: tallest.h, tower: tallest };

  // police station + hospital (special buildings)
  addBuilding(0, -100, 56, 40, 14, [0.75, 0.78, 0.85], 'police');
  addBuilding(-100, 100, 56, 40, 16, [0.92, 0.92, 0.94], 'hospital');
  addBuilding(-100, 225, 44, 30, 12, [0.9, 0.25, 0.15], 'fire');
  addBuilding(180, 120, 40, 30, 10, [0.6, 0.6, 0.65], 'garage');
  addBuilding(-220, 330, 40, 26, 12, [0.5, 0.45, 0.4], 'safehouse');
  addBuilding(300, -300, 34, 26, 10, [0.7, 0.65, 0.55], 'hideout');
  addBuilding(-335, -120, 20, 16, 7, [0.95, 0.8, 0.65], 'beachhouse');
  addBuilding(60, -140, 26, 20, 9, [0.9, 0.4, 0.7], 'outfit');
  addBuilding(320, 240, 50, 30, 12, [0.65, 0.65, 0.7], 'range');
  addBuilding(-240, 300, 30, 22, 10, [0.55, 0.5, 0.45], 'dockoffice');

  // ---- suburbs: small houses ----
  for (let i = 0; i < 26; i++) {
    const x = 210 + rng() * 160;
    const z = -340 + rng() * 460;
    if (Math.abs(x - 250) < 14 || Math.abs(z + 250) < 12) continue; // keep roads clear
    if (z > 230) continue; // airport area
    addBuilding(x, z, 12 + rng() * 6, 12 + rng() * 6, 6 + rng() * 4,
      COL.house[Math.floor(rng() * COL.house.length)], 'house');
  }

  // ---- harbour: containers, cranes, docks ----
  for (let i = 0; i < 18; i++) {
    const x = -290 + rng() * 200;
    const z = 270 + rng() * 90;
    const c = [[0.9, 0.3, 0.2], [0.2, 0.6, 0.9], [0.9, 0.7, 0.2], [0.3, 0.8, 0.4]][i % 4];
    city.containers.push({ x, z, color: c, yaw: rng() < 0.5 ? 0 : Math.PI / 2 });
    city.colliders.push({ x, z, hw: 6, hd: 3 });
  }
  city.props.push({ x: -280, z: 360, kind: 'crane' });
  city.props.push({ x: -120, z: 360, kind: 'crane' });

  // ---- airport: hangars + control tower ----
  addBuilding(140, 330, 40, 26, 12, [0.7, 0.72, 0.75], 'hangar');
  addBuilding(300, 360, 26, 26, 30, [0.75, 0.75, 0.78], 'control');
  city.props.push({ x: 225, z: 330, kind: 'runway' });

  // ---- food shops ----
  const shopSpots = [
    { name: 'Pizza Palace', kind: 'pizza', x: 40, z: 140 },
    { name: 'Burger Barn', kind: 'burger', x: -40, z: -140 },
    { name: 'Clucky Chicken', kind: 'chicken', x: -140, z: 40 },
    { name: 'Donut Dock', kind: 'donut', x: 140, z: -40 },
    { name: 'Taco Tide', kind: 'taco', x: -330, z: 100 },
  ];
  for (const s of shopSpots) {
    const def = { pizza: [0.95, 0.55, 0.25], burger: [0.9, 0.35, 0.2], chicken: [0.95, 0.8, 0.3], donut: [0.95, 0.6, 0.75], taco: [0.5, 0.85, 0.35] }[s.kind];
    addBuilding(s.x, s.z, 22, 16, 8, [0.88, 0.85, 0.8], 'shop');
    city.shops.push({ name: s.name, kind: s.kind, x: s.x, z: s.z + 10, color: def });
  }

  // ---- trees, palms, lamps, flowers, pots, benches ----
  for (let i = 0; i < 60; i++) {
    const x = -380 + rng() * 760;
    const z = -380 + rng() * 760;
    if (Math.abs(x) < 210 && Math.abs(z) < 210) continue; // downtown is towers
    if (x < -310) continue; // beach is palms
    if (collides(city, x, z, 2)) continue;
    city.trees.push({ x, z, scale: 0.8 + rng() * 0.6, palm: false });
  }
  for (let z = -340; z <= 340; z += 34) {
    city.trees.push({ x: -312, z, scale: 1, palm: true });
    if (rng() < 0.6) city.trees.push({ x: -288, z: z + 12, scale: 1, palm: true });
  }
  for (const x of AVE) for (let z = -190; z <= 190; z += 40) {
    city.lamps.push({ x: x + 8, z });
    city.lamps.push({ x: x - 8, z: z + 20 });
  }
  for (let i = 0; i < 40; i++) {
    const x = -150 + rng() * 300;
    const z = -150 + rng() * 300;
    if (collides(city, x, z, 2)) continue;
    city.flowers.push({ x, z, color: [[1, 0.4, 0.5], [1, 0.8, 0.2], [0.6, 0.4, 1], [1, 1, 1]][i % 4] });
  }
  for (let i = 0; i < 26; i++) {
    const x = -160 + rng() * 320;
    const z = -160 + rng() * 320;
    if (collides(city, x, z, 2)) continue;
    city.pots.push({ x, z });
  }
  for (let i = 0; i < 12; i++) {
    city.benches.push({ x: -140 + rng() * 280, z: -140 + rng() * 280, yaw: rng() * Math.PI });
  }

  // ---- beach: umbrellas + towels ----
  for (let i = 0; i < 14; i++) {
    const z = -330 + rng() * 660;
    city.umbrellas.push({ x: -345 + rng() * 18, z, color: [[1, 0.3, 0.4], [0.3, 0.8, 1], [1, 0.8, 0.2], [0.5, 1, 0.5]][i % 4] });
  }

  // ---- train: loop track around downtown, station at south point ----
  const track = [];
  for (let a = 0; a < 360; a += 10) {
    const r = (a * Math.PI) / 180;
    track.push([Math.cos(r) * 235, Math.sin(r) * 235]);
  }
  city.train = { track, station: { x: 0, z: 235 }, radius: 235 };

  // ---- spawns / mission anchors ----
  city.spawns = {
    player: { x: -50, z: 0 }, // on avenue -50, facing +z down the road
    garage: { x: 180, z: 120 },
    packagePickup: { x: -100, z: -100 },
    harbourOffice: { x: -240, z: 300 },
    safehouse: { x: -220, z: 330 },
    hideout: { x: 300, z: -300 },
    hospital: { x: -100, z: 100 },
    fireStation: { x: -100, z: 225 },
    policeStation: { x: 0, z: -100 },
    taxiStand: { x: 0, z: 160 },
    beachHouse: { x: -335, z: -120 },
    outfitShop: { x: 60, z: -140 },
    range: { x: 320, z: 240 },
    airport: { x: 225, z: 330 },
    trainStation: { x: 0, z: 235 },
    viewpoint: { x: -340, z: -320 },
    buoy: { x: -380, z: 0 },
  };
  city.parkedSpots = [
    { x: -44, z: -120 }, { x: 56, z: 80 }, { x: -144, z: 30 }, { x: 144, z: -70 },
    { x: -294, z: 120 }, { x: -294, z: -200 }, { x: 206, z: -120 }, { x: 44, z: 156 },
    { x: -56, z: -156 }, { x: 156, z: 44 }, { x: -206, z: 260 }, { x: 256, z: -60 },
    { x: -100, z: 206 }, { x: 100, z: -206 }, { x: -330, z: 200 }, { x: 330, z: -100 },
  ];
  city.towerCount = towerCount;
  return city;
}

// AABB collision: is the circle at (x,z) radius r inside any collider?
export function collides(city, x, z, r) {
  for (const c of city.colliders) {
    const dx = Math.abs(x - c.x) - c.hw;
    const dz = Math.abs(z - c.z) - c.hd;
    if (dx < r && dz < r) return true;
  }
  return false;
}

// Move with slide: try x then z separately so the mover slides walls.
export function moveWithCollision(city, pos, dx, dz, r) {
  if (!collides(city, pos.x + dx, pos.z, r)) pos.x += dx;
  if (!collides(city, pos.x, pos.z + dz, r)) pos.z += dz;
}

export function inWater(city, x, z) {
  return x < MAP.waterEdgeX;
}

export function nearestLanePoint(lane, x, z) {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < lane.points.length; i++) {
    const d = dist(x, z, lane.points[i][0], lane.points[i][1]);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

// ---- static geometry: convert the city into one box list ----
export function buildStaticBoxes(city) {
  const boxes = [];
  const add = (x, y, z, sx, sy, sz, color, alpha, yaw) => {
    boxes.push({ x, y, z, sx, sy, sz, color, alpha: alpha === undefined ? 1 : alpha, yaw: yaw || 0 });
  };

  // ground: grass base, sand strip, water handled separately
  add(0, -0.4, 0, 800, 0.8, 800, COL.grass);
  add(-340, -0.2, 0, 40, 0.4, 800, COL.sand);
  // roads + dashes + sidewalks
  for (const r of city.roads) add(r.x, 0.05, r.z, r.w, 0.1, r.d, COL.road);
  for (const d of city.dashes) add(d.x, 0.12, d.z, d.yaw ? 1 : 4, 0.06, d.yaw ? 4 : 1, COL.roadDash);
  // sidewalks along downtown avenues
  for (const x of [-150, -50, 50, 150]) {
    add(x - 8.5, 0.1, 0, 3, 0.2, 400, COL.sidewalk);
    add(x + 8.5, 0.1, 0, 3, 0.2, 400, COL.sidewalk);
  }
  add(-308, 0.1, 0, 3, 0.2, 700, COL.sidewalk);

  // buildings: body + window bands on all faces + roof props + neon
  for (const b of city.buildings) {
    add(b.x, b.h / 2, b.z, b.w, b.h, b.d, b.color);
    // window bands (lit / dark mix) on the four faces
    const bands = Math.max(2, Math.floor(b.h / 7));
    for (let f = 0; f < bands; f++) {
      const y = 4 + f * 7;
      if (y > b.h - 2) break;
      const lit = (f * 7 + Math.floor(b.x)) % 3 !== 0;
      const wc = lit ? COL.windowLit : COL.windowDark;
      add(b.x, y, b.z + b.d / 2 + 0.1, b.w * 0.8, 2.2, 0.2, wc);
      add(b.x, y, b.z - b.d / 2 - 0.1, b.w * 0.8, 2.2, 0.2, wc);
      add(b.x + b.w / 2 + 0.1, y, b.z, 0.2, 2.2, b.d * 0.8, wc);
      add(b.x - b.w / 2 - 0.1, y, b.z, 0.2, 2.2, b.d * 0.8, wc);
    }
    // roof AC units + antenna on towers
    if (b.kind === 'tower') {
      add(b.x - b.w / 4, b.h + 0.8, b.z, 4, 1.6, 4, [0.6, 0.6, 0.62]);
      add(b.x + b.w / 4, b.h + 1.2, b.z, 0.6, 2.4, 0.6, [0.4, 0.4, 0.42]);
      if (b.neon) {
        // neon sign band near the top, on the south face
        add(b.x, b.h - 3, b.z + b.d / 2 + 0.3, b.w * 0.7, 1.6, 0.4, b.neonColor);
      }
    }
    // shop awning + sign
    if (b.kind === 'shop') {
      add(b.x, 3.4, b.z + b.d / 2 + 1, b.w * 0.9, 0.4, 2.4, [0.95, 0.95, 0.95]);
    }
  }

  // harbour containers + cranes
  for (const c of city.containers) {
    add(c.x, 1.6, c.z, 12, 3.2, 6, c.color, 1, c.yaw);
  }
  for (const p of city.props) {
    if (p.kind === 'crane') {
      add(p.x, 12, p.z, 2, 24, 2, [0.9, 0.6, 0.15]);
      add(p.x, 24, p.z, 18, 2, 2, [0.9, 0.6, 0.15]);
    }
  }
  // runway markings
  add(225, 0.12, 330, 170, 0.06, 2, [0.9, 0.9, 0.9]);

  // trees + palms
  for (const t of city.trees) {
    if (t.palm) {
      add(t.x, 3, t.z, 1.2, 6, 1.2, COL.palmTrunk);
      add(t.x, 6.4, t.z, 5, 1.2, 5, COL.palmLeaf);
    } else {
      add(t.x, 1.5 * t.scale, t.z, 1 * t.scale, 3 * t.scale, 1 * t.scale, COL.treeTrunk);
      add(t.x, (3 + 1.5) * t.scale, t.z, 4 * t.scale, 3 * t.scale, 4 * t.scale, COL.treeLeaf);
    }
  }
  // lamps
  for (const l of city.lamps) {
    add(l.x, 2.5, l.z, 0.5, 5, 0.5, COL.lampPole);
    add(l.x, 5.2, l.z, 1.4, 0.7, 1.4, COL.lampGlow);
  }
  // flowers, pots, benches, umbrellas
  for (const f of city.flowers) add(f.x, 0.5, f.z, 1.2, 1, 1.2, f.color);
  for (const p of city.pots) {
    add(p.x, 0.6, p.z, 1.6, 1.2, 1.6, [0.7, 0.45, 0.3]);
    add(p.x, 1.6, p.z, 1.2, 1, 1.2, COL.treeLeaf);
  }
  for (const b of city.benches) add(b.x, 0.6, b.z, 4, 1, 1.4, [0.55, 0.4, 0.25], 1, b.yaw);
  for (const u of city.umbrellas) {
    add(u.x, 1.6, u.z, 0.4, 3.2, 0.4, [0.8, 0.8, 0.8]);
    add(u.x, 3.4, u.z, 5, 0.5, 5, u.color);
  }
  // train station platform
  add(0, 0.6, 235, 30, 1.2, 10, COL.sidewalk);
  add(0, 2.5, 241, 30, 4, 1, [0.3, 0.35, 0.5]);
  // train track ring (thin dark boxes along the circle)
  for (let a = 0; a < 360; a += 6) {
    const r = (a * Math.PI) / 180;
    add(Math.cos(r) * 235, 0.15, Math.sin(r) * 235, 3, 0.3, 3, [0.2, 0.2, 0.22]);
  }
  return boxes;
}

// Animated water: a few large translucent strips that bob with time.
export function buildWaterBoxes(city, t) {
  const out = [];
  for (let i = 0; i < 4; i++) {
    const z = -300 + i * 200;
    out.push({
      x: -380, y: 0.4 + Math.sin(t * 0.8 + i * 1.3) * 0.15,
      z, sx: 40, sy: 0.8, sz: 200, color: COL.water,
    });
  }
  return out;
}
