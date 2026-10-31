// Set the same version in every published package (they are released together).
// Usage: node scripts/set-version.mjs 0.2.0
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error('Usage: node scripts/set-version.mjs <version>   (for example 0.2.0 or 0.2.0-beta.1)');
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dirs = fs.readdirSync(path.join(root, 'packages'));
for (const dir of dirs) {
  const file = path.join(root, 'packages', dir, 'package.json');
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, 'utf8');
  const pkg = JSON.parse(text);
  if (pkg.private) continue;
  const old = pkg.version;
  // Replace only the version line, to keep the file's formatting.
  fs.writeFileSync(file, text.replace(/"version":\s*"[^"]*"/, `"version": "${version}"`));
  console.log(`${pkg.name}: ${old} → ${version}`);
}
console.log('\nNext: commit, then tag and push:  git tag v' + version + ' && git push origin v' + version);
