// Solmar Bay — the taxi (rebuild #15).
// Digit 4 calls a cab. It drives to the player, waits, and leaves
// after 30 s. Get in and a fare starts: drive to the marker for
// $120 + 10 respect.

import { makeVehicle } from './vehicles.js';
import { showToast } from './state.js';
import { randomSidewalkPoint } from './world.js';

export function stepTaxiCall(g, dt) {
  if (!g._taxiRequested) return;
  if (g._taxiCab) return;
  // Spawn a cab on a road near the player.
  const v = makeVehicle('taxi', g.player.x + 40, g.player.z + 20, 0, [1, 0.85, 0.1], 'Solmar Cab');
  v.col = [1, 0.85, 0.1];
  v.colour = [1, 0.85, 0.1];
  g.vehicles.push(v);
  g._taxiCab = v;
  g._taxiState = 'driving';
  g._taxiWait = 0;
  g._taxiRequested = false;
}

export function stepTaxiFare(g, dt) {
  const cab = g._taxiCab;
  if (!cab) return;
  if (g._taxiState === 'driving') {
    // Drive toward the player.
    const dx = g.player.x - cab.x;
    const dz = g.player.z - cab.z;
    const d = Math.hypot(dx, dz);
    if (d < 4) {
      g._taxiState = 'waiting';
      g._taxiWait = 0;
      showToast(g, 'Your cab is here.');
    } else {
      const s = Math.min(12 * dt, d);
      cab.x += (dx / d) * s;
      cab.z += (dz / d) * s;
      cab.heading = Math.atan2(dx / d, dz / d);
    }
    return;
  }
  if (g._taxiState === 'waiting') {
    g._taxiWait = (g._taxiWait || 0) + dt;
    if (g._taxiWait >= 30) {
      g.vehicles = g.vehicles.filter((v) => v !== cab);
      g._taxiCab = null;
      g._taxiState = null;
    }
    return;
  }
  if (g._taxiState === 'fare') {
    // The player is in the cab — check the marker.
    if (g.missionMarker) {
      const d = Math.hypot(g.player.x - g.missionMarker.x, g.player.z - g.missionMarker.z);
      if (d < 8) {
        g.cash += 120;
        g.stats.fares = (g.stats.fares || 0) + 1;
        g.respect += 10;
        g._taxiState = null;
        g._taxiCab = null;
        g.missionMarker = null;
        showToast(g, 'Fare complete! +$120');
      }
    }
    return;
  }
}

export function startTaxiFare(g) {
  const cab = g._taxiCab;
  if (!cab) return false;
  if (g.player.inCar !== cab) return false;
  g._taxiState = 'fare';
  const dest = randomSidewalkPoint(g.rng);
  g.missionMarker = { x: dest.x, z: dest.z, label: 'Drop-off' };
  showToast(g, 'Drive to the drop-off!');
  return true;
}

export function unstickCalledTaxi(g) {
  const cab = g._taxiCab;
  if (!cab) return false;
  cab.x = g.player.x + 40;
  cab.z = g.player.z + 10;
  g._taxiState = 'driving';
  return true;
}
