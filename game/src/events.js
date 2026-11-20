// Solmar Bay — city events (rebuild #14).
// A timer starts one of three events: a beach party (6 lights),
// a street race (flags) or a market day (stalls). Each runs for
// a while, then ends and the timer resets.

import { showToast } from './state.js';
import { pushBox } from './render.js';

export function stepEvents(g, dt, rng) {
  if (g.event) {
    // An event is running — nothing to start.
    return;
  }
  if (g.eventTimer === undefined) g.eventTimer = 120;
  g.eventTimer -= dt;
  if (g.eventTimer > 0) return;
  const r = rng ? rng() : Math.random();
  let id;
  if (r < 0.4) id = 'beachParty';
  else if (r < 0.7) id = 'streetRace';
  else id = 'marketDay';
  const spots = {
    beachParty: { label: 'Beach party', x: -330, z: 40 },
    streetRace: { label: 'Street race', x: 0, z: 0 },
    marketDay: { label: 'Market day', x: 30, z: 30 },
  };
  const s = spots[id];
  g.event = { id, label: s.label, x: s.x, z: s.z, t: 120 };
  showToast(g, `${s.label}!`);
  g.eventTimer = 240;
}

export function stepEventActive(g, dt) {
  if (!g.event) return;
  g.event.t -= dt;
  if (g.event.t <= 0) {
    g.event = null;
    g.eventTimer = 240;
  }
}

export function eventBoxes(g, b, camera) {
  if (!g.event) return 0;
  if (g.event.id === 'beachParty') {
    const cols = [[1, 0.3, 0.5], [0.3, 0.8, 1], [1, 0.8, 0.2], [0.5, 1, 0.4], [1, 0.5, 0.2], [0.8, 0.4, 1]];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      pushBox(b, g.event.x + Math.cos(a) * 8, 3, g.event.z + Math.sin(a) * 8, 0.8, 0.8, 0.8, cols[i]);
    }
    return 6;
  }
  if (g.event.id === 'streetRace') {
    for (let i = 0; i < 4; i++) {
      pushBox(b, g.event.x - 20 + i * 12, 0, g.event.z - 6, 0.3, 3, 0.3, [0.1, 0.1, 0.1]);
      pushBox(b, g.event.x - 20 + i * 12, 2.4, g.event.z - 6, 2, 1, 0.1, [0.9, 0.9, 0.9]);
    }
    return 8;
  }
  // marketDay: stalls.
  for (let i = 0; i < 4; i++) {
    pushBox(b, g.event.x - 12 + i * 8, 0, g.event.z, 3, 2, 2, [0.8, 0.5, 0.2]);
    pushBox(b, g.event.x - 12 + i * 8, 2, g.event.z, 3.4, 0.3, 2.4, [0.9, 0.3, 0.3]);
  }
  return 8;
}
