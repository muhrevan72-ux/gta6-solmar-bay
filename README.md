# Solmar Bay

[![make.fun bounty](https://img.shields.io/badge/make.fun-bounty_gta6--01-ff5da2)](https://make.fun/bounty/gta6-01)
[![Prize $1,666](https://img.shields.io/badge/prize-%241%2C666-ffd23f)](https://make.fun/bounty/gta6-01)
[![Deadline Nov 24, 2026](https://img.shields.io/badge/deadline-Nov%2024%202026-7dff8a)](https://make.fun/bounty/gta6-01)
[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/muhrevan72-ux/gta6-solmar-bay/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/muhrevan72-ux/gta6-solmar-bay/reward.svg)](https://make.fun/bounty/gta6-01)

**Solmar Bay** is a GTA-style open-world game built for the [Make GTA 6 bounty on make.fun](https://make.fun/bounty/gta6-01) — a sun-soaked 3D voxel city where you steal cars, dodge the cops, run jobs for Rico, and take over the streets one chapter at a time.

## Play it

```sh
node main.ts --serve   # serves game/ at http://localhost:8080
# or
node serve.ts          # same server, same port
```

Open http://localhost:8080 in a desktop browser (keyboard + mouse).
No build step, no dependencies — standard library only.

`node main.ts` (no flags) runs a headless self-check of the game
logic instead: boot, chapter flow, pause, wasted respawn, save/load,
and a 90-second stability soak. It exits 0 when everything passes.

## The city

- **800 × 800 m of Vice City flavour** — downtown towers, a harbour
  district, a beach with bright blue water, palm trees, neon signs,
  a runway, and a ring-road train.
- **A living city** — 76 pedestrians (sitting, chatting, queuing,
  vending, walking), 40 cars in traffic with working traffic lights,
  dogs, cats, birds, fish, and two rival gangs (Bay Kings downtown,
  Harbour Sharks at the harbour) who defend their turf.
- **Day/night cycle** — dawn, noon, golden hour, sunset, deep night,
  with distance fog in metres, rain, and fog weather.

## The game

- **5 story chapters** — First Wheels, The Harbour Job, Lay Low,
  The Long Night, The Big One — plus a taxi side job, a shooting
  range, a swim trial, a slalom, fishing, vending machines, ATMs,
  a fire service, an outfit shop, enterable restaurants, a date
  with Maya, and stray cats to rescue.
- **Wanted system** — 0–5 stars: foot patrol, interceptors,
  roadblocks, and a police helicopter at 4+. Lay low for 14 seconds
  out of sight and the heat decays. Getting busted costs a 20% fine;
  getting wasted wakes you up at the hospital.
- **Respect ladder** — SMG at 100, shotgun at 250, a Solmar Comet
  sports car at 500.
- **Everything a GTA needs** — car theft, drive-bys, bombs, cash
  pickups, armour, a phone (Tab) with contacts and messages, radio
  stations (R), a garage, and a dense HUD with a round minimap.

## Controls

| Key | Action |
| --- | --- |
| WASD | Move / drive |
| Shift | Run |
| E | Interact — enter/exit car, doors, shops, pets |
| F | Punch |
| G | Throw a bomb |
| Click | Shoot |
| Esc / P | Pause (pausing saves the game) |
| Tab | Phone |
| R | Radio station |
| M | Mute |
| 1 / 2 / 3 | Pistol / SMG / Shotgun |
| 4 | Call a taxi |

## Tech

- Custom WebGL renderer (no engine, no dependencies): one static
  batch for the city, a GLB batch for the barrels, one dynamic batch
  for everything that moves, and a single `gl.clear` per frame.
- The barrel prop is a real CC0 GLB (`game/assets/barrel.glb`,
  Poly Haven Barrel_01), loaded at boot with a procedural fallback.
- Fog is computed from **distance in metres** (not NDC depth), so
  golden hour and sunset stay visible.
- 511 headless tests cover the renderer (with a software rasterizer
  that projects the exact uploaded buffers), the city, the systems,
  and the play-test regressions:
  `node tests-round9/run-all.mjs` (in the test tree).

## Files

- `main.ts` — node22 entrypoint: self-check, or `--serve` the game.
- `game/index.html` — the page (loads only `game/src/main.js`).
- `game/src/` — the game: renderer, world, vehicles, peds, police,
  combat, missions, gangs, HUD, phone, garage, and the rest.
- `game/assets/barrel.glb` — the barrel prop.
- `screenshots/` — four in-game renders (title, golden hour, map,
  action).

## License

MIT — see `LICENSE`.
