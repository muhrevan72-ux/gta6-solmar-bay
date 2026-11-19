# Solmar Bay — 3D voxel open-world crime game

[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/muhrevan72-ux/gta6-solmar-bay/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/muhrevan72-ux/gta6-solmar-bay/reward.svg)](https://make.fun/bounty/gta6-01)

An original 3D voxel open-world crime game, built for the
[Make GTA 6](https://make.fun/bounty/gta6-01) bounty on make.fun.
Nothing from Rockstar: our own city, story, art and sound.

**Solmar Bay** is a sun-soaked coastal voxel city — downtown towers,
a beach, a harbour, suburbs, an airport and a highway loop — rendered
with raw WebGL1 (no libraries) in a blocky Minecraft/Roblox style,
with a third-person GTA-like camera.

## How to play

Serve the game and open it in a desktop browser:

```sh
node serve.ts
# then open http://localhost:8080
```

Or just open `game/index.html` directly — the game is plain static
files, no build step, no network.

### Controls

| Key | Action |
| --- | --- |
| WASD | Move on foot / drive |
| Mouse drag | Orbit the camera |
| Mouse wheel | Zoom |
| Shift | Run |
| E | Enter / exit car, bike, boat, plane |
| F | Punch |
| Click | Shoot (crosshair) |
| 1 / 2 / 3 | Pistol / SMG / Shotgun |
| G | Throw a bomb |
| Space | Handbrake (driving) / parachute (falling) |
| Plane | W/S throttle, Arrow keys pitch, A/D turn |
| Esc | Pause |
| M | Mute |

## What's in the game

- **Open voxel world** (~800×800): downtown skyline, beach with
  animated water, harbour with docks and containers, suburbs,
  airport with a runway, and a highway loop.
- **Vehicles**: cars, fast motorbikes, boats on the water, and a
  flyable airplane — plus a parachute for bailing out mid-air.
- **Weapons**: pistol (start), SMG and shotgun pickups, throwable
  bombs. Killed peds and cops drop cash ($10–$50).
- **Wanted system**: 0–5 stars. Police cars chase and ram, foot
  cops chase and grab you. Lose the heat to drop stars. Getting
  busted means the hospital and a fine.
- **Story — 5 chapters**: First Wheels ($200), The Package ($400),
  Getaway ($500), Night Run ($600), The Big One ($1,500), with
  chapter titles and story text.
- **Side jobs**: repeatable taxi fares, courier deliveries and time
  trials from green markers, with cash rewards.
- **Traffic and pedestrians**: NPC cars drive the road network,
  pedestrians walk the sidewalks and flee from danger.
- **HUD + minimap**: cash, health, armour, wanted stars, weapon and
  ammo, speed, objective text, and a live top-down minimap.
- **Save**: progress (cash, chapter, position) in localStorage.
- **Sound**: WebAudio synth — engine hum, sirens, gunshots,
  explosions, mission jingles, ambient bass.

## Structure

```
game/
  index.html        canvas + HUD
  src/
    config.js       tuning + palette
    render.js       raw WebGL1 engine (shaders, boxes, camera)
    world.js        voxel city generation + collision
    input.js        keyboard + mouse
    shots.js        third-person camera
    state.js        game state + progression
    player.js       on-foot movement, parachute
    vehicles.js     cars, bikes, boats, plane, traffic, stealing
    pedestrians.js  ped AI
    police.js       wanted level + police AI
    missions.js     5 chapters + side missions
    combat.js       weapons, bombs, cash drops, pickups
    hud.js          HUD + minimap
    audio.js        WebAudio synth
    save.js         localStorage save/load
    main.js         game loop + wiring
main.ts             entrypoint (hands the game in)
screenshots/       4 real renders of the game
```

## License

MIT — see [LICENSE](LICENSE).
