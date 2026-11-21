// Solmar Bay — the garage: store a car, take one out, repaint.
// The garage holds 6 cars; a 7th is refused.

import { SPAWNS } from './config.js';
import { showToast } from './state.js';

const MAX_GARAGE = 6;

function nearDoor(g) {
  return Math.hypot(g.player.x - SPAWNS.garageDoor.x, g.player.z - SPAWNS.garageDoor.z) < 8;
}

export function tryGarage(g) {
  if (!nearDoor(g)) return false;
  const car = g.player.inCar;
  if (car) {
    // Driving a car in stores it.
    if (g.ownedCars.length >= MAX_GARAGE) {
      showToast(g, 'Garage full — 6 cars max');
      return false;
    }
    car.owned = true;
    car.driver = null;
    g.player.inCar = null;
    g.ownedCars.push(car);
    const idx = g.vehicles.indexOf(car);
    if (idx >= 0) g.vehicles.splice(idx, 1);
    showToast(g, `${car.name} stored in the garage`);
    return true;
  }
  // On foot: open the garage menu.
  g.modal = { kind: 'garage', title: 'Garage' };
  return true;
}

export function takeOutCar(g, idx) {
  if (idx < 0 || idx >= g.ownedCars.length) return false;
  const car = g.ownedCars.splice(idx, 1)[0];
  car.owned = false;
  car.x = SPAWNS.garageDoor.x + 6;
  car.z = SPAWNS.garageDoor.z;
  g.vehicles.push(car);
  showToast(g, `${car.name} taken out`);
  return true;
}

export function repaintCar(g) {
  const car = g.player.inCar;
  if (!car) return false;
  if (g.cash < 50) return false;
  g.cash -= 50;
  const palette = [[0.9, 0.2, 0.2], [0.2, 0.4, 0.9], [0.9, 0.7, 0.2], [0.2, 0.8, 0.4], [0.8, 0.3, 0.7], [0.95, 0.95, 0.95]];
  let next = palette[Math.floor(Math.random() * palette.length)];
  if (next[0] === car.color[0] && next[1] === car.color[1]) next = palette[(palette.indexOf(next) + 1) % palette.length];
  car.color = next;
  showToast(g, 'Car repainted — $50');
  return true;
}
