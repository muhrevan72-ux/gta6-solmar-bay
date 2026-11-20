# Solmar Bay — a GTA-style open world

<!-- Rebuild #15: a full fresh rebuild of the working #14 game
     (all fixes baked in), written live during a make.fun recording. -->

[![make.fun](https://img.shields.io/badge/make.fun-bounty-gta6--01-blue)](https://make.fun/bounty/gta6-01)
[![make.fun live](https://img.shields.io/badge/make.fun-live%20recording-green)](https://make.fun)
[![make.fun agent](https://img.shields.io/badge/make.fun-agent--built-orange)](https://make.fun)
[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/muhrevan72-ux/gta6-solmar-bay/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/muhrevan72-ux/gta6-solmar-bay/reward.svg)](https://make.fun/bounty/gta6-01)

A GTA-style open-world game built live by an AI agent for the
[Make GTA 6 bounty](https://make.fun/bounty/gta6-01) on
[make.fun](https://make.fun).

## Play

Open `game/index.html` in a browser, or serve the `game/` folder:

```bash
npx serve game
```

Then open http://localhost:3000 and press **New Game**.

## The city

Solmar Bay is a low-poly voxel city: a downtown of colourful
towers with window frames and varied roofs, a bright blue beach
with palms and umbrellas, a harbour, an airport with a runway,
hangars and a control tower, and a ring railway. It rains, the
sun sets into a golden hour, and the night is dark navy with
stars, street lights and a moon.

## What you can do

- **Five story chapters** — steal a car, run a delivery, lose
  the cops, drive passengers, then hit the vault.
- **Two gangs** — the Bay Kings downtown and the Harbour Sharks
  at the docks. Walk into their turf and they come for you
  (visibly, with a warning on screen).
- **Police** — wanted stars bring foot cops, interceptors,
  roadblocks and a helicopter.
- **A living city** — traffic that stops at red lights, 76
  pedestrians, a train, an elevator up the Solmar Tower, dogs
  to pet, stray cats to carry home, birds and fish.
- **Side work** — taxi fares, firefighting, fishing, the
  shooting range, a swim trial, a slalom, a market day, a beach
  party, a street race.
- **Life** — a phone (Tab) with contacts, a garage, food shops,
  an outfit shop, a date with Maya at the beach house, vending
  machines and ATMs, and four radio stations (R cycles).
- **Respect** — earn it to unlock the SMG, the shotgun and your
  own Solmar Comet.

## Controls

WASD move · Shift run · E interact · F punch · G bomb ·
Click shoot · Esc pause · Tab phone · R radio · M mute ·
1/2/3 weapons · 4 call a taxi.

## Tech

Raw WebGL1, no game engine: boxes are emitted as triangles
into batches, uploaded, and drawn with `gl.TRIANGLES`. The
barrel prop is a CC0 GLB (`game/assets/barrel.glb`). Everything
in `game/src/` is plain ES modules; `node --check` is clean on
every file.

## License

MIT.
