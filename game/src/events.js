// Solmar Bay — city events: a rotating calendar of things
// happening in the city (street race, beach party, market day).
// An event is announced with a toast + a dialogue line, runs for a
// few game-hours, and gives a small reward for taking part.

import { showToast, showDialogue, addCash, addRespect } from './state.js';

const EVENTS = [
  { name: 'Street Race', place: 'downtown', x: 0, z: 0, reward: 200, text: 'Street race downtown! First to the harbour wins $200.' },
  { name: 'Beach Party', place: 'beach', x: -300, z: 120, reward: 50, text: 'Beach party! Dance at the beach for $50 and +10 REP.' },
  { name: 'Market Day', place: 'downtown', x: 50, z: 50, reward: 30, text: 'Market day downtown — vendors are selling. Grab a snack!' },
];

export function createEvents() {
  return {
    current: null, // {def, t}
    timer: 120, // seconds until the next event
    idx: 0,
  };
}

export function stepEvents(game, dt) {
  const ev = game.events;
  const s = game.state;
  const p = s.player;
  ev.timer -= dt;
  if (ev.timer <= 0) {
    ev.timer = 180 + Math.random() * 120;
    const def = EVENTS[ev.idx % EVENTS.length];
    ev.idx++;
    ev.current = { def, t: 0 };
    showToast(s, 'EVENT: ' + def.name + ' — ' + def.text, 6);
    showDialogue(s, 'City Radio', 'Announcer', def.text, 8);
  }
  if (ev.current) {
    ev.current.t += dt;
    const def = ev.current.def;
    const d = Math.hypot(p.x - def.x, p.z - def.z);
    if (d < 12) {
      // Take part: the reward is paid once per event.
      if (!ev.current.paid) {
        ev.current.paid = true;
        addCash(s, def.reward);
        addRespect(s, 10);
        showToast(s, def.name + '! +$' + def.reward + ', +10 REP', 5);
      }
    }
    if (ev.current.t > 300) ev.current = null;
  }
}

export function eventBoxes(game, out) {
  const ev = game.events;
  if (!ev.current) return;
  const def = ev.current.def;
  // A glowing marker at the event spot.
  out.pushFlat(def.x, 0.2, def.z, 10, 10, [1, 0.7, 0.1], 0);
  out.pushBox(def.x, 1, def.z, 1, 2, 1, [1, 0.7, 0.1]);
}
