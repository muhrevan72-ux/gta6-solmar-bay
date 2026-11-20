// Solmar Bay — garage (rebuild #13).
import { SPAWNS } from './config.js';
import { showToast } from './state.js';
import { makeVehicle } from './vehicles.js';

const GARAGE_MAX = 6;

export function tryGarage(g) {
  const d = Math.hypot(g.player.x - SPAWNS.garageDoor.x, g.player.z - SPAWNS.garageDoor.z);
  if (d > 10) return false;
  if (g.player.inCar) {
    if (g.ownedCars.length >= GARAGE_MAX) return false;
    const v = g.player.inCar;
    v.owned = true;
    g.ownedCars.push({ name: v.name, colour: v.colour, condition: v.condition, kind: v.kind });
    const idx = g.vehicles.indexOf(v);
    if (idx >= 0) g.vehicles.splice(idx, 1);
    g.player.inCar = null;
    showToast(g, `${v.name} stored in the garage`);
    return true;
  }
  g.modal = {
    kind: 'garage',
    title: 'Garage',
    lines: g.ownedCars.length === 0
      ? ['The garage is empty. Drive a car here and press E to store it.']
      : g.ownedCars.map((c, i) => `${i + 1}. ${c.name} — Condition ${Math.round(c.condition)}%`),
  };
  return true;
}

export function takeOutCar(g, i) {
  if (i < 0 || i >= g.ownedCars.length) return false;
  const c = g.ownedCars.splice(i, 1)[0];
  const v = makeVehicle(c.kind || 'car', SPAWNS.garageDoor.x + 6, SPAWNS.garageDoor.z, 0, c.colour, c.name);
  v.condition = c.condition;
  v.owned = true;
  g.vehicles.push(v);
  return true;
}

export function repaintCar(g) {
  const v = g.player.inCar;
  if (!v) return false;
  if (g.cash < 50) return false;
  g.cash -= 50;
  v.colour = [Math.random(), Math.random(), Math.random()];
  showToast(g, `${v.name} repainted — $50`);
  return true;
}
