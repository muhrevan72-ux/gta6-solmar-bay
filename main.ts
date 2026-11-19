// Solmar Bay — make.fun entrypoint (gta6-01).
// Hands the game in: copies game/ and screenshots/ from this
// repository into the output directory and writes dossier.json with
// buildDossier from the kit's vendored library.
//
// Run locally with:  MAKEFUN_OUTPUT_DIR=out node main.ts
// The grader runs it with /output as the target.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = dirname(fileURLToPath(import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR || '/output';

mkdirSync(out, { recursive: true });
mkdirSync(join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });

// the playable game, plain static files
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
// the four screenshots of the game, in dossier order
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(out, 'dossier.json'), dossier);
console.log('Solmar Bay handed in: game/ + screenshots/ + dossier.json in ' + out);
