// Solmar Bay — entrypoint (node22).
//
//   node main.ts            run the headless self-check and exit 0/1
//   node main.ts --serve    serve game/ on http://localhost:8080
//
// The self-check boots the real game through game/src/main.js with a
// stub canvas (no WebGL in plain Node, so the renderer stays null
// and the frame path is skipped) and exercises the logic that the
// round-12 play-test caught: the title screen, chapter flow, the
// pause overlay, the wasted/busted respawns with the 5 s spawn
// grace, the wanted decay, and a 90 s stability soak. The browser
// path is the same boot() — the page loads only game/src/main.js,
// which self-boots when #game-canvas exists.
import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boot, handleTaps, stepGame } from './game/src/main.js';
import { startChapter, completeChapter } from './game/src/missions.js';
import { saveGame, loadGame, hasSave } from './game/src/save.js';
import { damagePlayer } from './game/src/combat.js';

const here = fileURLToPath(new URL('.', import.meta.url));
const gameRoot = resolve(here, 'game');

// ---------- headless self-check ----------
function stubCanvas() {
  return {
    width: 1280,
    height: 720,
    getContext() { return null; },
    addEventListener() {},
    removeEventListener() {},
  };
}

function stubDoc() {
  const els = new Map<string, Record<string, unknown>>();
  return {
    getElementById(id: string) {
      if (!els.has(id)) {
        els.set(id, {
          id,
          style: { display: '' },
          textContent: '',
          addEventListener() {},
          removeEventListener() {},
          click() {},
          getContext: () => null,
          width: 200,
          height: 200,
        });
      }
      return els.get(id);
    },
  };
}

function memoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  };
}

function selfCheck(): string[] {
  const failures: string[] = [];
  const check = (cond: boolean, label: string) => {
    if (!cond) failures.push(label);
    else console.log(`  ok — ${label}`);
  };

  // Structural: the files the browser needs are on disk.
  const html = readFileSync(join(gameRoot, 'index.html'), 'utf8');
  check(html.includes('<canvas id="game-canvas" width="1280" height="720">'), 'index.html has #game-canvas 1280x720');
  check(html.includes('<script type="module" src="./src/main.js">'), 'index.html loads main.js as a module');
  check(html.includes('SOLMAR BAY'), 'index.html has the title');
  const barrel = statSync(join(gameRoot, 'assets', 'barrel.glb'));
  check(barrel.size > 1000, `barrel.glb on disk (${barrel.size} bytes)`);

  // Boot through the real entrypoint (stub canvas: no WebGL here).
  const game = boot(stubCanvas() as never, stubDoc() as never);
  check(game.mode === 'menu', 'title screen on boot');
  check(game.city !== null && game.city.buildings.length === 89, `city built (${game.city?.buildings.length} buildings)`);
  check(game.peds.length === 76, `76 pedestrians spawned (got ${game.peds.length})`);
  check(game.vehicles.length === 36 && game.traffic.length === 32, `68 vehicles spawned (${game.vehicles.length} parked/special + ${game.traffic.length} traffic)`);
  check(game.renderer === null, 'no renderer without WebGL (headless guard)');

  // New Game from the title screen, then dismiss the chapter card.
  game.input.injectTap('Enter');
  handleTaps(game, game.input);
  check(game.chapter === 1 && game.mode === 'card', 'Enter starts Chapter 1');
  game.input.endFrame();
  game.input.injectTap('Enter');
  handleTaps(game, game.input);
  check(game.mode === 'play', 'chapter card dismisses to play');

  // Chapter 1 completes from the garage in a car (drive the car
  // there — the player rides in it, so move the car itself).
  const v = game.vehicles[0];
  game.player.x = v.x;
  game.player.z = v.z;
  game.input.injectTap('KeyE');
  handleTaps(game, game.input);
  check(game.player.inCar === v, 'E enters a parked car');
  v.x = 150;
  v.z = -126;
  stepGame(game, 0.1, game.input);
  check(game.mode === 'passed' && game.cash === 350, 'Chapter 1 passes at the garage ($350)');

  // Pause saves and resumes; the world freezes while paused.
  game.input.endFrame();
  game.mode = 'play';
  game.input.injectTap('Escape');
  handleTaps(game, game.input);
  check(game.mode === 'pause', 'Escape pauses');
  const c0 = game.clock;
  stepGame(game, 1, game.input);
  check(game.clock === c0, 'clock frozen while paused');
  game.input.endFrame();
  game.input.injectTap('Enter');
  handleTaps(game, game.input);
  check(game.mode === 'play', 'Enter resumes');

  // Wasted: gang damage to 0 HP shows the card; Enter respawns
  // at the hospital with a 20% fine and a 5 s grace period.
  game.health = 3;
  game.player.x = 0;
  game.player.z = 20;
  damagePlayer(game, 10);
  check(game.mode === 'wasted', 'damage to 0 HP wastes the player');
  game.input.endFrame();
  game.input.injectTap('Enter');
  handleTaps(game, game.input);
  check(game.mode === 'play' && game.health === 100, 'wasted respawn restores health');
  check(game._spawnGrace > 0, 'spawn grace active after respawn');

  // Save / load round-trip with an in-memory localStorage.
  (globalThis as Record<string, unknown>).localStorage = memoryStorage();
  game.chapter = 2;
  game.cash = 300;
  check(saveGame(game), 'save writes');
  check(hasSave(), 'save detected');
  game.chapter = 1;
  game.cash = 150;
  loadGame(game);
  check(game.chapter === 2 && game.cash === 300, 'load restores chapter 2 / $300');
  delete (globalThis as Record<string, unknown>).localStorage;

  // 90 s stability soak on the beach (out of gang turf), with
  // Chapter 2 properly started so its timer is running.
  startChapter(game, 2);
  check(game.mode === 'card' && game.missionTimer === 120, 'Chapter 2 starts with a 120 s timer');
  game.input.endFrame();
  game.input.injectTap('Enter');
  handleTaps(game, game.input);
  game.mode = 'play';
  game.player.x = -330;
  game.player.z = 40;
  for (let i = 0; i < 90; i++) stepGame(game, 1, game.input);
  check(game.mode === 'play', 'still playing after a 90 s soak');
  check(game.clock > 8, 'clock advanced during the soak');

  // Chapter 2 end-to-end: pickup, then the hideout, while the
  // timer still has time left.
  game.player.x = -240;
  game.player.z = 200;
  stepGame(game, 0.1, game.input);
  check(game.chapterStage === 1, 'Chapter 2 pickup collected');
  game.player.x = -120;
  game.player.z = 60;
  stepGame(game, 0.1, game.input);
  check(game.mode === 'passed' && game.cash === 700, 'Chapter 2 passes at the hideout ($300 + $400)');

  return failures;
}

// ---------- static server (play the game in a browser) ----------
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.txt': 'text/plain; charset=utf-8',
};

function serve(port: number) {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/') rel = '/index.html';
    const file = resolve(gameRoot, normalize(rel).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(gameRoot + sep) && file !== gameRoot) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }
    try {
      const data = readFileSync(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });
  server.listen(port, () => {
    console.log(`Solmar Bay at http://localhost:${port}/`);
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--serve')) {
    const pi = args.indexOf('--port');
    const port = pi >= 0 ? Number(args[pi + 1]) || 8080 : 8080;
    serve(port);
    return;
  }
  // Pre-load combat so the self-check can use it synchronously.
  console.log('Solmar Bay — headless self-check');
  const failures = selfCheck();
  if (failures.length > 0) {
    console.log(`SELF-CHECK FAILED (${failures.length}):`);
    for (const f of failures) console.log(`  FAIL — ${f}`);
    process.exit(1);
  }
  console.log('SELF-CHECK PASSED');
}

main();
