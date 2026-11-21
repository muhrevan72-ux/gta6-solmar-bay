// Solmar Bay — the taxi. Digit4 calls a cab; it drives to the
// player, waits, and — once the player gets in — runs a fare to
// a marker for $120.

import { makeVehicle } from './vehicles.js';
import { addCash, showToast } from './state.js';

export function stepTaxiCall(g, dt) {
  if (!g._taxiRequested || g._taxiCab) return;
  // Spawn a cab on a road near the player.
  const a = Math.random() * Math.PI * 2;
  const x = g.player.x + Math.cos(a) * 50;
  const z = g.player.z + Math.sin(a) * 50;
  const cab = makeVehicle('taxi', x, z, 0, [1, 0.85, 0.1], 'Solmar Cab');
  g.vehicles.push(cab);
  g._taxiCab = cab;
  g._taxiState = 'driving';
  g._taxiWait = 0;
  showToast(g, 'Taxi dispatched');
}

export function stepTaxiFare(g, dt) {
  const cab = g._taxiCab;
  if (!cab) return;
  const d = Math.hypot(cab.x - g.player.x, cab.z - g.player.z);
  if (g._taxiState === 'driving') {
    if (d < 2.5) {
      g._taxiState = 'waiting';
      g._taxiWait = 0;
      showToast(g, 'Your taxi is here — press E to get in');
      return;
    }
    // Drive toward the player.
    const sp = 14 * dt;
    cab.x += ((g.player.x - cab.x) / d) * sp;
    cab.z += ((g.player.z - cab.z) / d) * sp;
    cab.heading = Math.atan2(g.player.x - cab.x, g.player.z - cab.z);
  } else if (g._taxiState === 'waiting') {
    g._taxiWait += dt;
    if (g._taxiWait > 30) {
      // The cab gives up and leaves.
      const idx = g.vehicles.indexOf(cab);
      if (idx >= 0) g.vehicles.splice(idx, 1);
      g._taxiCab = null;
      g._taxiState = null;
      g._taxiRequested = false;
    }
  } else if (g._taxiState === 'fare') {
    if (g.missionMarker && Math.hypot(g.player.x - g.missionMarker.x, g.player.z - g.missionMarker.z) < 6) {
      addCash(g, 120, 'taxi fare');
      g.stats.fares++;
      g.respect += 10;
      g._taxiState = null;
      g._taxiCab = null;
      g._taxiRequested = false;
      g.missionMarker = null;
      showToast(g, 'Fare complete +$120');
    }
  }
}

// The player got into the called cab: start the fare.
export function startTaxiFare(g) {
  const cab = g._taxiCab;
  if (!cab || g.player.inCar !== cab) return false;
  g._taxiState = 'fare';
  const spots = [[120, 120], [-60, -120], [200, 60], [-180, -60], [0, -180]];
  const s = spots[Math.floor(Math.random() * spots.length)];
  g.missionMarker = { x: s[0], z: s[1] };
  showToast(g, 'Drive to the fare marker');
  return true;
}

// Teleport a stuck cab closer to the player (< 400 m).
export function unstickCalledTaxi(g) {
  const cab = g._taxiCab;
  if (!cab) return false;
  const d = Math.hypot(cab.x - g.player.x, cab.z - g.player.z);
  if (d < 400) return false;
  cab.x = g.player.x + 40;
  cab.z = g.player.z + 20;
  return true;
}
