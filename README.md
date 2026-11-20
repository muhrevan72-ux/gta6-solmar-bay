# Solmar Bay

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/muhrevan72-ux/gta6-solmar-bay/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/muhrevan72-ux/gta6-solmar-bay/reward.svg)](https://make.fun/bounty/gta6-01)

A 3D voxel open-world crime game (GTA-style), built for the make.fun "Make GTA 6" bounty. Steal cars, run 5 story chapters, dodge the police, and live in a city that never sits still. Vanilla JavaScript + WebGL1 — no dependencies, no network at runtime, plays offline in a desktop browser from static files.

**Play it:** https://muhrevan72-ux.github.io/gta6-solmar-bay/game/

## What is in the city

- **Story:** 5 chapters (First Wheels, The Package, Getaway, Night Run, The Big One) with a mission-passed screen, rewards, respect and a completion %.
- **Driving:** cars, bikes, a boat in the harbour, a plane on the runway (Space = parachute), traffic that stops at red lights, a train that loops the city.
- **Police:** wanted 0–5 stars, foot cops, cop cars that ram, roadblocks at 3+ stars, and a helicopter at 4–5 stars with real line-of-sight through tall buildings. Busted and wasted screens, 20% fines, hospital respawn.
- **Living city:** 76 pedestrians with routines (walking, sitting, chatting, queuing, vending), two rival gangs with turf (Bay Kings vs Harbour Sharks), cats you can carry home, dogs, birds, fish, a beach party, street races and market days.
- **Systems:** weather + a 720-second day/night cycle with a golden hour, a smartphone (Tab: contacts, messages, map), a garage (store cars, repaint for $50), enterable interiors (pizza, burger, outfit shop), food shops, a shooting range, swimming and driving trials, fishing, vending machines, ATMs, dating, and a fire service.
- **Sound:** 4 original radio stations (BAY FM 94.7, PALM 102.3, NEON 89.1, CORAL 105.5) with 8 original synth songs, engine hum, sirens — all synthesized, no audio files.
- **Visuals:** a runtime-generated procedural texture atlas, a minimal static .glb loader (one CC0 model: Barrel_01 by Jorge Camacho, Poly Haven), per-face shading, blob shadows, frustum + distance culling, near/far LOD.

## Controls

WASD move · Shift run · E interact / enter car · F punch · G bomb · Click shoot · 1/2/3 weapons · Space handbrake / parachute · Esc pause · Tab phone · R radio · M mute · Mouse drag orbits, wheel zooms.

## Build notes

Rebuilt from scratch in a recorded session (round 8). The round-7 build failed its browser play-test with a flat-sky render: the boot sequence created the WebGL renderer *before* sizing the canvas, and assigning `canvas.width`/`height` resets the WebGL context, destroying the shader program before the first frame. This build sizes the canvas first, creates the renderer second, and re-creates the renderer on every resize — with a headless regression test that fails on the old order and passes on the new one.
