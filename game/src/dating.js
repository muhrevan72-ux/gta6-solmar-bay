// Solmar Bay — dating: Maya and Rico, two named NPCs the player
// can meet, talk to, and take on dates. A date is a walk to a spot
// (beach or pier) together; completing one gives +10 respect and a
// dialogue line. Maya and Rico also appear as phone contacts
// (Digit 5 / Digit 6 on the phone).

import { showToast, showDialogue, addRespect } from './state.js';

const NPCS = [
  { name: 'Maya', role: 'Beach lifeguard', x: -280, z: 120, shirt: [1, 0.5, 0.6], hair: [0.3, 0.2, 0.1] },
  { name: 'Rico', role: 'Garage mechanic', x: 150, z: -110, shirt: [0.2, 0.5, 0.9], hair: [0.1, 0.1, 0.1] },
];

export function createDating() {
  return {
    npcs: NPCS.map((n) => ({ ...n, heading: 0, bob: 0, dateT: 0, onDate: false })),
    date: null, // {npc, target, stage}
  };
}

export function stepDating(game, dt) {
  const d = game.dating;
  const p = game.state.player;
  for (const npc of d.npcs) {
    npc.bob += dt * 1.5;
    if (npc.onDate) {
      // Follow the player at 2 m.
      const dx = p.x - npc.x, dz = p.z - npc.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 2.5) {
        npc.heading = Math.atan2(dx, dz);
        npc.x += (dx / dist) * 4 * dt;
        npc.z += (dz / dist) * 4 * dt;
      }
    }
  }
  if (d.date) {
    const npc = d.date.npc;
    const t = d.date.target;
    if (Math.hypot(p.x - t.x, p.z - t.z) < 6 && Math.hypot(npc.x - t.x, npc.z - t.z) < 8) {
      d.date = null;
      npc.onDate = false;
      addRespect(game.state, 10);
      showDialogue(game.state, npc.name, npc.role, 'This is nice. Same time tomorrow?', 8);
      showToast(game.state, 'Date complete! +10 REP', 4);
    }
  }
}

// Start a date with the nearest NPC (E within 3 m).
export function tryDate(game) {
  const d = game.dating;
  const p = game.state.player;
  for (const npc of d.npcs) {
    if (Math.hypot(npc.x - p.x, npc.z - p.z) < 3 && !npc.onDate) {
      npc.onDate = true;
      const spot = npc.name === 'Maya' ? { x: -300, z: 140 } : { x: -330, z: 100 };
      d.date = { npc, target: spot, stage: 0 };
      showDialogue(game.state, npc.name, npc.role, 'Let\'s go for a walk — meet me at the pier.', 8);
      showToast(game.state, 'Date with ' + npc.name + ' — walk to the pier together.', 5);
      return true;
    }
  }
  return false;
}

// Called from the phone (Digit 5 Maya, Digit 6 Rico): the NPC walks
// to the player.
export function callDateNPC(game, name) {
  const d = game.dating;
  const p = game.state.player;
  const npc = d.npcs.find((n) => n.name === name);
  if (!npc) return false;
  npc.x = p.x + 3;
  npc.z = p.z + 3;
  npc.onDate = true;
  showToast(game.state, name + ' is on their way to you.', 4);
  return true;
}

export function datingBoxes(game, out) {
  for (const npc of game.dating.npcs) {
    const swing = Math.sin(npc.bob) * 0.3;
    out.pushBoxRot(npc.x - 0.11, 0.45, npc.z, 0.18, 0.9, 0.18, [0.3, 0.3, 0.35], npc.heading + swing * 0.1);
    out.pushBoxRot(npc.x + 0.11, 0.45, npc.z, 0.18, 0.9, 0.18, [0.3, 0.3, 0.35], npc.heading - swing * 0.1);
    out.pushBoxRot(npc.x, 1.25, npc.z, 0.5, 0.7, 0.28, npc.shirt, npc.heading);
    out.pushBoxRot(npc.x, 1.82, npc.z, 0.34, 0.36, 0.32, [0.9, 0.75, 0.6], npc.heading);
    out.pushBoxRot(npc.x, 2.02, npc.z, 0.36, 0.12, 0.34, npc.hair, npc.heading);
    out.pushFlat(npc.x, 0.06, npc.z, 0.7, 0.7, [0, 0, 0], npc.heading);
  }
}
