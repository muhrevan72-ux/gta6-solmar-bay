// Solmar Bay — staging entrypoint (gta6-01).
// Copies game/ + screenshots/ into $MAKEFUN_OUTPUT_DIR (default
// /output) and writes the dossier with the kit's own library.
// Nothing else: no self-check, no headless render, no network.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');
mkdirSync(out, { recursive: true });
for (const dir of ['game', 'screenshots']) {
  const src = join(here, dir);
  if (existsSync(src)) cpSync(src, join(out, dir), { recursive: true });
}
writeFileSync(join(out, 'dossier.json'), buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
}));
console.log(`Solmar Bay staged to ${out}`);
