// Solmar Bay — taxi side job: yellow taxi, fares with tips.
//
// Pick up a passenger at the taxi stand, drive them to the
// destination marker; the fare + tip depends on distance and time.
// A fare also pays +10 respect.
//
// Calling a taxi from the phone DISPATCHES a cab: it drives to the
// player, parks nearby and toasts "Your cab is here. Get in!". The
// parked cab is a normal parked car — E enters it like any other
// (play-test #4 found the old build's called taxi could not be
// entered at all, so the dispatch parks with driver = null, exactly
// like a parked car, and the E dispatcher treats it as one).

import { dist2, clamp } from './config.js';
import { addCash, addRespect, showToast } from './state.js';
import { makeVehicle } from './vehicles.js';

export function createTaxi() {
  return {
    fare: null, // {px, pz, dx, dz, t, dist}
    waiting: false,
    dispatched: null, // the cab driving to the player (or null)
    arrived: null, // the parked cab waiting for the player (or null)
    dispatchT: 0, // seconds since dispatch (unstick timer)
  };
}

// Dispatch a cab to the player's location (phone call).
export function dispatchTaxi(game) {
  const t = game.taxi;
  if (t.fare || t.dispatched || t.arrived) return false;
  const p = game.state.player;
  // Reuse the city's taxi if it is free, else spawn one nearby.
  let cab = game.vehicles.list.find((v) => v.type === 'taxi' && v.driver !== 'player');
  if (!cab) {
    cab = makeVehicle('taxi', p.x + 30, p.z, 0);
    game.vehicles.list.push(cab);
  }
  cab.driver = 'dispatch';
  cab.speed = 0;
  t.dispatched = cab;
  t.dispatchT = 0;
  showToast(game.state, 'Taxi dispatched — your cab is on its way.', 3);
  return true;
}

// Start a fare: the passenger waits at the taxi stand.
export function startFare(game) {
  const t = game.taxi;
  if (t.fare) return false;
  const dests = [
    { x: 300, z: -100, label: 'Harbour docks' },
    { x: -250, z: 190, label: 'Southside' },
    { x: 200, z: -320, label: 'Airport' },
    { x: -310, z: 100, label: 'Beach' },
    { x: 150, z: -120, label: 'Garage' },
  ];
  const d = dests[Math.floor(Math.random() * dests.length)];
  t.fare = { px: 0, pz: 50, dx: d.x, dz: d.z, label: d.label, t: 0, pickedUp: false, dist: 0 };
  showToast(game.state, 'Taxi fare: pick up the passenger at the stand, then drive to ' + d.label + '.', 4);
  return true;
}

export function stepTaxi(game, dt) {
  const t = game.taxi;
  // --- dispatched cab: drive to the player and park ---
  if (t.dispatched) {
    const cab = t.dispatched;
    const p = game.state.player;
    t.dispatchT += dt;
    if (cab.driver !== 'dispatch') {
      // The player (or someone) took the cab.
      t.dispatched = null;
      t.arrived = null;
    } else {
      const d = Math.sqrt(dist2(cab.x, cab.z, p.x, p.z));
      if (d < 4) {
        // Parked within E range (4.5 m): driver = null, exactly like
        // any parked car, so E enters it through the normal path.
        cab.driver = null;
        cab.speed = 0;
        t.dispatched = null;
        t.arrived = cab;
        showToast(game.state, 'Your cab is here. Get in!', 3);
      } else {
        // Unstick: if it has not arrived in 30 s, move it to a road
        // point near the player and try again.
        if (t.dispatchT > 30) {
          t.dispatchT = 0;
          cab.x = p.x + 25;
          cab.z = p.z + 5;
          cab.speed = 0;
        }
        const targetHeading = Math.atan2(p.x - cab.x, p.z - cab.z);
        let dh = targetHeading - cab.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        cab.heading += clamp(dh, -1.8 * dt, 1.8 * dt);
        cab.speed = clamp(cab.speed + 14 * dt, 0, 26);
        cab.x += Math.sin(cab.heading) * cab.speed * dt;
        cab.z += Math.cos(cab.heading) * cab.speed * dt;
        cab.wheelSpin += cab.speed * dt * 2;
      }
    }
  }
  if (!t.fare) return;
  const f = t.fare;
  const p = game.state.player;
  f.t += dt;
  if (!f.pickedUp) {
    if (dist2(p.x, p.z, f.px, f.pz) < 64) {
      f.pickedUp = true;
      showToast(game.state, 'Passenger aboard — drive to ' + f.label + '.', 3);
    }
    return;
  }
  if (p.inCar) f.dist += Math.abs(p.speed) * dt;
  if (dist2(p.x, p.z, f.dx, f.dz) < 100) {
    // Fare + tip: base $30, +$1 per 20 units driven, tip for speed.
    const base = 30;
    const distPay = Math.floor(f.dist / 20);
    const tip = f.t < 90 ? 15 : 0;
    const total = base + distPay + tip;
    addCash(game.state, total);
    addRespect(game.state, 10);
    game.state.stats.fares++;
    showToast(game.state, 'Fare complete! +$' + total + (tip ? ' (incl. $15 tip)' : ''), 3);
    t.fare = null;
  }
}

export function cancelFare(game) {
  game.taxi.fare = null;
}
