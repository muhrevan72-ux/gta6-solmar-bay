// Solmar Bay — tuning, tables and constants.
//
// Everything the systems agree on lives here so a balance tweak is a
// one-line change: speeds, crime stars, chapter rewards, radio, spawn
// points, respect ladder, food, outfits and the colour palette.

// ---------- tuning ----------
export const TUNE = {
  walkSpeed: 4, // m/s on foot
  runSpeed: 8, // m/s while holding Shift
  dayLengthSec: 720, // one full game day = 24 game hours at 120x
  carMaxSpeed: 32, // m/s, ordinary cars
  bikeMaxSpeed: 40, // m/s, the bike outruns every car
  carAccel: 14, // m/s^2
  carBrake: 26, // m/s^2
  batchCap: 1600, // max boxes in one dynamic batch
  heliAltitude: 80, // metres, police helicopter orbit height
  copShootRange: 30, // metres, a foot cop opens fire inside this
  copBustRange: 2, // metres, a foot cop that close busts the player
  wantedDecaySec: 14, // seconds out of sight to lose one star
  sightRange: 60, // metres, a cop inside this blocks wanted decay
};

// ---------- crime ----------
// A crime's stars are the wanted LEVEL it sets, not points to add:
// stealing a car (1) then killing a ped (2) leaves the player at 2
// stars, the worst crime, exactly like the genre this game imitates.
export const CRIME = {
  stealCar: { stars: 1, label: 'Grand theft auto' },
  assault: { stars: 1, label: 'Assault' },
  killPed: { stars: 2, label: 'Killing a pedestrian' },
  killGang: { stars: 2, label: 'Killing a gang member' },
  carjacking: { stars: 2, label: 'Carjacking' },
  killCop: { stars: 3, label: 'Killing a cop' },
  bombKill: { stars: 3, label: 'Killing with a bomb' },
  massRampage: { stars: 4, label: 'Mass rampage' },
  copMassacre: { stars: 5, label: 'Cop massacre' },
};

// ---------- chapters ----------
export const CHAPTERS = [
  { title: 'Chapter 1 — First Wheels', reward: 200, objective: 'Steal a car and drive to the garage' },
  { title: 'Chapter 2 — The Package', reward: 400, objective: 'Pick up the package at the harbour and deliver it to the hideout' },
  { title: 'Chapter 3 — Hot Pursuit', reward: 500, objective: 'Lose the cops — get your wanted level down to zero' },
  { title: 'Chapter 4 — Taxi Nights', reward: 600, objective: 'Pick up three passengers around the city' },
  { title: 'Chapter 5 — The Big One', reward: 1500, objective: 'Grab the vault cash, then reach the safehouse with no stars' },
];

// ---------- radio ----------
// Four stations, two songs each. A song is a name plus 8 note
// frequencies; the sequencer steps through them 32 steps per loop.
export const SONG_STEPS = 32;
export const STATIONS = [
  {
    name: 'BAY FM', freq: '94.7',
    songs: [
      { name: 'Golden Hour Drive', notes: [262, 330, 392, 523, 392, 330, 262, 196] },
      { name: 'Sunset Cruise', notes: [196, 262, 330, 392, 330, 262, 196, 147] },
    ],
  },
  {
    name: 'PALM', freq: '102.3',
    songs: [
      { name: 'Coconut Radio', notes: [330, 392, 440, 523, 440, 392, 330, 262] },
      { name: 'Island Breeze', notes: [262, 294, 330, 392, 330, 294, 262, 220] },
    ],
  },
  {
    name: 'NEON', freq: '89.1',
    songs: [
      { name: 'Night Circuit', notes: [220, 262, 330, 440, 330, 262, 220, 165] },
      { name: 'Chrome Lights', notes: [247, 294, 370, 440, 370, 294, 247, 196] },
    ],
  },
  {
    name: 'CORAL', freq: '105.5',
    songs: [
      { name: 'Slow Tide', notes: [196, 220, 262, 330, 262, 220, 196, 165] },
      { name: 'Deep Blue', notes: [165, 196, 247, 294, 247, 196, 165, 131] },
    ],
  },
];

// ---------- spawn points ----------
// Every interactable is addressed through SPAWNS so the tests and the
// world builder can never drift apart about where things are.
export const SPAWNS = {
  hospital: { x: -110, z: 150 }, // respawn point, clear of the hospital walls
  garageDoor: { x: 150, z: -128 }, // player garage, east side
  elevatorTower: { x: 30, z: -78 }, // Solmar Tower door, south face
  trainStation: { x: -200, z: -200 }, // south-west platform
  fishing: { x: -340, z: 100 }, // pier on the beach
  outfitDoor: { x: -120, z: 65 }, // Vice Threads
  beachHouse: { x: -300, z: 60 }, // Maya's place, and the cat shelter
  shootingRange: { x: 250, z: 250 }, // south-east range
  swimBuoy: { x: -360, z: 100 }, // out in the sea
  slalomStart: { x: 180, z: 200 }, // start line, east side
  fireStation: { x: -150, z: -90 }, // fire truck parks 10 m east of this
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

// The level a respect total sits at, plus the next level's name.
export function respectLevel(rep) {
  let cur = RESPECT.levels[0];
  let next = null;
  for (let i = 0; i < RESPECT.levels.length; i++) {
    if (rep >= RESPECT.levels[i].min) {
      cur = RESPECT.levels[i];
      next = RESPECT.levels[i + 1] ? RESPECT.levels[i + 1].name : null;
    }
  }
  return { name: cur.name, min: cur.min, next };
}

// ---------- palette ----------
// COL is the shared palette: the world, the peds and the player all
// draw from the same colours so the city reads as one place.
export const COL = {
  water: [0.2, 0.65, 0.9], // bright Solmar Bay water
  grass: [0.42, 0.62, 0.38],
  road: [0.16, 0.16, 0.18],
  sidewalk: [0.55, 0.55, 0.58],
  sand: [0.85, 0.75, 0.55],
  dash: [0.95, 0.8, 0.15],
  glass: [0.4, 0.65, 0.8],
  palmLeaf: [0.25, 0.65, 0.3],
  coconut: [0.5, 0.35, 0.2],
  barrelRed: [0.85, 0.2, 0.15],
  barrelRust: [0.75, 0.3, 0.15],
  taxiYellow: [1, 0.85, 0.1],
  copNavy: [0.1, 0.15, 0.5],
  kingsGold: [0.95, 0.75, 0.2],
  sharksTeal: [0.15, 0.6, 0.75],
  skin: [
    [0.85, 0.65, 0.5],
    [0.7, 0.5, 0.35],
    [0.55, 0.4, 0.3],
    [0.9, 0.75, 0.6],
  ],
  hair: [
    [0.1, 0.08, 0.06],
    [0.5, 0.3, 0.15],
    [0.85, 0.7, 0.3],
    [0.9, 0.1, 0.1],
    [0.8, 0.8, 0.8],
    [0.2, 0.2, 0.25],
  ],
  shirt: [
    [0.8, 0.2, 0.2],
    [0.2, 0.4, 0.8],
    [0.2, 0.7, 0.3],
    [0.9, 0.8, 0.2],
    [0.8, 0.4, 0.7],
    [0.9, 0.9, 0.9],
  ],
  pants: [
    [0.2, 0.25, 0.5],
    [0.3, 0.3, 0.3],
    [0.5, 0.4, 0.3],
    [0.7, 0.7, 0.65],
  ],
};

// ---------- food ----------
export const FOOD_MENU = [
  { name: 'Snack', price: 5, heal: 10, armour: 0 },
  { name: 'Meal', price: 10, heal: 25, armour: 0 },
  { name: 'Feast', price: 15, heal: 100, armour: 25 },
];

export const FOOD_SHOPS = [
  { name: 'Pizza Palace', x: 40, z: 40 },
  { name: 'Burger Barn', x: -90, z: -30 },
  { name: "Clucky's Chicken", x: -40, z: 70 },
  { name: 'Donut Dock', x: 130, z: 90 },
  { name: 'Taco Tide', x: -130, z: -90 },
];

// ---------- outfits ----------
// Each catalogue entry is a name, a price and the colour it renders
// as. The outfit the player buys is the outfit the renderer draws.
export const OUTFIT = {
  hair: [
    { name: 'Buzz cut', price: 0, colour: [0.15, 0.12, 0.1] },
    { name: 'Long hair', price: 25, colour: [0.55, 0.35, 0.2] },
    { name: 'Red mohawk', price: 40, colour: [0.9, 0.12, 0.1] },
    { name: 'Blonde spikes', price: 30, colour: [0.85, 0.75, 0.2] },
  ],
  shirt: [
    { name: 'White tee', price: 0, colour: [0.85, 0.85, 0.85] },
    { name: 'Blue hoodie', price: 50, colour: [0.2, 0.3, 0.8] },
    { name: 'Black jacket', price: 70, colour: [0.15, 0.15, 0.15] },
    { name: 'Orange tank', price: 20, colour: [0.9, 0.5, 0.2] },
  ],
  pants: [
    { name: 'Blue jeans', price: 0, colour: [0.2, 0.25, 0.5] },
    { name: 'Khaki shorts', price: 30, colour: [0.7, 0.7, 0.65] },
    { name: 'Cargo pants', price: 45, colour: [0.3, 0.35, 0.25] },
  ],
  shoes: [
    { name: 'White sneakers', price: 0, colour: [0.9, 0.9, 0.9] },
    { name: 'Gold kicks', price: 35, colour: [0.95, 0.75, 0.1] },
    { name: 'Brown boots', price: 50, colour: [0.3, 0.2, 0.15] },
  ],
};
