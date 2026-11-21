// Solmar Bay — staging entrypoint.
// Copies game/ + screenshots/ (and the README) into
// $MAKEFUN_OUTPUT_DIR and writes dossier.json there.
import { copyFileSync, cpSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR || join(__dirname, 'dist');

mkdirSync(out, { recursive: true });
cpSync(join(__dirname, 'game'), join(out, 'game'), { recursive: true });
cpSync(join(__dirname, 'screenshots'), join(out, 'screenshots'), { recursive: true });
if (existsSync(join(__dirname, 'README.md'))) {
  copyFileSync(join(__dirname, 'README.md'), join(out, 'README.md'));
}

const dossier = {
  name: 'Solmar Bay',
  slug: 'gta6-01',
  kind: 'game',
  entry: 'game/index.html',
  description: 'A GTA-style open-world 3D voxel game: steal cars, run 5 story chapters, dodge the cops, live the city.',
  version: '2.0.0',
  license: 'MIT',
};

writeFileSync(join(out, 'dossier.json'), JSON.stringify(dossier, null, 2));
console.log('Solmar Bay staged to', out);
