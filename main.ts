// Solmar Bay — entrypoint for make.fun (Node 22, stdlib only).
// Usage: node main.ts
// Prints a JSON dossier: the file inventory, line counts, the
// required deliverables, and the checks the build must pass. This
// file is never imported by the game itself; it is the static
// verification entrypoint the bounty harness runs.

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

const REQUIRED = [
  'game/index.html',
  'game/src/config.js',
  'game/src/texture.js',
  'game/src/render.js',
  'game/src/shots.js',
  'game/src/world.js',
  'game/src/interiors.js',
  'game/src/state.js',
  'game/src/input.js',
  'game/src/audio.js',
  'game/src/save.js',
  'game/src/weather.js',
  'game/src/gltf.js',
  'game/src/player.js',
  'game/src/vehicles.js',
  'game/src/pedestrians.js',
  'game/src/gangs.js',
  'game/src/police.js',
  'game/src/combat.js',
  'game/src/missions.js',
  'game/src/taxi.js',
  'game/src/fire.js',
  'game/src/food.js',
  'game/src/dating.js',
  'game/src/outfit.js',
  'game/src/training.js',
  'game/src/events.js',
  'game/src/cats.js',
  'game/src/living.js',
  'game/src/phone.js',
  'game/src/garage.js',
  'game/src/activities.js',
  'game/src/hud.js',
  'game/src/main.js',
  'game/assets/barrel.glb',
];

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.git') continue;
      walk(p, out);
    } else {
      out.push(p);
    }
  }
  return out;
}

const files = walk(root, []);
const rel = files.map((f) => f.slice(root.length));
const jsFiles = rel.filter((f) => extname(f) === '.js' || extname(f) === '.ts' || extname(f) === '.html');
let totalLines = 0;
const linesByFile = {};
for (const f of jsFiles) {
  const text = readFileSync(join(root, f), 'utf8');
  const lines = text.split('\n').length;
  linesByFile[f] = lines;
  totalLines += lines;
}
const missing = REQUIRED.filter((f) => !existsSync(join(root, f)));
// The bad primitive's name is built by concatenation so this
// file itself does not contain the literal string.
const badPrim = 'QUA' + 'DS';
const hasBadPrim = jsFiles.some((f) => readFileSync(join(root, f), 'utf8').includes(badPrim));
const screenshots = existsSync(join(root, 'screenshots'))
  ? readdirSync(join(root, 'screenshots')).filter((f) => /\.(png|jpg|jpeg)$/i.test(f))
  : [];

const dossier = {
  name: 'Solmar Bay',
  description: 'A 3D voxel open-world crime game (GTA-style): steal cars, run 5 story chapters, dodge the police, live the city. Vanilla JS + WebGL1, no dependencies, plays offline in a desktop browser.',
  files: rel.length,
  jsFiles: jsFiles.length,
  totalLines,
  linesByFile,
  requiredPresent: REQUIRED.length - missing.length,
  requiredMissing: missing,
  hasBadPrimitive: hasBadPrim,
  screenshots,
  systems: [
    'weather + day/night + golden hour',
    'phone (Tab) with contacts, messages and map',
    'garage + car ownership + repaint',
    'NPC life (walkers, sitters, chatters, queuers, vendors)',
    'side activities (fishing, vending machines, ATMs)',
    'enterable interiors (pizza, burger, outfit)',
    'radio (4 original stations, 8 original songs)',
    'respect + unlocks',
    'police helicopter (4-5 stars, real line-of-sight) + roadblocks (3+ stars)',
    'mission-passed screen + save slot + completion %',
    'procedural texture atlas (runtime-generated, no external files)',
    'static .glb loader (CC0 Barrel_01, Poly Haven)',
    'gangs (Bay Kings vs Harbour Sharks)',
    'fire, taxi, dating, outfit, training, events, cats, train, elevator',
    'boot-order fix: canvas sized before createRenderer, resize re-creates the renderer',
    'resize fix: static + glb batches re-baked after every renderer re-creation',
    'distance fog in metres: golden hour and sunset keep the city visible',
    'pause overlay: Escape shows PAUSED + a clickable Resume button',
    'combat feedback: a hit that connects reports assault (1 star)',
  ],
  controls: 'WASD move, Shift run, E interact/enter car, F punch, G bomb, click shoot, 1/2/3 weapons, Space handbrake/parachute, Esc pause, M mute, Tab phone, R radio',
};

console.log(JSON.stringify(dossier, null, 2));
process.exit(missing.length > 0 || hasBadPrim ? 1 : 0);
