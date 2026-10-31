import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { resolveConfig, toVdf, planUpload } from '../dist/index.js';

test('toVdf quotes, escapes and nests', () => {
  const out = toVdf({ A: { B: 1, C: 'x "y" \\z', D: { E: 'f' } } });
  assert.equal(out, '"A"\n{\n\t"B"\t\t"1"\n\t"C"\t\t"x \\"y\\" \\\\z"\n\t"D"\n\t{\n\t\t"E"\t\t"f"\n\t}\n}\n');
});

function setup(steam, built = ['windows', 'linux']) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cartridge-up-'));
  fs.writeFileSync(path.join(root, 'package.json'), '{"version":"1.0.0"}');
  for (const p of built) fs.mkdirSync(path.join(root, '.cartridge', 'build', p), { recursive: true });
  return resolveConfig({ name: 'G', steam }, root, 'x');
}

test('plan uses every built platform with a depot', () => {
  const c = setup({ appId: 1000, depots: { windows: 1001, linux: 1003, macos: 1002 } });
  const plan = planUpload(c, { description: 'test', branch: 'beta' });
  assert.deepEqual(plan.depots.map((d) => [d.platform, d.depotId]), [['windows', 1001], ['linux', 1003]]);
  const app = plan.files.find((f) => f.path === plan.appBuildFile).content;
  assert.match(app, /"AppID"\t\t"1000"/);
  assert.match(app, /"SetLive"\t\t"beta"/);
  assert.match(app, /"1001"\t\t".*depot_1001\.vdf"/);
  const depot = plan.files.find((f) => f.path.endsWith('depot_1003.vdf')).content;
  assert.match(depot, /"ContentRoot"\t\t".*\.cartridge\/build\/linux"/);
  assert.match(depot, /"LocalPath"\t\t"\*"/);
});

test('plan refuses app 480, missing depots and missing builds', () => {
  assert.throws(() => planUpload(setup({ appId: 480 }), { description: '' }), /Spacewar/);
  assert.throws(() => planUpload(setup({ appId: 1000, depots: { windows: 1001 } }), { description: '' }), /No depot for linux/);
  assert.throws(
    () => planUpload(setup({ appId: 1000, depots: { macos: 1002 } }), { description: '', platforms: ['macos'] }),
    /No macos build/,
  );
});
