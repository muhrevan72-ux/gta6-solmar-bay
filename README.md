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

Rebuilt from scratch in a recorded session (round 9). Three play-test failures from round 8 were fixed in this build:

1. **Resize killed the static world.** The resize handler re-created the renderer, but the new renderer's static and GLB batches were empty — the old batch data lived on the old renderer. `rebuildStaticBatches()` now re-bakes the static city and the GLB barrels into the current renderer after the initial creation, after every resize, and when the GLB model finishes loading. A headless regression test (render8) simulates a resize and proves the static geometry still renders (pixel coverage > 5%).
2. **Golden hour / sunset = flat orange sky.** The fog shader computed fog from NDC depth (p.z/p.w), which is 0.98–1.0 for all scene geometry — so at golden hour everything fogged to 1.0 and the city vanished into the sky colour, while at night the fog silently disappeared (undefined smoothstep with edge0 > edge1). Fog is now a true function of camera distance in metres (fogNear 60 m, fogFar 180–420 m per time of day), so the city at 10–100 m always stays visible. render8 proves pixel coverage > 5% at day, golden hour and sunset through the real boot path.
3. **Escape did not open pause.** The state machine already toggled play ↔ pause, but the HUD showed no pause overlay at all — no PAUSED text, no Resume button — so the player saw nothing change. The pause overlay (#hud-pause) now appears whenever the game is paused, with a clickable Resume button, and a HUD pause button toggles pause as a fallback when the browser swallows Escape.

The round-7/8 boot-order fix is kept: the canvas is sized before `createRenderer`, the renderer is re-created on every resize, and a headless regression test with a negative control proves the old order kills the program.
