// Solmar Bay — the entrypoint for the make.fun GTA 6 bounty.
// It hands the game in: the playable game/ folder and the
// screenshots/ folder are copied into the output directory, and a
// dossier.json describing the entry is written there with the kit's
// buildDossier helper. Standard library only, no network.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

// This file lives at the repository root, so its folder is the root.
const rootDir = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

mkdirSync(outDir, { recursive: true });

// Copy the playable game and its screenshots into the output folder.
cpSync(join(rootDir, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(rootDir, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

// The scorer's own caps for this bounty (from its gate.json).
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});

writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log('Solmar Bay handed in: game/ + screenshots/ + dossier.json in ' + outDir);
