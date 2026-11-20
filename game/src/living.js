// Solmar Bay — ambient life: train, fish, dogs, birds, clouds,
// trees, flowers, pots, elevator.
//
// The train loops the city on a rectangular track; press E at
// the station to board, E again to get off. Fish swim near the
// surface at the fish spots. Dogs wander and can be petted.
// Birds circle overhead. Clouds drift (DRAWN here in
// livingBoxes, tinted by the sky colour so night clouds are
// dark, not white — the round-7 rebuild kept the cloud data but
// dropped the draw call). The elevator on the tallest tower
// carries the player to a rooftop observation deck.

import { TUNE, SPAWNS, dist, makeRng, clamp } from './config.js';
import { showToast } from './state.js';

export function spawnLiving(game) {
  const rng = makeRng(31337);
  game.dogs = [];
  for (let i = 0; i < 6; i++) {
    game.dogs.push({
      x: (rng() - 0.5) * 300, z: (rng() - 0.5) * 300,
      heading: rng() * Math.PI * 2, speed: 2.5, wag: 0,
      target: null, walkPhase: rng() * 6,
    });
  }
  game.birds = [];
  for (let i = 0; i < 12; i++) {
    game.birds.push({
      x: (rng() - 0.5) * 500, z: (rng() - 0.5) * 500,
      y: 45 + rng() * 25, ang: rng() * Math.PI * 2,
      r: 30 + rng() * 60, speed: 0.15 + rng() * 0.2,
    });
  }
  game.fish = [];
  for (const spot of game.city.fishSpots) {
    for (let i = 0; i < 4; i++) {
      game.fish.push({
        x: spot.x + (rng() - 0.5) * 20, z: spot.z + (rng() - 0.5) * 20,
        y: -0.4, heading: rng() * Math.PI * 2, speed: 1 + rng(),
      });
    }
  }
  const t = game.city.trainTrack;
  game.train = {
    // Position along the rectangular loop, 0..1.
    u: 0, speed: 0.02, cars: 3,
    x: t.x0, z: t.z0, heading: 0,
  };
  game.elevator = {
    x: SPAWNS.elevatorTower.x + 19, z: SPAWNS.elevatorTower.z, // tower face + shaft (w36: +19)
    y: 0, top: 68, goingUp: false, riding: false,
  };
  game.cloudDrift = 0;
}

// Train position on the rectangular loop at parameter u (0..1).
export function trainPosAt(track, u) {
  const per = 2 * ((track.x1 - track.x0) + (track.z1 - track.z0));
  let d = u * per;
  const w = track.x1 - track.x0;
  const h = track.z1 - track.z0;
  if (d < w) return { x: track.x0 + d, z: track.z0, heading: Math.PI / 2 };
  d -= w;
  if (d < h) return { x: track.x1, z: track.z0 + d, heading: 0 };
  d -= h;
  if (d < w) return { x: track.x1 - d, z: track.z1, heading: -Math.PI / 2 };
  d -= w;
  return { x: track.x0, z: track.z1 - d, heading: Math.PI };
}

export function stepLiving(game, dt) {
  const p = game.player;
  // Clouds drift slowly.
  game.cloudDrift = (game.cloudDrift || 0) + dt * 0.5;
  // Dogs wander; a petted dog wags.
  for (const dog of game.dogs) {
    if (dog.wag > 0) {
      dog.wag -= dt;
      continue;
    }
    if (!dog.target || dist(dog.x, dog.z, dog.target.x, dog.target.z) < 2) {
      dog.target = { x: p.x + (Math.random() - 0.5) * 200, z: p.z + (Math.random() - 0.5) * 200 };
    }
    const a = Math.atan2(dog.target.x - dog.x, dog.target.z - dog.z);
    dog.heading = a;
    dog.x += Math.sin(a) * dog.speed * dt;
    dog.z += Math.cos(a) * dog.speed * dt;
    dog.walkPhase += dt * 6;
  }
  // Birds circle.
  for (const b of game.birds) {
    b.ang += b.speed * dt;
    b.x = Math.cos(b.ang) * b.r;
    b.z = Math.sin(b.ang) * b.r;
  }
  // Fish swim in small circles near the surface.
  for (const f of game.fish) {
    f.heading += dt * 0.5;
    f.x += Math.sin(f.heading) * f.speed * dt;
    f.z += Math.cos(f.heading) * f.speed * dt;
  }
  // Train loops the track.
  const train = game.train;
  if (train) {
    train.u = (train.u + train.speed * dt) % 1;
    const pos = trainPosAt(game.city.trainTrack, train.u);
    train.x = pos.x;
    train.z = pos.z;
    train.heading = pos.heading;
    if (p.onTrain) {
      p.x = train.x;
      p.z = train.z;
    }
  }
  // Elevator: rides up when the player steps on and presses E,
  // rides back down at the top. Rooftop reward once per visit.
  const el = game.elevator;
  if (el) {
    if (el.riding) {
      el.y += (el.goingUp ? 8 : -8) * dt;
      if (el.goingUp && el.y >= el.top) {
        el.y = el.top;
        el.goingUp = false;
        if (!el.rewarded) {
          el.rewarded = true;
          game.cash += 50;
          showToast(game, '+$50 rooftop view bonus');
        }
      }
      if (!el.goingUp && el.y <= 0) {
        el.y = 0;
        el.riding = false;
        el.rewarded = false;
        p.onElevator = false;
      }
      if (p.onElevator) {
        p.x = el.x;
        p.z = el.z;
        p.y = el.y;
      }
    }
  }
}

// Board / leave the train (E at the station, train stopped
// nearby). Returns true when the action happened.
export function tryTrain(game) {
  const p = game.player;
  const train = game.train;
  if (!train) return false;
  if (p.onTrain) {
    p.onTrain = false;
    p.x = train.x + 4;
    p.z = train.z + 4;
    showToast(game, 'You got off the train');
    return true;
  }
  const station = SPAWNS.trainStation;
  const atStation = dist(p.x, p.z, station.x, station.z) < 12;
  const trainNear = dist(train.x, train.z, station.x, station.z) < 30;
  if (atStation && trainNear) {
    p.onTrain = true;
    showToast(game, 'Riding the train — press E to get off at the station');
    return true;
  }
  return false;
}

// Step onto the elevator platform (E). Returns true when it starts.
export function tryElevator(game) {
  const p = game.player;
  const el = game.elevator;
  if (!el || el.riding) return false;
  if (dist(p.x, p.z, el.x, el.z) < 4) {
    el.riding = true;
    el.goingUp = true;
    p.onElevator = true;
    showToast(game, 'Elevator going up — enjoy the view');
    return true;
  }
  return false;
}

// Pet a nearby dog (E). Returns true when a dog was petted.
export function tryPetDog(game) {
  const p = game.player;
  for (const dog of game.dogs) {
    if (dist(p.x, p.z, dog.x, dog.z) < 3) {
      dog.wag = 2;
      showToast(game, 'The dog wags its tail happily');
      return true;
    }
  }
  return false;
}

// Draw the ambient life into `out`: clouds (2 boxes each, tinted
// by the sky colour), dogs, birds, fish, train, elevator car.
// Clouds MUST be drawn here — the round-7 rebuild kept the data
// but dropped this call, so the sky was empty.
export function livingBoxes(game, out, skyColour) {
  const tint = [skyColour[0] * 0.9 + 0.1, skyColour[1] * 0.9 + 0.1, skyColour[2] * 0.9 + 0.1];
  for (const cl of game.city.clouds) {
    let cx = cl.x + (game.cloudDrift || 0);
    // Wrap across the map so clouds never leave.
    cx = ((cx + 400) % 800) - 400;
    out.push({ x: cx, y: cl.y, z: cl.z, w: cl.s, h: 2, d: cl.s * 0.6, c: tint });
    out.push({ x: cx + cl.s * 0.4, y: cl.y + 1.5, z: cl.z, w: cl.s * 0.6, h: 2, d: cl.s * 0.4, c: tint });
  }
  for (const dog of game.dogs) {
    const wag = dog.wag > 0 ? Math.sin(game.time * 12) * 0.2 : 0;
    out.push({ x: dog.x, y: 0.3, z: dog.z, w: 0.5, h: 0.5, d: 1.1, c: [0.55, 0.4, 0.25] });
    out.push({ x: dog.x, y: 0.8, z: dog.z + 0.6, w: 0.4, h: 0.4, d: 0.4, c: [0.55, 0.4, 0.25] });
    out.push({ x: dog.x, y: 0.9, z: dog.z - 0.6, w: 0.15, h: 0.15, d: 0.5 + wag, c: [0.55, 0.4, 0.25] });
  }
  for (const b of game.birds) {
    out.push({ x: b.x, y: b.y, z: b.z, w: 1.6, h: 0.25, d: 0.5, c: [0.15, 0.15, 0.18] });
  }
  for (const f of game.fish) {
    out.push({ x: f.x, y: f.y, z: f.z, w: 0.5, h: 0.25, d: 1.1, c: [0.95, 0.6, 0.25] });
  }
  // Train: 3 cars.
  const train = game.train;
  if (train) {
    for (let i = 0; i < train.cars; i++) {
      const back = i * 9;
      const bx = train.x - Math.sin(train.heading) * back;
      const bz = train.z - Math.cos(train.heading) * back;
      out.push({ x: bx, y: 0.5, z: bz, w: 3, h: 3, d: 8, c: i === 0 ? [0.85, 0.2, 0.2] : [0.75, 0.75, 0.78] });
      out.push({ x: bx, y: 2, z: bz, w: 3.1, h: 0.8, d: 7, c: [0.4, 0.65, 0.85] });
    }
  }
  // Elevator car on the tower shaft.
  const el = game.elevator;
  if (el) {
    out.push({ x: el.x, y: el.y, z: el.z, w: 2.6, h: 3, d: 3.4, c: [0.5, 0.8, 1.0] });
  }
  return out;
}
