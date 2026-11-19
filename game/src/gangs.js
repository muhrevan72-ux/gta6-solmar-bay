// Solmar Bay — gangs: Bay Kings (gold, downtown) vs Harbour Sharks
// (teal, harbour). Two rival gangs with turf, members, hostility,
// and turf jobs. Gang members wear their gang's bandana and fight
// the player (and each other) on sight inside their turf.

import { GANGS, COL, TUNE } from './config.js';
import { showToast, addRespect, addCash } from './state.js';
import { dropCash } from './pedestrians.js';

export function createGangs(city) {
  const gangs = { members: [], turfJobs: [] };
  // 25 members split across the two turfs. The turf fields hx/hz
  // are the FULL width/height (kings 160x140, sharks 90x110).
  for (let i = 0; i < 25; i++) {
    const def = i % 2 === 0 ? GANGS.kings : GANGS.sharks;
    const x = def.turf.x + (Math.random() - 0.5) * def.turf.hx;
    const z = def.turf.z + (Math.random() - 0.5) * def.turf.hz;
    const ped = {
      x, z, heading: Math.random() * Math.PI * 2,
      speed: 2 + Math.random(),
      role: 'walk', activity: 'walk', target: null, waitT: 0,
      bob: Math.random() * Math.PI * 2,
      shirt: [0.1, 0.1, 0.1],
      pants: [0.2, 0.2, 0.2],
      skin: COL.skin[i % COL.skin.length],
      hair: COL.hair[i % COL.hair.length],
      hairStyle: 'buzz',
      height: 0.95 + ((i * 5) % 10) / 100,
      bulk: 0.85 + ((i * 3) % 10) / 100,
      gang: i % 2 === 0 ? 'kings' : 'sharks',
      hp: 40,
      dead: false,
      hostile: false,
    };
    gangs.members.push(ped);
  }
  return gangs;
}

// Which gang's turf is (x, z) in, if any. hx/hz are the full
// width/height, so the test is against half of each.
export function gangAt(x, z) {
  for (const key of ['kings', 'sharks']) {
    const t = GANGS[key].turf;
    if (Math.abs(x - t.x) < t.hx / 2 && Math.abs(z - t.z) < t.hz / 2) return key;
  }
  return null;
}

export function stepGangs(game, dt) {
  const s = game.state;
  const p = s.player;
  for (const m of game.gangs.members) {
    if (m.dead) continue;
    const d = Math.hypot(m.x - p.x, m.z - p.z);
    const turf = gangAt(p.x, p.z);
    // Hostile when the player is inside their turf, or already
    // hostile from an earlier fight.
    if ((turf === m.gang && d < 25) || m.hostile) {
      m.hostile = true;
      m.activity = 'walk';
      // Chase and punch the player.
      const dx = p.x - m.x, dz = p.z - m.z;
      const dd = Math.hypot(dx, dz) || 1;
      m.heading = Math.atan2(dx, dz);
      if (d > 1.5) {
        m.x += (dx / dd) * m.speed * dt;
        m.z += (dz / dd) * m.speed * dt;
        m.bob += dt * m.speed * 2.2;
      } else {
        // In range: punch (with a cooldown so the player is not
        // instantly shredded).
        m.waitT -= dt;
        if (m.waitT <= 0) {
          m.waitT = 1.2;
          game.state.health = Math.max(0, game.state.health - 8);
          showToast(s, 'A ' + (m.gang === 'kings' ? 'Bay King' : 'Harbour Shark') + ' hit you!', 2);
        }
      }
    } else {
      // Idle: wander their turf.
      m.waitT -= dt;
      if (m.waitT <= 0) {
        m.waitT = 5 + Math.random() * 10;
        const def = GANGS[m.gang];
        m.target = {
          x: def.turf.x + (Math.random() - 0.5) * def.turf.hx,
          z: def.turf.z + (Math.random() - 0.5) * def.turf.hz,
        };
      }
      if (m.target) {
        const dx = m.target.x - m.x, dz = m.target.z - m.z;
        const dd = Math.hypot(dx, dz);
        if (dd > 1) {
          m.heading = Math.atan2(dx, dz);
          m.x += (dx / dd) * m.speed * 0.5 * dt;
          m.z += (dz / dd) * m.speed * 0.5 * dt;
          m.bob += dt * m.speed;
        }
      }
    }
  }
}

// Turf job: clear the rival gang's turf (kill or scare off 3
// members) for $250 + 25 respect. Started from the side-job marker
// at (-100, -100).
export function startTurfJob(game) {
  const s = game.state;
  game.sideJob = { kind: 'turf', need: 3, done: 0, target: 'sharks' };
  showToast(s, 'Turf war: clear 3 Harbour Sharks from the harbour.', 5);
}

export function gangMemberKilled(game, member) {
  const s = game.state;
  member.dead = true;
  dropCash(game, member.x, member.z);
  if (game.sideJob && game.sideJob.kind === 'turf') {
    game.sideJob.done++;
    if (game.sideJob.done >= game.sideJob.need) {
      game.sideJob = null;
      addCash(s, 250);
      addRespect(s, 25);
      s.stats.sideJobsDone++;
      showToast(s, 'Turf cleared! +$250, +25 REP', 5);
    }
  }
}

export function gangBoxes(game, out) {
  const p = game.state.player;
  for (const m of game.gangs.members) {
    if (m.dead) continue;
    const d = Math.hypot(m.x - p.x, m.z - p.z);
    if (d > 220) continue;
    const swing = m.activity === 'walk' ? Math.sin(m.bob) * 0.5 : 0;
    const color = m.gang === 'kings' ? COL.gangKings : COL.gangSharks;
    out.pushBoxRot(m.x - 0.11, 0.45, m.z, 0.18, 0.9, 0.18, [0.2, 0.2, 0.2], m.heading + swing * 0.1);
    out.pushBoxRot(m.x + 0.11, 0.45, m.z, 0.18, 0.9, 0.18, [0.2, 0.2, 0.2], m.heading - swing * 0.1);
    out.pushBoxRot(m.x, 1.25, m.z, 0.55, 0.7, 0.3, [0.12, 0.12, 0.12], m.heading);
    out.pushBoxRot(m.x - 0.32, 1.25, m.z, 0.14, 0.65, 0.14, m.skin, m.heading + swing * 0.4);
    out.pushBoxRot(m.x + 0.32, 1.25, m.z, 0.14, 0.65, 0.14, m.skin, m.heading - swing * 0.4);
    out.pushBoxRot(m.x, 1.82, m.z, 0.34, 0.36, 0.32, m.skin, m.heading);
    out.pushBoxRot(m.x, 1.78, m.z, 0.36, 0.08, 0.34, color, m.heading);
    out.pushFlat(m.x, 0.06, m.z, 0.7, 0.7, [0, 0, 0], m.heading);
  }
}
