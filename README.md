# Solmar Bay

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/muhrevan72-ux/gta6-solmar-bay/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/muhrevan72-ux/gta6-solmar-bay/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world 3D crime game for the [make.fun "Make GTA 6" bounty](https://make.fun/bounty/gta6-01) — a sun-soaked Vice City-style island you explore on foot and by car, with traffic and pedestrians, a wanted level with police who respond, five story chapters, combat, and a living city.

## Play

Open `game/index.html` in a desktop browser (Chrome). No build step, no network — every file is under `game/`.

- **WASD** move · **Shift** run · **E** interact / enter a car · **F** punch · **G** bomb · **Click** shoot
- **1 / 2 / 3** weapons · **Space** handbrake / parachute · **Esc** pause · **Tab** phone · **R** radio · **M** mute

## The game

- **A living city**: 97 buildings across downtown towers, a harbour, a beach and an airport; 76 pedestrians with jobs (sitting, chatting, queuing, vending, walking); traffic with working lights; a train ring, an elevator, dogs, birds and fish; stray cats you can carry home.
- **Crime and police**: steal cars, punch, shoot and bomb; a 0–5 star wanted level with foot patrols, interceptor cars, roadblocks and a police helicopter; get **BUSTED** or **WASTED** and respawn at Solmar General Hospital with a 20% fine.
- **Five story chapters** ("First Wheels" to "The Big One") plus side jobs (taxi fares, the shooting range, swimming, the slalom), a respect ladder (Nobody → Legend) that unlocks the SMG, the shotgun and a sports car.
- **Systems**: a day/night cycle with golden hour and dynamic weather, a 4-station synth radio, a phone (contacts, taxi call, messages), a garage, an outfit shop, food shops and enterable interiors, dating Maya, fires and the fire service, and city events (beach parties, street races, market days).
- **Tech**: vanilla JavaScript + WebGL 1, no dependencies. Procedural low-poly geometry with a runtime texture atlas, a CC0 barrel model (Poly Haven, Jorge Camacho), and a software-rasterizer render proof suite (pixel coverage at every hour, resize-safe).

## Files

- `game/` — the playable game (static files): `index.html`, `src/` (33 modules), `assets/barrel.glb`.
- `screenshots/` — 4 renders of the game itself.
- `main.ts` — the staging entrypoint: copies `game/` + `screenshots/` to the output directory and writes `dossier.json` with the kit's `buildDossier`.
- `vendor/makefun-game.ts` — the make.fun kit library, unchanged.

## License

MIT — see [LICENSE](LICENSE).
