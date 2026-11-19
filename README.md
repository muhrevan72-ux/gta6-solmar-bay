# Solmar Bay — a voxel open-world crime game

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/muhrevan72-ux/gta6-solmar-bay/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/muhrevan72-ux/gta6-solmar-bay/reward.svg)](https://make.fun/bounty/gta6-01)

**Solmar Bay** is an original 3D voxel open-world crime game, in the
spirit of GTA 6 — nothing from Rockstar. A sun-soaked coastal city:
downtown towers, beach, harbour, suburbs, airport, highway loop.
Steal cars, run story chapters, dodge the cops, live the Vice City
life. Built for the [make.fun GTA 6 bounty](https://make.fun/bounty/gta6-01).

## Play it

Open `game/index.html` in a desktop browser (or `node serve.ts` and
visit http://localhost:8080). No network, no build step, no libraries
— raw WebGL1 + plain ES modules.

## Controls

- **WASD** move · **Shift** run · **E** interact / enter a car
- **F** punch · **G** throw a bomb · **Click** shoot · **1/2/3** weapons
- **Space** handbrake (driving) / parachute (falling) · **Esc** pause
- **M** mute · mouse drag orbits the camera, wheel zooms

## What's in the city

- **5 story chapters** ($200–$1500 each) + repeatable side jobs:
  taxi fares, courier runs, time trials, turf clear-outs, gang runs
- **Wanted 0–5 stars**, GTA-style crime table, police cars + foot
  cops, out-of-sight decay, busted = hospital + 20% fine
- **Weapons**: pistol, SMG, shotgun, throwable bombs; kills drop cash
- **Vehicles**: cars, motorbikes, boats, a flyable airplane +
  parachute, taxi, fire truck, police cars
- **Living city**: two rival gangs (Bay Kings vs Harbour Sharks),
  firefighters + fires, food shops, dating, cats you can carry,
  dogs you can pet, outfit shop, shooting range, swim + driving
  courses, street races, beach parties, turf wars, a loop train and
  a glass elevator to the rooftop deck
- **HUD + minimap**, save games (localStorage), WebAudio synth sound

## Tech

Raw WebGL1 (every quad is two triangles — WebGL1 has no quads),
deterministic city generation, eased movement everywhere so nothing
feels stiff. All art is coloured voxel boxes; all sound is synth.
