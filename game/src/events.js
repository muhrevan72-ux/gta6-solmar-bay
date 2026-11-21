// Solmar Bay — city events.
//
// Every few minutes something happens: a beach party, a street race,
// or a market day. An event carries its id, its spot, and `t` — the
// seconds left before it ends. stepEvents takes an optional random
// source (tests pass a stub so the pick is deterministic).

import { pushBox } from './render.js';
import { showToast } from './state.js';

const EVENT_TYPES = [
  { id: 'beachParty', dur: 120, label: 'Beach Party', x: -330, z: 60 },
  { id: 'streetRace', dur: 90, label: 'Street Race', x: 0, z: 0 },
  { id: 'marketDay', dur: 180, label: 'Market Day', x: 60, z: 60 },
];

export function spawnEvents(g) {
  g.event = null;
  g.eventTimer = 120;
  return g;
}

function startEvent(g, rng) {
  const roll = typeof rng === 'function' ? rng() : Math.random();
  const pick = roll < 0.33 ? EVENT_TYPES[0] : roll < 0.66 ? EVENT_TYPES[1] : EVENT_TYPES[2];
  g.event = { id: pick.id, t: pick.dur, x: pick.x, z: pick.z, label: pick.label };
  g.eventTimer = 300;
  showToast(g, `${pick.label} is on! Head over and join in.`);
  return g.event;
}

export function stepEventActive(g, dt) {
  if (!g.event) return false;
  g.event.t -= dt;
  if (g.event.t <= 0) {
    g.event = null;
    return true;
  }
  return false;
}

export function stepEvents(g, dt, rng) {
  if (g.event) {
    stepEventActive(g, dt);
    return;
  }
  g.eventTimer = (g.eventTimer === undefined ? 120 : g.eventTimer) - dt;
  if (g.eventTimer <= 0) {
    startEvent(g, rng);
  }
}

// The event's props: 6 for a beach party, flags for a race, stalls
// for a market day. No event, nothing drawn.
export function eventBoxes(g, b, cam) {
  const plain = [0, 0, 1, 1];
  if (!g.event) return 0;
  const { x, z } = g.event;
  const id = g.event.id || g.event.type;
  if (id === 'beachParty') {
    pushBox(b, x, 0, z, 6, 0.6, 4, [0.9, 0.3, 0.5], plain);
    pushBox(b, x - 4, 0, z, 1, 2, 1, [0.2, 0.2, 0.2], plain);
    pushBox(b, x + 4, 0, z, 1, 2, 1, [0.2, 0.2, 0.2], plain);
    pushBox(b, x, 3, z - 3, 0.3, 3, 0.3, [0.95, 0.75, 0.1], plain);
    pushBox(b, x, 3, z + 3, 0.3, 3, 0.3, [0.95, 0.75, 0.1], plain);
    pushBox(b, x, 0, z + 6, 2, 1, 2, [0.95, 0.6, 0.1], plain);
    return 6;
  }
  if (id === 'streetRace') {
    let n = 0;
    for (let i = 0; i < 8; i++) {
      pushBox(b, x - 40 + i * 12, 0, z - 6, 0.4, 3, 0.4, [0.95, 0.75, 0.1], plain);
      n += 1;
    }
    return n;
  }
  if (id === 'marketDay') {
    let n = 0;
    for (let i = 0; i < 5; i++) {
      pushBox(b, x - 20 + i * 10, 0, z, 3, 2, 2, [0.9, 0.5, 0.2], plain);
      n += 1;
    }
    return n;
  }
  return 0;
}
