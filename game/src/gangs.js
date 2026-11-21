// Solmar Bay — the two rival gangs.
//
// The Bay Kings own downtown; the Harbour Sharks own the docks. A gang
// member on its own turf attacks the player on sight; off turf the
// members just patrol. Walking into Kings turf earns a warning toast.
// The bandana is the last box of the model, in the gang colour.

import { mulberry32 } from './state.js';
import { pushBox, pushBoxRot } from './render.js';
import { damagePlayer } from './combat.js';
import { showToast } from './state.js';

export const TURFS = {
  kings: { x: 0, z: -60, r: 140, colour: [0.95, 0.75, 0.1], label: 'Bay Kings' },
  sharks: { x: -240, z: 200, r: 140, colour: [0.15, 0.55, 0.85], label: 'Harbour Sharks' },
};

export function gangInTurf(gang, x, z) {
  const t = TURFS[gang];
  if (!t) return false;
  return Math.hypot(x - t.x, z - t.z) <= t.r;
}

export function spawnGangs(g) {
  const rng = mulberry32(21);
  const members = [];
  const mk = (gang, x, z) => ({
    gang,
    x,
    z,
    hp: 100,
    heading: rng() * Math.PI * 2,
    speed: 2 + rng() * 1.5,
    dead: false,
    flee: 0,
    attackCd: 0,
    wanderA: rng() * Math.PI * 2,
    shirt: gang === 'kings' ? [0.95, 0.75, 0.1] : [0.15, 0.55, 0.85],
    skin: [0.7, 0.5, 0.35],
    pants: [0.2, 0.2, 0.25],
  });
  for (let i = 0; i < 13; i++) {
    const a = rng() * Math.PI * 2;
    const r = 20 + rng() * 100;
    members.push(mk('kings', TURFS.kings.x + Math.cos(a) * r, TURFS.kings.z + Math.sin(a) * r));
  }
  for (let i = 0; i < 12; i++) {
    const a = rng() * Math.PI * 2;
    const r = 20 + rng() * 100;
    members.push(mk('sharks', TURFS.sharks.x + Math.cos(a) * r, TURFS.sharks.z + Math.sin(a) * r));
  }
  g.gangMembers = members;
  return members;
}

export function stepGangs(g, dt) {
  const p = g.player;
  // Warning toast on entering Kings turf.
  const inKings = gangInTurf('kings', p.x, p.z);
  if (inKings && !g._inKingsTurf) {
    showToast(g, 'You are in kings turf — the Bay Kings own downtown. Watch your back.');
  }
  g._inKingsTurf = inKings;

  for (const m of g.gangMembers) {
    if (m.dead) continue;
    m.attackCd = Math.max(0, (m.attackCd || 0) - dt);
    const inTurf = gangInTurf(m.gang, m.x, m.z);
    const d = Math.hypot(p.x - m.x, p.z - m.z);
    // A member only hurts the player up close (within 3 m) and on its
    // own turf. There is no invisible turf damage, and members do not
    // chase from across the district — they patrol until you are near.
    if (inTurf && gangInTurf(m.gang, p.x, p.z) && d <= 3) {
      m.heading = Math.atan2(p.x - m.x, p.z - m.z);
      if (m.attackCd <= 0) {
        damagePlayer(g, 5);
        m.attackCd = 1;
      }
    } else {
      // Patrol: wander slowly, changing direction now and then.
      if (Math.random() < dt * 0.2) m.wanderA += (Math.random() - 0.5) * 2;
      m.x += Math.sin(m.wanderA) * m.speed * 0.5 * dt;
      m.z += Math.cos(m.wanderA) * m.speed * 0.5 * dt;
      m.heading = m.wanderA;
      m.x = Math.max(-395, Math.min(395, m.x));
      m.z = Math.max(-395, Math.min(395, m.z));
    }
  }
}

// A box with no per-face shading: every vertex gets the exact colour.
// Used for the bandana, whose colour the tests read back verbatim.
function pushBoxFlat(b, x, y, z, w, h, d, color, uv) {
  const [u0, v0, u1, v1] = uv || [0, 0, 1, 1];
  const x0 = x - w / 2, x1 = x + w / 2;
  const y0 = y, y1 = y + h;
  const z0 = z - d / 2, z1 = z + d / 2;
  const faces = [
    [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]],
    [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]],
    [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]],
    [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]],
    [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]],
    [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]],
  ];
  const faceUv = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
  for (const corners of faces) {
    for (const i of [0, 1, 2, 0, 2, 3]) {
      const pt = corners[i];
      b.pos.push(pt[0], pt[1], pt[2]);
      b.col.push(color[0], color[1], color[2]);
      b.uv.push(faceUv[i][0], faceUv[i][1]);
      b.norm.push(0, 1, 0);
    }
  }
}

// A gang member: head, torso, arms, legs, and the bandana last.
export function gangBoxes(g, m, b, cam) {
  if (m.dead) return 0;
  const plain = [0, 0, 1, 1];
  const h = m.heading || 0;
  const colour = TURFS[m.gang].colour;
  const parts = [
    [0, 0, 0, 0.17, 0.8, 0.17, m.pants],
    [0, 0, 0, 0.17, 0.8, 0.17, m.pants],
    [0, 0.8, 0, 0.5, 0.55, 0.3, m.shirt],
    [0, 1.35, 0, 0.32, 0.3, 0.3, m.skin],
    [0, 0.85, 0, 0.14, 0.5, 0.14, m.shirt],
    [0, 0.85, 0, 0.14, 0.5, 0.14, m.shirt],
  ];
  const sides = [[-0.11, 0], [0.11, 0], [0, 0], [0, 0], [-0.33, 0], [0.33, 0]];
  const cos = Math.cos(h);
  const sin = Math.sin(h);
  for (let i = 0; i < parts.length; i++) {
    const [dx, dy, dz, w, hh, d, col] = parts[i];
    const [sx, sz] = sides[i];
    const lx = dx + sx;
    const lz = dz + sz;
    const wx = m.x + lx * cos + lz * sin;
    const wz = m.z - lx * sin + lz * cos;
    pushBoxRot(b, wx, dy, wz, w, hh, d, h, col, plain);
  }
  // Bandana, last: flat gang colour, no shading.
  pushBoxFlat(b, m.x, 1.62, m.z, 0.36, 0.1, 0.34, colour, plain);
  return 7;
}
