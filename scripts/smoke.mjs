// Smoke test: start a packaged Linux build (or `cartridge preview`) and check the game.
// Usage: xvfb-run -a node scripts/smoke.mjs <path-to-executable>
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const playwright = require('playwright'); // root devDependency; Electron mode needs no browser download

const exe = process.argv[2];
if (!exe) { console.error('usage: node scripts/smoke.mjs <executable>'); process.exit(2); }

const app = await playwright._electron.launch({ executablePath: exe, args: [], env: { ...process.env, CARTRIDGE_NO_STEAM: process.env.CARTRIDGE_NO_STEAM ?? '' } });
const logs = [];
app.process().stdout?.on('data', (d) => logs.push(String(d).trim()));
const page = await app.firstWindow();
page.on('console', (m) => logs.push(`[page] ${m.text()}`));
await page.waitForFunction(() => !!window.__game, null, { timeout: 15000 });

const result = await page.evaluate(async () => {
  const status = await window.__cartridge.invoke('steam.status');
  const info = await window.__cartridge.invoke('app.info');
  for (let i = 0; i < 10; i++) await window.__game.onScore();
  const gl = document.createElement('canvas').getContext('webgl2');
  return {
    url: location.href,
    title: document.title,
    status,
    info,
    score: window.__game.score(),
    best: document.querySelector('#best').textContent,
    savedLocally: localStorage.getItem('cartridge:cloud:save.json'),
    achievements: localStorage.getItem('cartridge:achievements'),
    webgl2: !!gl,
    nodeLeak: typeof window.require !== 'undefined' || typeof window.process !== 'undefined',
  };
});
await page.screenshot({ path: process.env.SMOKE_SCREENSHOT ?? 'smoke.png' });
await app.close();
console.log(JSON.stringify(result, null, 2));
console.log(logs.filter(Boolean).join('\n'));

const fail = [];
if (!result.url.startsWith('app://game/')) fail.push('game not served from app://game/');
if (result.score !== 10) fail.push('score');
if (!result.webgl2) fail.push('no WebGL2');
if (result.nodeLeak) fail.push('Node globals visible to the page');
if (fail.length) { console.error('SMOKE FAILED:', fail.join(', ')); process.exit(1); }
console.log('SMOKE OK');
