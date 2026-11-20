// Solmar Bay — tuning, palette, crimes, chapters, stations, spawns.
// Pure data + tiny helpers. No imports, no side effects.

export const TUNE = {
  walkSpeed: 4,
  runSpeed: 8,
  carMaxSpeed: 28,
  carAccel: 12,
  carTurn: 1.8,
  bikeMaxSpeed: 36,
  boatMaxSpeed: 20,
  planeMaxSpeed: 45,
  dayLengthSec: 720,
  batchCap: 1600,
  heliAltitude: 80,
};

// Colour palette (RGB 0..1). Every colour used by the world, the
// peds, the vehicles and the HUD lives here so the look stays coherent.
export const COL = {
  water: [0.2, 0.65, 0.9],
  grass: [0.42, 0.62, 0.38],
  road: [0.16, 0.16, 0.18],
  sidewalk: [0.55, 0.55, 0.55],
  sand: [0.85, 0.75, 0.55],
  asphalt: [0.16, 0.16, 0.18],
  brick: [0.6, 0.35, 0.3],
  glass: [0.4, 0.65, 0.8],
  palmLeaf: [0.25, 0.65, 0.3],
  coconut: [0.5, 0.35, 0.2],
  barrelRed: [0.85, 0.2, 0.15],
  rustRed: [0.75, 0.3, 0.15],
  taxiYellow: [1, 0.85, 0.1],
  copNavy: [0.1, 0.15, 0.5],
  kingsGold: [0.95, 0.75, 0.1],
  sharksTeal: [0.1, 0.7, 0.7],
  roadLine: [0.95, 0.8, 0.2],
  neon: [
    [1, 0.2, 0.5],
    [0.2, 0.8, 1],
    [1, 0.6, 0.1],
    [0.5, 1, 0.3],
    [0.9, 0.3, 1],
    [1, 0.9, 0.2],
  ],
  cars: [
    [0.8, 0.1, 0.1],
    [0.1, 0.3, 0.8],
    [0.9, 0.9, 0.9],
    [0.1, 0.1, 0.1],
    [0.2, 0.7, 0.3],
    [0.95, 0.75, 0.1],
    [0.1, 0.7, 0.7],
  ],
  shirts: [
    [0.9, 0.9, 0.9],
    [0.2, 0.4, 0.8],
    [0.8, 0.2, 0.2],
    [0.2, 0.6, 0.3],
    [0.9, 0.6, 0.2],
    [0.5, 0.3, 0.7],
  ],
  pants: [
    [0.2, 0.25, 0.5],
    [0.1, 0.1, 0.1],
    [0.7, 0.6, 0.4],
    [0.4, 0.4, 0.4],
  ],
  hair: [
    [0.1, 0.1, 0.1],
    [0.4, 0.25, 0.1],
    [0.7, 0.55, 0.3],
    [0.9, 0.1, 0.1],
    [0.8, 0.8, 0.8],
    [0.15, 0.1, 0.05],
  ],
};

// Crime table — wanted stars per crime, GTA style. commitCrime takes
// the max of the current wanted level and the crime's stars.
export const CRIME = {
  stealCar: { stars: 1, label: 'Grand theft auto' },
  assault: { stars: 1, label: 'Assault' },
  killPed: { stars: 2, label: 'Murder' },
  killGang: { stars: 2, label: 'Gang murder' },
  carjacking: { stars: 2, label: 'Armed carjacking' },
  killCop: { stars: 3, label: 'Killing an officer' },
  explosion: { stars: 3, label: 'Explosion' },
  copMassacre: { stars: 5, label: 'Cop massacre' },
  rampage: { stars: 5, label: 'Rampage' },
};

// The two rival gangs and their turf (axis-aligned rectangles).
export const GANGS = {
  kings: {
    name: 'Bay Kings',
    colour: [0.95, 0.75, 0.1],
    turf: { x0: -120, x1: 120, z0: -120, z1: 60 },
  },
  sharks: {
    name: 'Harbour Sharks',
    colour: [0.1, 0.7, 0.7],
    turf: { x0: -300, x1: -120, z0: 120, z1: 280 },
  },
};

// The five story chapters.
export const CHAPTERS = [
  { title: 'First Wheels', reward: 200, objective: 'Steal a car and drive to the garage' },
  { title: 'The Package', reward: 400, objective: 'Pick up the package at the harbour, deliver it to the hideout' },
  { title: 'Getaway', reward: 500, objective: 'Escape a 3-star wanted level' },
  { title: 'Night Run', reward: 600, objective: 'Pick up 3 passengers across the city' },
  { title: 'The Big One', reward: 1500, objective: 'Grab the vault cash, lose the heat, reach the safehouse' },
];

// Respect ladder + unlocks.
export const RESPECT = {
  levels: [
    { min: 0, name: 'Nobody' },
    { min: 100, name: 'Hustler' },
    { min: 250, name: 'Shot Caller' },
    { min: 500, name: 'Kingpin' },
    { min: 1000, name: 'Legend' },
  ],
  unlocks: [
    { min: 100, flag: 'smgUnlocked', label: 'SMG' },
    { min: 250, flag: 'shotgunUnlocked', label: 'Shotgun' },
    { min: 500, flag: 'sportsCarSpawned', label: 'Solmar Comet' },
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
  return { name: cur.name, next: next ? next.name : cur.name, min: cur.min };
}

// Radio: 4 original synth stations, 2 songs each, 8 notes per song.
export const SONG_STEPS = 32;
export const STATIONS = [
  {
    name: 'BAY FM', freq: '94.7',
    songs: [
      { name: 'Golden Hour Drive', notes: [262, 294, 330, 392, 440, 392, 330, 294] },
      { name: 'Sunset Strip', notes: [220, 262, 294, 330, 392, 440, 392, 330] },
    ],
  },
  {
    name: 'PALM', freq: '102.3',
    songs: [
      { name: 'Coconut Radio', notes: [330, 392, 440, 523, 440, 392, 330, 262] },
      { name: 'Island Breeze', notes: [294, 330, 392, 440, 523, 587, 523, 440] },
    ],
  },
  {
    name: 'NEON', freq: '89.1',
    songs: [
      { name: 'Night Circuit', notes: [196, 220, 262, 294, 330, 294, 262, 220] },
      { name: 'Midnight Drive', notes: [175, 196, 220, 262, 294, 330, 294, 262] },
    ],
  },
  {
    name: 'CORAL', freq: '105.5',
    songs: [
      { name: 'Slow Tide', notes: [247, 262, 294, 330, 294, 262, 247, 220] },
      { name: 'Low Tide', notes: [220, 247, 262, 294, 330, 294, 262, 247] },
    ],
  },
];

// Fixed spawn / interaction points. Every one of these is on open
// ground: not inside a building collider and (where it matters) not
// on a road line.
export const SPAWNS = {
  hospital: { x: -110, z: 150 },
  garageDoor: { x: 150, z: -128 },
  elevatorTower: { x: 30, z: -68 },
  trainStation: { x: 0, z: 300 },
  fishing: { x: -330, z: 100 },
  swimBuoy: { x: -390, z: 100 },
  slalomStart: { x: 180, z: 200 },
  outfitDoor: { x: 150, z: 8 },
  fireStation: { x: -90, z: -128 },
  beachHouse: { x: -300, z: 60 },
  shootingRange: { x: -270, z: -270 },
};

// Food shops: name + the walk-up point in front of the shop.
export const FOOD_SHOPS = [
  { name: 'Pizza Palace', x: 30, z: 68 },
  { name: 'Burger Barn', x: -150, z: 68 },
  { name: "Clucky's Chicken", x: -40, z: 70 },
  { name: 'Donut Hole', x: 150, z: 68 },
  { name: 'Taco Truck', x: 90, z: -68 },
];

export const FOOD_MENU = [
  { name: 'Snack', price: 5, heal: 10, armour: 0 },
  { name: 'Meal', price: 10, heal: 25, armour: 0 },
  { name: 'Feast', price: 15, heal: 100, armour: 25 },
];

// Outfit catalogue. Prices are chosen so hair 2 + shirt 1 + pants 1
// + shoes 1 totals $155 (40 + 50 + 30 + 35).
export const OUTFIT = {
  hair: [
    { name: 'Buzz', price: 0, color: [0.1, 0.1, 0.1] },
    { name: 'Fade', price: 20, color: [0.4, 0.25, 0.1] },
    { name: 'Red mohawk', price: 40, color: [0.9, 0.1, 0.1] },
    { name: 'Blonde', price: 30, color: [0.85, 0.7, 0.3] },
  ],
  shirt: [
    { name: 'White tee', price: 0, color: [0.9, 0.9, 0.9] },
    { name: 'Blue shirt', price: 50, color: [0.2, 0.4, 0.8] },
    { name: 'Red shirt', price: 45, color: [0.8, 0.2, 0.2] },
    { name: 'Green shirt', price: 35, color: [0.2, 0.6, 0.3] },
  ],
  pants: [
    { name: 'Jeans', price: 0, color: [0.2, 0.25, 0.5] },
    { name: 'Black pants', price: 30, color: [0.1, 0.1, 0.1] },
    { name: 'Khaki', price: 25, color: [0.7, 0.6, 0.4] },
  ],
  shoes: [
    { name: 'Sneakers', price: 0, color: [0.9, 0.9, 0.9] },
    { name: 'Gold kicks', price: 35, color: [0.95, 0.75, 0.1] },
    { name: 'Boots', price: 40, color: [0.4, 0.25, 0.15] },
  ],
};
