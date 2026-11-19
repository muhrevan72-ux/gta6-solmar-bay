// Solmar Bay — tuning, colours, chapters, menus, crime table.
// All numbers live here so the rest of the game reads them, never
// magic literals scattered through the systems.

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
  // weather + day/night (feature pass 6)
  dayLengthSec: 720, // real seconds per game day
  weatherMinSec: 90, // seconds between weather changes (min)
  weatherMaxSec: 180, // seconds between weather changes (max)
  rainDrops: 100, // max visible rain drops (perf cap)
  // garage + side activities (feature pass 6)
  repaintPrice: 50,
  snackPrice: 3,
  snackHeal: 15,
  fishMin: 5, // fishing reward ($)
  fishMax: 15,
  fishTime: 3, // seconds to catch a fish
  atmStep: 50, // ATM deposit / withdraw chunk ($)
};

export const COL = {
  sky: [0.98, 0.72, 0.55],
  fog: [0.98, 0.74, 0.58],
  water: [0.15, 0.55, 0.75],
  sand: [0.93, 0.83, 0.58],
  asphalt: [0.16, 0.16, 0.18],
  sidewalk: [0.55, 0.55, 0.58],
  lane: [0.95, 0.85, 0.3],
  grass: [0.35, 0.65, 0.3],
  buildings: [
    [0.85, 0.6, 0.55], [0.6, 0.75, 0.85], [0.9, 0.75, 0.55],
    [0.65, 0.6, 0.8], [0.85, 0.85, 0.8], [0.55, 0.8, 0.65],
    [0.95, 0.6, 0.65], [0.7, 0.7, 0.75],
  ],
  neon: [
    [1, 0.25, 0.55], [0.2, 0.9, 1], [1, 0.8, 0.2],
    [0.6, 1, 0.4], [1, 0.5, 0.1], [0.8, 0.4, 1],
  ],
  carPaint: [
    [0.85, 0.2, 0.15], [0.2, 0.45, 0.85], [0.95, 0.8, 0.15],
    [0.25, 0.8, 0.3], [0.9, 0.9, 0.9], [0.15, 0.15, 0.2],
    [0.95, 0.5, 0.1], [0.5, 0.2, 0.6],
  ],
  skin: [
    [0.95, 0.75, 0.55], [0.75, 0.55, 0.4], [0.55, 0.4, 0.3],
    [0.9, 0.65, 0.5], [0.65, 0.45, 0.32],
  ],
  shirt: [
    [0.9, 0.2, 0.25], [0.2, 0.5, 0.9], [0.2, 0.8, 0.4],
    [0.95, 0.85, 0.2], [0.9, 0.9, 0.9], [0.4, 0.3, 0.6],
    [0.95, 0.5, 0.2], [0.2, 0.7, 0.7],
  ],
};

// The five story chapters, in order. Same names and payouts as the
// design doc: First Wheels, The Package, Getaway, Night Run, The Big One.
export const CHAPTERS = [
  {
    id: 1,
    title: 'Chapter 1 — First Wheels',
    intro: 'Solmar Bay. Sun, sand, and no money in your pocket. Rico says a car is waiting on the street — take it, and bring it to the garage on Bay Street.',
    objective: 'Steal a car and drive to the garage.',
    reward: 200,
  },
  {
    id: 2,
    title: 'Chapter 2 — The Package',
    intro: 'Rico trusts you now. Pick up the package at the harbour docks and deliver it to the hideout before the timer runs out. Stay off the police radar.',
    objective: 'Pick up the package, deliver it before time runs out.',
    reward: 400,
  },
  {
    id: 3,
    title: 'Chapter 3 — Getaway',
    intro: 'The drop went wrong. Three stars of heat and every cop in Solmar Bay is on you. Lose them — hide, outrun, outsmart.',
    objective: 'Escape the 3-star wanted level.',
    reward: 500,
  },
  {
    id: 4,
    title: 'Chapter 4 — Night Run',
    intro: 'The crew needs a driver for the night. Pick up three passengers across the city and drop each one where they need to go. Tips included.',
    objective: 'Pick up 3 passengers and drop them off.',
    reward: 600,
  },
  {
    id: 5,
    title: 'Chapter 5 — The Big One',
    intro: 'The harbour heist. Grab the cash from the vault container, lose four stars of heat, and reach the safehouse. This is the one that sets you up for life.',
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
// Points sit at the shop FRONTS (just outside the shop building,
// on standable ground) — the old points sat inside the downtown
// towers, so 3 of 5 menus could never be reached on foot (closest
// approach 8m vs the 5m menu radius). Same pattern as the interior
// doors: the front is the south face of the shop's building.
export const FOOD_MENU = [
  { name: 'Snack', price: 5, heal: 10, armour: 0 },
  { name: 'Meal', price: 10, heal: 25, armour: 0 },
  { name: 'Feast', price: 15, heal: 100, armour: 25 },
];
export const FOOD_SHOPS = [
  // Pizza/Burger sit 5m south of their interior doors so the 5m
  // food radius and the 4m door radius do not overlap at the point
  // itself — at the door, E enters the shop (E at the counter inside
  // opens the same menu); at the street point, E buys food without
  // going in. The old points sat inside the shop buildings and were
  // unreachable on foot (closest approach 7.1m).
  { name: 'Pizza Palace', x: -60, z: -27, colour: [0.9, 0.3, 0.2] },
  { name: 'Burger Barn', x: 60, z: -23, colour: [0.95, 0.6, 0.1] },
  { name: "Clucky's Chicken", x: -40, z: 70, colour: [0.95, 0.8, 0.2] },
  { name: 'Donut Dock', x: 40, z: 120, colour: [0.95, 0.5, 0.7] },
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

// Respect levels and unlocks (graphics pass): respect grows with
// missions (+50) and side jobs (+25), fares (+10), fires (+15) and
// training (+10). Unlocks spawn once, tracked in state.flags.
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

// Original car model names (nothing from Rockstar). Assigned in
// makeVehicle so the HUD can show the car you are driving.
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

// Deterministic RNG (mulberry32) so the city is the same every run.
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
export function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI;
  return a + d * t;
}
