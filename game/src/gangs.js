// Solmar Bay — gangs. Two original rival gangs:
// gold Bay Kings (downtown turf) vs teal Harbour Sharks (harbour turf).
// Members hang out in groups in their turf; they turn hostile if the
// player attacks them, fires a gun in their turf, or rolls in with
// 3+ stars of heat. Killing one drops cash and raises wanted
// (handled by combat.js via the crime table).

import { COL, dist, clamp, mulberry32 } from './config.js';
import { moveWithCollision } from './world.js';

export const TURFS = {
  king: { x0: -150, x1: 150, z0: -150, z1: 150, color: COL.gangKing, name: 'Bay Kings' },
  shark: { x0: -300, x1: -60, z0: 250, z1: 380, color: COL.gangShark, name: 'Harbour Sharks' },
};

export function createGangs() {
  const rng = mulberry32(999);
  const members = [];
  const hangouts = {
    king: [[-100, -100], [100, 100], [0, -100], [-44, 44], [100, -100]],
    shark: [[-200, 300], [-280, 330], [-120, 280], [290, 330], [-240, 350]],
  };
  for (let i = 0; i < 14; i++) {
    const h = hangouts.king[i % hangouts.king.length];
    members.push(makeMember(rng, 'king', h[0], h[1]));
  }
  for (let i = 0; i < 11; i++) {
    const h = hangouts.shark[i % hangouts.shark.length];
    members.push(makeMember(rng, 'shark', h[0], h[1]));
  }
  return {
    members,
    onMemberHit: (g, m) => onMemberHit(g, m),
    spawnHostile: (g, gang, x, z, n) => spawnHostile(g, gang, x, z, n),
    countHostile: (g, gang) => countHostile(g, gang),
  };
}

function makeMember(rng, gang, hx, hz) {
  return {
    x: hx + (rng() - 0.5) * 8,
    z: hz + (rng() - 0.5) * 8,
    heading: rng() * Math.PI * 2,
    health: 100, alive: true,
    gang, hostile: 0,
    homeX: hx, homeZ: hz,
    tx: hx, tz: hz,
    speed: 1.8 + rng() * 0.8,
    phase: rng() * Math.PI * 2,
    color: gang === 'king' ? COL.gangKing : COL.gangShark,
  };
}

// A gang member was hit — its whole gang turns hostile for a while.
export function onMemberHit(game, member) {
  if (!game.gangs) return;
  for (const m of game.gangs.members) {
    if (m.alive && m.gang === member.gang) m.hostile = Math.max(m.hostile, 8);
  }
}

// Spawn n hostile members of a gang at a spot (turf clear-out job).
export function spawnHostile(game, gang, x, z, n) {
  if (!game.gangs) return;
  for (let i = 0; i < n; i++) {
    const m = makeMember(Math.random, gang, x, z);
    m.hostile = 999; // stays hostile until killed
    m.x = x + (Math.random() - 0.5) * 10;
    m.z = z + (Math.random() - 0.5) * 10;
    game.gangs.members.push(m);
  }
}

export function countHostile(game, gang) {
  if (!game.gangs) return 0;
  let n = 0;
  for (const m of game.gangs.members) {
    if (m.alive && m.gang === gang && m.hostile > 0) n += 1;
  }
  return n;
}

function inTurf(turf, x, z) {
  return x >= turf.x0 && x <= turf.x1 && z >= turf.z0 && z <= turf.z1;
}

export function updateGangs(dt, game) {
  const p = game.player;
  const state = game.state;
  // firing a gun inside a turf, or 3+ stars inside a turf, provokes it
  for (const key of ['king', 'shark']) {
    const turf = TURFS[key];
    if (inTurf(turf, p.x, p.z)) {
      if (game.combat && game.combat.shootT > 0.15) {
        for (const m of game.gangs.members) {
          if (m.alive && m.gang === key) m.hostile = Math.max(m.hostile, 5);
        }
      }
      if (state.wanted >= 3) {
        for (const m of game.gangs.members) {
          if (m.alive && m.gang === key) m.hostile = Math.max(m.hostile, 5);
        }
      }
    }
  }
  for (const m of game.gangs.members) {
    if (!m.alive) continue;
    if (m.hostile > 0) {
      m.hostile -= dt;
      // chase the player and punch up close
      const d = dist(m.x, m.z, p.x, p.z);
      if (p.inVehicle) {
        // chase the car
        const want = Math.atan2(p.x - m.x, p.z - m.z);
        m.heading = want;
        moveWithCollision(game.city, m, Math.sin(want) * 6 * dt, Math.cos(want) * 6 * dt, 0.8);
        continue;
      }
      const want = Math.atan2(p.x - m.x, p.z - m.z);
      m.heading = want;
      if (d > 2.2) {
        moveWithCollision(game.city, m, Math.sin(want) * 5.5 * dt, Math.cos(want) * 5.5 * dt, 0.8);
      } else if (game.hurtPlayer) {
        game.hurtPlayer(12 * dt, 'gang');
      }
      continue;
    }
    // calm: wander around the home hangout, inside the turf
    const turf = TURFS[m.gang];
    if (dist(m.x, m.z, m.tx, m.tz) < 2) {
      m.tx = clamp(m.homeX + (Math.random() - 0.5) * 30, turf.x0 + 2, turf.x1 - 2);
      m.tz = clamp(m.homeZ + (Math.random() - 0.5) * 30, turf.z0 + 2, turf.z1 - 2);
    }
    const want = Math.atan2(m.tx - m.x, m.tz - m.z);
    let diff = want - m.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    m.heading += clamp(diff, -3 * dt, 3 * dt);
    const pace = 1 + 0.2 * Math.sin(game.time * 0.9 + m.phase);
    moveWithCollision(game.city, m, Math.sin(m.heading) * m.speed * pace * dt, Math.cos(m.heading) * m.speed * pace * dt, 0.8);
  }
}

export function drawGangs(renderer, game) {
  for (const m of game.gangs.members) {
    if (!m.alive) continue;
    const bob = Math.sin(game.time * 6 + m.phase) * 0.05;
    renderer.box(m.x, 0.4 + bob, m.z, 0.5, 0.8, 0.5, [0.2, 0.2, 0.22], 1, m.heading, 0, 0);
    renderer.box(m.x, 1.15 + bob, m.z, 0.95, 0.75, 0.55, m.color, 1, m.heading, 0, 0);
    renderer.box(m.x, 1.85 + bob, m.z, 0.58, 0.58, 0.58, [0.92, 0.75, 0.6], 1, m.heading, 0, 0);
    if (m.hostile > 0) {
      // red ring above hostile members
      renderer.box(m.x, 2.6 + bob, m.z, 0.9, 0.25, 0.9, [1, 0.15, 0.15], 0.9, 0, game.time * 2, 0);
    }
  }
}
