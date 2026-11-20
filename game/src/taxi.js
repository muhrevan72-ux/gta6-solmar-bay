// Solmar Bay — taxi jobs.
//
// Two taxi paths: (1) the player calls a cab from the phone — a
// taxi drives to the player, parks within 4 m, and E gets in
// for free (driver=null, no theft crime — the round-6 taxi-E
// fix: a called taxi is NOT a stolen car); (2) the taxi side job
// — pick up a passenger and drive them to the destination for a
// fare + tip based on distance/time.

import { TUNE, dist, clamp } from './config.js';
import { addCash, showToast } from './state.js';
import { makeVehicle } from './vehicles.js';

export function stepTaxiCall(game, dt) {
  if (!game.taxiCalled) return;
  const p = game.player;
  if (!game.calledTaxi) {
    // Dispatch a taxi from the nearest road.
    const v = makeVehicle('taxi', p.x + 60, p.z + 40, 0, {
      driver: 'npc', owner: 'city', name: 'Taxi', colour: [0.95, 0.8, 0.1],
    });
    v.kind = 'taxiCalled';
    game.calledTaxi = v;
    game.vehicles.push(v);
    showToast(game, 'Your cab is on its way');
  }
  const taxi = game.calledTaxi;
  const d = dist(taxi.x, taxi.z, p.x, p.z);
  if (d > 4) {
    // Drive toward the player.
    const a = Math.atan2(p.x - taxi.x, p.z - taxi.z);
    taxi.heading = a;
    taxi.speed = 16;
    taxi.x += Math.sin(a) * taxi.speed * dt;
    taxi.z += Math.cos(a) * taxi.speed * dt;
  } else {
    taxi.speed = 0;
    // Parked: the driver steps out (driver=null) so E enters it
    // as a free ride, not a theft.
    if (taxi.driver !== null) {
      taxi.driver = null;
      showToast(game, 'Your cab is here. Get in!');
    }
  }
  // If the player got in, the call is done.
  if (p.inCar === taxi) {
    game.taxiCalled = false;
    game.calledTaxi = null;
  }
  // Give up after 60 s if the player walks away.
  game.taxiCallTimer = (game.taxiCallTimer || 0) + dt;
  if (game.taxiCallTimer > 60 && !p.inCar) {
    game.taxiCalled = false;
    game.calledTaxi = null;
    game.taxiCallTimer = 0;
    showToast(game, 'The taxi left — call again from the phone');
  }
}

// Called taxi unstick: if the cab is stuck for 30 s, teleport
// it to a road near the player (round-6 fix).
export function unstickCalledTaxi(game) {
  const taxi = game.calledTaxi;
  if (!taxi || game.player.inCar === taxi) return;
  taxi.stuckTimer = (taxi.stuckTimer || 0) + 1;
  if (taxi.stuckTimer > 30) {
    taxi.stuckTimer = 0;
    taxi.x = game.player.x + 20;
    taxi.z = game.player.z + 10;
  }
}

// Taxi side job: passenger pickup + dropoff with fare + tip.
export function startTaxiFare(game) {
  const p = game.player;
  const spots = [
    { x: -40, z: -80 }, { x: 140, z: 80 }, { x: -200, z: 140 }, { x: 220, z: -160 },
  ];
  const pick = spots[Math.floor(Math.random() * spots.length)];
  const drop = spots[Math.floor(Math.random() * spots.length)];
  game.taxiFare = {
    stage: 0, pick, drop,
    startTime: game.time,
    startX: pick.x, startZ: pick.z,
  };
  game.missionMarker = { x: pick.x, z: pick.z, label: 'Taxi passenger' };
  showToast(game, 'Taxi fare: pick up the passenger');
  return game.taxiFare;
}

export function stepTaxiFare(game, dt) {
  const fare = game.taxiFare;
  if (!fare) return;
  const p = game.player;
  if (fare.stage === 0) {
    if (dist(p.x, p.z, fare.pick.x, fare.pick.z) < 7 && p.inCar) {
      fare.stage = 1;
      game.missionMarker = { x: fare.drop.x, z: fare.drop.z, label: 'Taxi destination' };
      showToast(game, 'Passenger aboard — drive to the destination');
    }
  } else if (dist(p.x, p.z, fare.drop.x, fare.drop.z) < 8) {
    const d = dist(fare.pick.x, fare.pick.z, fare.drop.x, fare.drop.z);
    const elapsed = Math.max(1, game.time - fare.startTime);
    const amount = 120 + Math.round(d / 10) + Math.max(0, 60 - Math.round(elapsed));
    addCash(game, amount, 'taxi fare + tip');
    game.stats.fares += 1;
    game.respect += 10;
    game.taxiFare = null;
    game.missionMarker = null;
  }
}
