// Solmar Bay — staging entrypoint.
//
// Run with `node main.ts`. It copies the playable game and the screenshots
// into the directory named by $MAKEFUN_OUTPUT_DIR and writes dossier.json
// there, so the bounty harness can pick the entry up as one folder.
import { cpSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR;
if (!outDir) {
  console.error('MAKEFUN_OUTPUT_DIR is not set');
  process.exit(1);
}
const out = resolve(outDir);
mkdirSync(out, { recursive: true });

for (const folder of ['game', 'screenshots']) {
  const src = join(here, folder);
  if (!existsSync(src)) {
    console.error(`missing folder: ${src}`);
    process.exit(1);
  }
  cpSync(src, join(out, folder), { recursive: true });
}

const dossier = {
  title: 'Solmar Bay',
  competition: 'gta6-01',
  repo: 'https://github.com/muhrevan72-ux/gta6-solmar-bay',
  entrypoint: 'game/index.html',
  description:
    'A GTA-style open-world 3D game in the browser: drive the Solmar Comet, ' +
    'steal cars, dodge the police, climb the respect ladder, and play five ' +
    'story chapters across an 800m coastal city.',
  controls: 'WASD move/drive, Shift run, E interact, F punch, G bomb, click shoot, Tab phone, R radio, M mute, Esc pause',
  builtWith: 'Node 22, no dependencies, custom software WebGL renderer',
};
writeFileSync(join(out, 'dossier.json'), JSON.stringify(dossier, null, 2) + '\n');
console.log(`staged Solmar Bay into ${out}`);
