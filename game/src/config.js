// Solmar Bay — tuning, colours and shared constants.
// Written fresh for the round-4 rebuild (recording 01a1f333).

export const MAP = {
  size: 800,
  half: 400,
  waterEdgeX: -360, // water is west of this x
  sandEdgeX: -320, // beach sand strip between waterEdgeX and sandEdgeX
};

export const COL = {
  sky: [0.96, 0.58, 0.38], // warm Vice City sunset
  fog: [0.93, 0.62, 0.45],
  fogNear: 120,
  fogFar: 620,
  road: [0.13, 0.13, 0.16],
  roadDash: [0.85, 0.8, 0.5],
  sidewalk: [0.62, 0.66, 0.72],
  sand: [0.92, 0.82, 0.6],
  water: [0.15, 0.45, 0.65],
  grass: [0.35, 0.62, 0.3],
  runway: [0.16, 0.16, 0.18],
  // pastel art-deco downtown palette
  buildings: [
    [0.85, 0.72, 0.58], [0.72, 0.72, 0.7], [0.78, 0.6, 0.5],
    [0.6, 0.68, 0.72], [0.88, 0.8, 0.66], [0.66, 0.58, 0.62],
    [0.9, 0.75, 0.62], [0.58, 0.64, 0.58],
  ],
  house: [
    [0.9, 0.75, 0.6], [0.75, 0.8, 0.85], [0.85, 0.65, 0.55],
    [0.7, 0.75, 0.6], [0.88, 0.82, 0.7],
  ],
  windowLit: [1.0, 0.85, 0.45],
  windowDark: [0.25, 0.3, 0.38],
  neon: [
    [1.0, 0.25, 0.55], [0.25, 0.9, 1.0], [1.0, 0.85, 0.2],
    [0.55, 1.0, 0.4], [0.9, 0.4, 1.0],
  ],
  palmTrunk: [0.5, 0.38, 0.22],
  palmLeaf: [0.25, 0.65, 0.3],
  treeTrunk: [0.45, 0.32, 0.18],
  treeLeaf: [0.3, 0.6, 0.28],
  lampPole: [0.25, 0.25, 0.28],
  lampGlow: [1.0, 0.9, 0.55],
  gangKing: [1.0, 0.8, 0.15], // Bay Kings — gold
  gangShark: [0.15, 0.75, 0.8], // Harbour Sharks — teal
  cop: [0.15, 0.25, 0.85],
  taxi: [1.0, 0.85, 0.1],
  fire: [0.9, 0.15, 0.1],
};

// Player / vehicle tuning
export const TUNE = {
  walkSpeed: 6,
  runSpeed: 11,
  swimSpeed: 3.2,
  playerAccel: 14, // eased approach rate (per second)
  playerRadius: 0.9,
  carAccel: 16,
  carBrake: 30,
  carMaxSpeed: 38,
  carMaxReverse: 12,
  carTurn: 1.9,
  bikeAccel: 22,
  bikeMaxSpeed: 48,
  bikeTurn: 2.6,
  boatAccel: 12,
  boatMaxSpeed: 26,
  boatTurn: 1.4,
  planeAccel: 18,
  planeMaxSpeed: 70,
  planeTurn: 1.2,
  trafficSpeed: 9,
  enterRadius: 5.0,
  punchRange: 2.6,
  punchDamage: 12,
  punchCooldown: 0.45,
  bombCooldown: 0.8,
  shootCooldownPistol: 0.28,
  shootCooldownSmg: 0.09,
  shootCooldownShotgun: 0.7,
  shootRange: 70,
  bombRadius: 9,
  bombDamage: 200,
  wantedDecayTime: 14, // seconds out of sight to drop a star
  bustedFine: 0.2, // 20% of cash lost when busted
};

// Story chapter rewards
export const CHAPTERS = [
  { id: 0, title: 'First Wheels', text: 'No wheels, no name. Steal a car and drive it to the garage on the east side.', reward: 200 },
  { id: 1, title: 'The Package', text: 'Pick up the package downtown and deliver it to the harbour before the timer runs out. Stay off the cops\' radar.', reward: 400 },
  { id: 2, title: 'Getaway', text: 'The heat is on — 3 stars and climbing. Lose the cops and reach the safehouse in the suburbs.', reward: 500 },
  { id: 3, title: 'Night Run', text: 'The taxi stand needs a driver. Pick up 3 passengers across the city.', reward: 600 },
  { id: 4, title: 'The Big One', text: 'The harbour heist. Grab the cash from the dock office, lose 4 stars of heat, and reach the safehouse.', reward: 1500 },
];

// Wanted stars per crime, like real GTA (crime table).
// commitCrime(type) maps a crime to the wanted level it sets (minimum).
export const CRIME_STARS = {
  stealCar: 1,
  punchPed: 1,
  assaultPed: 1,
  killPed: 2,
  killGang: 2,
  armedRobbery: 2,
  killCop: 3,
  explosion: 3,
  massRampage: 4,
  copMassacre: 5,
};

// Food shops (original names — no real brands)
export const FOOD_SHOPS = [
  { name: 'Pizza Palace', kind: 'pizza', color: [0.95, 0.55, 0.25] },
  { name: 'Burger Barn', kind: 'burger', color: [0.9, 0.35, 0.2] },
  { name: 'Clucky Chicken', kind: 'chicken', color: [0.95, 0.8, 0.3] },
  { name: 'Donut Dock', kind: 'donut', color: [0.95, 0.6, 0.75] },
  { name: 'Taco Tide', kind: 'taco', color: [0.5, 0.85, 0.35] },
];

export const FOOD_MENU = [
  { name: 'Snack', price: 5, heal: 10, armour: 0 },
  { name: 'Meal', price: 10, heal: 25, armour: 0 },
  { name: 'Feast', price: 15, heal: 100, armour: 25 },
];

// Outfit shop options (hair / shirt / pants / shoes)
export const OUTFIT = {
  hair: [
    { name: 'Black crop', color: [0.1, 0.1, 0.1], price: 0 },
    { name: 'Blond buzz', color: [0.95, 0.8, 0.4], price: 20 },
    { name: 'Red mohawk', color: [0.9, 0.2, 0.15], price: 40 },
    { name: 'Teal spikes', color: [0.1, 0.75, 0.8], price: 60 },
  ],
  shirt: [
    { name: 'White tee', color: [0.92, 0.92, 0.9], price: 0 },
    { name: 'Gold jacket', color: [1.0, 0.8, 0.15], price: 30 },
    { name: 'Teal hoodie', color: [0.15, 0.7, 0.75], price: 30 },
    { name: 'Neon pink', color: [1.0, 0.3, 0.6], price: 50 },
  ],
  pants: [
    { name: 'Blue jeans', color: [0.25, 0.35, 0.6], price: 0 },
    { name: 'Black cargos', color: [0.15, 0.15, 0.18], price: 25 },
    { name: 'White shorts', color: [0.9, 0.88, 0.8], price: 25 },
    { name: 'Camo', color: [0.4, 0.5, 0.3], price: 45 },
  ],
  shoes: [
    { name: 'Sneakers', color: [0.9, 0.9, 0.9], price: 0 },
    { name: 'Red runners', color: [0.9, 0.2, 0.2], price: 20 },
    { name: 'Gold boots', color: [1.0, 0.75, 0.2], price: 35 },
    { name: 'Teal kicks', color: [0.1, 0.7, 0.75], price: 35 },
  ],
};

export const SIDE_REWARDS = {
  taxiFare: 60,
  courier: 120,
  timeTrial: 150,
  turf: 250,
  gangRun: 200,
  fire: 150,
  range: 100,
  swim: 120,
  driveCourse: 150,
  streetRace: 300,
  beachParty: 50,
  turfWar: 250,
  trainRide: 20,
};

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; }
export function dist(ax, az, bx, bz) { return Math.sqrt(dist2(ax, az, bx, bz)); }

// Deterministic seeded RNG (mulberry32)
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
