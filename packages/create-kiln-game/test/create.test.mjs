import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { create } from '../dist/index.js';

test('creates a game from the template', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'kiln-create-'));
  const { dir, name } = create('space-ducks', cwd, '1.2.3');
  assert.equal(name, 'Space Ducks');
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  assert.equal(pkg.name, 'space-ducks');
  assert.equal(pkg.dependencies['@kiln/steam'], '^1.2.3');
  assert.equal(pkg.devDependencies['@kiln/cli'], '^1.2.3');
  const config = fs.readFileSync(path.join(dir, 'kiln.config.mjs'), 'utf8');
  assert.match(config, /name: 'Space Ducks'/);
  assert.match(config, /com\.example\.spaceducks/);
  assert.ok(fs.existsSync(path.join(dir, '.gitignore')));
  assert.ok(!fs.existsSync(path.join(dir, 'node_modules')));
  assert.throws(() => create('space-ducks', cwd), /not empty/);
});
