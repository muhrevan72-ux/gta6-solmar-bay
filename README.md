# Solmar Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/muhrevan72-ux/gta6-solmar-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/muhrevan72-ux/gta6-solmar-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Solmar Bay is a GTA-style open-world 3D game that runs entirely in the
browser. Drive the streets of a sunny coastal city, steal cars, dodge the
police, climb the respect ladder, and play through five story chapters —
from your first stolen wheels to the big one.

## Play it

Open `game/index.html` in a desktop browser (keyboard + mouse), or run the
bundled static server and visit the address it prints:

```sh
node serve.ts
```

No build step, no dependencies, no downloads. The world is rendered with a
small software WebGL renderer written for this game.

## The city

An 800 x 800 metre island city: a downtown of colourful low-poly towers, a
beach with palms and umbrellas, a harbour, an airport with a runway, and a
train that loops the island. Traffic lights change, the sun moves across the
sky, weather rolls in, and the streets fill with pedestrians, dogs, cats,
birds and fish.

## What you can do

- **Drive anything** — the starter Solmar Comet, parked cars, taxis, bikes,
  a boat, a plane, even the fire truck. Cars take damage and can be repaired
  or repainted at the garage.
- **Five story chapters** — First Wheels, a harbour pickup, losing the heat,
  three fares across town, and the vault job. Finish them to unlock free roam.
- **Wanted stars** — crimes raise your wanted level; foot patrol, interceptors,
  roadblocks and a police helicopter answer. Lose the heat or get busted.
- **Two rival gangs** — the Bay Kings downtown and the Harbour Sharks at the
  docks. Respect opens new weapons and rides.
- **A living phone** — call Rico for tips, Maya for a date, a taxi for a ride,
  or a mechanic for a repair.
- **Side life** — fish at the pier, work the shooting range, swim to the buoy,
  run the slalom, put out fires, pet stray cats, buy snacks, use ATMs, change
  your outfit, and catch the train.

## Controls

| Key | Action |
| --- | --- |
| WASD | Walk / drive |
| Shift | Run |
| E | Interact — enter a car, talk, pick things up |
| F | Punch |
| G | Throw a bomb |
| Click | Shoot |
| Tab | Phone |
| R | Change radio station |
| M | Mute |
| Esc / P | Pause |
| 1–4 | Weapon / taxi |

## Tech

- `game/src/` — 33 ES modules: world generation, the software renderer,
  vehicles, pedestrians, police AI, missions, gangs, weather, audio and HUD.
- `game/index.html` — the shell: canvas, HUD, phone, pause menu.
- `screenshots/` — four in-game shots rendered by the game's own renderer.

Built for the make.fun `gta6-01` bounty ("Make GTA 6").
