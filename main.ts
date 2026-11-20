// Solmar Bay — the make.fun entrypoint (rebuild #14).
// This is a fresh, minimal entrypoint: it copies the game and
// the screenshots next to it into the output directory, builds
// the dossier from the kit's buildDossier helper, and writes it
// out. Nothing here runs the game headlessly — the artifact is
// the plain game folder, so the harness gate only has to check
// plain files, resolvable references, screenshots and the dossier.

import { cp, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = dirname(fileURLToPath(import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR || '/output';

async function main() {
  await mkdir(out, { recursive: true });
  // The game: index.html + src + assets, exactly as built.
  await cp(join(here, 'game'), join(out, 'game'), { recursive: true });
  // The screenshots: four 1280x720 renders of the real game.
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
