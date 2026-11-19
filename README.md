# Solmar Bay — an open-world crime game

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/muhrevan72-ux/gta6-solmar-bay/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/muhrevan72-ux/gta6-solmar-bay/reward.svg)](https://make.fun/bounty/gta6-01)

An original 3D voxel open-world crime game in the spirit of GTA 6 — built for the
[make.fun "Make GTA 6" bounty](https://make.fun/bounty/gta6-01). Nothing from Rockstar:
own city, names, story, art, sounds and music.

## The city

Solmar Bay is a sun-soaked coastal voxel city: a downtown grid with neon towers, a
beach road with palms, a harbour with containers, suburbs, an airport with a flyable
plane, and a highway loop. 76 pedestrians with daily activities (walking, sitting,
chatting, queuing, vending), 32 traffic cars, two rival gangs (gold Bay Kings downtown
vs teal Harbour Sharks at the harbour), a train loop, dogs, cats, fish, birds, clouds,
a glass elevator up the tallest tower, and a living weather + day/night cycle with a
golden-hour sunset.

## Play

- **On foot:** WASD move, Shift run, E interact / enter car, F punch, G bomb, click to
  shoot, 1/2/3 switch weapons (pistol, SMG, shotgun), Space handbrake / parachute.
- **Driving:** W/S accelerate / brake, A/D steer, Space handbrake. Cars, bikes, boats,
  a plane, a fire truck, a taxi.
- **Wanted 0–5 stars:** a crime table (steal 1, punch 1, kill 2, kill a cop 3,
  explosion 3, rampage 4–5). Police cars chase and ram, foot cops chase, a helicopter
  hunts you at 4–5 stars, roadblocks at 3+. Busted = hospital respawn, 20% fine.
- **Story:** 5 chapters — First Wheels ($200), The Package ($400), Getaway ($500),
  Night Run ($600), The Big One ($1500) — plus repeatable side jobs (taxi fares,
  courier runs, time trials, turf clear-outs, gang deliveries), a firefighter job,
  food shops, dating Maya, an outfit shop, training (shooting range, swim challenge,
  slalom), fishing, vending machines, ATMs, a garage (store cars, repaint $50),
  a smartphone (Tab: contacts, messages, map), 4 radio stations with 8 original
  synth songs (R to change station), respect levels (Nobody → Legend) with unlocks,
  and city events (street races, beach parties, turf wars).
- **Save:** progress autosaves to localStorage; Continue on the title screen.

## Tech

Vanilla JavaScript + raw WebGL1, no libraries, no build step, no network at runtime.
All art is coloured voxel boxes; all sound is WebAudio synth. Play it by serving
`game/` with any static server and opening `game/index.html` in desktop Chrome.

## License

MIT — see LICENSE.
