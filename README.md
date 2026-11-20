# Solmar Bay

[![Make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/competitions/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/muhrevan72-ux/gta6-solmar-bay/rank.svg)](https://make.fun/competitions/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/muhrevan72-ux/gta6-solmar-bay/reward.svg)](https://make.fun/competitions/gta6-01)

An open-world 3D city in the spirit of GTA 6, built with vanilla JavaScript + WebGL — no engine, no dependencies, no copyrighted assets. Made for the [make.fun GTA 6 bounty](https://make.fun/competitions/gta6-01).

## Play

Open `game/index.html` in a desktop browser (or serve the `game/` folder with any static server). No build step, no install.

## The city

Solmar Bay is a living coastal city on a 60 m road grid: a downtown of nine towers (including the Solmar Tower, with its elevator to the roof), a beach with palms, umbrellas and waves, a harbour with containers and a crane, and an airport with a runway, hangars and a control tower. The sun runs a full 24-hour cycle — dawn, day, golden hour, sunset, night — with weather (clear, rain, fog) and neon signs that glow after dark.

## What you can do

- **Drive** — 36 vehicles (sports cars, a bike, a boat, a plane, a fire truck) plus traffic that stops at red lights.
- **Five story chapters** — steal a car to the garage, run a package through the harbour, lose the cops, drive three taxi passengers, then pull off the Big One at the vault.
- **Wanted system** — foot cops, interceptors, roadblocks and a helicopter; break line of sight for 14 s to lose a star, get busted at 2 m.
- **Combat** — pistol, SMG and shotgun (respect unlocks), punching, bombs, cash drops.
- **Gangs** — Bay Kings downtown, Harbour Sharks at the harbour; they chase and attack inside their turf.
- **A living city** — 76 pedestrians (sitters, chatters, queuers, vendors, walkers), dogs to pet, cats to deliver, birds, fish, a looping train, a working elevator.
- **Side activities** — fishing at the pier, vending machines, ATMs, food shops, an outfit shop, shooting range, swim trial, slalom, fires to put out, city events (beach party, street race, market day), a date with Maya, and a taxi side job.
- **Radio** — four stations (BAY FM, PALM, NEON, CORAL), two songs each, sequenced live. Press R to switch, M to mute.

## Controls

WASD move · Shift run · E interact · F punch · G bomb · Click shoot · Esc pause · Tab phone · R radio · M mute · 1/2/3 weapons · 4 call a taxi

## Tech

- `game/src/main.js` — boot (canvas sized before the renderer), the game loop, input routing, the dynamic batch.
- `game/src/render.js` — the WebGL renderer (triangles only), batches, fog in metres.
- `game/src/world.js` — the deterministic city (seed 1337) and the static batch.
- `game/src/weather.js` — the 120x clock, sky/fog keyframes, weather.
- The other `game/src/*.js` modules are the gameplay systems (player, vehicles, police, combat, missions, gangs, …).
- `main.ts` — the make.fun entrypoint: stages `game/` + `screenshots/` and writes `dossier.json`.
- `game/assets/barrel.glb` — a CC0 barrel model, loaded when available (procedural barrels otherwise).
