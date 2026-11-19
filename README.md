[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/muhrevan72-ux/gta6-solmar-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard)
[![reward](https://make.fun/badge/gta6-01/muhrevan72-ux/gta6-solmar-bay/reward.svg)](https://make.fun/bounty/gta6-01)

# Solmar Bay

An original 2D top-down open-world crime game, built for the make.fun
bounty [Make GTA 6](https://make.fun/bounty/gta6-01). No Rockstar
assets, no network needed: the whole game runs offline in a desktop
browser from static files.

Play it live: https://muhrevan72-ux.github.io/gta6-solmar-bay/game/

## The game

You arrive in Solmar Bay with nothing but a pair of legs. Steal cars,
outrun the police, earn cash, and work your way through five story
missions — from your first joyride to the big one.

- **A living city:** downtown streets, a beach road, traffic AI and
  pedestrians going about their day.
- **On foot and behind the wheel:** walk, run, steal any car you
  find, and drive it like you stole it.
- **Wanted level 0–5:** the more chaos you cause, the harder the
  police come after you — patrol cars and officers on foot. Get
  busted and you wake up at the hospital, 20% lighter.
- **5 story missions:** First Wheels ($200), The Package ($400),
  Getaway ($500), Night Run ($600), The Big One ($1,500) — plus
  courier jobs for extra cash.
- **HUD + minimap:** speed, cash, wanted stars, mission tracker and
  a live minimap.
- **Save:** progress is saved in your browser (localStorage).
- **Sound:** synthesized WebAudio effects and engine hum, no audio
  files needed.

## How to play

Open `game/index.html` in a desktop browser (Chrome recommended), or
play the live version linked above.

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive |
| E | Enter / exit a car |
| Space | Handbrake |
| P | Pause |
| M | Mute |

## Screenshots

Real gameplay renders, in `screenshots/`:

- `1-chase.jpg` — police chase, 3 wanted stars, Getaway mission
- `2-drive.jpg` — driving downtown, First Wheels mission
- `3-beach.png` — beach road, Night Run mission
- `4-title.jpg` — title screen over the living city

## Structure

- `main.ts` — entrypoint (Node 22) for the make.fun harness
- `game/index.html` — the game page
- `game/src/` — the game source (~2,500 lines, 16 modules: world,
  vehicles, pedestrians, player, police, missions, combat, audio,
  HUD, render, save, state, shots, input, config, main)
- `screenshots/` — 4 real gameplay screenshots (1280×720)
- `vendor/makefun-game.ts` — make.fun kit file, unchanged

## License

MIT. See [LICENSE](LICENSE).
