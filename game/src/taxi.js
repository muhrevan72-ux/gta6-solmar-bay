// Solmar Bay — taxis: call one from the phone (Digit 4), ride it,
// and the taxi side job ($120 per fare).
//
// Call flow (play-test #4 fix): the taxi drives to the player, parks
// WITHIN 4 m with driver=null, and waits. E enters it WITHOUT a
// steal crime (it is a called taxi). If it waits 30 s unentered it
// un-sticks itself (teleports beside the player) — vehicles.js owns
// that timer.

import { TUNE, COL } from './config.js';
import { showToast, addCash } from './state.js';
import { completeSideJob } from './missions.js';

export function createTaxi() {
  return {
    called: null, // the called taxi car object
    fare: null, // {active, stage, pickup, dropoff}
  };
}

// Call a taxi to the player. Spawns a yellow taxi on the nearest
// road and drives it to the player.
export function callTaxi(game) {
  const s = game.state;
  const p = s.player;
  if (game.taxi.called) {
    showToast(s, 'A taxi is already on its way.', 3);
    return false;
  }
  // Spawn on the nearest road line.
  const road = game.city.roads.reduce((best, r) => {
    const d = r.vertical ? Math.abs(r.coord - p.x) : Math.abs(r.coord - p.z);
    return d < best.d ? { r, d } : best;
  }, { r: game.city.roads[0], d: Infinity }).r;
  const x = road.vertical ? road.coord : p.x;
  const z = road.vertical ? p.z : road.coord;
  const taxi = {
    kind: 'taxi', x, z, heading: road.vertical ? 0 : Math.PI / 2,
    speed: 0, color: [1, 0.85, 0.1], name: 'Solmar Cab',
    condition: 100, driver: 'npc', route: null,
    stuckT: 0, calledTaxi: true, parkedT: 0, wheelSpin: 0,
  };
  game.vehicles.traffic.push(taxi);
  game.taxi.called = taxi;
  showToast(s, 'Taxi called — it is on its way to you.', 4);
  return true;
}

export function stepTaxi(game, dt) {
  const taxi = game.taxi.called;
  if (!taxi) return;
  const s = game.state;
  const p = s.player;
  if (taxi.driver === 'player') return; // the player is driving it
  const dx = p.x - taxi.x, dz = p.z - taxi.z;
  const d = Math.hypot(dx, dz);
  if (d > 4) {
    // Drive to the player.
    taxi.heading = Math.atan2(dx, dz);
    taxi.speed = Math.min(18, taxi.speed + 10 * dt);
    const nx = taxi.x + Math.sin(taxi.heading) * taxi.speed * dt;
    const nz = taxi.z + Math.cos(taxi.heading) * taxi.speed * dt;
    if (!game.city.collidesCircle(nx, taxi.z, 1.6)) taxi.x = nx;
    if (!game.city.collidesCircle(taxi.x, nz, 1.6)) taxi.z = nz;
    taxi.wheelSpin += taxi.speed * dt * 2;
  } else {
    // Parked beside the player, waiting.
    taxi.speed = 0;
    taxi.driver = null;
    taxi.parkedT += dt;
    if (!taxi.arrived) {
      taxi.arrived = true;
      showToast(s, 'Your cab is here. Get in!', 4);
    }
  }
}

// The taxi side job: pick up a passenger at the stand (0, 50) and
// drop them at the harbour (330, -100). $120.
export function stepTaxiFare(game, dt) {
  const fare = game.taxi.fare;
  if (!fare || !fare.active) return;
  const s = game.state;
  const p = s.player;
  if (fare.stage === 0) {
    if (p.inCar && Math.hypot(p.x - 0, p.z - 50) < 8) {
      fare.stage = 1;
      showToast(s, 'Passenger aboard — drop them at the harbour.', 4);
    }
  } else if (fare.stage === 1) {
    if (p.inCar && Math.hypot(p.x - 330, p.z + 100) < 12) {
      completeSideJob(game, 'taxi');
    }
  }
}

export function taxiBoxes(game, out) {
  // Taxis are drawn by vehicleBoxes; this only adds the roof sign
  // for a called taxi (the sign is drawn in vehicleBoxes already
  // when kind === 'taxi'). Kept for symmetry with the other systems.
}
