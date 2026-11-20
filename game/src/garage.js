// Solmar Bay — the garage (rebuild #15).
// Drive a car to the garage door to store it (up to 6), take a
// stored car back out, or repaint it for $50.

import { SPAWNS } from './config.js';
import { showToast } from './state.js';

export function tryGarage(g) {
  const p = g.player;
  const d = SPAWNS.garageDoor;
  const dist = Math.hypot(p.x - d.x, p.z - d.z);
  if (dist > 8) return false;
  // Driving a car to the door stores it.
  if (p.inCar) {
    if ((g.ownedCars || []).length >= 6) {
      showToast(g, 'Garage is full (6 cars).');
      return false;
    }
    const v = p.inCar;
    v.owned = true;
    v.driver = null;
    g.ownedCars.push(v);
    g.vehicles = g.vehicles.filter((x) => x !== v);
    p.inCar = null;
    showToast(g, `${v.name} stored in the garage.`);
    return true;
  }
  // On foot at the door: open the garage modal.
  g.modal = { kind: 'garage', title: 'Garage', lines: (g.ownedCars || []).map((v, i) => `${i + 1}. ${v.name} — ${Math.round(v.condition)}%`) };
  return true;
}

export function takeOutCar(g, index) {
  const cars = g.ownedCars || [];
  if (index < 0 || index >= cars.length) return false;
  const v = cars[index];
  g.ownedCars.splice(index, 1);
  v.owned = false;
  v.x = SPAWNS.garageDoor.x;
  v.z = SPAWNS.garageDoor.z - 6;
  g.vehicles.push(v);
  showToast(g, `${v.name} is out on the street.`);
  return true;
}

export function repaintCar(g, index, color) {
  // No index: repaint the car the player is sitting in.
  let v = null;
  if (index === undefined || index === null) {
    v = g.player.inCar;
  } else {
    const cars = g.ownedCars || [];
    v = cars[index];
  }
  if (!v) return false;
  if (g.cash < 50) return false;
  g.cash -= 50;
  const c = color || [0.9, 0.2, 0.4];
  v.color = c;
  v.col = c;
  v.colour = c;
  showToast(g, `${v.name} repainted.`);
  return true;
}
