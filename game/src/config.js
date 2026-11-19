// Solmar Bay — every tuning number, colour and table lives here.
// The rest of the game reads these constants; nothing else hard-codes
// magic numbers for balance, positions or prices.

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
export function lerp(a, b, t) {
  return a + (b - a) * t;
}
export function dist2(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}
export function dist(ax, az, bx, bz) {
  return Math.sqrt(dist2(ax, az, bx, bz));
}
export function angleTo(ax, az, bx, bz) {
  return Math.atan2(bx - ax, bz - az);
}
// Wrap an angle to [-PI, PI].
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
// Deterministic RNG (mulberry32) so the city is identical every run.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const TUNE = {
  // player on foot
  walkSpeed: 6,
  runSpeed: 10.5,
  accel: 34,
  friction: 26,
  swimSpeed: 3.2,
  playerRadius: 0.9,
  playerHeight: 1.9,
  // cars
  carAccel: 16,
  carBrake: 26,
  carMaxSpeed: 34,
  carReverseMax: 12,
  carSteer: 1.9,
  bikeAccel: 20,
  bikeMaxSpeed: 40,
  boatAccel: 12,
  boatMaxSpeed: 24,
  planeAccel: 22,
  planeTakeoff: 45,
  planeMaxSpeed: 70,
  // wanted
  wantedDecayTime: 14, // seconds out of sight to lose one star
  copSightRange: 60,
  bustedFine: 0.2, // 20% of cash on busted
  // combat
  pistolDamage: 34,
  smgDamage: 18,
  shotgunDamage: 22, // per pellet, 6 pellets
  punchDamage: 12,
  bombDamage: 120,
  bombRadius: 9,
  // world
  cityHalf: 400,
  pedCap: 76,
  trafficCap: 32,
  parkedCap: 31,
  batchCap: 1600, // max dynamic boxes drawn per frame
  // misc
  interactRange: 4.5,
  pickupRadius: 2.2,
  cashDropMin: 10,
  cashDropMax: 50,
  // weather + day/night
  dayLengthSec: 720, // real seconds per game day
  weatherMinSec: 90,
  weatherMaxSec: 180,
  rainDrops: 100, // max visible rain drops (perf cap)
  // garage + side activities
  repaintPrice: 50,
  snackPrice: 3,
  snackHeal: 15,
  fishMin: 5,
  fishMax: 15,
  fishTime: 3, // seconds to catch a fish
  // police helicopter
  heliAltitude: 80,
  heliSpeed: 22,
  // training
  rangeReward: 80,
  swimReward: 100,
  slalomReward: 150,
  fireReward: 150,
};

// Palette. Colours are [r, g, b] in 0..1 (values above 1.0 read as glow
// for neon signs at sunset/night).
export const COL = {
  sky: [0.98, 0.72, 0.55], // warm peach sunset base
  skyDawn: [0.92, 0.62, 0.55],
  skyDay: [0.55, 0.78, 0.95],
  skyGolden: [1.0, 0.62, 0.38], // golden hour, 17:00
  skySunset: [1.0, 0.45, 0.3], // peak sunset, 18:00
  skyDusk: [0.75, 0.35, 0.5], // pink afterglow, 18:45
  skyNight: [0.07, 0.09, 0.2],
  fogDay: [0.75, 0.82, 0.9],
  fogNight: [0.1, 0.12, 0.22],
  road: [0.16, 0.16, 0.18],
  roadLine: [0.95, 0.8, 0.2],
  sidewalk: [0.55, 0.55, 0.58],
  sand: [0.93, 0.82, 0.6],
  water: [0.15, 0.45, 0.65],
  grass: [0.35, 0.6, 0.3],
  trunk: [0.4, 0.28, 0.16],
  leaf: [0.2, 0.55, 0.25],
  palmLeaf: [0.25, 0.65, 0.3],
  building: [0.75, 0.72, 0.68],
  glass: [0.4, 0.65, 0.85],
  neon: [
    [1.0, 0.25, 0.6],
    [0.2, 0.9, 1.0],
    [1.0, 0.75, 0.15],
    [0.5, 1.0, 0.4],
    [0.9, 0.4, 1.0],
  ],
  carPaint: [
    [0.85, 0.15, 0.15],
    [0.15, 0.35, 0.85],
    [0.95, 0.75, 0.15],
    [0.2, 0.7, 0.3],
    [0.9, 0.9, 0.9],
    [0.1, 0.1, 0.12],
    [0.95, 0.45, 0.1],
    [0.5, 0.2, 0.7],
  ],
  skin: [
    [0.95, 0.8, 0.65],
    [0.8, 0.6, 0.45],
    [0.6, 0.45, 0.32],
    [0.95, 0.7, 0.55],
  ],
  // Hair colours for the ped variety pass (visual overhaul): each
  // ped gets one, plus a hair style (cap / long / mohawk / buzz /
  // ponytail) that changes the shape of the single hair box.
  hair: [
    [0.1, 0.1, 0.12],
    [0.25, 0.18, 0.1],
    [0.5, 0.35, 0.2],
    [0.85, 0.75, 0.5],
    [0.7, 0.7, 0.72],
    [0.9, 0.15, 0.15],
  ],
  shirt: [
    [0.9, 0.9, 0.9],
    [0.95, 0.75, 0.15],
    [0.1, 0.7, 0.7],
    [1.0, 0.25, 0.6],
    [0.2, 0.4, 0.95],
    [0.85, 0.2, 0.2],
  ],
};

// The five story chapters, in order.
export const CHAPTERS = [
  {
    id: 1,
    title: 'Chapter 1 — First Wheels',
    intro:
      'Solmar Bay. Sun, sand, and no money in your pocket. Rico says a car is waiting on the street — take it, and bring it to the garage on Bay Street.',
    objective: 'Steal a car and drive to the garage.',
    reward: 200,
  },
  {
    id: 2,
    title: 'Chapter 2 — The Package',
    intro:
      'Rico trusts you now. Pick up the package at the harbour docks and deliver it to the hideout before the timer runs out. Stay off the police radar.',
    objective: 'Pick up the package, deliver it before time runs out.',
    reward: 400,
  },
  {
    id: 3,
    title: 'Chapter 3 — Getaway',
    intro:
      'The drop went wrong. Three stars of heat and every cop in Solmar Bay is on you. Lose them — hide, outrun, outsmart.',
    objective: 'Escape the 3-star wanted level.',
    reward: 500,
  },
  {
    id: 4,
    title: 'Chapter 4 — Night Run',
    intro:
      'The crew needs a driver for the night. Pick up three passengers across the city and drop each one where they need to go. Tips included.',
    objective: 'Pick up 3 passengers and drop them off.',
    reward: 600,
  },
  {
    id: 5,
    title: 'Chapter 5 — The Big One',
    intro:
      'The harbour heist. Grab the cash from the vault container, lose four stars of heat, and reach the safehouse. This is the one that sets you up for life.',
    objective: 'Grab the cash, lose the heat, reach the safehouse.',
    reward: 1500,
  },
];

// Side jobs (repeatable). Each has a marker, a reward and a short label.
export const SIDE_JOBS = [
  { id: 'taxi', label: 'Taxi fare', reward: 120, desc: 'Drive a passenger to the marker.' },
  { id: 'courier', label: 'Courier run', reward: 150, desc: 'Deliver the parcel across town.' },
  { id: 'trial', label: 'Time trial', reward: 180, desc: 'Hit every checkpoint before time runs out.' },
  { id: 'turf', label: 'Turf clear-out', reward: 250, desc: 'Clear the rival gang out of the turf.' },
  { id: 'gangrun', label: 'Gang delivery', reward: 200, desc: 'Deliver the goods for your crew.' },
];

// Food shops: name, menu prices, heal values.
// Points sit at the shop FRONTS (just outside the shop building, on
// standable ground) — never inside a building collider.
export const FOOD_MENU = [
  { name: 'Snack', price: 5, heal: 10, armour: 0 },
  { name: 'Meal', price: 10, heal: 25, armour: 0 },
  { name: 'Feast', price: 15, heal: 100, armour: 25 },
];
export const FOOD_SHOPS = [
  // Pizza/Burger sit 5m south of their interior doors so the 5m food
  // radius and the 4m door radius do not overlap at the point itself.
  { name: 'Pizza Palace', x: -60, z: -27, colour: [0.9, 0.3, 0.2] },
  { name: 'Burger Barn', x: 60, z: -23, colour: [0.95, 0.6, 0.1] },
  { name: "Clucky's Chicken", x: -40, z: 70, colour: [0.95, 0.8, 0.2] },
  { name: 'Donut Dock', x: 40, z: 132, colour: [0.95, 0.5, 0.7] },
  { name: 'Taco Tide', x: 120, z: 68, colour: [0.4, 0.8, 0.3] },
];

// Outfit shop options. Each part cycles through these; buying costs cash.
export const OUTFIT = {
  hair: [
    { name: 'Black crop', price: 0, colour: [0.1, 0.1, 0.12] },
    { name: 'Blonde buzz', price: 20, colour: [0.95, 0.85, 0.4] },
    { name: 'Red mohawk', price: 40, colour: [0.9, 0.15, 0.15] },
    { name: 'Blue spikes', price: 40, colour: [0.2, 0.4, 0.95] },
  ],
  shirt: [
    { name: 'White tee', price: 0, colour: [0.9, 0.9, 0.9] },
    { name: 'Gold jacket', price: 50, colour: [0.95, 0.75, 0.15] },
    { name: 'Teal hoodie', price: 50, colour: [0.1, 0.7, 0.7] },
    { name: 'Neon pink', price: 60, colour: [1, 0.25, 0.6] },
  ],
  pants: [
    { name: 'Jeans', price: 0, colour: [0.25, 0.35, 0.6] },
    { name: 'Black cargos', price: 30, colour: [0.15, 0.15, 0.18] },
    { name: 'White shorts', price: 30, colour: [0.92, 0.92, 0.9] },
  ],
  shoes: [
    { name: 'Sneakers', price: 0, colour: [0.9, 0.9, 0.9] },
    { name: 'Gold kicks', price: 35, colour: [0.95, 0.75, 0.15] },
    { name: 'Red runners', price: 35, colour: [0.9, 0.15, 0.2] },
  ],
};

// Respect levels and unlocks. Respect grows with missions (+50) and
// side jobs (+25), fares (+10), fires (+15) and training (+10).
// Unlocks spawn once, tracked in state.flags.
export const RESPECT = {
  levels: [
    { min: 0, name: 'Nobody' },
    { min: 100, name: 'Hustler' },
    { min: 250, name: 'Shot Caller' },
    { min: 500, name: 'Kingpin' },
    { min: 1000, name: 'Legend' },
  ],
  unlocks: [
    { min: 100, flag: 'smgUnlocked', label: 'SMG at the shooting range' },
    { min: 250, flag: 'shotgunUnlocked', label: 'Shotgun at the harbour' },
    { min: 500, flag: 'sportsCarSpawned', label: 'Solmar Comet sports car at the garage' },
  ],
};

export function respectLevel(rep) {
  let lvl = RESPECT.levels[0];
  for (const l of RESPECT.levels) if (rep >= l.min) lvl = l;
  const next = RESPECT.levels.find((l) => l.min > rep);
  return { name: lvl.name, min: lvl.min, next: next ? next.name : null, nextMin: next ? next.min : null };
}

// Original car model names (nothing from Rockstar).
export const CAR_NAMES = [
  'Solmar Comet', 'Bay Runner', 'Harbour Hawk', 'Sunset Cruiser',
  'Palm GT', 'Tide Runner', 'Vice Sprint', 'Coral Coupe',
  'Neon Sting', 'Dune Drifter', 'Marina GT', 'Coconut Cruiser',
];

// Crime table — wanted stars per crime, GTA-style. Every crime site
// in the game must call commitCrime with one of these keys.
export const CRIME = {
  stealCar: { stars: 1, label: 'Grand theft auto' },
  punchPed: { stars: 1, label: 'Assault' },
  killPed: { stars: 2, label: 'Manslaughter' },
  killGang: { stars: 2, label: 'Gang murder' },
  armedRobbery: { stars: 2, label: 'Armed robbery' },
  killCop: { stars: 3, label: 'Cop killing' },
  explosion: { stars: 3, label: 'Explosion' },
  massRampage: { stars: 4, label: 'Mass rampage' },
  copMassacre: { stars: 5, label: 'Cop massacre' },
};

// Radio stations — all original synth songs, nothing copyrighted.
// A song is 32 sequencer steps (4 bars of 8th notes).
export const STATIONS = [
  {
    name: 'BAY FM', freq: '94.7', genre: 'Sunset Drive',
    songs: [
      { title: 'Golden Hour Drive', notes: [0, 3, 5, 7, 5, 3, 2, 0] },
      { title: 'Malecón Lights', notes: [5, 7, 9, 7, 5, 4, 2, 4] },
    ],
  },
  {
    name: 'PALM 102.3', freq: '102.3', genre: 'Tropical House',
    songs: [
      { title: 'Coconut Radio', notes: [0, 2, 4, 5, 7, 5, 4, 2] },
      { title: 'Beachfront', notes: [7, 5, 4, 2, 0, 2, 4, 5] },
    ],
  },
  {
    name: 'NEON 89.1', freq: '89.1', genre: 'Electro',
    songs: [
      { title: 'Night Circuit', notes: [0, 0, 3, 0, 5, 0, 7, 5] },
      { title: 'Chrome Hearts', notes: [9, 7, 5, 7, 9, 7, 5, 4] },
    ],
  },
  {
    name: 'CORAL 105.5', freq: '105.5', genre: 'Chill',
    songs: [
      { title: 'Slow Tide', notes: [4, 2, 0, 2, 4, 5, 4, 2] },
      { title: 'Harbour Moon', notes: [2, 4, 5, 4, 2, 0, 2, 4] },
    ],
  },
];
export const SONG_STEPS = 32;

// Two rival gangs (original names/colours).
export const GANGS = {
  kings: { name: 'Bay Kings', colour: [0.95, 0.75, 0.15], turf: { x: 0, z: -100, hx: 160, hz: 140 } },
  sharks: { name: 'Harbour Sharks', colour: [0.1, 0.7, 0.7], turf: { x: 320, z: -100, hx: 90, hz: 110 } },
};

// City districts, for the HUD location name.
export function districtAt(x, z) {
  if (x < -300) return 'Solmar Beach';
  if (x > 300) return 'Harbour District';
  if (z < -280 && x > 120) return 'Airport';
  if (x >= -160 && x <= 160 && z >= -220 && z <= 60) return 'Downtown';
  if (z > 140) return 'Southside';
  if (x < -160) return 'West End';
  return 'Bay Street';
}
