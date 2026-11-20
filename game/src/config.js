// Solmar Bay — tuning, tables and catalogue data (rebuild #13).
// All numbers the test suites pin live here: crime stars, chapter
// rewards, station frequencies, spawn points, respect ladder.

export const TUNE = {
  walkSpeed: 5,
  runSpeed: 9,
  carMaxSpeed: 28,
  bikeMaxSpeed: 38,
  carAccel: 14,
  carBrake: 30,
  dayLengthSec: 720,
  heliAltitude: 80,
  batchCap: 1600,
  clockRate: 120, // game seconds per real second (120x)
};

export const CRIME = {
  speeding: { stars: 1, label: 'Speeding' },
  stealCar: { stars: 1, label: 'Grand theft auto' },
  assault: { stars: 1, label: 'Assault' },
  killPed: { stars: 2, label: 'Manslaughter' },
  killGang: { stars: 2, label: 'Gang murder' },
  arson: { stars: 2, label: 'Arson' },
  robbery: { stars: 3, label: 'Armed robbery' },
  killCop: { stars: 3, label: 'Killing a cop' },
  copMassacre: { stars: 5, label: 'Cop massacre' },
};

export const CHAPTERS = [
  { n: 1, title: 'First Wheels', reward: 200, objective: 'Drive to the garage' },
  { n: 2, title: 'Harbour Run', reward: 400, objective: 'Pick up the package at the harbour, deliver to the hideout' },
  { n: 3, title: 'Cooling Off', reward: 500, objective: 'Lose the heat — get wanted down to 0' },
  { n: 4, title: 'Three Fares', reward: 600, objective: 'Pick up three passengers across the city' },
  { n: 5, title: 'The Big One', reward: 1500, objective: 'Grab the vault cash, then reach the safehouse with 0 stars' },
];

export const STATIONS = [
  {
    name: 'BAY FM', freq: '94.7',
    songs: [
      { title: 'Golden Hour Drive', notes: [440, 523, 659, 587, 523, 659, 784, 659] },
      { title: 'Sunset Boulevard', notes: [392, 494, 587, 523, 440, 494, 587, 659] },
    ],
  },
  {
    name: 'PALM', freq: '102.3',
    songs: [
      { title: 'Coconut Radio', notes: [523, 659, 784, 880, 784, 659, 587, 523] },
      { title: 'Island Breeze', notes: [440, 554, 659, 740, 659, 554, 494, 440] },
    ],
  },
  {
    name: 'NEON', freq: '89.1',
    songs: [
      { title: 'Night Circuit', notes: [330, 415, 494, 622, 494, 415, 370, 330] },
      { title: 'Laser Rain', notes: [294, 370, 440, 554, 659, 554, 440, 370] },
    ],
  },
  {
    name: 'CORAL', freq: '105.5',
    songs: [
      { title: 'Slow Tide', notes: [262, 330, 392, 440, 392, 330, 294, 262] },
      { title: 'Deep Current', notes: [220, 277, 330, 392, 440, 392, 330, 277] },
    ],
  },
];

export const SONG_STEPS = 32;

export const SPAWNS = {
  hospital: { x: -110, z: 150 },
  garageDoor: { x: 150, z: -126 },
  elevatorTower: { x: 30, z: -90 },
  trainStation: { x: 0, z: 300 },
  fishing: { x: -330, z: 100 },
  swimBuoy: { x: -380, z: 100 },
  slalomStart: { x: 200, z: 200 },
  shootingRange: { x: 240, z: -240 },
  beachHouse: { x: -300, z: 60 },
  outfitDoor: { x: 60, z: -22 },
  fireStation: { x: -60, z: -180 },
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
    { min: 100, flag: 'smgUnlocked', label: 'SMG' },
    { min: 250, flag: 'shotgunUnlocked', label: 'Shotgun' },
    { min: 500, flag: 'sportsCarSpawned', label: 'Solmar Comet' },
  ],
};

export function respectLevel(rep) {
  let level = RESPECT.levels[0];
  let next = null;
  for (let i = 0; i < RESPECT.levels.length; i++) {
    if (rep >= RESPECT.levels[i].min) {
      level = RESPECT.levels[i];
      next = RESPECT.levels[i + 1] ? RESPECT.levels[i + 1].name : null;
    }
  }
  return { name: level.name, min: level.min, next };
}

export const COL = {
  hair: [
    [0.1, 0.08, 0.06],
    [0.3, 0.2, 0.1],
    [0.9, 0.8, 0.4],
    [0.8, 0.2, 0.1],
    [0.2, 0.2, 0.25],
    [0.5, 0.5, 0.55],
  ],
  skin: [
    [0.85, 0.65, 0.5],
    [0.7, 0.5, 0.35],
    [0.55, 0.4, 0.3],
    [0.95, 0.8, 0.65],
  ],
  water: [0.2, 0.65, 0.9],
  grass: [0.42, 0.62, 0.38],
  road: [0.16, 0.16, 0.18],
  roadLine: [0.95, 0.8, 0.2],
  glass: [0.4, 0.65, 0.85],
  palmLeaf: [0.25, 0.65, 0.3],
  coconut: [0.5, 0.35, 0.2],
  barrelRed: [0.85, 0.2, 0.15],
  barrelRust: [0.75, 0.3, 0.15],
  kings: [0.95, 0.75, 0.1],
  sharks: [0.1, 0.5, 0.9],
  copNavy: [0.1, 0.15, 0.5],
  taxiYellow: [1, 0.85, 0.1],
};

export const FOOD_SHOPS = [
  { name: 'Pizza Palace', x: -90, z: 30 },
  { name: 'Burger Barn', x: -30, z: -90 },
  { name: 'Chicken Shack', x: -40, z: 70 },
  { name: 'Taco Truck', x: 90, z: 150 },
  { name: 'Noodle House', x: 150, z: 30 },
];

export const FOOD_MENU = [
  { name: 'Snack', price: 5, heal: 10, armour: 0 },
  { name: 'Meal', price: 10, heal: 25, armour: 0 },
  { name: 'Feast', price: 15, heal: 100, armour: 25 },
];

export const OUTFIT = {
  hair: [
    { name: 'Buzz cut', colour: [0.1, 0.1, 0.1], price: 0 },
    { name: 'Blonde sweep', colour: [0.9, 0.8, 0.4], price: 20 },
    { name: 'Red mohawk', colour: [0.9, 0.15, 0.1], price: 40 },
    { name: 'Blue spikes', colour: [0.2, 0.4, 0.9], price: 60 },
  ],
  shirt: [
    { name: 'White tee', colour: [0.9, 0.9, 0.9], price: 0 },
    { name: 'Red tee', colour: [0.8, 0.2, 0.2], price: 50 },
    { name: 'Gold shirt', colour: [0.9, 0.75, 0.2], price: 70 },
    { name: 'Black jacket', colour: [0.15, 0.15, 0.18], price: 90 },
  ],
  pants: [
    { name: 'Jeans', colour: [0.2, 0.3, 0.6], price: 0 },
    { name: 'Black pants', colour: [0.15, 0.15, 0.15], price: 30 },
    { name: 'Shorts', colour: [0.5, 0.6, 0.4], price: 50 },
  ],
  shoes: [
    { name: 'White sneakers', colour: [0.9, 0.9, 0.9], price: 0 },
    { name: 'Gold kicks', colour: [0.95, 0.75, 0.1], price: 35 },
    { name: 'Black boots', colour: [0.15, 0.15, 0.15], price: 60 },
  ],
};
