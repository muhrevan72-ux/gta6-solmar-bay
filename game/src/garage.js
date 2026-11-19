// Solmar Bay — the garage: store cars, take them out, repaint.
//
// Drive a stopped car/bike to the garage door (150, -128) and press
// E to store it. On foot, E at the door opens the menu: Digit 1-9
// takes a stored car out, Digit 0 repaints the current car for $50
// (cycles the paint colours). Owned cars persist in the save.

import { TUNE, COL } from './config.js';
import { showToast, addCash } from './state.js';

export function createGarage() {
  return {
    owned: [], // car objects owned by the player
    menuOpen: false,
  };
}

// E at the garage door: store the car you are driving, or open the
// menu on foot.
export function tryGarage(game) {
  const s = game.state;
  const p = s.player;
  const d = Math.hypot(p.x - 150, p.z + 128);
  if (d > 5) return false;
  if (p.inCar) {
    const car = p.inCar;
    if (car.speed > 1) {
      showToast(s, 'Stop the car first.', 3);
      return false;
    }
    // Store it.
    p.inCar = null;
    car.driver = null;
    car.x = 150;
    car.z = -150;
    if (!game.garage.owned.includes(car)) {
      game.garage.owned.push(car);
      s.ownedCars.push(car.name);
    }
    showToast(s, car.name + ' stored in the garage.', 4);
    return true;
  }
  game.garage.menuOpen = !game.garage.menuOpen;
  if (game.garage.menuOpen) {
    const list = game.garage.owned.map((c, i) => (i + 1) + ' ' + c.name).join(' · ') || 'empty';
    showToast(s, 'Garage: ' + list + ' · 0 repaint $50', 5);
  }
  return true;
}

// Digit keys while the garage menu is open: 1-9 take a car out,
// 0 repaints the car you are driving (or the first owned car).
export function garageDigit(game, digit) {
  const s = game.state;
  const p = s.player;
  if (digit === 0) {
    const car = p.inCar || game.garage.owned[0];
    if (!car) { showToast(s, 'No car to repaint.', 3); return false; }
    if (s.cash < TUNE.repaintPrice) {
      showToast(s, 'Repaint costs $' + TUNE.repaintPrice + '.', 3);
      return false;
    }
    addCash(s, -TUNE.repaintPrice);
    const idx = (COL.carPaint.indexOf(car.color) + 1) % COL.carPaint.length;
    car.color = COL.carPaint[idx];
    showToast(s, 'Repainted ' + car.name + ' (-$' + TUNE.repaintPrice + ').', 4);
    return true;
  }
  const car = game.garage.owned[digit - 1];
  if (!car) return false;
  // Take it out: park it at the door, ready to drive.
  car.x = 150;
  car.z = -120;
  car.heading = 0;
  car.driver = null;
  game.vehicles.parked.push(car);
  game.garage.menuOpen = false;
  showToast(s, car.name + ' is outside the garage. Press E to drive it.', 4);
  return true;
}

export function garageBoxes(game, out) {
  // A car lift + tool wall inside the garage (room coordinates are
  // the garage building itself — drawn here for the door area).
  out.pushBox(150, 0.5, -140, 3, 1, 1, [0.7, 0.7, 0.7]);
  out.pushBox(150, 1.5, -160, 4, 0.2, 0.5, [0.9, 0.6, 0.1]);
}
