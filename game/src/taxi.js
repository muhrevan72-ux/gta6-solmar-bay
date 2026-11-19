// Solmar Bay — taxi: a yellow taxi vehicle plus a fare system.
// Pick up a passenger at the taxi stand, drive them to the marker,
// fare + tip based on distance and time.

import { dist2, angleLerp } from './config.js';
import { addCash, addRespect, showToast } from './state.js';
import { checkRespectUnlocks } from './missions.js';
import { collideCircle } from './world.js';
import { spawnVehicle } from './vehicles.js';
import { notifyPhone } from './phone.js';

export function createTaxi() {
  return {
    passenger: null, // { x, z } destination while a fare runs
    fareT: 0,
    waiting: true, // a passenger waits at the stand
    standT: 0,
    called: null, // phone-called cab: { veh, tx, tz }
  };
}

// Phone call: send a cab to (x, z). Spawns a taxi on the nearest
// road node and drives it to the player. Returns the vehicle.
export function callTaxiTo(game, x, z) {
  const taxi = game.taxi;
  if (!taxi || taxi.called) return null;
  let best = null;
  let bestD = Infinity;
  for (const n of game.city.roadNodes) {
    const d = dist2(n.x, n.z, x, z);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  if (!best) return null;
  const veh = spawnVehicle(game.vehicles, 'taxi', best.x, best.z, 0, [0.95, 0.8, 0.1]);
  veh.driver = 'taxi-call';
  taxi.called = { veh, tx: x, tz: z };
  return veh;
}

export function updateTaxi(game, dt) {
  const taxi = game.taxi;
  const p = game.player;
  // a phone-called cab drives to the player, then waits as a taxi
  if (taxi.called) {
    const c = taxi.called;
    const veh = c.veh;
    if (!veh || veh.wrecked) {
      taxi.called = null;
    } else {
      const d2 = dist2(veh.x, veh.z, p.x, p.z);
      if (d2 < 64) {
        // arrived: park and wait for the player to get in
        veh.driver = 'parked';
        veh.speed = 0;
        taxi.called = null;
        showToast(game.state, 'Your taxi has arrived!', 3);
        notifyPhone(game, 'Taxi Co.', 'Your cab is here. Get in!');
        if (game.audio) game.audio.play('mission');
      } else {
        const desired = Math.atan2(p.x - veh.x, p.z - veh.z);
        veh.heading = angleLerp(veh.heading, desired, 1 - Math.pow(0.001, dt));
        veh.speed = 14;
        const nx = veh.x + Math.sin(veh.heading) * veh.speed * dt;
        const nz = veh.z + Math.cos(veh.heading) * veh.speed * dt;
        const fixed = collideCircle(game.city, nx, nz, 2.2);
        veh.x = fixed.x;
        veh.z = fixed.z;
      }
    }
  }
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
      addRespect(game.state, 10);
      checkRespectUnlocks(game);
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
