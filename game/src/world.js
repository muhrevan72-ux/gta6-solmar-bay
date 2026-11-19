// Solmar Bay's city: one deterministic layout, generated from a fixed seed,
// with no drawing and no browser in it. Roads form a grid, blocks hold
// buildings, the west edge is beach and water, and a few blocks are the
// story places: hospital, garage, safehouse, harbour and a park.
import {
  COLORS, LANE, ROAD_W, ROAD_X, ROAD_Y, SAND_X, WATER_X,
  WORLD_H, WORLD_W, clamp, mulberry32,
} from './config.js';

const CITY_SEED = 1337;

// Block (column, row) of each story place, in road-gap coordinates.
const PARK_BLOCK = { col: 2, row: 2 };
const HOSPITAL_BLOCK = { col: 5, row: 0 };
const GARAGE_BLOCK = { col: 1, row: 4 };
const SAFEHOUSE_BLOCK = { col: 6, row: 3 };
const HARBOUR_BLOCK = { col: 6, row: 4 };

export function createWorld() {
  const rng = mulberry32(CITY_SEED);
  const buildings = [];
  const trees = [];
  const parks = [];
  const half = ROAD_W / 2;

  function blockRect(col, row) {
    return {
      x: ROAD_X[col] + half + 8,
      y: ROAD_Y[row] + half + 8,
      w: ROAD_X[col + 1] - ROAD_X[col] - ROAD_W - 16,
      h: ROAD_Y[row + 1] - ROAD_Y[row] - ROAD_W - 16,
    };
  }

  function addBuilding(x, y, w, h, kind, color, label) {
    buildings.push({ x, y, w, h, kind, color, label: label || '' });
  }

  // One or two buildings per ordinary block, split along its longer side.
  for (let col = 0; col < ROAD_X.length - 1; col += 1) {
    for (let row = 0; row < ROAD_Y.length - 1; row += 1) {
      const block = blockRect(col, row);
      const special =
        (col === PARK_BLOCK.col && row === PARK_BLOCK.row) ||
        (col === HOSPITAL_BLOCK.col && row === HOSPITAL_BLOCK.row) ||
        (col === GARAGE_BLOCK.col && row === GARAGE_BLOCK.row) ||
        (col === SAFEHOUSE_BLOCK.col && row === SAFEHOUSE_BLOCK.row) ||
        (col === HARBOUR_BLOCK.col && row === HARBOUR_BLOCK.row);
      if (special) continue;
      const two = rng() < 0.55;
      const colorA = COLORS.roof[Math.floor(rng() * COLORS.roof.length)];
      const colorB = COLORS.roof[Math.floor(rng() * COLORS.roof.length)];
      if (two && block.w > block.h) {
        const split = block.w * (0.42 + rng() * 0.16);
        addBuilding(block.x, block.y, split - 8, block.h, 'building', colorA);
        addBuilding(block.x + split + 8, block.y, block.w - split - 8, block.h, 'building', colorB);
      } else if (two) {
        const split = block.h * (0.42 + rng() * 0.16);
        addBuilding(block.x, block.y, block.w, split - 8, 'building', colorA);
        addBuilding(block.x, block.y + split + 8, block.w, block.h - split - 8, 'building', colorB);
      } else {
        const w = block.w * (0.6 + rng() * 0.3);
        const h = block.h * (0.6 + rng() * 0.3);
        addBuilding(
          block.x + (block.w - w) / 2, block.y + (block.h - h) / 2,
          w, h, 'building', colorA,
        );
      }
    }
  }

  // The park: grass, trees, a pond dot.
  const park = blockRect(PARK_BLOCK.col, PARK_BLOCK.row);
  parks.push({ x: park.x, y: park.y, w: park.w, h: park.h });
  for (let i = 0; i < 12; i += 1) {
    trees.push({
      x: park.x + 20 + rng() * (park.w - 40),
      y: park.y + 20 + rng() * (park.h - 40),
      r: 10 + rng() * 8,
    });
  }

  // Story places, each a building with a letter the renderer draws.
  const hospital = blockRect(HOSPITAL_BLOCK.col, HOSPITAL_BLOCK.row);
  addBuilding(hospital.x, hospital.y, hospital.w, hospital.h, 'hospital', COLORS.hospital, 'H');
  const garage = blockRect(GARAGE_BLOCK.col, GARAGE_BLOCK.row);
  addBuilding(garage.x, garage.y, garage.w, garage.h, 'garage', COLORS.garage, 'G');
  const safehouse = blockRect(SAFEHOUSE_BLOCK.col, SAFEHOUSE_BLOCK.row);
  addBuilding(safehouse.x, safehouse.y, safehouse.w * 0.7, safehouse.h * 0.7, 'safehouse', COLORS.safehouse, 'S');
  const harbour = blockRect(HARBOUR_BLOCK.col, HARBOUR_BLOCK.row);
  addBuilding(harbour.x, harbour.y, harbour.w, harbour.h, 'harbour', COLORS.harbour, 'H');

  // A few street trees on sidewalk corners, away from the roads.
  for (let i = 0; i < 24; i += 1) {
    const cx = ROAD_X[Math.floor(rng() * ROAD_X.length)];
    const cy = ROAD_Y[Math.floor(rng() * ROAD_Y.length)];
    trees.push({
      x: clamp(cx + (rng() < 0.5 ? -1 : 1) * (half + 26), 120, WORLD_W - 20),
      y: clamp(cy + (rng() < 0.5 ? -1 : 1) * (half + 26), 20, WORLD_H - 20),
      r: 9 + rng() * 6,
    });
  }

  // Named points, all on roads, used by missions, spawns and the save.
  const points = {
    garage: { x: ROAD_X[GARAGE_BLOCK.col], y: garage.y + garage.h / 2 },
    hospital: { x: ROAD_X[HOSPITAL_BLOCK.col], y: hospital.y + hospital.h / 2 },
    safehouse: { x: ROAD_X[SAFEHOUSE_BLOCK.col], y: safehouse.y + safehouse.h / 2 },
    harbour: { x: ROAD_X[HARBOUR_BLOCK.col], y: harbour.y + harbour.h / 2 },
    downtown: { x: ROAD_X[3], y: ROAD_Y[2] },
    plaza: { x: ROAD_X[4], y: ROAD_Y[3] },
    beach: { x: ROAD_X[0], y: ROAD_Y[4] },
    northGate: { x: ROAD_X[3], y: ROAD_Y[0] },
    park: { x: park.x + park.w / 2, y: park.y + park.h / 2 },
  };

  return {
    w: WORLD_W, h: WORLD_H, buildings, trees, parks, points,
    // The intersection just south of the garage: open road in every
    // direction, so the player never starts facing a wall.
    spawn: { x: ROAD_X[GARAGE_BLOCK.col], y: ROAD_Y[ROAD_Y.length - 1] },
  };
}

export function isRoad(x, y) {
  const half = ROAD_W / 2 + 2;
  for (const cx of ROAD_X) if (Math.abs(x - cx) <= half) return true;
  for (const cy of ROAD_Y) if (Math.abs(y - cy) <= half) return true;
  return false;
}

export function isWater(x, y) {
  return x < WATER_X;
}

export function isSand(x, y) {
  return x >= WATER_X && x < SAND_X;
}

// The road centre line nearest to (x, y): which axis, which line, and the
// point on it. Traffic and spawns use this to stay on the roads.
export function nearestRoadPoint(x, y) {
  let bestV = ROAD_X[0];
  let bestVd = Math.abs(x - ROAD_X[0]);
  for (const cx of ROAD_X) {
    const d = Math.abs(x - cx);
    if (d < bestVd) { bestVd = d; bestV = cx; }
  }
  let bestH = ROAD_Y[0];
  let bestHd = Math.abs(y - ROAD_Y[0]);
  for (const cy of ROAD_Y) {
    const d = Math.abs(y - cy);
    if (d < bestHd) { bestHd = d; bestH = cy; }
  }
  if (bestVd <= bestHd) return { x: bestV, y: clamp(y, 0, WORLD_H), axis: 'v', line: bestV };
  return { x: clamp(x, 0, WORLD_W), y: bestH, axis: 'h', line: bestH };
}

export function intersections() {
  const list = [];
  for (const cx of ROAD_X) for (const cy of ROAD_Y) list.push({ x: cx, y: cy });
  return list;
}

// A random point on a random road, at least `minDist` from (cx, cy).
export function randomRoadPoint(rng, cx, cy, minDist) {
  for (let tries = 0; tries < 40; tries += 1) {
    let x;
    let y;
    if (rng() < 0.5) {
      x = ROAD_X[Math.floor(rng() * ROAD_X.length)];
      y = 60 + rng() * (WORLD_H - 120);
    } else {
      x = 220 + rng() * (WORLD_W - 280);
      y = ROAD_Y[Math.floor(rng() * ROAD_Y.length)];
    }
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy >= minDist * minDist) return { x, y };
  }
  return { x: ROAD_X[3], y: ROAD_Y[2] };
}

// Push a circle out of buildings, water and the world edge. Returns the
// corrected position; the caller decides what the bump costs.
export function collideCircle(world, x, y, r) {
  let nx = clamp(x, r, world.w - r);
  let ny = clamp(y, r, world.h - r);
  if (nx < WATER_X + r) nx = WATER_X + r;
  for (const b of world.buildings) {
    const closestX = clamp(nx, b.x, b.x + b.w);
    const closestY = clamp(ny, b.y, b.y + b.h);
    const dx = nx - closestX;
    const dy = ny - closestY;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      nx = closestX + (dx / d) * r;
      ny = closestY + (dy / d) * r;
    } else {
      // Centre inside the rect: push out along the smallest penetration.
      const pushLeft = nx - b.x + r;
      const pushRight = b.x + b.w - nx + r;
      const pushUp = ny - b.y + r;
      const pushDown = b.y + b.h - ny + r;
      const min = Math.min(pushLeft, pushRight, pushUp, pushDown);
      if (min === pushLeft) nx = b.x - r;
      else if (min === pushRight) nx = b.x + b.w + r;
      else if (min === pushUp) ny = b.y - r;
      else ny = b.y + b.h + r;
    }
  }
  return { x: nx, y: ny };
}

// Right-hand lane point for a road line and a travel direction.
export function lanePoint(axis, line, along, dir) {
  if (axis === 'v') return { x: line + (dir > 0 ? -LANE : LANE), y: along };
  return { x: along, y: line + (dir > 0 ? LANE : -LANE) };
}
