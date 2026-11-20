// Solmar Bay — garage + car ownership.
//
// Drive into the garage (E at the door while in a car): store
// the current car, list owned cars, take one out (1–9), repaint
// the current car ($50). Owned cars persist in the save.

import { SPAWNS, TUNE, dist } from './config.js';
import { showToast } from './state.js';
import { makeVehicle } from './vehicles.js';

export function tryGarage(game) {
  const p = game.player;
  // Enter the garage: in a car, at the door.
  if (p.inCar && dist(p.x, p.z, SPAWNS.garageDoor.x, SPAWNS.garageDoor.z) < 8) {
    const car = p.inCar;
    if (!game.ownedCars.find((c) => c.id === car.id)) {
      game.ownedCars.push({ id: car.id, name: car.name, colour: car.colour, kind: car.kind });
      showToast(game, `${car.name} stored in the garage (${game.ownedCars.length} owned)`);
    }
    game.modal = {
      kind: 'garage',
      title: 'Garage — Bay Street',
      lines: [
        ...game.ownedCars.map((c, i) => `${i + 1}. ${c.name} — press ${i + 1} to take out`),
        `0. Repaint current car — $${TUNE.repaintPrice}`,
        'Esc. Leave',
      ],
    };
    return true;
  }
  return false;
}

// Take out owned car i (number key).
export function takeOutCar(game, i) {
  if (!game.modal || game.modal.kind !== 'garage') return false;
  const owned = game.ownedCars[i];
  if (!owned) return false;
  const p = game.player;
  // Spawn the car just outside the garage door.
  const v = makeVehicle(owned.kind, SPAWNS.garageDoor.x + 4, SPAWNS.garageDoor.z + 8, 0, {
    name: owned.name, colour: owned.colour, owner: 'player', parked: false,
  });
  v.id = owned.id;
  game.vehicles.push(v);
  p.inCar = v;
  v.driver = 'player';
  game.modal = null;
  showToast(game, `Took out the ${owned.name}`);
  return true;
}

// Repaint the current car (key 0 in the garage menu).
export function repaintCar(game) {
  const p = game.player;
  if (!p.inCar) return false;
  if (game.cash < TUNE.repaintPrice) {
    showToast(game, `Repaint costs $${TUNE.repaintPrice}`);
    return false;
  }
  const palette = [
    [0.85, 0.15, 0.15], [0.15, 0.35, 0.85], [0.95, 0.75, 0.15],
    [0.2, 0.7, 0.3], [0.9, 0.9, 0.9], [0.5, 0.2, 0.7],
  ];
  const cur = palette.findIndex((c) => c[0] === p.inCar.colour[0] && c[1] === p.inCar.colour[1]);
  const next = palette[(cur + 1) % palette.length];
  game.cash -= TUNE.repaintPrice;
  p.inCar.colour = next;
  const owned = game.ownedCars.find((c) => c.id === p.inCar.id);
  if (owned) owned.colour = next;
  showToast(game, `Repainted the ${p.inCar.name} — $${TUNE.repaintPrice}`);
  game.modal = null;
  return true;
}
