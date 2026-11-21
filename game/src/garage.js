// Solmar Bay — the garage.
//
// Drive a car to the garage door to store it (up to 6 cars), walk up
// on foot to open the garage list, take a car back out, or repaint the
// car you are sitting in for $50.

import { makeVehicle } from './vehicles.js';
import { showToast } from './state.js';
import { SPAWNS } from './config.js';

const PAINTS = [
  [0.85, 0.2, 0.25],
  [0.2, 0.4, 0.9],
  [0.95, 0.75, 0.1],
  [0.2, 0.8, 0.3],
  [0.6, 0.3, 0.8],
  [0.9, 0.5, 0.1],
];

export function tryGarage(g) {
  const p = g.player;
  if (Math.hypot(p.x - SPAWNS.garageDoor.x, p.z - SPAWNS.garageDoor.z) > 6) return false;
  if (p.inCar) {
    // Store the car you are driving.
    if (g.ownedCars.length >= 6) {
      showToast(g, 'Garage is full — 6 cars already.');
      return false;
    }
    const v = p.inCar;
    v.owned = true;
    g.ownedCars.push({ name: v.name, colour: v.colour, condition: v.condition, kind: v.kind });
    g.vehicles = g.vehicles.filter((car) => car !== v);
    p.inCar = null;
    showToast(g, `${v.name} stored in the garage.`);
    return true;
  }
  // On foot: open the garage list.
  const lines = g.ownedCars.length === 0
    ? ['Garage is empty.']
    : g.ownedCars.map((c, i) => `${i + 1}. ${c.name} — ${Math.round(c.condition)}%`);
  g.modal = { kind: 'garage', title: 'Garage', lines };
  return true;
}

export function takeOutCar(g, index) {
  if (index < 0 || index >= g.ownedCars.length) return false;
  const stored = g.ownedCars.splice(index, 1)[0];
  const v = makeVehicle(stored.kind || 'car', SPAWNS.garageDoor.x, SPAWNS.garageDoor.z + 6, 0, stored.colour, stored.name);
  v.condition = stored.condition;
  v.owned = true;
  g.vehicles.push(v);
  return true;
}

export function repaintCar(g, colour) {
  const p = g.player;
  if (!p.inCar) return false;
  if (g.cash < 50) return false;
  g.cash -= 50;
  const paint = colour || PAINTS[Math.floor(Math.random() * PAINTS.length)];
  p.inCar.colour = paint;
  showToast(g, 'Repainted — $50.');
  return true;
}
