// Solmar Bay — pedestrians (rebuild #13).
// 76 peds: 7 sit, 14 chat, 7 queue, 6 vendor, 42 walk.
import { randomSidewalkPoint } from './world.js';
import { pushBox } from './render.js';
import { COL } from './config.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SHIRTS = [[0.8, 0.3, 0.3], [0.3, 0.5, 0.9], [0.9, 0.8, 0.3], [0.4, 0.8, 0.4], [0.7, 0.4, 0.8], [0.9, 0.6, 0.3]];

export function spawnPeds(g) {
  const rng = mulberry32(777);
  const acts = [
    ...Array(7).fill('sit'), ...Array(14).fill('chat'),
    ...Array(7).fill('queue'), ...Array(6).fill('vendor'),
    ...Array(42).fill('walk'),
  ];
  g.peds = acts.map((activity) => {
    const p = randomSidewalkPoint(rng);
    const t = randomSidewalkPoint(rng);
    return {
      x: p.x, z: p.z,
      hp: 100, dead: false,
      activity,
      height: 1.7 + rng() * 0.3,
      bulk: 0.8 + rng() * 0.5,
      hairStyle: Math.floor(rng() * 5),
      hairCol: Math.floor(rng() * COL.hair.length),
      skinCol: COL.skin[Math.floor(rng() * COL.skin.length)],
      shirtCol: SHIRTS[Math.floor(rng() * SHIRTS.length)],
      heading: rng() * Math.PI * 2,
      tx: t.x, tz: t.z,
      flee: 0, speed: 1.2 + rng() * 0.8,
      _assaulted: false,
    };
  });
}

export function stepPed(g, p, dt) {
  if (p.dead) return;
  if (p.flee > 0) {
    p.flee -= dt;
    const dx = p.x - g.player.x, dz = p.z - g.player.z;
    const d = Math.hypot(dx, dz) || 1;
    p.x += (dx / d) * 4 * dt;
    p.z += (dz / d) * 4 * dt;
    return;
  }
  if (p.activity !== 'walk') return; // sit / chat / queue / vendor stay put
  let dx = p.tx - p.x, dz = p.tz - p.z;
  let d = Math.hypot(dx, dz);
  if (d < 1) {
    // Reached the target: pick a new one and keep walking this step.
    const t = randomSidewalkPoint(Math.random);
    p.tx = t.x;
    p.tz = t.z;
    dx = p.tx - p.x;
    dz = p.tz - p.z;
    d = Math.hypot(dx, dz);
    if (d < 1) return;
  }
  p.x += (dx / d) * p.speed * dt;
  p.z += (dz / d) * p.speed * dt;
  p.heading = Math.atan2(dx, dz);
}

export function stepPeds(g, dt) {
  for (const p of g.peds) stepPed(g, p, dt);
}

// 8 base boxes: legs 2, torso, arms 2, head, hair, shoes.
// Near LOD (a camera is given and the ped is within 40 m): +2 eyes.
export function pedBoxes(g, p, b, cam) {
  if (p.dead) return 0;
  const plain = [0, 0, 1, 1];
  const s = p.height / 1.8;
  const w = 0.32 * p.bulk;
  let n = 0;
  const box = (x, y, z, bw, bh, bd, col) => { pushBox(b, x, y, z, bw, bh, bd, col, plain); n++; };
  box(p.x - 0.14, 0.2 * s, p.z, 0.2, 0.6 * s, 0.2, [0.2, 0.25, 0.4]); // leg L
  box(p.x + 0.14, 0.2 * s, p.z, 0.2, 0.6 * s, 0.2, [0.2, 0.25, 0.4]); // leg R
  box(p.x, 0.8 * s, p.z, w + 0.3, 0.6 * s, 0.3, p.shirtCol); // torso
  box(p.x - 0.42, 0.8 * s, p.z, 0.18, 0.55 * s, 0.18, p.shirtCol); // arm L
  box(p.x + 0.42, 0.8 * s, p.z, 0.18, 0.55 * s, 0.18, p.shirtCol); // arm R
  box(p.x, 1.4 * s, p.z, 0.36, 0.36 * s, 0.36, p.skinCol); // head
  box(p.x, 1.72 * s, p.z, 0.38, 0.16 * s, 0.38, COL.hair[p.hairCol]); // hair
  box(p.x, 0, p.z, 0.55, 0.2 * s, 0.3, [0.15, 0.15, 0.15]); // shoes
  if (cam) {
    const d = Math.hypot(p.x - cam.x, p.z - cam.z);
    if (d < 40) {
      box(p.x - 0.09, 1.48 * s, p.z + 0.19, 0.06, 0.06, 0.02, [0.05, 0.05, 0.05]);
      box(p.x + 0.09, 1.48 * s, p.z + 0.19, 0.06, 0.06, 0.02, [0.05, 0.05, 0.05]);
    }
  }
  return n;
}
