// Solmar Bay — tuning constants and colour palette.
// 3D voxel rebuild (round 3). Every number here is original tuning.

export const WORLD = {
  size: 800,
  half: 400,
  groundY: 0,
  waterY: -0.35,
  skyTop: [0.45, 0.72, 0.95],
  fogColor: [0.62, 0.76, 0.9],
  fogNear: 120,
  fogFar: 520,
};

// Convert '#rrggbb' to [r, g, b] floats 0..1.
export function hex(h) {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export const COL = {
  grass: hex('#5da244'),
  grassDark: hex('#4c8a38'),
  sand: hex('#e8d28a'),
  asphalt: hex('#33363d'),
  asphaltLight: hex('#43474f'),
  lane: hex('#e8e4c8'),
  sidewalk: hex('#9aa0a8'),
  concrete: hex('#8d9299'),
  water: hex('#2f7fc9'),
  waterDeep: hex('#1f5fa8'),
  building: [
    hex('#c8b8a0'), hex('#b0a89a'), hex('#8fa3b8'), hex('#a89a80'),
    hex('#7d8aa0'), hex('#c0a080'), hex('#9a8a70'),
  ],
  towerGlass: hex('#7fb8d8'),
  windowLit: hex('#ffd98a'),
  windowDark: hex('#2c3e55'),
  roof: hex('#6b5d4f'),
  house: [hex('#d8a878'), hex('#c98f6a'), hex('#e0c090'), hex('#b08858')],
  treeTrunk: hex('#6a4a28'),
  treeLeaf: hex('#3e8a2f'),
  treeLeaf2: hex('#57a83c'),
  container: [hex('#c84a3a'), hex('#3a7ac8'), hex('#d8a03a'), hex('#4aa86a')],
  dockWood: hex('#8a6a44'),
  runway: hex('#2e3138'),
  runwayMark: hex('#f0ead0'),
  hangar: hex('#a8b0b8'),
  tower: hex('#d8d8d8'),
  hospital: hex('#e8e8e8'),
  hospitalCross: hex('#e04040'),
  playerSkin: hex('#e8b88a'),
  playerShirt: hex('#2e7ad8'),
  playerPants: hex('#2a2f38'),
  pedShirt: [hex('#d84a4a'), hex('#4aa84a'), hex('#d8a03a'), hex('#8a5ad8'), hex('#38b8b8')],
  copShirt: hex('#1e3a6e'),
  copHat: hex('#16294e'),
  carBody: [
    hex('#c83a2e'), hex('#2e6ac8'), hex('#e8c832'), hex('#38a858'),
    hex('#c86a2e'), hex('#8a3ac8'), hex('#d8d8d8'), hex('#22262c'),
  ],
  bikeBody: [hex('#e03a3a'), hex('#e8a03a'), hex('#3a9ad8')],
  boatBody: hex('#e8e8e8'),
  planeBody: hex('#e8e8e8'),
  planeStripe: hex('#c83a2e'),
  policeCar: hex('#e8e8e8'),
  policeStripe: hex('#1e3a6e'),
  marker: hex('#ffd23a'),
  markerGreen: hex('#4ae08a'),
  cash: hex('#4ae08a'),
  health: hex('#ff5a5a'),
  armor: hex('#5a9aff'),
  wrench: hex('#c8c8c8'),
  weapon: hex('#3a3f48'),
  bomb: hex('#222222'),
  smoke: hex('#888888'),
};

export const PLAYER = {
  walkSpeed: 6.5,
  runSpeed: 11,
  radius: 0.55,
  height: 1.8,
  accel: 40,
  health: 100,
  punchDamage: 12,
  punchRange: 1.6,
  punchCooldown: 0.45,
};

export const CAR = {
  accel: 16,
  brake: 30,
  maxSpeed: 38,
  reverseSpeed: 13,
  steer: 1.9,
  grip: 8,
  radius: 1.6,
  health: 100,
  damageSmoke: 35,
};

export const BIKE = {
  accel: 22,
  brake: 32,
  maxSpeed: 48,
  reverseSpeed: 10,
  steer: 2.6,
  grip: 6,
  radius: 1.1,
  health: 70,
  wobble: 0.35,
};

export const BOAT = {
  accel: 10,
  brake: 14,
  maxSpeed: 26,
  steer: 1.4,
  radius: 1.8,
  health: 90,
};

export const PLANE = {
  accel: 12,
  maxSpeed: 72,
  takeoffSpeed: 30,
  climbRate: 9,
  steer: 1.1,
  radius: 2.2,
  health: 120,
};

export const WEAPONS = {
  pistol: { name: 'Pistol', damage: 26, rate: 0.22, range: 95, spread: 0.012, ammo: Infinity, auto: false, color: hex('#3a3f48') },
  smg: { name: 'SMG', damage: 14, rate: 0.07, range: 75, spread: 0.05, ammo: 150, auto: true, color: hex('#2a2e36') },
  shotgun: { name: 'Shotgun', damage: 11, pellets: 6, rate: 0.95, range: 42, spread: 0.11, ammo: 30, auto: false, color: hex('#5a3a28') },
};

export const BOMB = {
  count: 3,
  maxCount: 6,
  fuse: 1.2,
  radius: 9,
  damage: 200,
  throwSpeed: 16,
};

export const WANTED = {
  decayTime: 22,        // seconds out of sight before one star drops
  hideTime: 8,          // seconds hidden before decay starts ticking faster
  stealStars: 1,
  killStars: 1,
  explosionStars: 1,
  maxStars: 5,
  // police cars chasing per star level (index = stars)
  copCars: [0, 1, 2, 3, 4, 5],
  // on-foot cops per star level
  footCops: [0, 0, 1, 2, 3, 4],
  bustFine: 0.2,        // fraction of cash lost when busted
};

export const PICKUPS = {
  cashMin: 10,
  cashMax: 50,
  healthAmount: 30,
  armorAmount: 50,
  wrenchAmount: 45,
  smgAmmo: 150,
  shotgunAmmo: 30,
  bombAdd: 2,
};

export const MISSION_REWARDS = {
  chapter1: 200,
  chapter2: 400,
  chapter3: 500,
  chapter4: 600,
  chapter5: 1500,
  taxi: 120,
  courier: 160,
  timeTrial: 200,
};

export const SAVE_KEY = 'solmar-bay-3d-save-v1';
