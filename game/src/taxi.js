// Solmar Bay — taxi: a yellow taxi vehicle plus a fare system.
// Pick up a passenger at the taxi stand, drive them to the marker,
// fare + tip based on distance and time.

import { dist2 } from './config.js';
import { addCash, showToast } from './state.js';

export function createTaxi() {
  return {
    passenger: null, // { x, z } destination while a fare runs
    fareT: 0,
    waiting: true, // a passenger waits at the stand
    standT: 0,
  };
}

export function updateTaxi(game, dt) {
  const taxi = game.taxi;
  const p = game.player;
  const inTaxi = p.inVehicle && p.inVehicle.type === 'taxi';
  if (!taxi.passenger && taxi.waiting && inTaxi) {
    // pick up at the stand
    if (dist2(p.x, p.z, 0, 50) < 64) {
      const dest = {
        x: -250 + Math.random() * 500,
        z: -250 + Math.random() * 500,
      };
      taxi.passenger = dest;
      taxi.fareT = 0;
      taxi.waiting = false;
      showToast(game.state, 'Passenger aboard! Drive to the marker.', 3);
      if (game.audio) game.audio.play('mission');
    }
  } else if (taxi.passenger) {
    taxi.fareT += dt;
    if (!inTaxi) {
      // left the taxi mid-fare: the passenger walks off
      taxi.passenger = null;
      taxi.waiting = true;
      showToast(game.state, 'The passenger left.', 2);
      return;
    }
    if (dist2(p.x, p.z, taxi.passenger.x, taxi.passenger.z) < 100) {
      const dist = Math.hypot(taxi.passenger.x - 0, taxi.passenger.z - 50);
      const fare = Math.round(40 + dist * 0.25 + Math.max(0, 60 - taxi.fareT));
      addCash(game.state, fare);
      game.state.stats.faresDone += 1;
      showToast(game.state, 'Fare paid! +$' + fare, 3);
      if (game.audio) game.audio.play('win');
      taxi.passenger = null;
      taxi.standT = 8; // next passenger after a short wait
    }
  } else if (!taxi.waiting) {
    taxi.standT -= dt;
    if (taxi.standT <= 0) taxi.waiting = true;
  }
}

export function taxiMarker(game) {
  if (game.taxi.passenger) {
    return { x: game.taxi.passenger.x, z: game.taxi.passenger.z, label: 'Drop-off' };
  }
  if (game.taxi.waiting) {
    return { x: 0, z: 50, label: 'Taxi stand' };
  }
  return null;
}
