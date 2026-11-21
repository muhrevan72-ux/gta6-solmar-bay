// Solmar Bay — tuning, crime table, chapters, radio, spawns.
// All values are original to this rebuild; the numbers below are
// chosen to satisfy the game's design (see GAME-DESIGN.md).

// ----- movement + world tuning -----
export const TUNE = {
  walkSpeed: 4.5,
  runSpeed: 8.5,
  swimSpeed: 2.2,
  carMaxSpeed: 32,
  bikeMaxSpeed: 40,
  boatMaxSpeed: 22,
  planeMaxSpeed: 55,
  carAccel: 14,
  carBrake: 26,
  carSteer: 2.4,
  dayLengthSec: 720,
  heliAltitude: 80,
  batchCap: 1600,
  staticCap: 1600,
  sightRange: 60,
  wantedDecaySec: 14,
  copShootCd: 2.5,
  copShootRange: 35,
  interactRange: 6,
  punchRange: 2.6,
  punchDamage: 12,
  bombRadius: 9,
};

// ----- crime table: each crime carries a wanted level (1-5) -----
// commitCrime raises the wanted level to AT LEAST the crime's
// level (never stacks assaults on top of a kill).
export const CRIME = {
  stealCar: { stars: 1, label: 'Grand theft auto' },
  assault: { stars: 1, label: 'Assault' },
  killPed: { stars: 2, label: 'Manslaughter' },
  killGang: { stars: 2, label: 'Gang killing' },
  robbery: { stars: 2, label: 'Armed robbery' },
  killCop: { stars: 3, label: 'Cop killing' },
  explosion: { stars: 3, label: 'Explosion' },
  rampage: { stars: 4, label: 'Rampage' },
  copMassacre: { stars: 5, label: 'Cop massacre' },
};

// ----- story chapters -----
export const CHAPTERS = [
  { n: 1, title: 'First Wheels', reward: 200, respect: 50, objective: 'Steal a car and drive to the garage', intro: 'Fresh off the bus in Solmar Bay. Rico needs wheels — steal a car and bring it to the garage.' },
  { n: 2, title: 'The Package', reward: 400, respect: 50, objective: 'Pick up the package at the harbour, deliver it to the hideout', intro: 'A package is waiting at the harbour. Pick it up and deliver it to the hideout before the timer runs out.' },
  { n: 3, title: 'Getaway', reward: 500, respect: 50, objective: 'Lose the 3-star wanted level', intro: 'The cops are all over you. Lose the heat — break line of sight and stay hidden until the stars fade.' },
  { n: 4, title: 'Night Run', reward: 600, respect: 50, objective: 'Pick up 3 passengers across the city', intro: 'Night shift. Three passengers are waiting around the city — pick them all up.' },
  { n: 5, title: 'The Big One', reward: 1500, respect: 50, objective: 'Grab the vault cash at the harbour, then reach the safehouse with 0 stars', intro: 'The harbour vault. Grab the cash, lose the 4-star heat, and reach the safehouse clean.' },
];

// ----- respect ladder + unlocks -----
export const RESPECT = {
  levels: [
    { min: 0, name: 'Nobody' },
    { min: 100, name: 'Hustler' },
    { min: 250, name: 'Shot Caller' },
    { min: 500, name: 'Kingpin' },
    { min: 1000, name: 'Legend' },
  ],
  unlocks: [
    { min: 100, flag: 'smgUnlocked', label: 'SMG unlocked' },
    { min: 250, flag: 'shotgunUnlocked', label: 'Shotgun unlocked' },
    { min: 500, flag: 'sportsCarSpawned', label: 'A Comet is waiting for you' },
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
  return { name: cur.name, min: cur.min, next: next ? next.name : null, nextMin: next ? next.min : null };
}

// ----- radio stations (original synth songs) -----
export const SONG_STEPS = 32;
function song(title, notes) { return { title, notes }; }
export const STATIONS = [
  { name: 'BAY FM', freq: '94.7', songs: [song('Golden Hour Drive', [262, 330, 392, 494, 392, 330, 262, 196]), song('Sunset Boulevard', [294, 370, 440, 587, 440, 370, 294, 220])] },
  { name: 'PALM', freq: '102.3', songs: [song('Coconut Radio', [330, 392, 494, 659, 494, 392, 330, 262]), song('Island Breeze', [262, 392, 330, 494, 392, 330, 262, 196])] },
  { name: 'NEON', freq: '89.1', songs: [song('Night Circuit', [220, 277, 330, 440, 330, 277, 220, 165]), song('Midnight Run', [247, 311, 370, 494, 370, 311, 247, 185])] },
  { name: 'CORAL', freq: '105.5', songs: [song('Slow Tide', [196, 262, 330, 392, 330, 262, 196, 147]), song('Ocean Waves', [220, 294, 370, 440, 370, 294, 220, 175])] },
];

// ----- spawn points (all on open ground, clear of buildings/roads where required) -----
export const SPAWNS = {
  player: { x: 0, z: 20 },
  hospital: { x: -150, z: 200 },
  garageDoor: { x: 150, z: -126 },
  elevatorTower: { x: 30, z: -90 },
  trainStation: { x: 0, z: 300 },
  fishing: { x: -350, z: 100 },
  beachHouse: { x: -300, z: 60 },
  outfitDoor: { x: 80, z: 38 },
  shootingRange: { x: 200, z: -200 },
  swimBuoy: { x: -380, z: 100 },
  slalomStart: { x: 180, z: 200 },
  fireStation: { x: -90, z: -150 },
};

// ----- food -----
export const FOOD_MENU = [
  { name: 'Snack', price: 5, heal: 10, armour: 0 },
  { name: 'Meal', price: 10, heal: 25, armour: 0 },
  { name: 'Feast', price: 15, heal: 100, armour: 25 },
];
export const FOOD_SHOPS = [
  { name: 'Pizza Palace', x: -40, z: 38, kind: 'pizza' },
  { name: 'Burger Barn', x: 80, z: -38, kind: 'burger' },
  { name: "Clucky's Chicken", x: -40, z: 70, kind: 'chicken' },
  { name: 'Donut Den', x: 120, z: 78, kind: 'donut' },
  { name: 'Taco Truck', x: -120, z: -78, kind: 'taco' },
];

// ----- outfit catalogue -----
// Prices are chosen so hair 2 + shirt 1 + pants 1 + shoes 1 = 155.
export const OUTFIT = {
  hair: [
    { name: 'Buzz cut', colour: [0.12, 0.1, 0.08], price: 0 },
    { name: 'Spiky', colour: [0.3, 0.2, 0.1], price: 20 },
    { name: 'Red mohawk', colour: [0.9, 0.1, 0.1], price: 40 },
    { name: 'Long blonde', colour: [0.9, 0.8, 0.4], price: 60 },
  ],
  shirt: [
    { name: 'White tee', colour: [0.9, 0.9, 0.9], price: 0 },
    { name: 'Blue shirt', colour: [0.2, 0.4, 0.9], price: 50 },
    { name: 'Red jacket', colour: [0.8, 0.1, 0.1], price: 80 },
    { name: 'Gold shirt', colour: [0.95, 0.75, 0.2], price: 120 },
  ],
  pants: [
    { name: 'Jeans', colour: [0.2, 0.3, 0.6], price: 0 },
    { name: 'Black pants', colour: [0.1, 0.1, 0.1], price: 30 },
    { name: 'White pants', colour: [0.9, 0.9, 0.9], price: 50 },
  ],
  shoes: [
    { name: 'Sneakers', colour: [0.8, 0.8, 0.8], price: 0 },
    { name: 'Gold kicks', colour: [0.95, 0.75, 0.2], price: 35 },
    { name: 'Boots', colour: [0.4, 0.25, 0.1], price: 60 },
  ],
};

// ----- palette -----
export const COL = {
  grass: [0.42, 0.62, 0.38],
  road: [0.16, 0.16, 0.18],
  roadLine: [0.95, 0.8, 0.2],
  sidewalk: [0.55, 0.55, 0.58],
  sand: [0.9, 0.8, 0.55],
  water: [0.2, 0.65, 0.9],
  sea: [0.15, 0.5, 0.85],
  sky: [0.55, 0.75, 0.95],
  hair: [
    [0.1, 0.08, 0.06], [0.3, 0.2, 0.1], [0.9, 0.8, 0.4],
    [0.05, 0.05, 0.05], [0.6, 0.3, 0.1], [0.85, 0.85, 0.85],
  ],
  skin: [
    [0.9, 0.75, 0.6], [0.75, 0.55, 0.4], [0.95, 0.8, 0.7],
    [0.6, 0.45, 0.3], [0.85, 0.65, 0.5], [0.7, 0.5, 0.35],
  ],
  shirt: [
    [0.9, 0.2, 0.2], [0.2, 0.4, 0.9], [0.2, 0.7, 0.3],
    [0.95, 0.75, 0.2], [0.6, 0.3, 0.7], [0.9, 0.9, 0.9],
  ],
  pants: [
    [0.2, 0.3, 0.6], [0.1, 0.1, 0.1], [0.5, 0.4, 0.3],
    [0.3, 0.5, 0.3], [0.7, 0.7, 0.75], [0.4, 0.2, 0.5],
  ],
  copNavy: [0.1, 0.15, 0.5],
  kingsGold: [0.95, 0.75, 0.2],
  sharksTeal: [0.1, 0.65, 0.7],
  taxiYellow: [1, 0.85, 0.1],
  barrelRed: [0.85, 0.2, 0.15],
  barrelRust: [0.75, 0.3, 0.15],
  palmLeaf: [0.25, 0.65, 0.25],
  coconut: [0.5, 0.35, 0.2],
  glassBlue: [0.4, 0.65, 0.85],
};
