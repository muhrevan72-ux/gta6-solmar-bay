// Solmar Bay — the player on foot.
//
// WASD/arrows move relative to the camera, Shift runs, E enters /
// exits the nearest car, F punches, G throws a bomb, click shoots,
// 1/2/3 switch weapons, Space is the handbrake (driving) or the
// parachute (falling). Movement is eased: acceleration ramps up,
// friction eases down, the body leans into turns, the walk cycle
// bobs. The player swims (slowly) in the water instead of drowning.

import { TUNE, OUTFIT, clamp, dist2 } from './config.js';
import { collideCircle, clearSpot } from './world.js';
import { isDown, pressedKey } from './input.js';
import { exitVehicle } from './vehicles.js';
import { cameraForward } from './shots.js';
import { switchWeapon, shoot, punch, throwBomb } from './combat.js';

export function stepPlayer(game, dt) {
  const s = game.state;
  const p = s.player;
  const input = game.input;
  if (s.mode !== 'play') return;
  // Phone open: the world keeps running, but E/F/G/weapon keys are
  // blocked while the phone is up (Esc closes the phone first).
  const phoneOpen = game.phone && game.phone.open;
  // In a car: the vehicle system drives; the player just rides.
  if (p.inCar) {
    // E exits the car (cooldown-gated with `<= 0`, never `!cooldown`).
    if (!phoneOpen && pressedKey(input, 'KeyE') && input.eCooldown <= 0) {
      input.eCooldown = 0.4;
      exitVehicle(game);
    }
    return;
  }
  // Riding the train / elevator: no on-foot movement.
  if (p.onTrain || p.onElevator) return;

  // --- movement (camera-relative) ---
  const fwd = cameraForward(game.camera);
  let mx = 0;
  let mz = 0;
  if (isDown(input, 'KeyW') || isDown(input, 'ArrowUp')) { mx += fwd.x; mz += fwd.z; }
  if (isDown(input, 'KeyS') || isDown(input, 'ArrowDown')) { mx -= fwd.x; mz -= fwd.z; }
  if (isDown(input, 'KeyA') || isDown(input, 'ArrowLeft')) { mx += fwd.z; mz -= fwd.x; }
  if (isDown(input, 'KeyD') || isDown(input, 'ArrowRight')) { mx -= fwd.z; mz += fwd.x; }
  const mLen = Math.sqrt(mx * mx + mz * mz);
  if (mLen > 0) {
    mx /= mLen;
    mz /= mLen;
  }
  const running = isDown(input, 'ShiftLeft') || isDown(input, 'ShiftRight');
  const inWater = p.x < -340 || (p.x > 340 && p.x < 400 && p.z > -160 && p.z < -40);
  const topSpeed = inWater ? TUNE.swimSpeed : running ? TUNE.runSpeed : TUNE.walkSpeed;
  p.swimming = inWater;
  // Eased acceleration: ramp toward the target velocity.
  const tx = mx * topSpeed;
  const tz = mz * topSpeed;
  const k = Math.min(1, dt * (mLen > 0 ? TUNE.accel / topSpeed : TUNE.friction / topSpeed));
  p.vx += (tx - p.vx) * k;
  p.vz += (tz - p.vz) * k;
  // Friction when no input.
  if (mLen === 0) {
    p.vx -= p.vx * Math.min(1, dt * 8);
    p.vz -= p.vz * Math.min(1, dt * 8);
  }
  let nx = p.x + p.vx * dt;
  let nz = p.z + p.vz * dt;
  // Collide with buildings (slide along walls).
  const hit = collideCircle(game.city, nx, nz, TUNE.playerRadius);
  if (hit) {
    nx = hit.x;
    nz = hit.z;
    // Kill the velocity component into the wall.
    p.vx *= 0.4;
    p.vz *= 0.4;
  }
  // City bounds.
  nx = clamp(nx, -395, 395);
  nz = clamp(nz, -395, 395);
  p.x = nx;
  p.z = nz;
  p.speed = Math.sqrt(p.vx * p.vx + p.vz * p.vz);
  // Face the movement direction; lean into turns; walk-cycle bob.
  if (p.speed > 0.3) {
    const target = Math.atan2(p.vx, p.vz);
    let d = target - p.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    p.lean = clamp(d * 2, -0.4, 0.4);
    p.heading += d * Math.min(1, dt * 10);
    p.bob += p.speed * dt * 1.6;
  } else {
    p.lean *= Math.max(0, 1 - dt * 6);
  }
  // --- tap actions (all via pressedKey, never polling `down`) ---
  // E is NOT handled here on foot: main.js's interaction dispatcher
  // owns it (vehicle / food / cat / door / garage / ... priority).
  if (!phoneOpen) {
    if (pressedKey(input, 'KeyF')) punch(game);
    if (pressedKey(input, 'KeyG')) throwBomb(game);
    if (pressedKey(input, 'Digit1')) switchWeapon(game, 'pistol');
    if (pressedKey(input, 'Digit2')) switchWeapon(game, 'smg');
    if (pressedKey(input, 'Digit3')) switchWeapon(game, 'shotgun');
  }
  if (input.mouse.clicked && !phoneOpen) shoot(game);
}

// Voxel boxes for the player: articulated humanoid — head with hair,
// torso (outfit shirt), arms and legs that swing with the walk
// cycle, shoes. Colours come from the outfit + skin.
export function playerBoxes(game, out) {
  const s = game.state;
  const p = s.player;
  const hair = OUTFIT.hair[s.outfit.hair];
  const shirt = OUTFIT.shirt[s.outfit.shirt];
  const pants = OUTFIT.pants[s.outfit.pants];
  const shoes = OUTFIT.shoes[s.outfit.shoes];
  const skin = [0.95, 0.8, 0.65];
  const swing = Math.sin(p.bob) * (p.speed > 0.3 ? 0.5 : 0);
  const bobY = Math.abs(Math.sin(p.bob)) * 0.08 * (p.speed > 0.3 ? 1 : 0);
  const y = bobY;
  // Legs (swing opposite).
  out.pushBoxRot(p.x - 0.22, y + 0.45, p.z + swing * 0.4, 0.34, 0.9, 0.34, pants.colour, p.heading);
  out.pushBoxRot(p.x + 0.22, y + 0.45, p.z - swing * 0.4, 0.34, 0.9, 0.34, pants.colour, p.heading);
  // Shoes.
  out.pushBoxRot(p.x - 0.22, y + 0.08, p.z + swing * 0.4 + 0.05, 0.36, 0.16, 0.5, shoes.colour, p.heading);
  out.pushBoxRot(p.x + 0.22, y + 0.08, p.z - swing * 0.4 + 0.05, 0.36, 0.16, 0.5, shoes.colour, p.heading);
  // Torso.
  out.pushBoxRot(p.x, y + 1.25, p.z, 0.85, 0.75, 0.45, shirt.colour, p.heading);
  // Arms (swing with the walk cycle).
  out.pushBoxRot(p.x - 0.55, y + 1.25, p.z - swing * 0.35, 0.26, 0.7, 0.26, shirt.colour, p.heading);
  out.pushBoxRot(p.x + 0.55, y + 1.25, p.z + swing * 0.35, 0.26, 0.7, 0.26, shirt.colour, p.heading);
  // Head + hair (one box; the outfit's hair style changes its shape)
  // + eyes (two tiny dark boxes on the front of the face).
  out.pushBoxRot(p.x, y + 1.95, p.z, 0.55, 0.55, 0.5, skin, p.heading);
  const fx = Math.sin(p.heading);
  const fz = Math.cos(p.heading);
  const rx = Math.cos(p.heading);
  const rz = -Math.sin(p.heading);
  if (hair.name === 'Blonde buzz') out.pushBoxRot(p.x, y + 2.23, p.z, 0.57, 0.08, 0.52, hair.colour, p.heading);
  else if (hair.name === 'Red mohawk') out.pushBoxRot(p.x, y + 2.28, p.z, 0.12, 0.45, 0.52, hair.colour, p.heading);
  else if (hair.name === 'Blue spikes') out.pushBoxRot(p.x, y + 2.3, p.z, 0.57, 0.35, 0.52, hair.colour, p.heading);
  else out.pushBoxRot(p.x, y + 2.2, p.z, 0.57, 0.2, 0.52, hair.colour, p.heading); // Black crop
  out.pushBox(p.x + fx * 0.27 + rx * 0.13, y + 1.98, p.z + fz * 0.27 + rz * 0.13, 0.09, 0.12, 0.06, [0.08, 0.08, 0.1]);
  out.pushBox(p.x + fx * 0.27 - rx * 0.13, y + 1.98, p.z + fz * 0.27 - rz * 0.13, 0.09, 0.12, 0.06, [0.08, 0.08, 0.1]);
  // Carried cat rides on the shoulder.
  if (p.carryingCat) {
    out.pushBoxRot(p.x + 0.3, y + 2.5, p.z, 0.4, 0.3, 0.5, [0.9, 0.85, 0.7], p.heading);
  }
  // Blob shadow.
  out.pushBox(p.x, 0.05, p.z, 1.1, 0.08, 1.1, [0.05, 0.05, 0.06]);
}

export { dist2, clearSpot };
