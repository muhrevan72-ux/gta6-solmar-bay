// Solmar Bay — taxi service (rebuild #13).
import { makeVehicle } from './vehicles.js';
import { COL } from './config.js';
import { addCash } from './state.js';

export function stepTaxiCall(g, dt) {
  if (!g._taxiRequested || g._taxiCab) return;
  const cab = makeVehicle('taxi', g.player.x + 60, g.player.z + 20, 0, COL.taxiYellow, 'Solmar Cab');
  cab.driver = null;
  g.vehicles.push(cab);
  g._taxiCab = cab;
  g._taxiState = 'driving';
  g._taxiWait = 0;
}

export function unstickCalledTaxi(g) {
  const cab = g._taxiCab;
  if (!cab) return false;
  cab.x = g.player.x + 20;
  cab.z = g.player.z + 10;
  cab.heading = Math.atan2(g.player.x - cab.x, g.player.z - cab.z);
  return true;
}

export function startTaxiFare(g) {
  const cab = g._taxiCab;
  if (!cab || g.player.inCar !== cab) return false;
  g._taxiState = 'fare';
  g.missionMarker = { x: 120, z: -120, label: 'Fare destination' };
  return true;
}

export function stepTaxiFare(g, dt) {
  const cab = g._taxiCab;
  if (!cab) return;
  if (g._taxiState === 'driving') {
    const dx = g.player.x - cab.x, dz = g.player.z - cab.z;
    const d = Math.hypot(dx, dz);
    if (d < 4) {
      g._taxiState = 'waiting';
      g._taxiWait = 0;
      cab.speed = 0;
      return;
    }
    cab.heading = Math.atan2(dx, dz);
    const speed = 12;
    cab.x += Math.sin(cab.heading) * speed * dt;
    cab.z += Math.cos(cab.heading) * speed * dt;
  } else if (g._taxiState === 'waiting') {
    g._taxiWait += dt;
    if (g._taxiWait > 30) {
      const idx = g.vehicles.indexOf(cab);
      if (idx >= 0) g.vehicles.splice(idx, 1);
      g._taxiCab = null;
      g._taxiState = null;
      g._taxiRequested = false;
    }
  } else if (g._taxiState === 'fare') {
    if (g.missionMarker && Math.hypot(g.player.x - g.missionMarker.x, g.player.z - g.missionMarker.z) < 8) {
      addCash(g, 120, 'taxi fare');
      g.stats.fares += 1;
      g.respect += 10;
      g._taxiState = null;
      g._taxiRequested = false;
      g.missionMarker = null;
      const idx = g.vehicles.indexOf(cab);
      if (idx >= 0) g.vehicles.splice(idx, 1);
      if (g.player.inCar === cab) g.player.inCar = null;
      g._taxiCab = null;
    }
  }
}
