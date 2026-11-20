// Solmar Bay — city events.
//
// Every few minutes a beach party, a street race or a market day
// rolls into town. The event runs for its duration, then the timer
// resets for the next one.

import { pushBox } from './render.js';

const TYPES = [
  { id: 'beachParty', label: 'Beach party', x: -330, z: 40 },
  { id: 'streetRace', label: 'Street race', x: 0, z: 0 },
  { id: 'marketDay', label: 'Market day', x: 30, z: 30 },
];

export function stepEvents(g, dt, rng) {
  g.eventTimer = (g.eventTimer === undefined ? 240 : g.eventTimer) - dt;
  if (g.eventTimer > 0 || g.event) return;
  const r = (rng || Math.random)();
  const type = r < 0.4 ? TYPES[0] : r < 0.7 ? TYPES[1] : TYPES[2];
  g.event = { id: type.id, label: type.label, x: type.x, z: type.z, t: 120 };
  g.eventTimer = 240;
}

export function stepEventActive(g, dt) {
  if (!g.event) return;
  g.event.t -= dt;
  if (g.event.t <= 0) g.event = null;
}

// Beach party: 6 lights. Street race: flags. Market day: stalls.
export function eventBoxes(g, b, camera) {
  if (!g.event) return 0;
  let n = 0;
  const put = (x, y, z, w, h, d, col) => { pushBox(b, x, y, z, w, h, d, col); n++; };
  if (g.event.id === 'beachParty') {
    const cols = [[1, 0.3, 0.5], [0.3, 0.9, 1], [1, 0.8, 0.2], [0.6, 1, 0.4], [1, 0.5, 0.9], [0.4, 0.6, 1]];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      put(g.event.x + Math.cos(a) * 8, 3, g.event.z + Math.sin(a) * 8, 0.6, 0.6, 0.6, cols[i]);
    }
  } else if (g.event.id === 'streetRace') {
    for (let i = 0; i < 4; i++) {
      put(g.event.x + i * 10, 2, g.event.z, 0.3, 3, 0.3, [0.2, 0.2, 0.22]);
      put(g.event.x + i * 10, 4.5, g.event.z, 1.2, 0.8, 0.1, i % 2 === 0 ? [0.1, 0.1, 0.1] : [0.95, 0.95, 0.95]);
    }
  } else if (g.event.id === 'marketDay') {
    for (let i = 0; i < 4; i++) {
      put(g.event.x + (i % 2) * 6, 0, g.event.z + Math.floor(i / 2) * 6, 3, 2, 2, [0.8, 0.5, 0.2]);
      put(g.event.x + (i % 2) * 6, 2, g.event.z + Math.floor(i / 2) * 6, 3.4, 0.3, 2.4, [0.9, 0.3, 0.3]);
    }
  }
  return n;
}
