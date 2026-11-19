// Solmar Bay — the player character on foot. WASD moves relative to
// the camera, Shift runs, E enters/exits vehicles, F punches, Space
// deploys the parachute while falling. Falls use simple gravity.

import { PLAYER } from './config.js';
import { resolveCollision, inWater } from './world.js';
import { cameraForward, cameraRight } from './shots.js';

export function createPlayer(spawn) {
  return {
    x: spawn.x,
    y: 0,
    z: spawn.z,
    heading: Math.PI,     // facing -z at start
    speed: 0,
    vy: 0,                // vertical velocity while falling
    falling: false,
    parachute: false,
    inVehicle: null,      // vehicle object when driving/riding
    punchCd: 0,
    punchAnim: 0,
    walkPhase: 0,
    onGround: true,
  };
}

export function updatePlayer(dt, game) {
  const p = game.player;
  const input = game.input;
  const state = game.state;
  if (p.inVehicle) return; // vehicles module owns movement then
  if (p.punchCd > 0) p.punchCd -= dt;
  if (p.punchAnim > 0) p.punchAnim -= dt;

  const axes = input.moveAxes();
  const fwd = cameraForward(game.camera);
  const right = cameraRight(game.camera);
  let mx = fwd[0] * axes.y + right[0] * axes.x;
  let mz = fwd[1] * axes.y + right[1] * axes.x;
  const mLen = Math.hypot(mx, mz);
  const running = input.down('ShiftLeft') || input.down('ShiftRight');
  const topSpeed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;

  if (mLen > 0.01) {
    mx /= mLen; mz /= mLen;
    const target = Math.atan2(mx, mz);
    // turn smoothly toward the move direction
    let d = (target - p.heading) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    p.heading += d * Math.min(1, dt * 12);
    p.speed += PLAYER.accel * dt;
    if (p.speed > topSpeed) p.speed = topSpeed;
    p.walkPhase += dt * p.speed * 1.6;
  } else {
    p.speed -= PLAYER.accel * 1.4 * dt;
    if (p.speed < 0) p.speed = 0;
  }

  if (p.speed > 0.05) {
    const nx = p.x + Math.sin(p.heading) * p.speed * dt;
    const nz = p.z + Math.cos(p.heading) * p.speed * dt;
    const fixed = resolveCollision(nx, nz, PLAYER.radius, game.city.buildings);
    // keep the player out of the sea unless they walk in (swim = slow)
    p.x = fixed.x;
    p.z = fixed.z;
    state.stats.distanceDriven += 0; // on foot doesn't count as driving
  }

  // ---- falling / parachute ----
  if (p.falling) {
    p.vy -= 22 * dt; // gravity
    if (p.parachute) {
      p.vy = Math.max(p.vy, -3.2);
      // steer while gliding
      const ax = input.moveAxes();
      const f2 = cameraForward(game.camera);
      const r2 = cameraRight(game.camera);
      p.x += (f2[0] * ax.y + r2[0] * ax.x) * 5 * dt;
      p.z += (f2[1] * ax.y + r2[1] * ax.x) * 5 * dt;
      const fixed = resolveCollision(p.x, p.z, PLAYER.radius, game.city.buildings);
      p.x = fixed.x; p.z = fixed.z;
    } else {
      p.vy = Math.max(p.vy, -26);
    }
    p.y += p.vy * dt;
    if (p.y <= 0) {
      p.y = 0;
      if (!p.parachute && p.vy < -18) {
        // hard landing hurts
        game.hurtPlayer(Math.round((-p.vy - 18) * 2), 'fall');
      }
      p.vy = 0;
      p.falling = false;
      p.parachute = false;
    }
  } else if (p.y > 0) {
    p.falling = true; // walked off something (shouldn't happen on flat ground)
  }

  // deploy parachute while falling
  if (p.falling && !p.parachute && p.y > 12 && input.down('Space')) {
    p.parachute = true;
    game.audio.blip(880, 0.12);
  }
}

// Draw the blocky character as a few boxes via the renderer.
export function drawPlayer(renderer, game) {
  const p = game.player;
  if (p.inVehicle) return;
  const { COL } = game;
  const yaw = p.heading;
  const bob = Math.sin(p.walkPhase) * 0.06 * Math.min(1, p.speed / 6);
  const legSwing = Math.sin(p.walkPhase) * 0.28 * Math.min(1, p.speed / 6);
  const y = p.y + bob;
  // legs
  renderer.box(p.x - 0.14, y + 0.35, p.z, 0.24, 0.7, 0.26, yaw, COL.playerPants);
  renderer.box(p.x + 0.14, y + 0.35, p.z, 0.24, 0.7, 0.26, yaw, COL.playerPants);
  // torso (shirt), arms swing with the walk
  renderer.box(p.x, y + 1.05, p.z, 0.62, 0.7, 0.34, yaw, COL.playerShirt);
  const armY = y + 1.05 + legSwing * 0.4;
  renderer.box(p.x - 0.42, armY, p.z, 0.2, 0.62, 0.22, yaw, COL.playerShirt);
  renderer.box(p.x + 0.42, armY, p.z, 0.2, 0.62, 0.22, yaw, COL.playerShirt);
  // head + cap
  renderer.box(p.x, y + 1.62, p.z, 0.5, 0.46, 0.46, yaw, COL.playerSkin);
  renderer.box(p.x, y + 1.88, p.z, 0.54, 0.12, 0.5, yaw, COL.playerShirt);
  // held weapon
  if (game.state.weapon !== 'pistol') {
    const gx = p.x + Math.sin(yaw) * 0.5;
    const gz = p.z + Math.cos(yaw) * 0.5;
    renderer.box(gx, y + 1.05, gz, 0.12, 0.12, 0.55, yaw, COL.weapon);
  }
  // parachute canopy
  if (p.parachute) {
    renderer.box(p.x, y + 2.6, p.z, 2.4, 0.18, 2.4, yaw, COL.marker);
  }
}
