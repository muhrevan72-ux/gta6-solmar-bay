// Solmar Bay — timed city events: beach party, street race, market day.
// Written fresh for rebuild #18.

import { pushBox } from './render.js';

const TYPES = ['beachParty', 'streetRace', 'marketDay'];

export function stepEvents(g, dt, rng) {
  g.eventTimer = (g.eventTimer ?? 60) - dt;
  if (g.eventTimer > 0) return;
  const r = rng ? rng() : Math.random();
  const id = r < 0.34 ? 'beachParty' : r < 0.67 ? 'streetRace' : 'marketDay';
  const spot = id === 'beachParty'
    ? { label: 'Beach party', x: -330, z: 40 }
    : id === 'streetRace'
      ? { label: 'Street race', x: 0, z: 0 }
      : { label: 'Market day', x: -60, z: 90 };
  g.event = { id, type: id, label: spot.label, x: spot.x, z: spot.z, t: 60 };
  g.eventTimer = 120 + (rng ? rng() : Math.random()) * 120;
}

export function stepEventActive(g, dt) {
  if (!g.event) return;
  g.event.t -= dt;
  if (g.event.t <= 0) g.event = null;
}

export function eventBoxes(g, b, gl) {
  if (!g.event) return 0;
  const id = g.event.id || g.event.type;
  let n = 0;
  if (id === 'beachParty') {
    for (let i = 0; i < 6; i++) {
      pushBox(b, -320 + i * 4, 3 + (i % 2), 60 + i * 3, 0.5, 0.5, 0.5, [1, 0.3 + i * 0.1, 0.6], [0, 0, 1, 1]);
      n++;
    }
  } else if (id === 'streetRace') {
    for (let i = 0; i < 4; i++) {
      pushBox(b, -100 + i * 60, 2, 0, 0.3, 4, 0.3, [0.95, 0.75, 0.1], [0, 0, 1, 1]);
      n++;
    }
  } else if (id === 'marketDay') {
    for (let i = 0; i < 5; i++) {
      pushBox(b, -60 + i * 30, 1, 90, 4, 2, 3, [0.9, 0.5, 0.2], [0, 0, 1, 1]);
      n++;
    }
  }
  return n;
}
