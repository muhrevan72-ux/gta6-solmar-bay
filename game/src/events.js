// Solmar Bay — city events. Every few minutes one event fires,
// announced by a toast and a beacon marker: a street race, a beach
// party, or a gang turf war. Show up, take part, get paid.

import { SIDE_REWARDS, dist } from './config.js';
import { setToast, addCash } from './state.js';

const EVENT_TYPES = ['race', 'party', 'turfwar'];

export function createEvents() {
  return {
    timer: 120 + Math.random() * 60,
    active: null, // {type, x, z, t, stage, data}
    partyPeds: [],
  };
}

export function startEvent(game, type) {
  const ev = game.events;
  if (type === 'race') {
    ev.active = {
      type, t: 90, idx: 0,
      checkpoints: [[-150, -150], [150, -150], [150, 150], [-150, 150], [0, 0]],
      x: -150, z: -150,
    };
    setToast(game.state, 'EVENT: Street race! Hit all 5 checkpoints — $300!', 5);
  } else if (type === 'party') {
    ev.active = { type, t: 90, x: -340, z: 0, paid: false };
    ev.partyPeds = [];
    for (let i = 0; i < 10; i++) {
      ev.partyPeds.push({ x: -350 + Math.random() * 20, z: -30 + Math.random() * 60, phase: Math.random() * 6 });
    }
    setToast(game.state, 'EVENT: Beach party! Come hang out at the beach!', 5);
  } else {
    ev.active = { type, t: 90, x: 0, z: 0 };
    if (game.gangs) {
      game.gangs.spawnHostile(game, 'shark', 10, 10, 3);
      game.gangs.spawnHostile(game, 'king', -10, -10, 3);
    }
    setToast(game.state, 'EVENT: Gang turf war downtown! Take out the Sharks — $250!', 5);
  }
  if (game.audio) game.audio.jingle();
}

export function updateEvents(dt, game) {
  const ev = game.events;
  const state = game.state;
  const p = game.player;
  if (!ev.active) {
    ev.timer -= dt;
    if (ev.timer <= 0) {
      ev.timer = 150 + Math.random() * 60;
      startEvent(game, EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)]);
    }
    return;
  }
  const a = ev.active;
  a.t -= dt;
  if (a.type === 'race') {
    const cp = a.checkpoints[a.idx];
    a.x = cp[0]; a.z = cp[1];
    if (dist(p.x, p.z, cp[0], cp[1]) < 8 && p.inVehicle) {
      a.idx += 1;
      if (a.idx >= a.checkpoints.length) {
        addCash(state, SIDE_REWARDS.streetRace);
        setToast(state, 'Street race won! +$' + SIDE_REWARDS.streetRace, 4);
        ev.active = null;
        return;
      }
    }
  } else if (a.type === 'party') {
    if (!a.paid && dist(p.x, p.z, a.x, a.z) < 15) {
      a.paid = true;
      addCash(state, SIDE_REWARDS.beachParty);
      state.health = 100;
      setToast(state, 'Beach party! Free food, full health, +$' + SIDE_REWARDS.beachParty, 4);
    }
  } else if (a.type === 'turfwar') {
    const left = game.gangs ? game.gangs.countHostile(game, 'shark') : 0;
    if (left <= 0) {
      addCash(state, SIDE_REWARDS.turfWar);
      setToast(state, 'Turf war won! +$' + SIDE_REWARDS.turfWar, 4);
      ev.active = null;
      return;
    }
  }
  if (a.t <= 0) {
    setToast(state, 'The event is over.', 3);
    ev.active = null;
    ev.partyPeds = [];
  }
}

export function drawEvents(renderer, game) {
  const ev = game.events;
  const t = game.time;
  if (!ev.active) return;
  const a = ev.active;
  const pulse = 0.6 + Math.sin(t * 4) * 0.25;
  renderer.box(a.x, 8, a.z, 3, 16, 3, [1, 0.4, 0.9], pulse);
  if (a.type === 'party') {
    const cols = [[1, 0.4, 0.5], [0.4, 0.8, 1], [1, 0.8, 0.2], [0.5, 1, 0.5]];
    ev.partyPeds.forEach((pp, i) => {
      const bob = Math.abs(Math.sin(t * 6 + pp.phase)) * 0.5;
      renderer.box(pp.x, 1.1 + bob, pp.z, 0.9, 1.6, 0.5, cols[i % cols.length], 1, 0, 0, 0);
    });
  }
}
