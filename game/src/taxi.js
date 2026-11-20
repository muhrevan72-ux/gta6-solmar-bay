// Solmar Bay — taxis: call one (Digit 4 / phone), it drives to
// you, waits, and taking it starts a fare to a marker ($120).
//
// stepTaxiCall ONLY spawns the cab (when requested). stepTaxiFare
// is the main stepper: it drives the cab to the player, waits,
// and completes the fare.

import { makeVehicle } from './vehicles.js';

// Spawn the cab when one was requested (and none exists yet).
export function stepTaxiCall(g, dt) {
  if (!g._taxiRequested) return;
  if (!g._taxiCab) {
    const cab = makeVehicle('taxi', g.player.x + 60, g.player.z + 60, 0, [1, 0.85, 0.1], 'Solmar Cab');
    cab.speed = 0;
    g._taxiCab = cab;
    g.vehicles.push(cab);
    g._taxiState = 'driving';
  }
}

// Getting into the called cab starts a fare. Returns true.
export function startTaxiFare(g) {
  g._taxiState = 'fare';
  g._taxiRequested = false;
  g.missionMarker = { x: -120, z: -60 };
  g.toast = 'Taxi fare — drive to the marker';
  g.toastTimer = 3;
  return true;
}

// The main taxi stepper. Returns true when a fare completes.
export function stepTaxiFare(g, dt) {
  const cab = g._taxiCab;
  if (!cab) return false;
  if (g._taxiState === 'driving') {
    // Drive to the player at speed 12; arrive (< 4 m) -> waiting.
    const dx = g.player.x - cab.x;
    const dz = g.player.z - cab.z;
    const d = Math.hypot(dx, dz) || 1;
    if (d < 4) {
      g._taxiState = 'waiting';
      g._taxiWaitTimer = 30;
    } else {
      cab.heading = Math.atan2(dx, dz);
      cab.speed = 12;
      cab.x += Math.sin(cab.heading) * cab.speed * dt;
      cab.z += Math.cos(cab.heading) * cab.speed * dt;
    }
    return false;
  }
  if (g._taxiState === 'waiting') {
    // A cab that waits 30 s leaves. (The timer may be unset when
    // the state was entered directly — start it at 30 s then.)
    if (g._taxiWaitTimer === undefined || g._taxiWaitTimer === null) g._taxiWaitTimer = 30;
    g._taxiWaitTimer -= dt;
    if (g._taxiWaitTimer <= 0) {
      // The cab leaves.
      g.vehicles = g.vehicles.filter(v => v !== cab);
      g._taxiCab = null;
      g._taxiState = null;
      g._taxiRequested = false;
    }
    return false;
  }
  if (g._taxiState === 'fare') {
    const m = g.missionMarker;
    if (!m) return false;
    const d = Math.hypot(g.player.x - m.x, g.player.z - m.z);
    if (d < 10) {
      g.cash += 120;
      g.respect = (g.respect || 0) + 10;
      g.stats.fares = (g.stats.fares || 0) + 1;
      g.toast = 'Fare complete! +$120, +10 respect';
      g.toastTimer = 3;
      // The cab stays as a normal vehicle; clear the fare state.
      g._taxiState = null;
      g._taxiCab = null;
      g.missionMarker = null;
      return true;
    }
  }
  return false;
}

// A cab that got stuck (too far from the player) is teleported
// back within 400 m of the player.
export function unstickCalledTaxi(g) {
  const cab = g._taxiCab;
  if (!cab) return false;
  const d = Math.hypot(cab.x - g.player.x, cab.z - g.player.z);
  if (d > 400) {
    cab.x = g.player.x + 50;
    cab.z = g.player.z + 50;
    return true;
  }
  return false;
}
