// Solmar Bay — the taxi.
//
// Call a cab (phone, or Digit 4): it spawns on the street and
// drives to the player, then waits 30 s. Getting in starts a fare
// to a marker; reaching it pays $120 + 10 respect.

import { COL } from './config.js';
import { makeVehicle } from './vehicles.js';

export function stepTaxiCall(g, dt) {
  if (!g._taxiRequested) return false;
  if (g._taxiCab) return false;
  const a = Math.random() * Math.PI * 2;
  const cab = makeVehicle(
    'taxi',
    g.player.x + Math.cos(a) * 60,
    g.player.z + Math.sin(a) * 60,
    0,
    COL.taxiYellow,
    'Solmar Cab',
  );
  cab.driver = 'npc';
  g.vehicles = g.vehicles || [];
  g.vehicles.push(cab);
  g._taxiCab = cab;
  g._taxiState = 'driving';
  g._taxiWait = 0;
  return true;
}

export function stepTaxiFare(g, dt) {
  const cab = g._taxiCab;
  if (!cab) return;
  if (g._taxiState === 'driving') {
    const dx = g.player.x - cab.x;
    const dz = g.player.z - cab.z;
    const d = Math.hypot(dx, dz);
    if (d < 4) {
      g._taxiState = 'waiting';
      g._taxiWait = 0;
      return;
    }
    const step = Math.min(d - 4, 15 * dt);
    cab.x += (dx / d) * step;
    cab.z += (dz / d) * step;
    cab.heading = Math.atan2(dx / d, dz / d);
  } else if (g._taxiState === 'waiting') {
    g._taxiWait = (g._taxiWait || 0) + dt;
    if (g._taxiWait >= 30) {
      g.vehicles = (g.vehicles || []).filter((v) => v !== cab);
      g._taxiCab = null;
      g._taxiState = null;
      g._taxiRequested = false;
    }
  } else if (g._taxiState === 'fare') {
    if (!g.missionMarker) return;
    if (Math.hypot(g.player.x - g.missionMarker.x, g.player.z - g.missionMarker.z) < 6) {
      g.cash = (g.cash || 0) + 120;
      g.stats.fares = (g.stats.fares || 0) + 1;
      g.respect = (g.respect || 0) + 10;
      g._taxiState = null;
      g.missionMarker = null;
      g.vehicles = (g.vehicles || []).filter((v) => v !== cab);
      g._taxiCab = null;
      g._taxiRequested = false;
    }
  }
}

// The player got into the called cab: start the fare.
export function startTaxiFare(g) {
  if (!g._taxiCab) return false;
  if (g.player.inCar !== g._taxiCab) return false;
  g._taxiState = 'fare';
  g.missionMarker = { x: 60 + Math.floor(Math.random() * 120), z: 60 + Math.floor(Math.random() * 120) };
  return true;
}

// A cab stuck far away is teleported back near the player.
export function unstickCalledTaxi(g) {
  const cab = g._taxiCab;
  if (!cab) return false;
  const d = Math.hypot(cab.x - g.player.x, cab.z - g.player.z);
  if (d < 400) return false;
  cab.x = g.player.x + 50;
  cab.z = g.player.z + 50;
  return true;
}
