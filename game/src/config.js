// Solmar Bay — shared constants, tuning and lookup tables.
// Written fresh for rebuild #18. Everything the other modules
// need to agree on lives here: colours, spawn points, shops,
// radio stations, respect ladder, chapters and crime stars.

// Deterministic RNG (mulberry32) so the world spawns identically
// every time — respawnWorld must rebuild the exact boot-time city.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const COL = {
  hair: [
    [0.1, 0.1, 0.1],
    [0.4, 0.25, 0.1],
    [0.9, 0.15, 0.15],
    [0.95, 0.8, 0.4],
    [0.6, 0.6, 0.6],
    [0.2, 0.2, 0.5],
  ],
  water: [0.2, 0.65, 0.9],
  grass: [0.42, 0.62, 0.38],
  road: [0.16, 0.16, 0.18],
  roadLine: [0.95, 0.8, 0.1],
  sidewalk: [0.68, 0.68, 0.66],
  sand: [0.9, 0.8, 0.55],
  glass: [0.4, 0.65, 0.85],
  barrel: [0.85, 0.2, 0.15],
  barrelRust: [0.75, 0.3, 0.15],
  palmLeaf: [0.25, 0.65, 0.2],
  palmTrunk: [0.55, 0.4, 0.25],
  coconut: [0.5, 0.35, 0.2],
  kingsGold: [0.95, 0.75, 0.1],
  sharksTeal: [0.1, 0.7, 0.7],
  copNavy: [0.1, 0.15, 0.5],
  taxiYellow: [1, 0.85, 0.1],
  carGlass: [0.35, 0.6, 0.9],
  cabinSilver: [0.88, 0.89, 0.92],
  wheelBlack: [0.08, 0.08, 0.1],
};

export const SPAWNS = {
  player: { x: 0, z: 20 },
  hospital: { x: -150, z: 100 },
  garageDoor: { x: 150, z: -126 },
  elevatorTower: { x: 30, z: -72 },
  trainStation: { x: 0, z: 300 },
  fishing: { x: -350, z: 60 },
  beachHouse: { x: -320, z: 60 },
  outfitDoor: { x: 90, z: 30 },
  shootingRange: { x: -90, z: -150 },
  slalomStart: { x: 180, z: 200 },
  swimBuoy: { x: -380, z: 100 },
  fireStation: { x: -150, z: -150 },
};

export const FOOD_MENU = [
  { name: 'Snack', price: 5, heal: 10, armour: 0 },
  { name: 'Meal', price: 10, heal: 30, armour: 0 },
  { name: 'Feast', price: 15, heal: 100, armour: 25 },
];

export const FOOD_SHOPS = [
  { name: 'Pizza Palace', x: 50, z: 90 },
  { name: 'Burger Barn', x: -50, z: 30 },
  { name: 'Cluckin Chicken', x: -40, z: 70 },
  { name: 'Taco Truck', x: 150, z: 30 },
  { name: 'Sushi Bar', x: -150, z: -90 },
];

export const OUTFIT = {
  hair: [
    { name: 'Black Buzz', price: 20, color: [0.1, 0.1, 0.1] },
    { name: 'Brown Spikes', price: 30, color: [0.4, 0.25, 0.1] },
    { name: 'Red Mohawk', price: 40, color: [0.9, 0.15, 0.15] },
    { name: 'Blonde Fade', price: 50, color: [0.95, 0.8, 0.4] },
  ],
  shirt: [
    { name: 'White Tee', price: 25, color: [0.95, 0.95, 0.95] },
    { name: 'Gold Chain', price: 50, color: [0.95, 0.75, 0.1] },
    { name: 'Neon Tank', price: 35, color: [0.2, 0.9, 0.5] },
    { name: 'Palm Shirt', price: 45, color: [0.2, 0.6, 0.4] },
  ],
  pants: [
    { name: 'Jeans', price: 20, color: [0.2, 0.3, 0.6] },
    { name: 'Cargo', price: 30, color: [0.4, 0.45, 0.3] },
    { name: 'Shorts', price: 25, color: [0.9, 0.9, 0.8] },
  ],
  shoes: [
    { name: 'White Sneakers', price: 25, color: [0.95, 0.95, 0.95] },
    { name: 'Gold Kicks', price: 35, color: [0.95, 0.75, 0.1] },
    { name: 'Boots', price: 40, color: [0.3, 0.2, 0.1] },
  ],
};

export const STATIONS = [
  {
    name: 'BAY FM', freq: '94.7',
    songs: [
      { title: 'Golden Hour Drive', notes: [0, 3, 5, 7, 10, 12, 15, 17] },
      { title: 'Sunset Cruise', notes: [0, 2, 4, 7, 9, 12, 14, 16] },
    ],
  },
  {
    name: 'PALM', freq: '102.3',
    songs: [
      { title: 'Coconut Radio', notes: [0, 4, 7, 9, 12, 16, 19, 21] },
      { title: 'Island Breeze', notes: [0, 3, 7, 10, 12, 15, 19, 22] },
    ],
  },
  {
    name: 'NEON', freq: '89.1',
    songs: [
      { title: 'Night Circuit', notes: [0, 1, 3, 6, 8, 11, 13, 15] },
      { title: 'Midnight Drive', notes: [0, 2, 5, 7, 10, 12, 15, 17] },
    ],
  },
  {
    name: 'CORAL', freq: '105.5',
    songs: [
      { title: 'Slow Tide', notes: [0, 5, 7, 12, 14, 17, 19, 24] },
      { title: 'Deep Blue', notes: [0, 4, 9, 11, 14, 16, 21, 23] },
    ],
  },
];

export const SONG_STEPS = 32;

export const TUNE = {
  walkSpeed: 4,
  runSpeed: 8,
  dayLengthSec: 720,
  carMaxSpeed: 28,
  bikeMaxSpeed: 35,
  carAccel: 12,
  carBrake: 30,
  batchCap: 1600,
  heliAltitude: 80,
};

export const RESPECT = {
  levels: [
    { min: 0, name: 'Nobody' },
    { min: 100, name: 'Hustler' },
    { min: 250, name: 'Shot Caller' },
    { min: 500, name: 'Kingpin' },
    { min: 1000, name: 'Legend' },
  ],
  unlocks: [
    { min: 100, flag: 'smgUnlocked' },
    { min: 250, flag: 'shotgunUnlocked' },
    { min: 500, flag: 'sportsCarSpawned' },
  ],
};

export function respectLevel(r) {
  let cur = RESPECT.levels[0];
  let nxt = RESPECT.levels[1] || null;
  for (let i = 0; i < RESPECT.levels.length; i++) {
    if (r >= RESPECT.levels[i].min) {
      cur = RESPECT.levels[i];
      nxt = RESPECT.levels[i + 1] || null;
    }
  }
  return { name: cur.name, next: nxt ? nxt.name : null, min: cur.min };
}

export const CHAPTERS = [
  { n: 1, title: 'Chapter 1 — First Wheels', reward: 200, objective: 'Drive the Comet to the garage', text: 'Rico needs wheels, fast. Steal the red Comet parked north-west of the beach road and drive it to the garage. Rico is counting on you — do not scratch the paint.' },
  { n: 2, title: 'Chapter 2 — Harbor Run', reward: 400, objective: 'Pick up the package at the harbour and deliver it', timeLimit: 120, text: 'Rico has a package waiting at the north docks. Pick it up and deliver it to the harbour warehouse before the clock runs out.' },
  { n: 3, title: 'Chapter 3 — Heat Wave', reward: 500, objective: 'Lose the cops — get your wanted level to zero', text: 'The heat is on. Break line of sight, stay out of the cops\' way, and get your wanted level back to zero.' },
  { n: 4, title: 'Chapter 4 — Four Fares', reward: 600, objective: 'Give 3 passengers a ride around town', text: 'The taxi game pays. Pick up three passengers across the city and drop them where they need to go.' },
  { n: 5, title: 'Chapter 5 — The Big One', reward: 1500, objective: 'Rob the vault, then reach the safehouse clean', text: 'One last job. Crack the vault at the old bank, grab the cut, lose the heat, and reach the safehouse. Then Solmar Bay is yours.' },
];

export const CRIME = {
  stealCar: { stars: 1 },
  assault: { stars: 1 },
  killPed: { stars: 2 },
  killGang: { stars: 2 },
  carjacking: { stars: 2 },
  killCop: { stars: 3 },
  explosion: { stars: 3 },
  rampage: { stars: 4 },
  copMassacre: { stars: 5 },
};
