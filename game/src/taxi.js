// Solmar Bay — taxi: the yellow cab, the taxi stand sign, and the
// passenger ped who waits at the pickup point of an active taxi
// side job (the fare state machine itself lives in missions.js).

import { dist } from './config.js';

export function createTaxi() {
  return { passenger: null, earned: 0 };
}

export function updateTaxi(dt, game) {
  const taxi = game.taxi;
  const job = game.missions.sideJobs.find((j) => j.type === 'taxi');
  if (!job) return;
  if (job.active && job.stage === 0) {
    // a passenger waits at the pickup point
    if (!taxi.passenger) {
      taxi.passenger = { x: job.tx, z: job.tz, heading: 0, phase: Math.random() * 6 };
    }
    taxi.passenger.x = job.tx;
    taxi.passenger.z = job.tz;
  } else {
    taxi.passenger = null;
  }
  void dt;
}

export function drawTaxi(renderer, game) {
  // taxi stand sign
  renderer.box(0, 4.5, 152, 6, 1.4, 0.6, [1, 0.85, 0.1], 1);
  renderer.box(0, 2.2, 152, 0.4, 4.4, 0.4, [0.25, 0.25, 0.28], 1);
  const ps = game.taxi.passenger;
  if (ps) {
    const bob = Math.sin(game.time * 5 + ps.phase) * 0.08;
    renderer.box(ps.x, 0.4 + bob, ps.z, 0.45, 0.8, 0.45, [0.2, 0.2, 0.25], 1, ps.heading, 0, 0);
    renderer.box(ps.x, 1.15 + bob, ps.z, 0.9, 0.75, 0.5, [1, 0.85, 0.1], 1, ps.heading, 0, 0);
    renderer.box(ps.x, 1.8 + bob, ps.z, 0.55, 0.55, 0.55, [0.92, 0.75, 0.6], 1, ps.heading, 0, 0);
    // waiting marker
    renderer.box(ps.x, 3.2 + bob, ps.z, 0.7, 0.7, 0.7, [1, 0.85, 0.1], 0.9, 0, game.time * 2, 0);
  }
}

export { dist };
