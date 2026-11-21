// Solmar Bay — tuned constants: spawn points, chapters, radio, crime,
// respect, food, outfits and the driving model. Everything the other
// modules need to agree on lives here, in one place.

// ---------- spawn points ----------
// The city runs from -400 to +400 on both axes. Roads sit on multiples
// of 60; buildings fill the blocks between them. These points are kept
// clear of buildings by the city generator.
export const SPAWNS = {
  player: { x: 0, z: 20 },
  hospital: { x: -150, z: 100 },
  garageDoor: { x: 150, z: -120 },
  fireStation: { x: -120, z: 120 },
  elevatorTower: { x: 30, z: -90 },
  trainStation: { x: 0, z: 300 },
  fishing: { x: -345, z: 40 },
  swimBuoy: { x: -370, z: 100 },
  slalomStart: { x: 180, z: 200 },
  shootingRange: { x: 250, z: 250 },
  outfitDoor: { x: 90, z: 30 },
  beachHouse: { x: -320, z: 60 },
};

// ---------- respect ----------
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

export function respectLevel(score) {
  let current = RESPECT.levels[0];
  let next = null;
  for (let i = 0; i < RESPECT.levels.length; i++) {
    if (score >= RESPECT.levels[i].min) {
      current = RESPECT.levels[i];
      next = RESPECT.levels[i + 1] || null;
    }
  }
  return {
    name: current.name,
    min: current.min,
    next: next ? next.name : null,
    nextMin: next ? next.min : null,
  };
}

// ---------- story chapters ----------
export const CHAPTERS = [
  {
    title: 'First Wheels',
    reward: 200,
    respect: 50,
    brief: 'Rico needs a driver. Steal the Solmar Comet and bring it to the garage on the east side.',
  },
  {
    title: 'Harbour Run',
    reward: 400,
    respect: 50,
    brief: 'Pick up a package at the harbour and deliver it to the hideout before the timer runs out.',
  },
  {
    title: 'Lose the Heat',
    reward: 500,
    respect: 100,
    brief: 'The cops are all over you. Lose every wanted star and stay clean.',
  },
  {
    title: 'Three Fares',
    reward: 600,
    respect: 125,
    brief: 'Drive three passengers across town. Do not keep them waiting.',
  },
  {
    title: 'The Big One',
    reward: 1500,
    respect: 250,
    brief: 'Hit the vault, grab the cash, and get to the safehouse without a single star on you.',
  },
];

// ---------- radio ----------
export const SONG_STEPS = 32;

function song(title, notes) {
  return { title, notes };
}

export const STATIONS = [
  {
    name: 'BAY FM',
    freq: '94.7',
    songs: [
      song('Golden Hour Drive', [0, 2, 4, 7, 9, 7, 4, 2]),
      song('Sunset Boulevard', [0, 3, 5, 7, 10, 7, 5, 3]),
    ],
  },
  {
    name: 'PALM',
    freq: '102.3',
    songs: [
      song('Coconut Radio', [0, 2, 5, 7, 9, 12, 9, 5]),
      song('Island Breeze', [0, 4, 5, 9, 7, 5, 4, 0]),
    ],
  },
  {
    name: 'NEON',
    freq: '89.1',
    songs: [
      song('Night Circuit', [0, 1, 3, 6, 8, 6, 3, 1]),
      song('Midnight Overdrive', [0, 3, 6, 8, 11, 8, 6, 3]),
    ],
  },
  {
    name: 'CORAL',
    freq: '105.5',
    songs: [
      song('Slow Tide', [0, 2, 4, 5, 7, 5, 4, 2]),
      song('Tide Pool Dreams', [0, 5, 4, 2, 0, 2, 4, 5]),
    ],
  },
];

// ---------- colours ----------
export const COL = {
  hair: [
    [0.1, 0.1, 0.1],
    [0.5, 0.3, 0.15],
    [0.9, 0.1, 0.1],
    [0.9, 0.75, 0.2],
    [0.2, 0.2, 0.8],
    [0.9, 0.9, 0.9],
  ],
  skin: [
    [0.85, 0.65, 0.5],
    [0.7, 0.5, 0.35],
    [0.55, 0.4, 0.28],
  ],
  shirt: [
    [0.9, 0.9, 0.9],
    [0.95, 0.75, 0.1],
    [0.2, 0.7, 0.5],
    [0.15, 0.15, 0.2],
  ],
  pants: [
    [0.2, 0.25, 0.5],
    [0.5, 0.45, 0.3],
    [0.3, 0.3, 0.35],
  ],
  shoes: [
    [0.9, 0.9, 0.9],
    [0.95, 0.75, 0.1],
    [0.25, 0.2, 0.15],
  ],
  water: [0.2, 0.65, 0.9],
};

// ---------- tuning ----------
export const TUNE = {
  walkSpeed: 4,
  runSpeed: 8,
  carMaxSpeed: 28,
  carAccel: 14,
  carBrake: 30,
  bikeMaxSpeed: 34,
  // A fresh W tap must move the car right away: a pure accel/decay
  // model makes one tap add ~0.2 m/s and die in two frames, so the
  // car never visibly moves on taps. This impulse fires once per
  // newly-pressed W, before the max-speed clamp.
  carTapImpulse: 4,
  dayLengthSec: 720,
  batchCap: 1600,
  heliAltitude: 80,
  copSpeed: 4.5,
  copShootRange: 60,
};

// ---------- crime ----------
export const CRIME = {
  stealCar: { stars: 1, label: 'Grand Theft Auto' },
  assault: { stars: 1, label: 'Assault' },
  speeding: { stars: 1, label: 'Reckless Driving' },
  killPed: { stars: 2, label: 'Murder' },
  hitAndRun: { stars: 2, label: 'Hit and Run' },
  killCop: { stars: 3, label: 'Killing an Officer' },
  arson: { stars: 3, label: 'Arson' },
  bankRobbery: { stars: 4, label: 'Bank Robbery' },
  copMassacre: { stars: 5, label: 'Cop Massacre' },
};

// ---------- food ----------
export const FOOD_MENU = [
  { name: 'Snack', price: 5, hp: 10, armour: 0 },
  { name: 'Meal', price: 10, hp: 25, armour: 0 },
  { name: 'Feast', price: 15, hp: 100, armour: 25 },
];

export const FOOD_SHOPS = [
  { name: 'Pizza Palace', x: -40, z: 70 },
  { name: 'Burger Barn', x: 90, z: -30 },
  { name: 'Taco Truck', x: 30, z: 150 },
  { name: 'Noodle House', x: -90, z: -150 },
  { name: 'Chicken Shack', x: -40, z: -70 },
];

// ---------- outfits ----------
export const OUTFIT = {
  hair: [
    { name: 'Buzz Cut', price: 0, colour: [0.1, 0.1, 0.1] },
    { name: 'Side Part', price: 20, colour: [0.5, 0.3, 0.15] },
    { name: 'Red Mohawk', price: 40, colour: [0.9, 0.1, 0.1] },
    { name: 'Blonde Quiff', price: 60, colour: [0.9, 0.75, 0.2] },
  ],
  shirt: [
    { name: 'White Tee', price: 0, colour: [0.9, 0.9, 0.9] },
    { name: 'Gold Chain Tee', price: 50, colour: [0.95, 0.75, 0.1] },
    { name: 'Hawaiian Shirt', price: 70, colour: [0.2, 0.7, 0.5] },
    { name: 'Leather Jacket', price: 90, colour: [0.15, 0.15, 0.2] },
  ],
  pants: [
    { name: 'Jeans', price: 0, colour: [0.2, 0.25, 0.5] },
    { name: 'Cargo Shorts', price: 30, colour: [0.5, 0.45, 0.3] },
    { name: 'Track Pants', price: 50, colour: [0.3, 0.3, 0.35] },
  ],
  shoes: [
    { name: 'Sneakers', price: 0, colour: [0.9, 0.9, 0.9] },
    { name: 'Gold Kicks', price: 35, colour: [0.95, 0.75, 0.1] },
    { name: 'Boots', price: 55, colour: [0.25, 0.2, 0.15] },
  ],
};
