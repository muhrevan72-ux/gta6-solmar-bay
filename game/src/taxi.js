// Solmar Bay — the taxi service.
//
// Digit 4 (or a call from the phone) requests a cab. The cab drives to
// the player and waits; getting in starts a fare to a marker across
// town, and arriving pays $120 plus respect. A cab that waits 30 s
// without a passenger drives off, and a stuck cab can be teleported
// back within reach.

import { makeVehicle } from './vehicles.js';
import { addCash, showToast } from './state.js';

const FARE_SPOTS = [
  { x: 150, z: 150, label: 'Fare' },
  { x: -120, z: -120, label: 'Fare' },
  { x: 60, z: 240, label: 'Fare' },
  { x: -240, z: -60, label: 'Fare' },
  { x: 240, z: 60, label: 'Fare' },
  { x: 0, z: -240, label: 'Fare' },
];

export function stepTaxiCall(g, dt) {
  if (!g._taxiRequested) return;
  if (!g._taxiCab) {
    const p = g.player;
    const cab = makeVehicle('taxi', p.x + 60, p.z + 60, 0, [1, 0.85, 0.1], 'Solmar Cab');
    cab.speed = 0;
    g.vehicles.push(cab);
    g._taxiCab = cab;
    g._taxiState = 'driving';
    g._taxiWait = 0;
    showToast(g, 'A Solmar Cab is on its way.');
  }
}

export function stepTaxiFare(g, dt) {
  const cab = g._taxiCab;
  if (!cab) return;
  const p = g.player;

  if (g._taxiState === 'driving') {
    const dx = p.x - cab.x;
    const dz = p.z - cab.z;
    const d = Math.hypot(dx, dz);
    if (d <= 3) {
      g._taxiState = 'waiting';
      g._taxiWait = 0;
      showToast(g, 'Your cab is waiting. Press E to get in.');
      return;
    }
    const speed = 14;
    const step = Math.min(d - 3, speed * dt);
    cab.x += (dx / d) * step;
    cab.z += (dz / d) * step;
    cab.heading = Math.atan2(dx, dz);
    return;
  }

  if (g._taxiState === 'waiting') {
    g._taxiWait = (g._taxiWait || 0) + dt;
    if (g._taxiWait >= 30) {
      // The cab gives up and leaves.
      g.vehicles = g.vehicles.filter((v) => v !== cab);
      g._taxiCab = null;
      g._taxiState = null;
      g._taxiRequested = false;
      showToast(g, 'The cab left — call another one when you need it.');
    }
    return;
  }

  if (g._taxiState === 'fare') {
    const m = g.missionMarker;
    if (m && Math.hypot(p.x - m.x, p.z - m.z) <= 8) {
      // Fare complete.
      addCash(g, 120, 'Taxi fare');
      g.respect += 10;
      g.stats.fares += 1;
      if (p.inCar === cab) {
        p.inCar = null;
        cab.driver = null;
        p.x = cab.x + 2.5;
        p.z = cab.z;
      }
      g.vehicles = g.vehicles.filter((v) => v !== cab);
      g._taxiCab = null;
      g._taxiState = null;
      g._taxiRequested = false;
      g.missionMarker = null;
      showToast(g, 'Fare complete — $120 earned.');
    }
    return;
  }
}

// The player got into the called cab: the fare starts.
export function startTaxiFare(g) {
  const cab = g._taxiCab;
  if (!cab || g.player.inCar !== cab) return false;
  g._taxiState = 'fare';
  const spot = FARE_SPOTS[Math.floor(Math.random() * FARE_SPOTS.length)];
  g.missionMarker = { ...spot };
  showToast(g, 'Fare started — take the passenger to the marker.');
  return true;
}

// A cab that got stuck far away is teleported back within reach.
export function unstickCalledTaxi(g) {
  const cab = g._taxiCab;
  if (!cab) return false;
  const p = g.player;
  cab.x = p.x + 30;
  cab.z = p.z + 30;
  cab.heading = Math.atan2(p.x - cab.x, p.z - cab.z);
  g._taxiState = 'driving';
  return true;
}
