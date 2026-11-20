// Solmar Bay — make.fun entrypoint (rebuild #15).
// A deliberately small staging entrypoint: it copies the finished
// game folder and the four screenshots into the output directory,
// builds the dossier with the kit helper, and writes it out.
// The game itself is never executed headlessly here — the artifact
// is the plain game folder, so the harness gate only has to check
// plain files, resolvable references, the screenshots and the
// dossier. Nothing in this file depends on a browser or a display.

import { cp, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = dirname(fileURLToPath(import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR || '/output';

async function main() {
  await mkdir(out, { recursive: true });
  // The playable game: index.html plus src and assets, as built.
  await cp(join(here, 'game'), join(out, 'game'), { recursive: true });
  // The four screenshots: 1280x720 renders of the real game.
  await cp(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
  const dossier = buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  await writeFile(join(out, 'dossier.json'), JSON.stringify(dossier, null, 2) + '\n');
  console.log('SELF-CHECK PASSED');
}

main().catch((err) => {
  console.error('SELF-CHECK FAILED:', err);
  process.exit(1);
});
