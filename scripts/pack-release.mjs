// Pack every published package into .release/ (as `pnpm publish` would: workspace:
// ranges become real versions). Used by the release workflow and for a manual first publish.
//
// Usage: pnpm build && node scripts/pack-release.mjs
//        then: npm publish .release/<file>.tgz --access public   (for each file)
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '.release');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);

for (const dir of fs.readdirSync(path.join(root, 'packages'))) {
  const pkgDir = path.join(root, 'packages', dir);
  const manifest = path.join(pkgDir, 'package.json');
  if (!fs.existsSync(manifest) || JSON.parse(fs.readFileSync(manifest, 'utf8')).private) continue;
  execFileSync('pnpm', ['pack', '--pack-destination', out], { cwd: pkgDir, stdio: 'ignore', shell: process.platform === 'win32' });
}
for (const f of fs.readdirSync(out).sort()) console.log(path.join('.release', f));
