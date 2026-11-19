// Solmar Bay — garage + car customisation.
//
// The garage building becomes enterable with a car: drive a stopped
// car/bike to the door (150, -128) and press E to store it. On foot,
// E at the door opens the menu: list owned cars, take one out,
// repaint the current car ($50, cycles the paint colours). Owned
// cars + bank persist in the save.

import { TUNE, COL, dist2 } from './config.js';
import { showToast } from './state.js';
import { makeVehicle } from './vehicles.js';

export const GARAGE_DOOR = { x: 150, z: -128 };

export function createGarage() {
  return {
    menuOpen: false,
    paintIdx: 0,
  };
}

// Store the car the player is driving (must be stopped at the door).
export function storeCar(game) {
  const s = game.state;
  const v = s.player.inCar;
  if (!v) return false;
  if (Math.abs(v.speed) > 1) {
    showToast(s, 'Stop the car at the garage door first.', 2);
    return false;
  }
  if (dist2(v.x, v.z, GARAGE_DOOR.x, GARAGE_DOOR.z) > 100) {
    showToast(s, 'Drive to the garage door (150, -128) to store the car.', 2);
    return false;
  }
  // Already owned? Just park it.
  const owned = s.ownedCars.find((c) => c.id === v.id);
  if (!owned) {
    s.ownedCars.push({
      id: v.id, type: v.type, name: v.name,
      colour: [...v.colour], damage: 0,
    });
    showToast(s, v.name + ' stored in your garage!', 3);
  } else {
    showToast(s, v.name + ' parked in your garage.', 2);
  }
  // Leave the car in the garage (it stops being the driven car).
  const i = game.vehicles.list.indexOf(v);
  if (i >= 0) game.vehicles.list.splice(i, 1);
  s.player.inCar = null;
  s.player.x = GARAGE_DOOR.x;
  s.player.z = GARAGE_DOOR.z + 4;
  return true;
}

// Take an owned car out of the garage (it spawns at the door).
export function takeCar(game, idx) {
  const s = game.state;
  const owned = s.ownedCars[idx];
  if (!owned) return false;
  if (s.player.inCar) {
    showToast(s, 'You are already driving.', 2);
    return false;
  }
  const v = makeVehicle(owned.type, GARAGE_DOOR.x, GARAGE_DOOR.z + 6, 0);
  v.id = owned.id;
  v.name = owned.name;
  v.colour = [...owned.colour];
  v.damage = owned.damage || 0;
  game.vehicles.list.push(v);
  v.driver = 'player';
  s.player.inCar = v;
  s.player.x = v.x;
  s.player.z = v.z;
  showToast(s, 'You take out the ' + v.name + '.', 2);
  return true;
}

// Repaint the car the player is driving ($50, cycles paint colours).
export function repaint(game) {
  const s = game.state;
  const v = s.player.inCar;
  if (!v) {
    showToast(s, 'Drive a car into the garage to repaint it.', 2);
    return false;
  }
  if (s.cash < TUNE.repaintPrice) {
    showToast(s, 'Repaint costs $' + TUNE.repaintPrice + '.', 2);
    return false;
  }
  s.cash -= TUNE.repaintPrice;
  const g = game.garage;
  g.paintIdx = (g.paintIdx + 1) % COL.carPaint.length;
  v.colour = [...COL.carPaint[g.paintIdx]];
  const owned = s.ownedCars.find((c) => c.id === v.id);
  if (owned) owned.colour = [...v.colour];
  showToast(s, 'Repainted! -$' + TUNE.repaintPrice, 2);
  return true;
}

export function garageMenuData(game) {
  return game.state.ownedCars.map((c, i) => ({
    idx: i, name: c.name, type: c.type, colour: c.colour,
  }));
}
