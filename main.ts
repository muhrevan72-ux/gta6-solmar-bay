// Solmar Bay — staging entrypoint (make.fun gta6-01).
//
// Hands the game in: copies game/ and screenshots/ from this
// repository into the output directory, then writes the dossier
// there with the kit's buildDossier. The grader runs this as
// `node main.ts`; outside the grader, MAKEFUN_OUTPUT_DIR stands
// in for /output. Node 22, standard library only, no build step.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The gate's caps, from the bounty (gate.json): the dossier text
// holds at most 160 KiB, at most 4 screenshots of at most 256 KiB
// each, and game/ at most 993 entries / 48 MiB.
const GATE_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
};

// This file lives at the repository root, beside game/ and
// screenshots/ — resolve the entry directory from its own URL so
// the staging works from any working directory.
const entryRoot = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

function stageFolder(name) {
  const src = join(entryRoot, name);
  const dst = join(outDir, name);
  if (!existsSync(src)) throw new Error(`Solmar Bay: missing ${name}/ beside main.ts`);
  cpSync(src, dst, { recursive: true });
  return dst;
}

mkdirSync(outDir, { recursive: true });
stageFolder('game');
stageFolder('screenshots');

// The dossier is built from the STAGED copy, so it describes
// exactly what the grader receives.
const dossier = buildDossier(outDir, GATE_CAPS);
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`Solmar Bay staged to ${outDir} (dossier ${dossier.length} bytes)`);
