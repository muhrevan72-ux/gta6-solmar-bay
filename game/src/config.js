// Solmar Bay — tuning, tables and constants (rebuild #14).
// One file holds every number the systems share, so a balance
// change is a one-line edit here and never a hunt through logic.

// ---------- movement / world tuning ----------
export const TUNE = {
  walkSpeed: 4,
  runSpeed: 8,
  carMaxSpeed: 28,
  bikeMaxSpeed: 38,
  boatMaxSpeed: 22,
  planeMaxSpeed: 60,
  dayLengthSec: 720, // 24 game hours per 720 real seconds (120x)
  batchCap: 1600, // max dynamic boxes per frame
  staticCap: 1600, // max static boxes (19200 tris)
  heliAltitude: 80,
  copFootSpeed: 6,
  copCarSpeed: 26,
  trafficSpeed: 12,
  pedWalkMin: 1.5,
  pedWalkMax: 3.2,
  spawnGraceSec: 5, // no damage right after (re)spawn
  gangSafeDist: 40, // gang spawns stay this far from the player spawn
  wantedDecaySec: 14, // out of sight this long loses one star
  sightRange: 60, // cops within this range keep the wanted level hot
};

// ---------- crime table (wanted stars per crime) ----------
export const CRIME = {
  stealCar: { stars: 1 },
  assault: { stars: 1 },
  killPed: { stars: 2 },
  killGang: { stars: 2 },
  robbery: { stars: 2 },
  killCop: { stars: 3 },
  explosion: { stars: 3 },
  rampage: { stars: 4 },
  copMassacre: { stars: 5 },
};

// ---------- story chapters ----------
export const CHAPTERS = [
  { n: 1, title: 'Chapter 1 — First Wheels', reward: 200, respect: 50, text: 'Steal a car and drive to the garage to meet Darius.' },
  { n: 2, title: 'Chapter 2 — The Package', reward: 400, respect: 50, text: 'Pick up the package at the harbour and deliver it to the hideout before the timer runs out.' },
  { n: 3, title: 'Chapter 3 — Getaway', reward: 500, respect: 100, text: 'Lose the heat. Break line of sight and wait for the stars to fade.' },
  { n: 4, title: 'Chapter 4 — Night Run', reward: 600, respect: 150, text: 'Pick up three passengers across the city, one after another.' },
  { n: 5, title: 'Chapter 5 — The Big One', reward: 1500, respect: 200, text: 'Grab the vault cash at the harbour, lose the 4-star heat, reach the safehouse.' },
];

// ---------- respect ladder ----------
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

export function respectLevel(rep) {
  let cur = RESPECT.levels[0];
  let next = null;
  for (let i = 0; i < RESPECT.levels.length; i++) {
    if (rep >= RESPECT.levels[i].min) {
      cur = RESPECT.levels[i];
      next = RESPECT.levels[i + 1] || null;
    }
  }
  return { name: cur.name, min: cur.min, next: next ? next.name : null };
}

// ---------- radio (original synth songs, no copyrighted music) ----------
export const SONG_STEPS = 32;
export const STATIONS = [
  {
    name: 'BAY FM', freq: '94.7',
    songs: [
      { title: 'Golden Hour Drive', notes: [72, 76, 79, 76, 74, 76, 79, 81] },
      { title: 'Sunset Boulevard', notes: [69, 72, 76, 74, 72, 69, 67, 69] },
    ],
  },
  {
    name: 'PALM', freq: '102.3',
    songs: [
      { title: 'Coconut Radio', notes: [76, 79, 81, 79, 76, 74, 76, 79] },
      { title: 'Island Breeze', notes: [74, 77, 81, 79, 77, 74, 72, 74] },
    ],
  },
  {
    name: 'NEON', freq: '89.1',
    songs: [
      { title: 'Night Circuit', notes: [69, 72, 74, 77, 76, 74, 72, 69] },
      { title: 'Vice Lights', notes: [71, 74, 78, 76, 74, 71, 69, 71] },
    ],
  },
  {
    name: 'CORAL', freq: '105.5',
    songs: [
      { title: 'Slow Tide', notes: [67, 71, 74, 71, 69, 67, 64, 67] },
      { title: 'Beach Comber', notes: [69, 73, 76, 73, 71, 69, 66, 69] },
    ],
  },
];

// ---------- spawn points (all on open, standable ground) ----------
// hospital respawn: east of the hospital building, on the street,
// clear of every collider and off the road grid.
// Weapons: index 0 pistol, 1 SMG (respect 100), 2 shotgun (respect 250).
export const WEAPONS = [
  { name: 'Pistol', damage: 34, range: 60, cooldown: 0.3 },
  { name: 'SMG', damage: 18, range: 50, cooldown: 0.08 },
  { name: 'Shotgun', damage: 45, range: 25, cooldown: 0.7 },
];

export const SPAWNS = {
  player: { x: 0, z: 20 },
  hospital: { x: -110, z: 150 },
  garageDoor: { x: 150, z: -128 },
  elevatorTower: { x: 30, z: -90 },
  trainStation: { x: 0, z: 300 },
  fishing: { x: -330, z: 100 },
  beachHouse: { x: -300, z: 60 },
  outfitDoor: { x: -120, z: 52 },
  shootingRange: { x: 240, z: 200 },
  swimBuoy: { x: -370, z: 100 },
  slalomStart: { x: 180, z: 200 },
  fireStation: { x: -60, z: 150 },
};

// ---------- palette ----------
export const COL = {
  water: [0.2, 0.65, 0.9],
  grass: [0.42, 0.62, 0.38],
  road: [0.16, 0.16, 0.18],
  roadLine: [0.95, 0.8, 0.2],
  glass: [0.4, 0.65, 0.85],
  palmLeaf: [0.25, 0.65, 0.25],
  coconut: [0.5, 0.35, 0.2],
  barrelRed: [0.85, 0.2, 0.15],
  barrelRust: [0.75, 0.3, 0.15],
  taxiYellow: [1, 0.85, 0.1],
  copNavy: [0.1, 0.15, 0.5],
  kingsGold: [0.95, 0.75, 0.2],
  sharksTeal: [0.1, 0.7, 0.7],
  hair: [
    [0.08, 0.06, 0.05],
    [0.35, 0.22, 0.1],
    [0.85, 0.7, 0.3],
    [0.9, 0.1, 0.1],
    [0.15, 0.15, 0.2],
    [0.6, 0.6, 0.65],
  ],
  skin: [
    [0.85, 0.65, 0.5],
    [0.7, 0.5, 0.35],
    [0.55, 0.38, 0.26],
    [0.95, 0.8, 0.65],
  ],
  shirt: [
    [0.9, 0.9, 0.9],
    [0.95, 0.75, 0.2],
    [0.1, 0.7, 0.7],
    [0.9, 0.4, 0.6],
    [0.2, 0.4, 0.9],
    [0.3, 0.7, 0.3],
  ],
};

// ---------- food ----------
export const FOOD_MENU = [
  { name: 'Snack', price: 5, heal: 10, armour: 0 },
  { name: 'Meal', price: 10, heal: 25, armour: 0 },
  { name: 'Feast', price: 15, heal: 100, armour: 25 },
];

// Shop fronts: standable points just outside each shop's door,
// clear of buildings and roads so the menu is reachable on foot.
export const FOOD_SHOPS = [
  { name: 'Pizza Palace', x: -120, z: 30 },
  { name: 'Burger Barn', x: 60, z: -90 },
  { name: "Clucky's Chicken", x: -40, z: 70 },
  { name: 'Donut Dock', x: 120, z: 90 },
  { name: 'Taco Tide', x: -180, z: -60 },
];

// ---------- outfit catalogue ----------
// Prices are chosen so hair 2 + shirt 1 + pants 1 + shoes 1 = $155.
export const OUTFIT = {
  hair: [
    { name: 'Buzz Cut', price: 0, colour: [0.1, 0.1, 0.1] },
    { name: 'Spiky', price: 20, colour: [0.2, 0.15, 0.1] },
    { name: 'Red Mohawk', price: 40, colour: [0.9, 0.1, 0.1] },
    { name: 'Blonde Fade', price: 30, colour: [0.9, 0.8, 0.4] },
  ],
  shirt: [
    { name: 'White Tee', price: 0, colour: [0.9, 0.9, 0.9] },
    { name: 'Gold Chain Tee', price: 50, colour: [0.95, 0.75, 0.2] },
    { name: 'Teal Shirt', price: 40, colour: [0.1, 0.7, 0.7] },
    { name: 'Pink Shirt', price: 45, colour: [0.9, 0.4, 0.6] },
  ],
  pants: [
    { name: 'Jeans', price: 0, colour: [0.2, 0.3, 0.6] },
    { name: 'Black Cargo', price: 30, colour: [0.1, 0.1, 0.1] },
    { name: 'White Shorts', price: 25, colour: [0.9, 0.9, 0.85] },
  ],
  shoes: [
    { name: 'Sneakers', price: 0, colour: [0.8, 0.8, 0.8] },
    { name: 'Gold Kicks', price: 35, colour: [0.95, 0.75, 0.1] },
    { name: 'Red High-tops', price: 30, colour: [0.8, 0.1, 0.1] },
  ],
};
