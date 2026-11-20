// Solmar Bay — city events: beach parties, street races, market days.
// An event starts when its timer expires and runs for its duration.
// The active event is { id, label, x, z, t } and the spawn timer is
// g.eventTimer (not _eventTimer).

import { pushBox } from './render.js';

const EVENT_TYPES = [
  { id: 'beachParty', label: 'Beach Party', x: -300, z: 60, duration: 120 },
  { id: 'streetRace', label: 'Street Race', x: 0, z: 0, duration: 90 },
  { id: 'marketDay', label: 'Market Day', x: 0, z: 0, duration: 150 },
];

export function stepEvents(g, dt, rng) {
  if (g.eventTimer === undefined || g.eventTimer === null) g.eventTimer = 120;
  if (g.event) return;
  g.eventTimer -= dt;
  if (g.eventTimer <= 0) {
    const r = (rng || Math.random)();
    const pick = EVENT_TYPES[Math.floor(r * EVENT_TYPES.length)];
    g.event = { id: pick.id, label: pick.label, x: pick.x, z: pick.z, t: pick.duration };
    g.eventTimer = 180 + Math.random() * 120;
    g.toast = `${pick.label} is happening!`;
    g.toastTimer = 3;
  }
}

// The active event's duration counts down; it expires at 0.
export function stepEventActive(g, dt) {
  if (!g.event) return;
  g.event.t -= dt;
  if (g.event.t <= 0) {
    g.event = null;
  }
}

// Event dressing: beach parties get lights, street races get flags,
// market days get stalls. No event draws nothing.
export function eventBoxes(g, batch, cam) {
  if (!g.event) return 0;
  let n = 0;
  if (g.event.id === 'beachParty') {
    for (let i = 0; i < 6; i++) {
      pushBox(batch, -320 + i * 6, 3, -100, 0.5, 0.5, 0.5, [1, 0.8, 0.2]);
      n++;
    }
  } else if (g.event.id === 'streetRace') {
    for (let i = 0; i < 4; i++) {
      pushBox(batch, -120 + i * 80, 0, -60, 0.4, 3, 0.4, [0.9, 0.2, 0.2]);
      n++;
    }
  } else if (g.event.id === 'marketDay') {
    for (let i = 0; i < 5; i++) {
      pushBox(batch, -60 + i * 30, 0, 30, 3, 2.5, 2, [0.9, 0.7, 0.3]);
      n++;
    }
  }
  return n;
}
