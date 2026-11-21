// Solmar Bay — the garage: store cars, take them out, repaint.
// Written fresh for rebuild #18.

import { SPAWNS } from './config.js';
import { showToast } from './state.js';

export function tryGarage(g) {
  const door = SPAWNS.garageDoor;
  const d = Math.hypot(g.player.x - door.x, g.player.z - door.z);
  if (d > 10) return false;
  if (g.player.inCar) {
    // Store the car.
    const cars = g.ownedCars || [];
    if (cars.length >= 6) return false;
    const v = g.player.inCar;
    v.owned = true;
    v.driver = null;
    g.player.inCar = null;
    g.vehicles = g.vehicles.filter((x) => x !== v);
    cars.push({ name: v.name, kind: v.kind, color: v.color, condition: v.condition });
    g.ownedCars = cars;
    showToast(g, `${v.name} stored in the garage`);
    return true;
  }
  g.modal = { kind: 'garage', title: 'Garage', lines: ['Your stored cars'] };
  return true;
}

export function takeOutCar(g, i) {
  const cars = g.ownedCars || [];
  if (i < 0 || i >= cars.length) return false;
  const saved = cars.splice(i, 1)[0];
  g.ownedCars = cars;
  const v = {
    kind: saved.kind || 'car',
    x: SPAWNS.garageDoor.x + 6,
    z: SPAWNS.garageDoor.z,
    heading: 0,
    color: saved.color || [0.8, 0.2, 0.2],
    name: saved.name || 'Car',
    condition: saved.condition ?? 100,
    driver: null,
    owned: true,
    speed: 0,
  };
  v.colour = v.color;
  g.vehicles.push(v);
  g.modal = null;
  return true;
}

export function repaintCar(g) {
  const v = g.player.inCar;
  if (!v) return false;
  if ((g.cash || 0) < 50) return false;
  g.cash -= 50;
  const palette = [
    [0.9, 0.2, 0.2], [0.2, 0.5, 0.9], [0.9, 0.7, 0.2], [0.2, 0.8, 0.5],
    [0.8, 0.4, 0.8], [0.95, 0.95, 0.95], [0.15, 0.15, 0.2],
  ];
  let next = palette[Math.floor(Math.random() * palette.length)];
  // Pick a colour that differs from the current one.
  for (let i = 0; i < 6; i++) {
    if (next[0] !== v.color[0] || next[1] !== v.color[1] || next[2] !== v.color[2]) break;
    next = palette[Math.floor(Math.random() * palette.length)];
  }
  v.color = next;
  v.colour = next;
  showToast(g, 'Repainted — $50');
  return true;
}
