// Solmar Bay — the garage.
//
// Drive a car to the garage door to store it (up to 6 cars), or walk
// up on foot to open the garage menu. takeOutCar puts a stored car
// back on the street; repaintCar gives the current car a fresh coat.

import { SPAWNS } from './config.js';
import { makeVehicle } from './vehicles.js';

const MAX_CARS = 6;

function nearDoor(g) {
  return Math.hypot(g.player.x - SPAWNS.garageDoor.x, g.player.z - SPAWNS.garageDoor.z) < 6;
}

export function tryGarage(g) {
  if (!nearDoor(g)) return false;
  if (g.player.inCar) {
    if ((g.ownedCars || []).length >= MAX_CARS) return false;
    const v = g.player.inCar;
    g.ownedCars.push({ name: v.name, colour: v.color, condition: v.condition, kind: v.kind });
    v.owned = true;
    g.player.inCar = null;
    v.driver = null;
    g.vehicles = (g.vehicles || []).filter((x) => x !== v);
    g.toast = `${v.name} stored in the garage`;
    g.toastTimer = 3;
    return true;
  }
  g.modal = {
    kind: 'garage',
    title: 'Garage',
    lines: (g.ownedCars || []).map((c, i) => `${i + 1}. ${c.name} — Condition ${c.condition}%`),
  };
  if (!g.modal.lines.length) g.modal.lines = ['No cars stored yet. Drive a car here to store it.'];
  return true;
}

export function takeOutCar(g, idx) {
  const cars = g.ownedCars || [];
  if (idx < 0 || idx >= cars.length) return false;
  const c = cars[idx];
  g.ownedCars = cars.filter((_, i) => i !== idx);
  const v = makeVehicle(c.kind || 'car', SPAWNS.garageDoor.x + 4, SPAWNS.garageDoor.z, 0, c.colour, c.name);
  v.condition = c.condition;
  v.owned = true;
  g.vehicles = g.vehicles || [];
  g.vehicles.push(v);
  return true;
}

export function repaintCar(g) {
  const v = g.player.inCar;
  if (!v) return false;
  if ((g.cash || 0) < 50) return false;
  g.cash -= 50;
  const colours = [
    [0.9, 0.2, 0.2], [0.2, 0.4, 0.9], [0.9, 0.8, 0.2], [0.3, 0.7, 0.4],
    [0.7, 0.3, 0.8], [0.85, 0.5, 0.2], [0.9, 0.9, 0.95], [0.15, 0.15, 0.18],
  ];
  let next = colours[Math.floor(Math.random() * colours.length)];
  if (JSON.stringify(next) === JSON.stringify(v.color)) next = colours[(colours.indexOf(next) + 1) % colours.length];
  v.color = next;
  v.colour = next;
  return true;
}
