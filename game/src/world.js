// Solmar Bay — voxel city generation (800x800), districts, road graph,
// AABB collision. Pure data: no DOM, no WebGL here, so it can be
// unit-tested under node. Seeded RNG keeps the city identical.

import { COL, WORLD } from './config.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HALF = WORLD.half;

export function generateCity() {
  const rng = mulberry32(20261119);
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const range = (a, b) => a + rng() * (b - a);

  const buildings = [];   // {x,z,w,d,h,color,roof,windows}
  const roads = [];       // {x1,z1,x2,z2,w} axis-aligned
  const ground = [];      // flat region boxes {x,z,w,d,color}
  const water = [];       // {x1,z1,x2,z2}
  const props = [];       // {kind,x,z,...} trees, lamps, containers, cranes, docks
  const runway = { x: 315, z1: -300, z2: -140, w: 30 };

  const addRoad = (x1, z1, x2, z2, w = 12) => roads.push({ x1, z1, x2, z2, w });
  const addBuilding = (x, z, w, d, h, color, windows = true) =>
    buildings.push({ x, z, w, d, h, color, roof: COL.roof, windows });

  // ---- ground regions ----
  ground.push({ x: 0, z: 0, w: 800, d: 800, color: COL.grass });
  ground.push({ x: -350, z: 0, w: 100, d: 800, color: COL.sand }); // beach strip
  ground.push({ x: 320, z: -210, w: 160, d: 180, color: COL.concrete }); // airport apron

  // ---- water ----
  water.push({ x1: -400, z1: -400, x2: -336, z2: 400 }); // ocean, west
  water.push({ x1: 320, z1: 280, x2: 400, z2: 400 });    // harbour bay, south-east

  // ---- downtown grid ----
  const grid = [-132, -88, -44, 0, 44, 88, 132];
  for (const g of grid) {
    addRoad(g, -150, g, 150, 12);
    addRoad(-150, g, 150, g, 12);
  }
  // downtown blocks: buildings between the streets
  for (let i = 0; i < grid.length - 1; i++) {
    for (let j = 0; j < grid.length - 1; j++) {
      const x0 = grid[i] + 8, x1 = grid[i + 1] - 8;
      const z0 = grid[j] + 8, z1 = grid[j + 1] - 8;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const bw = x1 - x0, bd = z1 - z0;
      const central = Math.abs(cx) < 95 && Math.abs(cz) < 95;
      // one park block in the middle-west of downtown
      if (i === 1 && j === 3) {
        for (let t = 0; t < 8; t++) {
          props.push({ kind: 'tree', x: range(x0 + 4, x1 - 4), z: range(z0 + 4, z1 - 4), s: range(0.8, 1.3) });
        }
        continue;
      }
      if (central && rng() < 0.75) {
        // tall tower
        addBuilding(cx, cz, bw * 0.62, bd * 0.62, range(28, 78), pick(COL.building), true);
      } else if (rng() < 0.8) {
        addBuilding(cx - bw * 0.18, cz, bw * 0.36, bd * 0.55, range(9, 22), pick(COL.building), true);
        addBuilding(cx + bw * 0.2, cz + bd * 0.12, bw * 0.34, bd * 0.4, range(7, 16), pick(COL.building), true);
      } else {
        addBuilding(cx, cz, bw * 0.5, bd * 0.5, range(8, 14), pick(COL.building), true);
      }
    }
  }
  // hospital + police HQ in downtown
  addBuilding(-60, -60, 26, 18, 14, COL.hospital, true);
  props.push({ kind: 'cross', x: -60, z: -60, h: 15 });

  // ---- avenues + highway ring ----
  addRoad(-200, -380, -200, 380, 14);
  addRoad(200, -380, 200, 380, 14);
  addRoad(-380, -200, 380, -200, 14);
  addRoad(-380, 200, 380, 200, 14);
  addRoad(-370, -370, 370, -370, 16);
  addRoad(-370, 370, 370, 370, 16);
  addRoad(-370, -370, -370, 370, 16);
  addRoad(370, -370, 370, 370, 16);

  // ---- beach ----
  addRoad(-288, -380, -288, 380, 12); // beach road
  for (let z = -360; z < 380; z += 55) {
    props.push({ kind: 'tree', x: -312 + range(-6, 6), z: z + range(-8, 8), s: range(0.9, 1.4) });
  }
  props.push({ kind: 'umbrella', x: -318, z: 40 });
  props.push({ kind: 'umbrella', x: -316, z: -120 });

  // ---- suburbs (north) ----
  for (let gx = -260; gx <= 220; gx += 44) {
    for (let gz = -380; gz <= -250; gz += 44) {
      if (rng() < 0.25) continue;
      const hx = gx + range(-8, 8), hz = gz + range(-8, 8);
      addBuilding(hx, hz, range(12, 16), range(10, 14), range(4, 7), pick(COL.house), false);
      if (rng() < 0.7) props.push({ kind: 'tree', x: hx + range(10, 14), z: hz + range(-6, 6), s: range(0.8, 1.2) });
    }
  }
  addRoad(-260, -270, 240, -270, 10);
  addRoad(-260, -320, 240, -320, 10);
  addRoad(-260, -365, 240, -365, 10);
  addRoad(-180, -380, -180, -240, 10);
  addRoad(-60, -380, -60, -240, 10);
  addRoad(60, -380, 60, -240, 10);
  addRoad(180, -380, 180, -240, 10);

  // ---- harbour (south-east) ----
  addRoad(260, 240, 260, 380, 12);
  addRoad(240, 300, 400, 300, 12);
  addBuilding(280, 260, 34, 16, 10, pick(COL.building), false); // warehouse
  addBuilding(280, 340, 30, 14, 9, pick(COL.building), false);  // warehouse
  for (let i = 0; i < 14; i++) {
    props.push({
      kind: 'container', x: range(300, 385), z: range(240, 300),
      color: pick(COL.container), h: range(2.4, 7),
    });
  }
  props.push({ kind: 'crane', x: 330, z: 315 });
  props.push({ kind: 'crane', x: 360, z: 290 });
  props.push({ kind: 'dock', x: 330, z: 300, w: 60, d: 10 });

  // ---- airport (east) ----
  addRoad(260, -320, 260, -120, 12);
  addRoad(260, -210, 400, -210, 12);
  addBuilding(285, -160, 44, 18, 12, COL.hangar, false); // terminal
  addBuilding(360, -160, 26, 20, 11, COL.hangar, false); // hangar
  addBuilding(360, -280, 24, 18, 10, COL.hangar, false); // hangar
  addBuilding(268, -280, 10, 10, 32, COL.tower, false);  // control tower

  // ---- lamps along downtown streets ----
  for (const g of [-88, 0, 88]) {
    for (let z = -120; z <= 120; z += 44) {
      props.push({ kind: 'lamp', x: g + 7, z });
      props.push({ kind: 'lamp', x: z, z: g + 7 });
    }
  }

  // ---- road graph (nodes at endpoints + crossings, edges along roads) ----
  const nodeMap = new Map();
  const nodes = [];
  const addNode = (x, z) => {
    const key = x + ',' + z;
    if (!nodeMap.has(key)) {
      nodeMap.set(key, nodes.length);
      nodes.push({ x, z });
    }
    return nodeMap.get(key);
  };
  const adj = [];
  const link = (a, b) => {
    if (a === b) return;
    adj[a] = adj[a] || [];
    adj[b] = adj[b] || [];
    if (!adj[a].includes(b)) adj[a].push(b);
    if (!adj[b].includes(a)) adj[b].push(a);
  };
  for (const r of roads) {
    const pts = [{ x: r.x1, z: r.z1 }, { x: r.x2, z: r.z2 }];
    for (const o of roads) {
      if (o === r) continue;
      // axis-aligned crossing?
      const horiz = r.z1 === r.z2, oHoriz = o.z1 === o.z2;
      if (horiz === oHoriz) continue;
      const h = horiz ? r : o, v = horiz ? o : r;
      const cx = v.x1, cz = h.z1;
      const inH = cx >= Math.min(h.x1, h.x2) && cx <= Math.max(h.x1, h.x2);
      const inV = cz >= Math.min(v.z1, v.z2) && cz <= Math.max(v.z1, v.z2);
      if (inH && inV) pts.push({ x: cx, z: cz });
    }
    // sort along the segment, link consecutive
    pts.sort((a, b) => (r.x1 === r.x2 ? a.z - b.z : a.x - b.x));
    for (let i = 0; i < pts.length - 1; i++) {
      link(addNode(pts[i].x, pts[i].z), addNode(pts[i + 1].x, pts[i + 1].z));
    }
  }

  const city = {
    size: 800,
    buildings, roads, ground, water, props, runway, nodes, adj,
    spawns: {
      player: { x: 24, z: 24 },
      garage: { x: 24, z: 62 },
      hospital: { x: -60, z: -44 },
      safehouse: { x: -120, z: -300 },
      airport: { x: 315, z: -220 },
      harbour: { x: 350, z: 300 },
      beach: { x: -310, z: 0 },
      plane: { x: 315, z: -220 },
      boat: { x: -345, z: 60 },
    },
  };
  return city;
}

// ---- collision: circle vs building AABBs, slide along walls ----
export function resolveCollision(x, z, r, buildings) {
  let px = x, pz = z;
  for (const b of buildings) {
    const x1 = b.x - b.w / 2 - r, x2 = b.x + b.w / 2 + r;
    const z1 = b.z - b.d / 2 - r, z2 = b.z + b.d / 2 + r;
    if (px > x1 && px < x2 && pz > z1 && pz < z2) {
      const dxl = px - x1, dxr = x2 - px, dzl = pz - z1, dzr = z2 - pz;
      const m = Math.min(dxl, dxr, dzl, dzr);
      if (m === dxl) px = x1;
      else if (m === dxr) px = x2;
      else if (m === dzl) pz = z1;
      else pz = z2;
    }
  }
  px = Math.max(-HALF + 2, Math.min(HALF - 2, px));
  pz = Math.max(-HALF + 2, Math.min(HALF - 2, pz));
  return { x: px, z: pz };
}

export function inWater(x, z, water) {
  for (const w of water) {
    if (x >= w.x1 && x <= w.x2 && z >= w.z1 && z <= w.z2) return true;
  }
  return false;
}

export function pointInBuilding(x, z, buildings) {
  for (const b of buildings) {
    if (Math.abs(x - b.x) < b.w / 2 && Math.abs(z - b.z) < b.d / 2) return b;
  }
  return null;
}

// ---- static box list for the renderer ----
export function buildStaticBoxes(city) {
  const boxes = [];
  const push = (x, y, z, sx, sy, sz, color, top) =>
    boxes.push({ x, y, z, sx, sy, sz, yaw: 0, color, top: top || null });

  for (const g of city.ground) push(g.x, -0.55, g.z, g.w, 1, g.d, g.color);
  // roads: dark strips + centre dashes
  for (const r of city.roads) {
    const w = r.w;
    const cx = (r.x1 + r.x2) / 2, cz = (r.z1 + r.z2) / 2;
    const len = Math.abs(r.x2 - r.x1) || Math.abs(r.z2 - r.z1);
    const horiz = r.z1 === r.z2;
    push(cx, 0.06, cz, horiz ? len : w, 0.12, horiz ? w : len, COL.asphalt);
    // dashes every 12 units
    const n = Math.floor(len / 12);
    for (let i = 0; i < n; i++) {
      const t = -len / 2 + 6 + i * 12;
      push(horiz ? cx + t : cx, 0.13, horiz ? cz : cz + t, horiz ? 3 : 0.5, 0.06, horiz ? 0.5 : 3, COL.lane);
    }
  }
  // runway
  const rw = city.runway;
  push(rw.x, 0.06, (rw.z1 + rw.z2) / 2, rw.w, 0.12, rw.z2 - rw.z1, COL.runway);
  for (let z = rw.z1 + 10; z < rw.z2 - 5; z += 20) {
    push(rw.x, 0.13, z, 1.2, 0.06, 6, COL.runwayMark);
  }
  // buildings + window bands
  for (const b of city.buildings) {
    push(b.x, b.h / 2, b.z, b.w, b.h, b.d, b.color, b.color);
    push(b.x, b.h + 0.15, b.z, b.w + 0.4, 0.3, b.d + 0.4, b.roof);
    if (b.windows && b.h >= 12) {
      const floors = Math.floor(b.h / 4);
      for (let f = 1; f <= floors; f++) {
        const y = f * 4 - 1;
        const lit = (f % 3 === 0) ? COL.windowLit : COL.windowDark;
        push(b.x, y, b.z + b.d / 2 + 0.05, b.w * 0.8, 1.6, 0.1, lit);
        push(b.x, y, b.z - b.d / 2 - 0.05, b.w * 0.8, 1.6, 0.1, lit);
      }
    }
  }
  // props
  for (const p of city.props) {
    if (p.kind === 'tree') {
      push(p.x, 1.2 * p.s, p.z, 0.5 * p.s, 2.4 * p.s, 0.5 * p.s, COL.treeTrunk);
      push(p.x, (2.4 + 1.1) * p.s, p.z, 2.6 * p.s, 2.2 * p.s, 2.6 * p.s, COL.treeLeaf, COL.treeLeaf2);
    } else if (p.kind === 'lamp') {
      push(p.x, 2.2, p.z, 0.25, 4.4, 0.25, COL.weapon);
      push(p.x, 4.5, p.z, 0.9, 0.3, 0.9, COL.windowLit);
    } else if (p.kind === 'container') {
      push(p.x, p.h / 2, p.z, 6, p.h, 2.6, p.color, p.color);
    } else if (p.kind === 'crane') {
      push(p.x, 12, p.z, 2, 24, 2, COL.weapon);
      push(p.x, 24, p.z, 18, 1.6, 1.6, COL.weapon);
    } else if (p.kind === 'dock') {
      push(p.x, 0.25, p.z, p.w, 0.5, p.d, COL.dockWood);
    } else if (p.kind === 'cross') {
      push(p.x, p.h + 1.2, p.z, 4.5, 1.2, 0.5, COL.hospitalCross);
      push(p.x, p.h + 1.2, p.z, 1.2, 4.5, 0.5, COL.hospitalCross);
    } else if (p.kind === 'umbrella') {
      push(p.x, 1.4, p.z, 0.2, 2.8, 0.2, COL.weapon);
      push(p.x, 3, p.z, 4.5, 0.25, 4.5, COL.marker, COL.marker);
    }
  }
  return boxes;
}

// ---- water boxes (drawn transparent, animated by the game loop) ----
export function buildWaterBoxes(city, t) {
  const out = [];
  for (const w of city.water) {
    const wob = Math.sin(t * 0.8 + (w.x1 + w.z1) * 0.01) * 0.06;
    out.push({
      x: (w.x1 + w.x2) / 2, y: WORLD.waterY + wob, z: (w.z1 + w.z2) / 2,
      sx: w.x2 - w.x1, sy: 0.5, sz: w.z2 - w.z1, color: COL.water,
    });
  }
  return out;
}
