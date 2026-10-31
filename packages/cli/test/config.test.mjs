import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { resolveConfig } from '../dist/index.js';
import { slugify } from '../dist/config.js';

// The package manager guess reads this; the tests must not depend on how they run.
delete process.env.npm_config_user_agent;

function project(pkg = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cartridge-test-'));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ version: '1.2.3', scripts: { build: 'vite build', dev: 'vite' }, ...pkg }));
  return dir;
}

test('defaults', () => {
  const root = project({ author: 'Jo Dev <jo@example.com>' });
  const c = resolveConfig({ name: 'Space Ducks!' }, root, path.join(root, 'cartridge.config.mjs'));
  assert.equal(c.version, '1.2.3');
  assert.equal(c.executableName, 'space-ducks');
  assert.equal(c.id, 'com.cartridge.spaceducks');
  assert.equal(c.publisher, 'Jo Dev');
  assert.equal(c.web.build, 'npm run build');
  assert.equal(c.web.dev, 'npm run dev');
  assert.equal(c.web.dir, path.join(root, 'dist'));
  assert.deepEqual(c.platforms, ['windows', 'macos', 'linux']);
  assert.deepEqual(c.locales, ['en-US']);
  assert.equal(c.steam.restartThroughSteam, true);
  assert.equal(c.outDir, path.join(root, '.cartridge'));
});

test('package manager from lockfile', () => {
  const root = project();
  fs.writeFileSync(path.join(root, 'pnpm-lock.yaml'), '');
  const c = resolveConfig({ name: 'G' }, root, 'x');
  assert.equal(c.web.build, 'pnpm run build');
});

test('no build script means no build command', () => {
  const root = project({ scripts: {} });
  const c = resolveConfig({ name: 'G' }, root, 'x');
  assert.equal(c.web.build, false);
  assert.equal(c.web.dev, false);
});

test('reports all problems at once', () => {
  const root = project();
  assert.throws(
    () => resolveConfig({ name: '', id: 'bad', steam: { appId: -1, depots: { amiga: 3 } }, platforms: ['dos'] }, root, 'cartridge.config.mjs'),
    (err) => {
      for (const s of ['`name`', '`id`', 'steam.appId', 'amiga', 'dos']) assert.match(err.message, new RegExp(s.replace(/[.`]/g, '\\$&')));
      return true;
    },
  );
});

test('slugify', () => {
  assert.equal(slugify('Café Racer 2'), 'cafe-racer-2');
  assert.equal(slugify('!!!'), 'game');
});
