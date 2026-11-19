// Solmar Bay — garage + car customisation.
//
// The garage building (150,-150) has a door on its south face.
// Drive up to the door in a car and press E to store the car — it
// becomes yours. On foot, E at the door opens the garage menu:
// take out an owned car, or repaint the last stored car ($50).
// Owned cars persist in the save.

import { TUNE, COL, dist2 } from './config.js';
import { showToast } from './state.js';
import { showMenu, hideMenu } from './hud.js';
import { spawnVehicle } from './vehicles.js';

export const GARAGE_DOOR = { x: 150, z: -128 };

export function createGarage() {
  return {
    owned: [], // { vehId, type, colour, name }
    open: false,
    selected: -1, // index of the last stored car
  };
}

export function nearGarageDoor(game, range) {
  const p = game.player;
  const r = range === undefined ? 16 : range;
  return dist2(p.x, p.z, GARAGE_DOOR.x, GARAGE_DOOR.z) < r;
}

function paintName(colour) {
  const names = ['Red', 'Blue', 'Yellow', 'Green', 'White', 'Black', 'Orange', 'Purple'];
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < COL.carPaint.length; i++) {
    const c = COL.carPaint[i];
    const d = (c[0] - colour[0]) ** 2 + (c[1] - colour[1]) ** 2 + (c[2] - colour[2]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return names[best] || 'Custom';
}

function typeLabel(type) {
  return type === 'bike' ? 'Bike' : type === 'car' ? 'Car' : type;
}

// Drive in with a car (E while in a vehicle, stopped at the door):
// the car is stored and becomes owned. Returns true if stored.
export function storeCar(game) {
  const p = game.player;
  const veh = p.inVehicle;
  if (!veh) return false;
  if (veh.type !== 'car' && veh.type !== 'bike') {
    showToast(game.state, 'Only street cars and bikes go in the garage.', 2);
    return false;
  }
  if (Math.abs(veh.speed) > 2) {
    showToast(game.state, 'Stop the car at the garage door first.', 2);
    return false;
  }
  const garage = game.garage;
  // already owned (same physical car)? just update it, no duplicate
  let entry = garage.owned.find((o) => o.vehId === veh.id);
  if (!entry) {
    entry = {
      vehId: veh.id,
      type: veh.type,
      colour: [...veh.colour],
      name: paintName(veh.colour) + ' ' + typeLabel(veh.type),
    };
    garage.owned.push(entry);
    garage.selected = garage.owned.length - 1;
  } else {
    entry.colour = [...veh.colour];
    garage.selected = garage.owned.indexOf(entry);
  }
  // park the vehicle out of the world (driver 'stored' is never
  // drawn, never traffic, and nearestVehicle skips it)
  veh.driver = 'stored';
  veh.stored = true;
  veh.speed = 0;
  p.inVehicle = null;
  p.x = GARAGE_DOOR.x;
  p.z = GARAGE_DOOR.z - 4;
  p.y = 0;
  p.eCooldown = 0.25;
  showToast(game.state, entry.name + ' stored in your garage!', 3);
  if (game.audio) game.audio.play('win');
  showGarageMenu(game);
  return true;
}

// Take an owned car out: it spawns at the garage door, parked.
export function takeOutCar(game, index) {
  const garage = game.garage;
  const entry = garage.owned[index];
  if (!entry) return false;
  const veh = spawnVehicle(game.vehicles, entry.type, GARAGE_DOOR.x, GARAGE_DOOR.z - 6, 0, [...entry.colour]);
  veh.driver = 'parked';
  veh.name = entry.name; // the stored name shows in the HUD car panel
  entry.vehId = veh.id;
  garage.open = false;
  showToast(game.state, 'Your ' + entry.name + ' is outside the garage.', 3);
  return true;
}

// Repaint the selected (last stored) car. Cycles to the next paint.
export function repaintCar(game) {
  const garage = game.garage;
  const entry = garage.owned[garage.selected];
  if (!entry) {
    showToast(game.state, 'Store a car in the garage first.', 2);
    return false;
  }
  if (game.state.cash < TUNE.repaintPrice) {
    showToast(game.state, 'Repaint costs $' + TUNE.repaintPrice + '. Not enough cash.', 2);
    return false;
  }
  let idx = 0;
  for (let i = 0; i < COL.carPaint.length; i++) {
    const c = COL.carPaint[i];
    if (Math.abs(c[0] - entry.colour[0]) < 0.01 && Math.abs(c[1] - entry.colour[1]) < 0.01 && Math.abs(c[2] - entry.colour[2]) < 0.01) {
      idx = i;
      break;
    }
  }
  const next = COL.carPaint[(idx + 1) % COL.carPaint.length];
  game.state.cash -= TUNE.repaintPrice;
  entry.colour = [...next];
  entry.name = paintName(next) + ' ' + typeLabel(entry.type);
  // repaint the live vehicle too, if it is out in the world
  const live = game.vehicles.byId.get(entry.vehId);
  if (live && !live.stored) live.colour = [...next];
  showToast(game.state, 'Repainted: ' + entry.name + ' (-$' + TUNE.repaintPrice + ')', 3);
  if (game.audio) game.audio.play('pickup');
  showGarageMenu(game);
  return true;
}

export function showGarageMenu(game) {
  const garage = game.garage;
  garage.open = true;
  let lines = '';
  if (!garage.owned.length) {
    lines = 'No cars stored yet.<br>Drive a car to the door and press E to store it.';
  } else {
    lines = garage.owned.map((o, i) =>
      (i + 1) + '. ' + o.name + ' (' + o.type + ') — press ' + (i + 1) + ' to take out').join('<br>');
    lines += '<br>0. Repaint the last car ($' + TUNE.repaintPrice + ')';
  }
  showMenu(game.hud, 'Garage', lines, 'Press a number, Esc to close. Cash: $' + game.state.cash);
}

// Digit keys while the garage menu is open. Returns true if used.
export function handleGarageKeys(game) {
  const input = game.input;
  const garage = game.garage;
  if (!garage || !garage.open) return false;
  for (let i = 0; i < 9; i++) {
    if (input.pressedKey('Digit' + (i + 1))) {
      if (takeOutCar(game, i)) hideMenu(game.hud);
      return true;
    }
  }
  if (input.pressedKey('Digit0')) {
    repaintCar(game);
    return true;
  }
  return false;
}
