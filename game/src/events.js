// Solmar Bay — event scheduler. Every few minutes one event
// triggers, announced by toast + HUD marker: street race (race
// checkpoints for cash), beach party (crowd at the beach, free
// food/health), gang turf war (rival gangs fight, join for cash).

import { dist2 } from './config.js';
import { addCash, showToast } from './state.js';

export function createEvents() {
  return {
    nextT: 150, // first event ~2.5 minutes in
    active: null, // { kind, t, step, target }
    partyPeds: [],
  };
}

const EVENT_KINDS = ['race', 'party', 'turfwar'];

export function updateEvents(game, dt) {
  const ev = game.events;
  const p = game.player;
  if (!ev.active) {
    ev.nextT -= dt;
    if (ev.nextT <= 0) {
      const kind = EVENT_KINDS[Math.floor(Math.random() * EVENT_KINDS.length)];
      ev.active = { kind, t: 0, step: 0, target: null };
      if (kind === 'race') {
        ev.active.target = { x: 100, z: -100 };
        showToast(game.state, 'EVENT: Street race! Hit the checkpoints!', 4);
      } else if (kind === 'party') {
        showToast(game.state, 'EVENT: Beach party! Free food at the beach.', 4);
        // party crowd: peds gather at the beach
        for (let i = 0; i < 10; i++) {
          ev.partyPeds.push({ x: -340 + Math.random() * 20, z: -200 + Math.random() * 400 });
        }
      } else {
        ev.active.target = { x: -100, z: -100 };
        showToast(game.state, 'EVENT: Turf war downtown! Join the fight for $250.', 4);
        if (game.gangs) game.gangs.spawnHostile(game, -100, -100, 6);
      }
      if (game.audio) game.audio.play('mission');
    }
    return;
  }
  ev.active.t += dt;
  const a = ev.active;
  if (a.kind === 'race') {
    const cps = [
      { x: 100, z: -100 },
      { x: -100, z: 100 },
      { x: 200, z: 200 },
      { x: 0, z: 0 },
    ];
    const cp = cps[Math.min(a.step, 3)];
    a.target = cp;
    if (p.inVehicle && dist2(p.x, p.z, cp.x, cp.z) < 100) {
      a.step += 1;
      showToast(game.state, 'Race checkpoint ' + a.step + '/4', 2);
      if (a.step >= 4) {
        addCash(game.state, 300);
        showToast(game.state, 'You won the street race! +$300', 3);
        ev.active = null;
        ev.nextT = 180;
      }
    }
    if (a.t > 180) {
      ev.active = null;
      ev.nextT = 180;
      showToast(game.state, 'The street race ended.', 2);
    }
  } else if (a.kind === 'party') {
    // standing on the beach during the party heals you
    if (p.x < -300 && p.x > -400) {
      game.state.health = Math.min(100, game.state.health + 5 * dt);
    }
    if (a.t > 120) {
      ev.active = null;
      ev.nextT = 180;
      ev.partyPeds = [];
      showToast(game.state, 'The beach party wound down.', 2);
    }
  } else if (a.kind === 'turfwar') {
    const hostiles = game.gangs ? game.gangs.countHostile() : 0;
    if (hostiles <= 0 && a.t > 5) {
      addCash(game.state, 250);
      showToast(game.state, 'Turf war won! +$250', 3);
      ev.active = null;
      ev.nextT = 180;
    }
    if (a.t > 240) {
      ev.active = null;
      ev.nextT = 180;
    }
  }
}

export function eventMarker(game) {
  const a = game.events.active;
  if (!a || !a.target) return null;
  const label = a.kind === 'race' ? 'Street race' : a.kind === 'turfwar' ? 'Turf war' : 'Beach party';
  return { x: a.target.x, z: a.target.z, label };
}
