# Solmar Bay — 3D voxel open-world crime game

[![Solmar Bay](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/muhrevan72-ux/gta6-solmar-bay/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/muhrevan72-ux/gta6-solmar-bay/reward.svg)](https://make.fun/bounty/gta6-01)

An original 3D voxel open-world crime game in the spirit of GTA 6 — own city, names, story, art and sound, nothing from Rockstar. Built for the [make.fun GTA 6 bounty](https://make.fun/bounty/gta6-01).

## The city

Solmar Bay is a sun-soaked coastal voxel city, Vice City style: a downtown grid of pastel art-deco towers with neon signs, a crowded beach with palms and umbrellas, a harbour with containers and cranes, suburbs, an airport with a runway, and a highway loop. The streets are alive — ~76 pedestrians, 32 traffic cars, traffic lights, two rival gangs (**Bay Kings** in gold downtown, **Harbour Sharks** in teal at the harbour), cats, dogs, birds, fish, clouds, and a loop train.

## What you can do

- **Story:** 5 chapters — First Wheels ($200), The Package ($400), Getaway ($500), Night Run ($600), The Big One ($1500).
- **Side jobs:** taxi fares, courier runs, time trials, gang turf clear-outs and deliveries, firefighter shifts (drive the fire truck, spray the flames).
- **Vehicles:** cars, motorbikes, boats, a flyable airplane (with parachute), taxis, the fire truck, police cars, and the loop train.
- **Combat:** punch, pistol / SMG / shotgun (hitscan, crosshair aim), throwable bombs. Kills drop cash ($10–$50).
- **Wanted:** 0–5 stars, per crime like real GTA — stealing a car 1 star, killing a ped 2, killing a cop 3, explosions and rampages up to 5. Lose the heat by hiding out of sight.
- **Life:** food shops (pizza, burger, chicken, donut, taco), dating Maya (drive her to the viewpoint, eat together, drop her home), carryable cats, pettable dogs, an outfit shop (hair, shirt, pants, shoes), a shooting range, a swim challenge, a driving course, and city events (street races, beach parties, gang turf wars). Plus a glass elevator to the rooftop of the tallest tower.
- **Tech:** raw WebGL1, no libraries, no network, plain static files. WebAudio synth sound. Save in localStorage.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move / drive (Shift to run) |
| Mouse drag / wheel | Orbit camera / zoom |
| E | Enter car, interact (shops, cats, train, elevator…) |
| F | Punch (hold F in the fire truck to spray water) |
| Click | Shoot (hold for SMG) |
| G | Throw bomb |
| 1 / 2 / 3 | Pistol / SMG / Shotgun |
| Space | Handbrake (parachute while flying) |
| Esc | Pause (also advances chapter cards) |
| M | Mute |

## Play

Open `game/index.html` in a desktop browser (or `node serve.ts` and visit http://localhost:8080). No build step, no install, no network.

## License

MIT — see [LICENSE](LICENSE).
