// Solmar Bay — wanted level + police.
//
// Wanted stars per crime, GTA-style, through commitCrime(type):
// steal a car 1, punch a ped 1, kill a ped 2, kill a gang member 2,
// armed carjacking 2, kill a cop 3, explosion 3 (4 with multiple
// victims), kill 3+ cops / mass rampage 4, killing many cops +
// explosions 5. ONLY the player's own crimes raise wanted —
// nothing else (no gang hostility, no explosion splash, no event,
// no traffic bump) may call commitCrime.
//
// Police: cop cars chase and ram, foot cops chase near the player,
// wanted decays after 14 s out of sight. Busted = respawn at the
// hospital street, lose 20% of cash. At 4-5 stars a helicopter
// chases with a spotlight (real line-of-sight: a tall building
// between the heli and the player breaks it). At 3+ stars roadblocks
// of parked cop cars appear.

import { TUNE, CRIME, clamp, dist2 } from './config.js';
import { showToast, showMenu, hideMenu, damagePlayer } from './state.js';
import { makeVehicle, damageCar } from './vehicles.js';
import { playThud } from './audio.js';

// Cop-car unit names for the HUD police list (original names).
const UNIT_NAMES = ['OSPREY', 'KESTREL', 'FALCON', 'HAWK'];

export function createPolice() {
  return {
    cops: [], // foot cops {x, z, heading, speed, bob}
    cars: [], // police cars (vehicles in game.vehicles.list, flagged)
    heli: null, // {x, z, y, heading, rotor}
    roadblocks: [], // {x, z, heading, cars: [vehicle]}
    outOfSightT: 0,
    seen: false,
    copKills: 0,
    pedKills: 0,
    bombKills: 0,
    bustT: 0,
  };
}

// The ONLY way wanted rises. `type` must be a CRIME key.
export function commitCrime(game, type) {
  const s = game.state;
  const crime = CRIME[type];
  if (!crime) return;
  // Track kill counts for the rampage escalations.
  const pol = game.police;
  if (type === 'killCop') pol.copKills++;
  if (type === 'killPed' || type === 'killGang') pol.pedKills++;
  if (type === 'explosion') pol.bombKills++;
  let stars = crime.stars;
  if (pol.copKills >= 3 && pol.copKills < 6) stars = Math.max(stars, 4);
  if (pol.copKills >= 6 || (pol.copKills >= 3 && pol.bombKills >= 2)) stars = 5;
  if (pol.pedKills >= 4) stars = Math.max(stars, 4);
  if (stars > s.wanted) {
    s.wanted = Math.min(5, stars);
    showToast(s, crime.label + ' — wanted level ' + s.wanted, 3);
  }
  pol.outOfSightT = 0;
}

export function stepPolice(game, dt) {
  const s = game.state;
  const pol = game.police;
  const player = s.player;
  if (s.mode !== 'play') return;
  // Is any cop close enough to see the player?
  let seen = false;
  for (const c of pol.cops) {
    if (dist2(c.x, c.z, player.x, player.z) < TUNE.copSightRange * TUNE.copSightRange) { seen = true; break; }
  }
  if (!seen) {
    for (const v of pol.cars) {
      if (dist2(v.x, v.z, player.x, player.z) < TUNE.copSightRange * TUNE.copSightRange) { seen = true; break; }
    }
  }
  if (pol.heli) seen = true;
  pol.seen = seen;
  // Wanted decays after 14 s out of sight.
  if (s.wanted > 0) {
    if (seen) pol.outOfSightT = 0;
    else {
      pol.outOfSightT += dt;
      if (pol.outOfSightT >= TUNE.wantedDecayTime) {
        s.wanted = Math.max(0, s.wanted - 1);
        pol.outOfSightT = 0;
        if (s.wanted === 0) showToast(s, 'You lost the heat.', 3);
      }
    }
  }
  // Spawn pressure scales with wanted.
  const wantCars = s.wanted === 0 ? 0 : Math.min(1 + s.wanted, 5);
  const wantCops = s.wanted === 0 ? 0 : Math.min(1 + s.wanted, 5);
  while (pol.cars.length < wantCars) {
    const v = makeVehicle('police', player.x + (Math.random() < 0.5 ? -1 : 1) * (40 + Math.random() * 30), player.z + (Math.random() < 0.5 ? -1 : 1) * (40 + Math.random() * 30), 0);
    v.driver = 'police';
    game.vehicles.list.push(v);
    pol.cars.push(v);
  }
  while (pol.cops.length < wantCops) {
    pol.cops.push({
      x: player.x + (Math.random() - 0.5) * 40,
      z: player.z + (Math.random() - 0.5) * 40,
      heading: 0, speed: 5.5, bob: 0, hitT: 0, // baton swing cooldown
    });
  }
  // Trim extras when wanted falls.
  while (pol.cars.length > wantCars) {
    const v = pol.cars.pop();
    const i = game.vehicles.list.indexOf(v);
    if (i >= 0) game.vehicles.list.splice(i, 1);
  }
  while (pol.cops.length > wantCops) pol.cops.pop();
  // Chase: cop cars ram the player (or the player's car).
  // TUNING (play-test #4): the old ram had no cooldown, so a cop car
  // sitting on a stationary player rammed every frame and took a
  // stolen car from HP 100 to 0 in ~20 s at 1 star. A 1-star wanted
  // must not be a death sentence while stationary: each car rams at
  // most once per 2.5 s, backs off after a ram, and damage scales
  // with wanted (2 at 1 star, 6 at 5). Rams damage the CAR when the
  // player is driving, never the player's HP.
  for (const v of pol.cars) {
    if (v.ramT > 0) v.ramT -= dt;
    if (v.reverseT > 0) {
      v.reverseT -= dt;
      v.speed = Math.max(-8, v.speed - 20 * dt);
      v.x += Math.sin(v.heading) * v.speed * dt;
      v.z += Math.cos(v.heading) * v.speed * dt;
      v.wheelSpin += v.speed * dt * 2;
      continue;
    }
    const d = Math.sqrt(dist2(v.x, v.z, player.x, player.z)) || 1;
    const targetHeading = Math.atan2(player.x - v.x, player.z - v.z);
    let dh = targetHeading - v.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    v.heading += clamp(dh, -1.6 * dt, 1.6 * dt);
    v.speed = clamp(v.speed + 14 * dt, 0, 30);
    v.x += Math.sin(v.heading) * v.speed * dt;
    v.z += Math.cos(v.heading) * v.speed * dt;
    v.wheelSpin += v.speed * dt * 2;
    // Ram: close + fast + cooldown ready.
    if (d < 3.5 && Math.abs(v.speed) > 12 && v.ramT <= 0) {
      v.ramT = 2.5;
      v.reverseT = 0.8; // back off after the hit
      v.speed *= 0.4;
      if (player.inCar) {
        damageCar(game, player.inCar, 1 + s.wanted);
      } else {
        damagePlayer(s, 2 + s.wanted);
      }
      if (game.audio) playThud(game.audio);
    }
  }
  // Foot cops chase on foot and swing batons up close. A foot cop
  // cannot hurt a player inside a car, and swings at most once per
  // 1.2 s (the old code hit every frame: 6 HP/frame).
  for (const c of pol.cops) {
    if (c.hitT > 0) c.hitT -= dt;
    const d = Math.sqrt(dist2(c.x, c.z, player.x, player.z)) || 1;
    c.heading = Math.atan2(player.x - c.x, player.z - c.z);
    c.x += Math.sin(c.heading) * c.speed * dt;
    c.z += Math.cos(c.heading) * c.speed * dt;
    c.bob += c.speed * dt * 1.6;
    if (d < 2 && !player.inCar) {
      if (c.hitT <= 0) {
        c.hitT = 1.2;
        damagePlayer(s, 4);
      }
      // Boxed in: a foot cop on top of a slow, on-foot player busts
      // them after 2 seconds.
      if (!player.inCar && player.speed < 1) {
        pol.bustT += dt;
        if (pol.bustT > 2) {
          bustPlayer(game, 'busted');
          return;
        }
      } else {
        pol.bustT = 0;
      }
      if (s.health <= 0) break;
    }
  }
  // Helicopter at 4-5 stars.
  if (s.wanted >= 4 && !pol.heli) {
    pol.heli = { x: player.x + 60, z: player.z - 60, y: TUNE.heliAltitude, heading: 0, rotor: 0 };
    showToast(s, 'Police helicopter overhead — break line of sight!', 4);
  }
  if (pol.heli) {
    if (s.wanted < 4) {
      pol.heli = null;
    } else {
      const h = pol.heli;
      const d = Math.sqrt(dist2(h.x, h.z, player.x, player.z)) || 1;
      h.heading = Math.atan2(player.x - h.x, player.z - h.z);
      h.x += Math.sin(h.heading) * TUNE.heliSpeed * dt;
      h.z += Math.cos(h.heading) * TUNE.heliSpeed * dt;
      h.rotor += dt * 20;
      // Line of sight: a tall building between heli and player breaks
      // it, so heat can still be lost at 4-5 stars.
      h.los = hasLineOfSight(game, h.x, h.z, player.x, player.z);
      if (!h.los) pol.outOfSightT += dt;
    }
  }
  // Roadblocks at 3+ stars: 3 parked cop cars across the road ahead.
  if (s.wanted >= 3 && pol.roadblocks.length === 0) {
    const bx = player.x + Math.sin(player.heading) * 50;
    const bz = player.z + Math.cos(player.heading) * 50;
    const rb = { x: bx, z: bz, heading: player.heading, cars: [] };
    for (let i = -1; i <= 1; i++) {
      const v = makeVehicle('police', bx + Math.cos(player.heading) * i * 5, bz - Math.sin(player.heading) * i * 5, player.heading + Math.PI / 2);
      v.driver = null;
      game.vehicles.list.push(v);
      rb.cars.push(v);
    }
    pol.roadblocks.push(rb);
  }
  if (s.wanted < 3 && pol.roadblocks.length > 0) {
    for (const rb of pol.roadblocks) {
      for (const v of rb.cars) {
        const i = game.vehicles.list.indexOf(v);
        if (i >= 0) game.vehicles.list.splice(i, 1);
      }
    }
    pol.roadblocks = [];
  }
  // Busted: health 0, or boxed in by cops at close range while slow.
  if (s.health <= 0) {
    bustPlayer(game, 'wasted');
  }
}

// A tall building between (ax, az) and (bx, bz) blocks the view.
export function hasLineOfSight(game, ax, az, bx, bz) {
  for (const bd of game.city.buildings) {
    if (bd.h < 20) continue;
    // Segment vs AABB test (2D, XZ plane).
    const minX = bd.x - bd.sx / 2, maxX = bd.x + bd.sx / 2;
    const minZ = bd.z - bd.sz / 2, maxZ = bd.z + bd.sz / 2;
    if (segmentHitsBox(ax, az, bx, bz, minX, minZ, maxX, maxZ)) return false;
  }
  return true;
}

function segmentHitsBox(ax, az, bx, bz, minX, minZ, maxX, maxZ) {
  // Liang-Barsky clipping on the segment.
  const dx = bx - ax;
  const dz = bz - az;
  let t0 = 0;
  let t1 = 1;
  const p = [-dx, dx, -dz, dz];
  const q = [ax - minX, maxX - ax, az - minZ, maxZ - az];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return true;
}

// Busted or wasted: show the screen, take the 20% fine on bust.
export function bustPlayer(game, kind) {
  const s = game.state;
  if (s.mode === 'busted' || s.mode === 'wasted') return;
  if (kind === 'busted') {
    const fine = Math.floor(s.cash * TUNE.bustedFine);
    s.cash -= fine;
    s.mode = 'busted';
    showMenu(s, 'BUSTED', 'The Solmar Bay police caught you.<br><br>Fine: $' + fine + ' (20% of your cash).<br>Your heat is cleared.', 'Press Enter to respawn.');
  } else {
    s.mode = 'wasted';
    showMenu(s, 'WASTED', 'You went down in Solmar Bay.<br><br>The city keeps moving without you.', 'Press Enter to respawn.');
  }
}

// Respawn after busted/wasted. REQUIRED: the spawn is on the STREET
// outside the hospital building (the hospital sits at (-150, 150),
// 56 x 40; the spawn is (-88, 150), 34 units from its east face
// (x = -122) and at least 30 units from every collider), so the
// player can move in every direction after respawning.
export function respawnAfterBusted(game) {
  const s = game.state;
  const spawn = game.city.spawns.hospital;
  const p = s.player;
  if (p.inCar) {
    p.inCar.driver = null;
    p.inCar = null;
  }
  p.x = spawn.x;
  p.z = spawn.z;
  p.vx = 0;
  p.vz = 0;
  p.heading = 0;
  p.speed = 0;
  s.health = 100;
  s.armour = 0;
  s.wanted = 0;
  game.police.outOfSightT = 0;
  game.police.cops = [];
  // Cop cars despawn too (they are removed from the vehicle list).
  for (const v of game.police.cars) {
    const i = game.vehicles.list.indexOf(v);
    if (i >= 0) game.vehicles.list.splice(i, 1);
  }
  game.police.cars = [];
  game.police.heli = null;
  game.police.roadblocks = [];
  s.mode = 'play';
  // Hide the BUSTED/WASTED menu — without this the overlay stays on
  // screen while the player walks around (found by the graphics
  // tests: mode was 'play' but hud.menu was still set).
  hideMenu(s);
  showToast(s, 'You wake up at St. Marina Hospital. Back on your feet.', 4);
}

// HUD data: named police units + distance + status.
export function policeListData(game) {
  const s = game.state;
  const pol = game.police;
  const out = [];
  let i = 0;
  for (const v of pol.cars) {
    const d = Math.round(Math.sqrt(dist2(v.x, v.z, s.player.x, s.player.z)));
    const status = d < 12 ? 'RAMMING' : 'PURSUIT';
    out.push({ name: UNIT_NAMES[i % UNIT_NAMES.length], dist: d, status });
    i++;
  }
  for (const c of pol.cops) {
    const d = Math.round(Math.sqrt(dist2(c.x, c.z, s.player.x, s.player.z)));
    out.push({ name: UNIT_NAMES[i % UNIT_NAMES.length], dist: d, status: d < 6 ? 'RAMMING' : 'PURSUIT' });
    i++;
  }
  if (pol.heli) {
    out.push({ name: 'AIR-1', dist: Math.round(Math.sqrt(dist2(pol.heli.x, pol.heli.z, s.player.x, s.player.z))), status: pol.heli.los ? 'SPOTLIGHT' : 'SEARCHING' });
  }
  for (const rb of pol.roadblocks) {
    out.push({ name: 'ROADBLOCK', dist: Math.round(Math.sqrt(dist2(rb.x, rb.z, s.player.x, s.player.z))), status: 'ROADBLOCK' });
  }
  return out;
}

export { UNIT_NAMES, CRIME };
