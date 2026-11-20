// Solmar Bay — the entrypoint the make.fun scorer runs.
//
// It stages the playable game and its screenshots into the output
// directory, then writes the dossier that describes them. The
// dossier is built by the vendor library, with the gate's caps, so
// what lands in /output is exactly what the scorer will measure.
//
//   node main.ts            stages to $MAKEFUN_OUTPUT_DIR (or /output)
//
// The game itself lives in game/ (index.html + src/*.js, vanilla
// JavaScript and WebGL, no dependencies); screenshots/ holds the
// four renders of it. Nothing here reads the network.

import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Where this file lives is the entry root (game/ and screenshots/
// sit next to it).
const entryRoot = dirname(fileURLToPath(import.meta.url));

// The scorer sets MAKEFUN_OUTPUT_DIR; a local run defaults to /output.
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

// The gate's caps, from the bounty's gate.json.
const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
};

function stage() {
  mkdirSync(outDir, { recursive: true });
  // Copy the playable game and its screenshots verbatim.
  for (const name of ['game', 'screenshots']) {
    cpSync(join(entryRoot, name), join(outDir, name), { recursive: true });
  }
  // The dossier is canonical JSON bytes for this exact directory.
  const dossier = buildDossier(outDir, caps);
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  console.log(`Solmar Bay staged to ${outDir} (dossier ${dossier.length} bytes)`);
}

stage();
