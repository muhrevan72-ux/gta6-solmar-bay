// Solmar Bay — police, wanted, busts, helicopter, roadblocks.
//
// Crime raises wanted by the CRIME table (like real GTA: stealing a
// car is 1 star, killing a cop is 3, a massacre is 5). Wanted decays
// one star per 14 clean seconds. Cop cars chase and ram; foot cops
// punch. At 4-5 stars a helicopter joins (real line-of-sight through
// tall buildings). At 3+ stars roadblocks appear 50 m ahead.
//
// PLAY-TEST #4 TUNING (do not regress): a stationary player at 1
// star must survive 60 s (per-car ram cooldown 2.5 s, 0.8 s reverse
// after a ram, damage scaled by wanted, 1-star cop cars cut to 2,
// foot-cop baton cooldown 1.2 s). A bust costs 20% of cash and
// respawns the player at the hospital STREET (-88, 150) — 34 units
// from the hospital building's east face (x=-122), clear of every
// collider. The round-4 bug respawned the player INSIDE the hospital
// collider and soft-locked the game; the respawn test asserts the
// player can move >= 5 m in each direction afterwards.

import { TUNE, CRIME, COL, clamp } from './config.js';
import { showToast, showMenu, hideMenu, addCash, damagePlayer } from './state.js';

export function createPolice() {
  return {
    cops: [], // foot cops {x, z, heading, batonT}
    cars: [], // cop cars {x, z, heading, speed, ramT, reverseT}
    heli: null, // {x, y, z, heading, rotor}
    roadblocks: [], // {x, z, heading}
    wantedT: 0, // seconds since the last crime (decay timer)
    bustT: 0, // seconds a cop has been in bust range
  };
}

export function commitCrime(game, kind) {
  const s = game.state;
  const entry = CRIME[kind];
  const level = entry ? entry.stars : 1;
  if (level > s.wanted) {
    s.wanted = level;
    game.police.wantedT = 0;
  }
}

function desiredCopCars(wanted) {
  if (wanted <= 0) return 0;
  if (wanted === 1) return 2;
  if (wanted === 2) return 3;
  if (wanted === 3) return 4;
  return 5;
}

export function stepPolice(game, dt) {
  const s = game.state;
  const p = s.player;
  const pol = game.police;
  // Wanted decay: 14 clean seconds loses one star.
  if (s.wanted > 0) {
    pol.wantedT += dt;
    if (pol.wantedT >= TUNE.wantedDecayTime) {
      pol.wantedT = 0;
      s.wanted--;
      if (s.wanted === 0) showToast(s, 'You lost the heat.', 3);
    }
  } else {
    pol.wantedT = 0;
  }
  // Cop cars: spawn to the desired count near the player.
  const want = desiredCopCars(s.wanted);
  while (pol.cars.length < want) {
    const a = Math.random() * Math.PI * 2;
    pol.cars.push({
      x: p.x + Math.cos(a) * 40,
      z: p.z + Math.sin(a) * 40,
      heading: 0, speed: 0, ramT: 0, reverseT: 0, circleT: 0,
    });
  }
  if (pol.cars.length > want) pol.cars.length = want;
  // Cop cars chase. A ram has a LONG per-car cooldown (25 s at 1
  // star, scaling down with wanted) and the car then circles at a
  // distance instead of re-ramming immediately — a stationary player
  // at 1 star must survive 60 s (HP 100, car not wrecked). The
  // play-test #4 bug was a cop shredding an idle player in ~20 s.
  for (const c of pol.cars) {
    const dx = p.x - c.x, dz = p.z - c.z;
    const d = Math.hypot(dx, dz) || 1;
    c.heading = Math.atan2(dx, dz);
    c.ramT -= dt;
    c.reverseT -= dt;
    c.circleT -= dt;
    if (c.reverseT > 0) {
      c.speed = -6;
    } else if (c.circleT > 0) {
      // Circle the player at ~20 m while the ram cooldown runs:
      // heading is tangential to the radius (game convention:
      // heading = atan2(dx, dz), movement = (sin h, cos h)).
      const theta = Math.atan2(c.x - p.x, c.z - p.z);
      c.heading = theta + Math.PI / 2;
      c.speed = 10;
      c.x += Math.sin(c.heading) * c.speed * dt;
      c.z += Math.cos(c.heading) * c.speed * dt;
    } else if (d > 3) {
      c.speed = Math.min(26, c.speed + 12 * dt);
      c.x += Math.sin(c.heading) * c.speed * dt;
      c.z += Math.cos(c.heading) * c.speed * dt;
    } else {
      c.speed = 0;
    }
    if (d < 3 && c.ramT <= 0 && c.circleT <= 0) {
      c.ramT = Math.max(5, 25 / Math.max(1, s.wanted));
      c.circleT = c.ramT;
      c.reverseT = 0.8;
      const dmg = 4 * s.wanted;
      if (p.inCar) {
        p.inCar.condition = Math.max(0, p.inCar.condition - dmg);
        showToast(s, 'Police rammed your car! Condition ' + Math.round(p.inCar.condition) + '%', 2);
      } else {
        damagePlayer(s, dmg);
        showToast(s, 'Police rammed you!', 2);
      }
    }
  }
  // Foot cops: spawn when wanted, chase, baton (1.2 s cooldown).
  const wantCops = s.wanted > 0 ? Math.min(4, s.wanted + 1) : 0;
  while (pol.cops.length < wantCops) {
    const a = Math.random() * Math.PI * 2;
    pol.cops.push({ x: p.x + Math.cos(a) * 25, z: p.z + Math.sin(a) * 25, heading: 0, batonT: 0 });
  }
  if (pol.cops.length > wantCops) pol.cops.length = wantCops;
  for (const c of pol.cops) {
    const dx = p.x - c.x, dz = p.z - c.z;
    const d = Math.hypot(dx, dz) || 1;
    c.heading = Math.atan2(dx, dz);
    c.batonT -= dt;
    if (d > 1.5) {
      c.x += (dx / d) * 6 * dt;
      c.z += (dz / d) * 6 * dt;
    } else if (c.batonT <= 0 && !p.inCar) {
      // A foot cop cannot baton a player inside a car.
      c.batonT = 1.2;
      damagePlayer(s, 6);
      showToast(s, 'A cop hit you with a baton!', 2);
    }
  }
  // Helicopter at 4-5 stars: altitude 80, chases at 22 u/s, with a
  // spotlight. It despawns the moment wanted drops below 4.
  if (s.wanted >= 4) {
    if (!pol.heli) {
      pol.heli = { x: p.x + 30, y: TUNE.heliAltitude, z: p.z - 30, heading: 0, rotor: 0 };
      showToast(s, 'Police helicopter overhead! Break line of sight!', 5);
    }
    const h = pol.heli;
    const dx = p.x - h.x, dz = p.z - h.z;
    const d = Math.hypot(dx, dz) || 1;
    h.heading = Math.atan2(dx, dz);
    h.x += (dx / d) * TUNE.heliSpeed * dt;
    h.z += (dz / d) * TUNE.heliSpeed * dt;
    h.rotor += dt * 30;
    // Spotlight only matters when the heli can SEE the player: real
    // line-of-sight — a tall building between heli and player blocks
    // it (the spotlight cone is drawn only when the LOS is clear).
    h.losClear = hasLineOfSight(game, h.x, h.y, h.z, p.x, 1.5, p.z);
  } else {
    pol.heli = null;
  }
  // Roadblocks at 3+ stars: 3 parked cop cars 50 m ahead of the
  // player (in the direction the player is facing).
  if (s.wanted >= 3 && pol.roadblocks.length === 0) {
    const hx = Math.sin(p.heading), hz = Math.cos(p.heading);
    for (let i = -1; i <= 1; i++) {
      pol.roadblocks.push({
        x: p.x + hx * 50 - hz * i * 6,
        z: p.z + hz * 50 + hx * i * 6,
        heading: p.heading + Math.PI / 2,
      });
    }
    showToast(s, 'Roadblock ahead!', 4);
  } else if (s.wanted < 3) {
    pol.roadblocks = [];
  }
  // Bust: a cop within 2 m for 2 s while wanted.
  if (s.wanted > 0 && !p.inCar) {
    let near = false;
    for (const c of pol.cops) {
      if (Math.hypot(c.x - p.x, c.z - p.z) < 2) near = true;
    }
    for (const c of pol.cars) {
      if (Math.hypot(c.x - p.x, c.z - p.z) < 2.5) near = true;
    }
    if (near) {
      pol.bustT += dt;
      if (pol.bustT > 2) {
        pol.bustT = 0;
        bustPlayer(game);
      }
    } else {
      pol.bustT = 0;
    }
  } else {
    pol.bustT = 0;
  }
  // Wasted: HP hit zero.
  if (s.health <= 0) {
    wastedPlayer(game);
  }
}

// Real line-of-sight: sample the segment; blocked if a tall building
// (h > 15) stands within 3 m of any sample point.
export function hasLineOfSight(game, x0, y0, z0, x1, y1, z1) {
  for (let t = 0.1; t < 1; t += 0.1) {
    const x = x0 + (x1 - x0) * t;
    const z = z0 + (z1 - z0) * t;
    const y = y0 + (y1 - y0) * t;
    for (const b of game.city.buildings) {
      if (b.h > 15 && Math.abs(x - b.x) < b.sx / 2 + 3 && Math.abs(z - b.z) < b.sz / 2 + 3 && y < b.h) {
        return false;
      }
    }
  }
  return true;
}

export function bustPlayer(game) {
  const s = game.state;
  const fine = Math.floor(s.cash * TUNE.bustedFine);
  addCash(s, -fine);
  s.wanted = 0;
  s.health = 100;
  respawnAfterBusted(game);
  showMenu(s, 'BUSTED', 'The police caught you. Fine: -$' + fine + '.', 'Press Enter to respawn at the hospital.');
  s.mode = 'busted';
}

// Respawn on the STREET east of the hospital (-88, 150) — 34 units
// from the hospital building's east face (x=-122), clear of every
// collider. The round-4 bug respawned the player at the building's
// centre (-100, 100) and soft-locked the game.
export function respawnAfterBusted(game) {
  const s = game.state;
  s.player.x = game.city.spawns.hospital.x;
  s.player.z = game.city.spawns.hospital.z;
  s.player.inCar = null;
  s.player.vx = 0;
  s.player.vz = 0;
  s.player.heading = 0;
  hideMenu(s);
}

export function wastedPlayer(game) {
  const s = game.state;
  const fine = Math.floor(s.cash * TUNE.bustedFine);
  addCash(s, -fine);
  s.wanted = 0;
  s.health = 100;
  respawnAfterBusted(game);
  showMenu(s, 'WASTED', 'You died. Hospital bill: -$' + fine + '.', 'Press Enter to respawn at the hospital.');
  s.mode = 'wasted';
}

// The named police-response list for the dense HUD: unit name,
// distance, and status (RAMMING / PURSUIT / RESPONDING / SPOTLIGHT /
// SEARCHING / ROADBLOCK).
export function policeResponseList(game) {
  const s = game.state;
  const p = s.player;
  const list = [];
  const names = ['OSPREY', 'KESTREL', 'FALCON', 'HAWK'];
  game.police.cars.forEach((c, i) => {
    const d = Math.round(Math.hypot(c.x - p.x, c.z - p.z));
    const status = d < 5 ? 'RAMMING' : d < 30 ? 'PURSUIT' : 'RESPONDING';
    list.push({ name: names[i % names.length] + '-' + (i + 1), dist: d, status });
  });
  game.police.cops.forEach((c, i) => {
    const d = Math.round(Math.hypot(c.x - p.x, c.z - p.z));
    list.push({ name: 'OFFICER-' + (i + 1), dist: d, status: d < 5 ? 'RAMMING' : 'PURSUIT' });
  });
  if (game.police.heli) {
    const h = game.police.heli;
    const d = Math.round(Math.hypot(h.x - p.x, h.z - p.z));
    list.push({ name: 'HELI-1', dist: d, status: h.losClear ? 'SPOTLIGHT' : 'SEARCHING' });
  }
  for (const rb of game.police.roadblocks) {
    const d = Math.round(Math.hypot(rb.x - p.x, rb.z - p.z));
    list.push({ name: 'ROADBLOCK', dist: d, status: 'ROADBLOCK' });
  }
  return list;
}

// Police as boxes: foot cops (dark blue, cap), cop cars (black +
// white doors, light bar), heli (body + rotor + spotlight cone),
// roadblock cars.
export function policeBoxes(game, out) {
  const pol = game.police;
  const p = game.state.player;
  for (const c of pol.cops) {
    out.pushBoxRot(c.x - 0.11, 0.45, c.z, 0.18, 0.9, 0.18, [0.1, 0.1, 0.2], c.heading);
    out.pushBoxRot(c.x + 0.11, 0.45, c.z, 0.18, 0.9, 0.18, [0.1, 0.1, 0.2], c.heading);
    out.pushBoxRot(c.x, 1.25, c.z, 0.5, 0.7, 0.28, [0.1, 0.15, 0.4], c.heading);
    out.pushBoxRot(c.x, 1.82, c.z, 0.34, 0.36, 0.32, COL.skin[1], c.heading);
    out.pushBoxRot(c.x, 2.02, c.z, 0.36, 0.1, 0.34, [0.1, 0.15, 0.4], c.heading);
    out.pushFlat(c.x, 0.06, c.z, 0.7, 0.7, [0, 0, 0], c.heading);
  }
  for (const c of pol.cars) {
    out.pushBoxRot(c.x, 0.55, c.z, 1.8, 0.7, 4.2, [0.08, 0.08, 0.1], c.heading);
    out.pushBoxRot(c.x, 1.15, c.z - 0.3, 1.6, 0.6, 2.2, [0.9, 0.9, 0.9], c.heading);
    out.pushBoxRot(c.x, 1.5, c.z - 0.3, 1.2, 0.15, 0.6, [0.9, 0.1, 0.1], c.heading);
    out.pushBoxRot(c.x, 1.5, c.z + 0.3, 1.2, 0.15, 0.6, [0.1, 0.3, 1], c.heading);
    out.pushFlat(c.x, 0.06, c.z, 2.2, 4.6, [0, 0, 0], c.heading);
  }
  for (const rb of pol.roadblocks) {
    out.pushBoxRot(rb.x, 0.55, rb.z, 1.8, 0.7, 4.2, [0.08, 0.08, 0.1], rb.heading);
    out.pushBoxRot(rb.x, 1.15, rb.z - 0.3, 1.6, 0.6, 2.2, [0.9, 0.9, 0.9], rb.heading);
    out.pushFlat(rb.x, 0.06, rb.z, 2.2, 4.6, [0, 0, 0], rb.heading);
  }
  if (pol.heli) {
    const h = pol.heli;
    out.pushBoxRot(h.x, h.y, h.z, 2.5, 1.2, 5, [0.1, 0.15, 0.3], h.heading);
    out.pushBoxRot(h.x, h.y + 0.9, h.z, 0.3, 0.3, 5.5, [0.2, 0.2, 0.2], h.heading + h.rotor);
    out.pushBoxRot(h.x, h.y + 0.9, h.z, 5.5, 0.3, 0.3, [0.2, 0.2, 0.2], h.heading + h.rotor);
    // Spotlight cone + ground pool (only when the LOS is clear).
    if (h.losClear) {
      const midX = (h.x + p.x) / 2, midZ = (h.z + p.z) / 2;
      out.pushBoxRot(midX, (h.y + 1.5) / 2, midZ, 0.8, h.y - 1.5, 0.8, [1, 1, 0.7], h.heading);
      out.pushFlat(p.x, 0.08, p.z, 6, 6, [1, 1, 0.6], 0);
    }
  }
}
