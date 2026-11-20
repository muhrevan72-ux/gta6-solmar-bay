// Solmar Bay — garage.
//
// The Bay Garage (150, -126) stores the player's cars. Drive a
// car to the garage door and press E to store it; press E at the
// door on foot to take a car out or repaint it for $50. The
// garage modal is a real menu: 1/2/3 pick a car, R repaints.

import { SPAWNS, TUNE } from './config.js';
import { dist } from './config.js';
import { showToast } from './state.js';
import { makeVehicle } from './vehicles.js';

export function tryGarage(game) {
  const p = game.player;
  const door = SPAWNS.garageDoor;
  if (dist(p.x, p.z, door.x, door.z) > 5) return false;
  if (p.inCar) {
    // Store the car.
    const v = p.inCar;
    if (game.ownedCars.length >= 6) {
      showToast(game, 'Garage full (6 cars).');
      return false;
    }
    v.owned = true;
    game.ownedCars.push({ name: v.name, colour: v.colour, condition: v.condition, kind: v.kind });
    game.vehicles = game.vehicles.filter((x) => x !== v);
    p.inCar = null;
    p.x = door.x;
    p.z = door.z + 3;
    showToast(game, `${v.name} stored in the garage.`);
    return true;
  }
  // On foot: open the garage menu.
  const lines = game.ownedCars.length
    ? game.ownedCars.map((c, i) => `${i + 1}. ${c.name} — ${Math.round(c.condition)}%`)
    : ['(Garage empty — steal a car and drive it here.)'];
  lines.push('', 'Press 1-6 to take a car out, R to repaint ($50), Esc to leave.');
  game.modal = { kind: 'garage', title: 'Bay Garage', lines };
  return true;
}

export function takeOutCar(game, idx) {
  const c = game.ownedCars[idx];
  if (!c) return false;
  const door = SPAWNS.garageDoor;
  const v = makeVehicle(c.kind, door.x, door.z + 6, 0, c.colour, c.name);
  v.owned = true;
  v.condition = c.condition;
  game.vehicles.push(v);
  game.ownedCars.splice(idx, 1);
  game.modal = null;
  showToast(game, `${c.name} is out — press E to get in.`);
  return true;
}

export function repaintCar(game) {
  const p = game.player;
  if (!p.inCar) {
    showToast(game, 'Repaint needs a car — drive one here first.');
    return false;
  }
  if (game.cash < TUNE.repaintPrice) {
    showToast(game, 'Repaint costs $50.');
    return false;
  }
  game.cash -= TUNE.repaintPrice;
  const cols = [
    [0.85, 0.15, 0.15],
    [0.15, 0.35, 0.85],
    [0.95, 0.75, 0.15],
    [0.2, 0.7, 0.3],
    [0.9, 0.9, 0.9],
    [0.95, 0.45, 0.1],
  ];
  p.inCar.colour = cols[Math.floor(Math.random() * cols.length)];
  showToast(game, 'Repainted! Fresh paint, $50.');
  return true;
}
