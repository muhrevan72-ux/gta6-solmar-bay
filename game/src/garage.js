// Solmar Bay — the garage: store cars, take them out, repaint.
// The garage holds at most 6 cars. The door is at (150,-128).

import { SPAWNS } from './config.js';

export function nearGarageDoor(g) {
  const d = Math.hypot(g.player.x - SPAWNS.garageDoor.x, g.player.z - SPAWNS.garageDoor.z);
  return d < 6;
}

// E at the garage door: on foot opens the garage modal; driving a
// car stores it. Returns true when the garage handled the key,
// false when the garage is full or the player is far away.
export function tryGarage(g) {
  if (!nearGarageDoor(g)) return false;
  if (g.player.inCar) {
    const car = g.player.inCar;
    if (!g.ownedCars) g.ownedCars = [];
    if (g.ownedCars.length >= 6) {
      g.toast = 'Garage is full (6 cars)';
      g.toastTimer = 3;
      return false;
    }
    car.owned = true;
    car.driver = null;
    g.ownedCars.push(car);
    g.vehicles = g.vehicles.filter(v => v !== car);
    g.player.inCar = null;
    g.player.x = SPAWNS.garageDoor.x;
    g.player.z = SPAWNS.garageDoor.z;
    g.toast = `${car.name} stored in the garage`;
    g.toastTimer = 3;
    return true;
  }
  g.modal = { kind: 'garage', title: 'Solmar Garage', lines: (g.ownedCars || []).map(c => c.name) };
  return true;
}

// Take a stored car back out onto the street.
export function takeOutCar(g, i) {
  if (!g.ownedCars || i < 0 || i >= g.ownedCars.length) return false;
  const car = g.ownedCars.splice(i, 1)[0];
  car.x = SPAWNS.garageDoor.x;
  car.z = SPAWNS.garageDoor.z + 4;
  car.heading = 0;
  car.driver = null;
  g.vehicles.push(car);
  g.modal = null;
  return true;
}

// Repaint the player's current car for $50.
export function repaintCar(g) {
  const car = g.player.inCar;
  if (!car) return false;
  if (g.cash < 50) {
    g.toast = 'Repaint costs $50';
    g.toastTimer = 3;
    return false;
  }
  g.cash -= 50;
  const palette = [[0.9, 0.2, 0.2], [0.2, 0.5, 0.9], [0.95, 0.75, 0.1], [0.2, 0.8, 0.4], [0.7, 0.3, 0.9]];
  let idx = palette.findIndex(c => c[0] === car.colour[0] && c[1] === car.colour[1] && c[2] === car.colour[2]);
  car.colour = palette[(idx + 1) % palette.length];
  g.toast = 'Car repainted — $50';
  g.toastTimer = 3;
  return true;
}
