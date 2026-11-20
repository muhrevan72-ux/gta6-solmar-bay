// Solmar Bay — city events.
//
// Every few minutes one event triggers, announced by toast +
// HUD marker: street race (race checkpoints for cash), beach
// party (crowd at the beach, free food/health), gang turf war
// (a gang fight breaks out, join in for cash). Simple
// participation: go to the marker, do the activity, get paid.

import { dist } from './config.js';
import { addCash, showToast } from './state.js';

const EVENT_DEFS = [
  {
    id: 'race',
    label: 'Street Race',
    x: 0, z: -300,
    desc: 'Hit 4 checkpoints before the timer runs out — $200!',
    reward: 200,
  },
  {
    id: 'party',
    label: 'Beach Party',
    x: -340, z: 0,
    desc: 'Free food and music at the beach — heal up!',
    reward: 0,
  },
  {
    id: 'turfwar',
    label: 'Gang Turf War',
    x: -180, z: 180,
    desc: 'The Sharks and Kings are fighting — back your crew, $250!',
    reward: 250,
  },
];

export function stepEvents(game, dt) {
  game.eventTimer -= dt;
  if (!game.event && game.eventTimer <= 0) {
    const def = EVENT_DEFS[Math.floor(Math.random() * EVENT_DEFS.length)];
    game.event = {
      ...def,
      t: 180,
      stage: 0,
      checkpoints: def.id === 'race' ? [
        { x: 0, z: -300 }, { x: 120, z: -180 }, { x: 120, z: 60 }, { x: 0, z: 180 },
      ] : null,
    };
    game.eventTimer = 240;
    showToast(game, `EVENT: ${def.label} — ${def.desc}`);
    if (def.id === 'turfwar') {
      // A gang fight breaks out: spawn hostile Sharks.
      for (let i = 0; i < 4; i++) {
        game.gangMembers.push({
          gang: 'sharks',
          x: def.x + (Math.random() - 0.5) * 30,
          z: def.z + (Math.random() - 0.5) * 30,
          heading: 0, hp: 100, hostile: true, speed: 2.5,
          colour: [0.1, 0.7, 0.7], bandana: [0.1, 0.7, 0.7],
          walkPhase: 0, target: null,
        });
      }
    }
  }
  if (!game.event) return;
  const ev = game.event;
  ev.t -= dt;
  if (ev.t <= 0) {
    showToast(game, `Event over: ${ev.label}`);
    game.event = null;
    return;
  }
  const p = game.player;
  if (ev.id === 'race' && p.inCar) {
    const cp = ev.checkpoints[ev.stage];
    if (cp && dist(p.x, p.z, cp.x, cp.z) < 8) {
      ev.stage += 1;
      if (ev.stage >= ev.checkpoints.length) {
        addCash(game, ev.reward, 'street race win');
        game.respect += 10;
        showToast(game, `You won the street race! +$${ev.reward}`);
        game.event = null;
      } else {
        showToast(game, `Race checkpoint ${ev.stage + 1}/4`);
      }
    }
  } else if (ev.id === 'party') {
    if (dist(p.x, p.z, ev.x, ev.z) < 15) {
      game.health = Math.min(100, game.health + dt * 5);
    }
  } else if (ev.id === 'turfwar') {
    const left = game.gangMembers.filter((g) => g.gang === 'sharks' && g.hostile).length;
    if (left === 0) {
      addCash(game, ev.reward, 'turf war win');
      game.respect += 15;
      showToast(game, `Turf war won! +$${ev.reward}`);
      game.event = null;
    }
  }
}

// Draw the event marker (a tall glowing pillar at the event spot).
export function eventBoxes(game, out) {
  const ev = game.event;
  if (!ev) return out;
  const pulse = 1 + Math.sin(game.time * 4) * 0.3;
  out.push({ x: ev.x, y: 0, z: ev.z, w: 2 * pulse, h: 30, d: 2 * pulse, c: [1.3, 1.1, 0.2] });
  if (ev.id === 'race') {
    const cp = ev.checkpoints[ev.stage];
    if (cp) out.push({ x: cp.x, y: 0, z: cp.z, w: 4, h: 5, d: 4, c: [1.3, 0.5, 0.1] });
  }
  return out;
}
