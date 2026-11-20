// Solmar Bay — taxi.
//
// Call a cab from the phone (contact "Solmar Cab") or with the
// Digit 4 key. A taxi spawns on a nearby road and drives to the
// player, parks, and waits. Press E to get in and start a fare:
// the passenger gives a destination, and the fare pays $120 on
// arrival. If the cab gets stuck (no path), it teleports to the
// nearest road point — a parked cab that never arrives was a
// round-4 bug.

import { makeVehicle } from './vehicles.js';
import { randomRoadPoint, isBlocked } from './world.js';
import { makeRng, TUNE } from './config.js';
import { dist } from './config.js';
import { addCash, showToast } from './state.js';

export function stepTaxiCall(game, dt) {
  if (!game._taxiRequested) return;
  // Spawn the cab on the nearest road.
  const rng = makeRng(Math.floor(game.time * 1000) + 7);
  const p = game.player;
  const spot = randomRoadPoint(rng);
  const cab = makeVehicle('taxi', spot.x, spot.z, 0, [1, 0.85, 0.1], 'Solmar Cab');
  cab.driver = 'taxi';
  cab.taxiCalled = true;
  game.vehicles.push(cab);
  game._taxiCab = cab;
  game._taxiRequested = false;
  game._taxiState = 'driving';
  showToast(game, 'Your cab is on its way.');
}

export function unstickCalledTaxi(game) {
  const cab = game._taxiCab;
  if (!cab || game._taxiState !== 'driving') return false;
  const p = game.player;
  const d = dist(cab.x, cab.z, p.x, p.z);
  if (d < 40) return false; // still on its way
  // Stuck: teleport to the nearest road point to the player.
  const rng = makeRng(Math.floor(game.time * 1000) + 13);
  const spot = randomRoadPoint(rng);
  cab.x = spot.x;
  cab.z = spot.z;
  cab.speed = 0;
  return true;
}

export function stepTaxiFare(game, dt) {
  const cab = game._taxiCab;
  if (!cab) return;
  const p = game.player;
  if (game._taxiState === 'driving') {
    // Drive toward the player.
    const d = dist(cab.x, cab.z, p.x, p.z);
    if (d < 4) {
      game._taxiState = 'waiting';
      cab.speed = 0;
      showToast(game, 'Your cab is here. Get in!');
      return;
    }
    const a = Math.atan2(p.x - cab.x, p.z - cab.z);
    cab.heading = a;
    cab.speed = Math.min(18, cab.speed + 6 * dt);
    const nx = cab.x + Math.sin(a) * cab.speed * dt;
    const nz = cab.z + Math.cos(a) * cab.speed * dt;
    if (!isBlocked(game.city, nx, nz)) {
      cab.x = nx;
      cab.z = nz;
    } else {
      // Blocked: try to unstick.
      unstickCalledTaxi(game);
    }
    // Give up driving after 60 s and teleport near the player.
    game._taxiDriveT = (game._taxiDriveT || 0) + dt;
    if (game._taxiDriveT > 60) {
      game._taxiDriveT = 0;
      unstickCalledTaxi(game);
    }
    return;
  }
  if (game._taxiState === 'waiting') {
    // Wait for the player to get in (E). The cab waits 30 s.
    game._taxiWaitT = (game._taxiWaitT || 0) + dt;
    if (game._taxiWaitT > 30) {
      showToast(game, 'The cab left — call another one.');
      game.vehicles = game.vehicles.filter((v) => v !== cab);
      game._taxiCab = null;
      game._taxiState = null;
    }
    return;
  }
  if (game._taxiState === 'fare') {
    // The fare: drive the passenger to the marker.
    if (!game.missionMarker) return;
    const m = game.missionMarker;
    const d = dist(p.x, p.z, m.x, m.z);
    if (d < 6) {
      addCash(game, 120, '— taxi fare');
      game.stats.fares += 1;
      game.respect += 10;
      game.missionMarker = null;
      game._taxiState = null;
      game._taxiCab = null;
      showToast(game, 'Fare complete! +$120 · +10 respect');
    }
  }
}

// Start a fare when the player gets into the called cab.
export function startTaxiFare(game) {
  const p = game.player;
  const cab = p.inCar;
  if (!cab || !cab.taxiCalled) return false;
  game._taxiState = 'fare';
  const spots = [
    { x: 150, z: 150, label: 'Taxi fare — drop off downtown' },
    { x: -180, z: -60, label: 'Taxi fare — drop off northside' },
    { x: 30, z: -180, label: 'Taxi fare — drop off the airport' },
  ];
  game.missionMarker = spots[Math.floor(Math.random() * spots.length)];
  showToast(game, 'Fare started — drive to the marker.');
  return true;
}
