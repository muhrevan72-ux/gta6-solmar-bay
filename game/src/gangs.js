// Solmar Bay — gangs. Two original rival gangs:
// gold "Bay Kings" downtown vs teal "Harbour Sharks" at the harbour.
// Members hang out in groups in their turf (shown on the minimap),
// turn hostile if provoked or if the player causes trouble in their
// turf, and drop cash when killed. Two gang side jobs plug into
// missions.js via spawnHostile / countHostile.

import { TUNE, clamp, angleLerp, dist2 } from './config.js';
import { collideCircle } from './world.js';

export const GANGS = {
  kings: {
    name: 'Bay Kings',
    colour: [0.95, 0.75, 0.15],
    turf: { x0: -150, x1: 150, z0: -150, z1: 150 },
    home: { x: -100, z: -100 },
  },
  sharks: {
    name: 'Harbour Sharks',
    colour: [0.1, 0.7, 0.7],
    turf: { x0: 230, x1: 400, z0: 220, z1: 400 },
    home: { x: 320, z: 300 },
  },
};

export function createGangs() {
  const gangs = {
    members: [],
    hostility: { kings: 0, sharks: 0 },
  };
  gangs.spawnHostile = (game, x, z, count) => spawnHostile(game, x, z, count);
  gangs.countHostile = () => countHostile(gangs);
  gangs.onMemberHit = (game, member) => onMemberHit(game, member);
  // 25 members: 13 Kings downtown, 12 Sharks at the harbour
  for (let i = 0; i < 13; i++) {
    gangs.members.push(makeMember('kings', -140 + Math.random() * 280, -140 + Math.random() * 280, i));
  }
  for (let i = 0; i < 12; i++) {
    gangs.members.push(makeMember('sharks', 240 + Math.random() * 150, 230 + Math.random() * 150, 13 + i));
  }
  return gangs;
}

function makeMember(gangId, x, z, id) {
  const g = GANGS[gangId];
  return {
    id,
    gang: gangId,
    x, z,
    heading: Math.random() * Math.PI * 2,
    targetHeading: Math.random() * Math.PI * 2,
    speed: 1.4 + Math.random(),
    baseSpeed: 1.4 + Math.random(),
    hostile: false,
    alive: true,
    colour: g.colour,
    wanderT: 2 + Math.random() * 4,
    bob: Math.random() * 6,
  };
}

export function spawnHostile(game, x, z, count) {
  const gangs = game.gangs;
  for (let i = 0; i < count; i++) {
    const gangId = Math.random() < 0.5 ? 'kings' : 'sharks';
    const m = makeMember(gangId, x + (Math.random() * 20 - 10), z + (Math.random() * 20 - 10), gangs.members.length);
    m.hostile = true;
    gangs.members.push(m);
  }
}

export function countHostile(gangs) {
  let n = 0;
  for (const m of gangs.members) if (m.alive && m.hostile) n += 1;
  return n;
}

// Attacking a gang member makes its gang hostile to the player.
export function onMemberHit(game, member) {
  const gangs = game.gangs;
  gangs.hostility[member.gang] = 1;
  member.hostile = true;
  // nearby members of the same gang join in
  for (const m of gangs.members) {
    if (m.alive && m.gang === member.gang && dist2(m.x, m.z, member.x, member.z) < 400) {
      m.hostile = true;
    }
  }
}

function inTurf(gangId, x, z) {
  const t = GANGS[gangId].turf;
  return x >= t.x0 && x <= t.x1 && z >= t.z0 && z <= t.z1;
}

export function updateGangs(game, dt) {
  const gangs = game.gangs;
  const player = game.player;
  const state = game.state;
  for (const m of gangs.members) {
    if (!m.alive) continue;
    m.bob += m.speed * dt * 2;
    // hostile members chase + punch the player; they only go hostile
    // when provoked, or when the player has 3+ stars inside their turf
    if (!m.hostile) {
      if (state.wanted >= 3 && inTurf(m.gang, player.x, player.z)) {
        m.hostile = true;
      }
    }
    if (m.hostile) {
      const d = Math.hypot(player.x - m.x, player.z - m.z);
      const desired = Math.atan2(player.x - m.x, player.z - m.z);
      m.targetHeading = desired;
      m.speed = 5.5;
      if (d < 2) {
        if (game.combat) game.combat.damagePlayer(game, 10 * dt);
      }
      if (d > 80) m.hostile = false; // they give up far from the player
    } else {
      m.speed = m.baseSpeed;
      m.wanderT -= dt;
      if (m.wanderT <= 0) {
        m.wanderT = 3 + Math.random() * 5;
        // drift back toward the gang home
        const home = GANGS[m.gang].home;
        const toHome = Math.atan2(home.x - m.x, home.z - m.z);
        m.targetHeading = Math.random() < 0.6 ? toHome + (Math.random() - 0.5) : Math.random() * Math.PI * 2;
      }
    }
    m.heading = angleLerp(m.heading, m.targetHeading, 1 - Math.pow(0.001, dt));
    const nx = m.x + Math.sin(m.heading) * m.speed * dt;
    const nz = m.z + Math.cos(m.heading) * m.speed * dt;
    const fixed = collideCircle(game.city, nx, nz, 0.6);
    m.x = fixed.x;
    m.z = fixed.z;
  }
}

export function gangBoxes(m) {
  const bobY = Math.sin(m.bob) * 0.05;
  const boxes = [];
  boxes.push({ x: m.x - 0.22, y: 0.4 + bobY, z: m.z, sx: 0.4, sy: 0.8, sz: 0.4, c: [0.15, 0.15, 0.18] });
  boxes.push({ x: m.x + 0.22, y: 0.4 + bobY, z: m.z, sx: 0.4, sy: 0.8, sz: 0.4, c: [0.15, 0.15, 0.18] });
  boxes.push({ x: m.x, y: 1.2 + bobY, z: m.z, sx: 0.95, sy: 0.85, sz: 0.55, c: m.colour });
  boxes.push({ x: m.x - 0.62, y: 1.2 + bobY, z: m.z, sx: 0.3, sy: 0.7, sz: 0.35, c: m.colour });
  boxes.push({ x: m.x + 0.62, y: 1.2 + bobY, z: m.z, sx: 0.3, sy: 0.7, sz: 0.35, c: m.colour });
  boxes.push({ x: m.x, y: 1.85 + bobY, z: m.z, sx: 0.6, sy: 0.55, sz: 0.55, c: [0.85, 0.65, 0.5] });
  // gang bandana
  boxes.push({ x: m.x, y: 2.12 + bobY, z: m.z, sx: 0.64, sy: 0.18, sz: 0.6, c: m.colour });
  return boxes;
}
