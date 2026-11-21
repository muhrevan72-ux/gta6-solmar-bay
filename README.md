# Solmar Bay

[![make.fun](https://make.fun/badge/gta6-01)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/rank)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/reward)](https://make.fun/bounty/gta6-01)

A GTA-style open-world 3D voxel game, built for the **make.fun "Make GTA 6" bounty** (`gta6-01`).

## Play it

Open `game/index.html` in a browser (or serve the `game/` folder). No build step, no dependencies — raw WebGL1 + plain ES modules.

## The game

Solmar Bay is an 800×800 m voxel city with a beach and sea to the west, an airport to the north-east, and a harbour to the south-west. Roads run on a 60 m grid; the buildings are colourful low-poly blocks with balconies, roof props, and neon signs.

- **On foot:** walk, run, punch, shoot, throw bombs. Steal any parked car with **E**.
- **Driving:** W/S accelerate and brake, A/D steer. Watch the condition — crashes hurt.
- **5 story chapters:** First Wheels, The Package, Getaway, Night Run, The Big One. Each pays cash and respect.
- **Wanted stars:** crimes raise the heat. Foot cops, interceptors, roadblocks, and a helicopter respond. Break line of sight for 14 s to lose a star.
- **Two gangs:** Bay Kings (gold, downtown) and Harbour Sharks (teal, harbour). Their turf is not safe.
- **Phone (Tab):** contacts (Rico, Maya, Taxi, Mechanic), messages, and a cab on demand (4).
- **Radio (R):** four synth stations. Mute with **M**.
- **Side life:** fishing, vending machines, ATMs, food shops, the outfit shop, the shooting range, the swim trial, the slalom course, stray cats to rescue, dogs to befriend, the train, the Solmar Tower elevator, and city events (beach parties, street races, market days).
- **Save / load:** progress autosaves on pause; Continue on the menu resumes it.

## Controls

| Key | Action |
| --- | --- |
| WASD | Move / drive |
| Shift | Run |
| E | Interact (enter car, shop, door…) |
| F | Punch |
| G | Throw bomb |
| Click | Shoot |
| Esc / P | Pause |
| Tab | Phone |
| R | Radio station |
| M | Mute |
| 1 / 2 / 3 | Pistol / SMG / Shotgun |
| 4 | Call a taxi |

## Tech

- Raw WebGL1, one draw call per batch (static / dynamic / props).
- Software-rasterizer-friendly geometry: the ground, roads, and sea are tiled in ~100 m segments so no triangle spans the map.
- Deterministic city (seeded RNG) — the same seed always builds the same Solmar Bay.
- No assets, no .glb files: every prop (including the barrels) is built procedurally from boxes.

## License

MIT — see `LICENSE`.
