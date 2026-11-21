// Solmar Bay — the taxi call and fares.
// Written fresh for rebuild #18.

import { COL } from './config.js';
import { makeVehicle } from './vehicles.js';
import { addCash, showToast } from './state.js';

// Spawn the called cab near the player (off-screen, on a road).
export function stepTaxiCall(g, dt) {
  if (!g._taxiRequested) return;
  if (g._taxiCab) return;
  const cab = makeVehicle('taxi', g.player.x + 60, g.player.z, Math.PI / 2, COL.taxiYellow, 'Solmar Cab');
  cab._isTaxi = true;
  g.vehicles.push(cab);
  g._taxiCab = cab;
  g._taxiState = 'driving';
  g._taxiRequested = false;
}

// Drive the cab to the player, wait, then leave if ignored.
export function stepTaxiFare(g, dt) {
  const cab = g._taxiCab;
  if (!cab) return;
  if (g._taxiState === 'driving') {
    const dx = g.player.x - cab.x, dz = g.player.z - cab.z;
    const d = Math.hypot(dx, dz) || 1;
    if (d < 6) {
      g._taxiState = 'waiting';
      g._taxiWait = 30;
      return;
    }
    const speed = 13;
    cab.heading = Math.atan2(dx, dz);
    cab.x += Math.sin(cab.heading) * speed * dt;
    cab.z += Math.cos(cab.heading) * speed * dt;
  } else if (g._taxiState === 'waiting') {
    if (g._taxiWait === undefined || g._taxiWait === null) g._taxiWait = 30;
    g._taxiWait -= dt;
    if (g._taxiWait <= 0) {
      // The player never got in — the cab leaves.
      g.vehicles = g.vehicles.filter((v) => v !== cab);
      g._taxiCab = null;
      g._taxiState = null;
      showToast(g, 'The taxi gave up waiting and left.');
    }
  } else if (g._taxiState === 'fare') {
    // The fare pays out when the player reaches the marker.
    if (g.missionMarker) {
      const d = Math.hypot(g.player.x - g.missionMarker.x, g.player.z - g.missionMarker.z);
      if (d < 8) {
        addCash(g, 120, 'taxi fare');
        g.respect = (g.respect || 0) + 10;
        g.stats.fares = (g.stats.fares || 0) + 1;
        g._taxiState = null;
        g.missionMarker = null;
        showToast(g, 'Fare complete — $120');
      }
    }
  }
}

// The player is in the cab: start a fare to a random drop-off.
export function startTaxiFare(g) {
  const cab = g._taxiCab;
  if (!cab) return false;
  if (g.player.inCar !== cab) return false;
  g._taxiState = 'fare';
  g.missionMarker = { x: 120, z: -180 };
  return true;
}

// A cab that is stuck far away gets teleported near the player.
export function unstickCalledTaxi(g) {
  const cab = g._taxiCab;
  if (!cab) return false;
  const d = Math.hypot(cab.x - g.player.x, cab.z - g.player.z);
  if (d < 400) return false;
  cab.x = g.player.x + 40;
  cab.z = g.player.z + 20;
  cab.heading = Math.PI / 2;
  g._taxiState = 'driving';
  return true;
}
