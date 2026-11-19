// Solmar Bay — city events: a scheduler triggers one event every
// few minutes, announced by toast + HUD marker.
//
// - Street race: race checkpoints for cash.
// - Beach party: a crowd gathers at the beach, free food/health.
// - Gang turf war: a gang fight breaks out — join in for cash.
// Participation is simple: go to the marker, do the activity, get
// paid. Events never raise wanted by themselves.

import { dist2 } from './config.js';
import { addCash, addRespect, showToast } from './state.js';

const EVENT_TYPES = ['race', 'party', 'turfwar'];

export function createEvents() {
  return {
    next: 150, // seconds until the first event
    active: null, // {type, x, z, t, progress}
  };
}

export function stepEvents(game, dt) {
  const ev = game.events;
  if (!ev.active) {
    ev.next -= dt;
    if (ev.next <= 0) {
      const type = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];
      startEvent(game, type);
    }
    return;
  }
  const a = ev.active;
  a.t -= dt;
  const p = game.state.player;
  if (a.type === 'race') {
    const cp = a.checkpoints[a.idx];
    if (cp && p.inCar && dist2(p.x, p.z, cp.x, cp.z) < 144) {
      a.idx++;
      showToast(game.state, 'Race checkpoint ' + a.idx + '/' + a.checkpoints.length + '!', 2);
      if (a.idx >= a.checkpoints.length) {
        endEvent(game, true, 300);
        return;
      }
    }
  } else if (a.type === 'party') {
    if (dist2(p.x, p.z, a.x, a.z) < 400) {
      a.progress += dt;
      if (a.progress >= 20) {
        endEvent(game, true, 100);
        return;
      }
    }
  } else if (a.type === 'turfwar') {
    // Count rival gang members the player knocked out nearby.
    const dead = game.peds.list.filter((pd) => pd.hp <= 0 && pd.gang && dist2(pd.x, pd.z, a.x, a.z) < 2500).length;
    if (dead >= 3) {
      endEvent(game, true, 250);
      return;
    }
  }
  if (a.t <= 0) endEvent(game, false, 0);
}

export function startEvent(game, type) {
  const ev = game.events;
  if (type === 'race') {
    ev.active = {
      type, x: 0, z: 0, t: 120, idx: 0,
      checkpoints: [
        { x: 0, z: 0 }, { x: 200, z: 0 }, { x: 200, z: 200 },
        { x: -200, z: 200 }, { x: 0, z: 0 },
      ],
    };
    showToast(game.state, 'EVENT: Street race! Hit all 5 checkpoints in 2 minutes — $300!', 5);
  } else if (type === 'party') {
    ev.active = { type, x: -310, z: 100, t: 180, progress: 0 };
    showToast(game.state, 'EVENT: Beach party! Hang out at the beach for 20 seconds — $100 + free food!', 5);
  } else {
    ev.active = { type, x: 0, z: -100, t: 180 };
    showToast(game.state, 'EVENT: Gang turf war downtown! Knock out 3 rival gang members — $250!', 5);
  }
}

function endEvent(game, success, reward) {
  const ev = game.events;
  const type = ev.active.type;
  ev.active = null;
  ev.next = 180 + Math.random() * 120;
  if (success) {
    addCash(game.state, reward);
    addRespect(game.state, 15);
    showToast(game.state, 'Event complete! +$' + reward + ' +15 REP.', 3);
  } else {
    showToast(game.state, 'Event over: ' + type + ' ended.', 2);
  }
}

export function eventBoxes(game, out) {
  const a = game.events.active;
  if (!a) return;
  if (a.type === 'race' && a.checkpoints) {
    const cp = a.checkpoints[a.idx];
    if (cp) out.pushBox(cp.x, 1.5, cp.z, 3, 3, 3, [0.95, 0.8, 0.15]);
  }
  if (a.type === 'party') {
    out.pushBox(a.x, 1, a.z, 4, 2, 4, [1.0, 0.5, 0.7]);
  }
  if (a.type === 'turfwar') {
    out.pushBox(a.x, 2, a.z, 3, 4, 3, [0.9, 0.2, 0.2]);
  }
}

export { EVENT_TYPES };
