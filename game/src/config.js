// Solmar Bay — every tuning number and colour in one place.
// Pure data and tiny helpers: no DOM, no imports, safe to load anywhere.
export const VIEW_W = 1280;
export const VIEW_H = 720;

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const WORLD_W = 3200;
export const WORLD_H = 2400;

// Road grid: centre lines of the vertical and horizontal roads.
export const ROAD_X = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
export const ROAD_Y = [200, 600, 1000, 1400, 1800, 2200];
export const ROAD_W = 96; // full asphalt width
export const LANE = 22; // right-hand lane offset from a road centre line

// West edge: open water, then sand.
export const WATER_X = 90; // x < 90 is water (impassable)
export const SAND_X = 200; // 90..200 is beach sand

export const COLORS = {
  grass: '#7fae5a',
  grassDark: '#74a24f',
  sand: '#e8d5a0',
  water: '#3f8fd2',
  waterDeep: '#2f74b8',
  road: '#3c3f46',
  roadEdge: '#565a63',
  dash: '#e8e3c8',
  sidewalk: '#b9b3a4',
  roof: ['#c96f4a', '#4a7a96', '#8a6fa8', '#b89a4a', '#5a8a6a', '#96604a'],
  hospital: '#e8e8e8',
  garage: '#5a6a7a',
  safehouse: '#a87a4a',
  harbour: '#6a5a8a',
  park: '#5f9e4a',
  tree: '#3f7a34',
  player: '#f2c14e',
  police: '#2f6fd2',
  policeDark: '#1e4a96',
  pedShirt: ['#d24a4a', '#4a8ad2', '#4ad27a', '#d2a24a', '#8a4ad2', '#e8e8e8'],
  hudBg: 'rgba(12, 16, 22, 0.72)',
  hudText: '#f2f0e8',
  gold: '#f2c14e',
  red: '#e04030',
  green: '#4ad27a',
  blue: '#4a8ad2',
};

export const TUNING = {
  walkSpeed: 210,
  runSpeed: 330,
  playerRadius: 12,
  carRadius: 18,
  carMaxSpeed: 520,
  carAccel: 340,
  carBrake: 520,
  carReverseMax: 190,
  carSteer: 2.6,
  carDrag: 0.55,
  handbrakeDrag: 2.4,
  trafficSpeed: 150,
  trafficMax: 190,
  pedSpeed: 55,
  pedFleeSpeed: 170,
  copRunSpeed: 265,
  policeCarSpeed: 545,
  punchRange: 58,
  punchDamage: 12,
  punchCooldown: 0.45,
  maxHealth: 100,
  maxArmor: 50,
  maxWanted: 5,
  wantedDecayDelay: 6,
  wantedDecayEvery: 3,
  bustedCashLoss: 0.2,
};

export const CAR_COLORS = [
  '#c23b2e', '#2e6fc2', '#e0a32e', '#3aa655', '#7a4a9e',
  '#c2c2c2', '#22262c', '#d2691e', '#4a9e9e', '#b03060',
];

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save is kept between visits (this browser only). */
export const SAVE_KEY = 'solmar-bay-save-v1';

// A tiny deterministic RNG (mulberry32) so the city layout is the same
// on every load. Gameplay randomness uses Math.random.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

// Shortest signed turn from angle `from` towards angle `to`.
export function angleDiff(from, to) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
