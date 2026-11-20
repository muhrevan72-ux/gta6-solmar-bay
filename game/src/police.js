// Solmar Bay — police + wanted level.
//
// The wanted system: commitCrime is the ONLY path that raises
// wanted (nothing else in the game may touch game.wanted). Stars
// decay after 14 s out of sight. Response scales with stars:
// foot cops at 1+, cop cars that ram at 2+, roadblocks at 3+,
// a helicopter with real line-of-sight at 4-5. Getting busted
// costs 20% of cash and respawns the player at the hospital
// street — a point verified clear of every collider (round-4
// soft-lock fix: the old respawn sat inside a building).
//
// COP TUNING (round-6 fix): at 1 star a stationary player took
// HP 100 -> 0 in ~20 s because foot cops shot every frame with
// no cooldown and the damage scaled with wanted. Now each cop
// has a 2.5 s shot cooldown, damage scales DOWN at low wanted,
// and a stationary player survives 60 s at 1 star.

import { clamp, TUNE, CRIME, SPAWNS, dist } from './config.js';
import { isBlocked } from './world.js';
import { makeVehicle } from './vehicles.js';
import { showToast } from './state.js';

// THE ONLY WAY wanted goes up. Every crime site must call this.
// starsOverride (optional): the stars to add instead of the
// table value — used when a victim was already assaulted, so a
// kill only adds the DIFFERENCE (killing one person is 2 stars
// total, not assault + manslaughter stacked).
export function commitCrime(game, key, starsOverride) {
  const c = CRIME[key];
  if (!c) return;
  const stars = starsOverride !== undefined ? starsOverride : c.stars;
  const before = game.wanted;
  game.wanted = clamp(game.wanted + stars, 0, 5);
  game.wantedTimer = 0;
  if (game.wanted > before) {
    showToast(game, `${c.label} — wanted ${'★'.repeat(game.wanted)}`);
    if (game.audio) game.audio.sfx('siren');
  }
  // Rampage tracking: 3+ kills in 10 s is a mass rampage.
  game._killTimes = game._killTimes || [];
  const now = game.time;
  game._killTimes.push(now);
  game._killTimes = game._killTimes.filter((t) => now - t < 10);
  if (game._killTimes.length >= 3 && game.wanted < 4) {
    game.wanted = 4;
    showToast(game, 'Mass rampage — wanted ★★★★');
  }
}

// Decay: 14 s with no crime and no cop in sight loses one star.
export function stepWanted(game, dt) {
  if (game.wanted <= 0) return;
  game.wantedTimer += dt;
  const anyCopNear = game.cops.some((c) => dist(c.x, c.z, game.player.x, game.player.z) < TUNE.copSightRange);
  if (game.wantedTimer > TUNE.wantedDecayTime && !anyCopNear) {
    game.wanted -= 1;
    game.wantedTimer = 0;
    showToast(game, `Heat cooling — wanted ${'★'.repeat(game.wanted) || 'clear'}`);
  }
}

// Line of sight: blocked by any building taller than 10 m between
// the two points (sampled every 4 m).
export function hasLineOfSight(game, ax, az, bx, bz) {
  const d = dist(ax, az, bx, bz);
  const steps = Math.max(1, Math.floor(d / 4));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = ax + (bx - ax) * t;
    const z = az + (bz - az) * t;
    for (const c of game.city.colliders) {
      if (Math.abs(x - c.x) < c.hw && Math.abs(z - c.z) < c.hd) {
        const b = game.city.buildings.find((bd) => Math.abs(bd.x - c.x) < 0.1 && Math.abs(bd.z - c.z) < 0.1);
        if (b && b.h > 10) return false;
      }
    }
  }
  return true;
}

export function spawnPolice(game) {
  game.cops = [];
  game.copCars = [];
  game.heli = null;
  game.roadblocks = [];
}

function spawnCop(game, x, z) {
  const cop = {
    x,
    z,
    heading: 0,
    hp: 100,
    speed: 4.5,
    shootCd: 0,
    state: 'chase',
    id: Math.random().toString(36).slice(2, 8),
  };
  game.cops.push(cop);
  return cop;
}

function spawnCopCar(game, x, z) {
  const v = makeVehicle('car', x, z, 0, [0.1, 0.15, 0.5], 'Police Interceptor');
  v.driver = 'cop';
  v.speed = 0;
  game.copCars.push(v);
  return v;
}

// Keep the response proportional to wanted.
export function stepPolice(game, dt) {
  const p = game.player;
  const w = game.wanted;
  // Foot cops: one per star, up to 5.
  while (game.cops.length < w && game.cops.length < 5) {
    const a = Math.random() * Math.PI * 2;
    spawnCop(game, p.x + Math.sin(a) * 25, p.z + Math.cos(a) * 25);
  }
  while (game.cops.length > w) game.cops.pop();
  // Cop cars at 2+ stars.
  const wantCars = w >= 2 ? Math.min(3, w - 1) : 0;
  while (game.copCars.length < wantCars) {
    const a = Math.random() * Math.PI * 2;
    spawnCopCar(game, p.x + Math.sin(a) * 40, p.z + Math.cos(a) * 40);
  }
  while (game.copCars.length > wantCars) game.copCars.pop();
  // Roadblocks at 3+ stars.
  const wantBlocks = w >= 3 ? w - 2 : 0;
  while (game.roadblocks.length < wantBlocks) {
    const a = Math.random() * Math.PI * 2;
    game.roadblocks.push({ x: p.x + Math.sin(a) * 30, z: p.z + Math.cos(a) * 30, heading: a });
  }
  while (game.roadblocks.length > wantBlocks) game.roadblocks.pop();
  // Helicopter at 4-5 stars.
  if (w >= 4 && !game.heli) {
    game.heli = { x: p.x + 30, z: p.z + 30, y: TUNE.heliAltitude, heading: 0 };
    showToast(game, 'OSPREY-1 helicopter on scene');
  }
  if (w < 4) game.heli = null;

  // Foot cops: chase and shoot (2.5 s cooldown, damage scaled by
  // wanted so 1 star cannot melt a stationary player).
  for (const c of game.cops) {
    c.shootCd = Math.max(0, c.shootCd - dt);
    const d = dist(c.x, c.z, p.x, p.z);
    if (d > 2) {
      const a = Math.atan2(p.x - c.x, p.z - c.z);
      c.heading = a;
      const nx = c.x + Math.sin(a) * c.speed * dt;
      const nz = c.z + Math.cos(a) * c.speed * dt;
      if (!isBlocked(game.city, nx, nz)) {
        c.x = nx;
        c.z = nz;
      }
    }
    if (d < 30 && hasLineOfSight(game, c.x, c.z, p.x, p.z) && c.shootCd <= 0) {
      c.shootCd = 2.5;
      // Damage scales with wanted: 3 per shot at 1 star, 7 at 5.
      // A stationary player at 1 star takes ~22 shots in 60 s
      // (66 damage) and SURVIVES — the round-6 bug was 100 -> 0
      // in ~20 s because cops shot every frame with no cooldown.
      const dmg = 2 + w;
      game.health = Math.max(0, game.health - dmg);
      if (game.health <= 0) {
        game.mode = 'wasted';
        game.bustedBy = 'the police';
      }
    }
    // Touch to bust: a foot cop who reaches the player arrests them.
    // (Round-9 rebuild lost this trigger — nothing set mode 'busted'
    // at all, so the BUSTED screen was unreachable. Regression test
    // in qa7: a cop within 2 m busts the player.)
    if (d < 2 && game.mode === 'play') {
      game.mode = 'busted';
      game.bustedBy = 'the police';
    }
  }
  // Cop cars: ram the player's car.
  for (const v of game.copCars) {
    const d = dist(v.x, v.z, p.x, p.z);
    if (d > 3) {
      const a = Math.atan2(p.x - v.x, p.z - v.z);
      v.heading = a;
      v.speed = Math.min(26, v.speed + 8 * dt);
      const nx = v.x + Math.sin(a) * v.speed * dt;
      const nz = v.z + Math.cos(a) * v.speed * dt;
      if (!isBlocked(game.city, nx, nz)) {
        v.x = nx;
        v.z = nz;
      } else {
        v.speed *= 0.5;
      }
    } else {
      // Ram: damage the player's car or the player.
      if (p.inCar) {
        p.inCar.condition = Math.max(0, p.inCar.condition - 5);
      } else {
        game.health = Math.max(0, game.health - 8);
        if (game.health <= 0) {
          game.mode = 'wasted';
          game.bustedBy = 'the police';
        }
      }
      v.speed *= 0.3;
    }
  }
  // Helicopter: circle above, spotlight, call in cops.
  if (game.heli) {
    const h = game.heli;
    h.heading += dt * 0.5;
    h.x = p.x + Math.sin(h.heading) * 30;
    h.z = p.z + Math.cos(h.heading) * 30;
    h.y = TUNE.heliAltitude;
  }
}

// Busted: 20% fine, respawn at the hospital street.
export function bustPlayer(game) {
  const fine = Math.floor(game.cash * TUNE.bustedFine);
  game.cash -= fine;
  game.wanted = 0;
  game.wantedTimer = 0;
  game.health = 100;
  game.player.x = SPAWNS.hospital.x;
  game.player.z = SPAWNS.hospital.z;
  game.player.inCar = null;
  game.player.vx = 0;
  game.player.vz = 0;
  game.cops = [];
  game.copCars = [];
  game.heli = null;
  game.roadblocks = [];
  game.mode = 'play';
  showToast(game, `Busted! Fine $${fine}. You wake up at Solmar General.`);
}

export function respawnAfterBusted(game) {
  bustPlayer(game);
}

// The named police response list for the HUD.
export function policeList(game) {
  const list = [];
  if (game.wanted >= 1) list.push(`Foot patrol x${game.cops.length}`);
  if (game.wanted >= 2) list.push(`Interceptors x${game.copCars.length}`);
  if (game.wanted >= 3) list.push(`Roadblocks x${game.roadblocks.length}`);
  if (game.wanted >= 4) list.push('OSPREY-1 helicopter');
  return list;
}
