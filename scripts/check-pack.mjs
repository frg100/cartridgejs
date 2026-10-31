// Release check: pack every package as `pnpm publish` would, check what is inside,
// and (with --e2e) make a new game from the packed starter and build it with ONLY
// the packed packages, as a user would after `npm create @cartridgejs`.
//
// Usage: node scripts/check-pack.mjs [--e2e]      (run `pnpm build` first)
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const e2e = process.argv.includes('--e2e');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'cartridge-pack-'));
const shell = process.platform === 'win32';
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: 'inherit', shell });
const capture = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, encoding: 'utf8', shell });

const PACKAGES = {
  steam: { must: ['package.json', 'README.md', 'LICENSE', 'dist/index.js', 'dist/index.d.ts', 'dist/protocol.js'] },
  electron: { must: ['package.json', 'README.md', 'LICENSE', 'dist/index.js', 'dist/main.js', 'dist/preload.js', 'dist/steam.js', 'dist/config.js'] },
  cli: { must: ['package.json', 'README.md', 'LICENSE', 'bin/cartridge.mjs', 'dist/bin.js', 'dist/index.js', 'dist/index.d.ts'] },
  create: { must: ['package.json', 'README.md', 'LICENSE', 'dist/index.js', 'template/package.json', 'template/cartridge.config.mjs', 'template/_gitignore', 'template/src/main.ts', 'template/assets/icon.icns'] },
};
const FORBIDDEN = [/^src\//, /^test\//, /\.map$/, /^tsconfig\.json$/, /node_modules\//];

const problems = [];
const tarballs = {};
const versions = new Set();

for (const [dir, spec] of Object.entries(PACKAGES)) {
  const pkgDir = path.join(root, 'packages', dir);
  const before = new Set(fs.readdirSync(out));
  capture('pnpm', ['pack', '--pack-destination', out], pkgDir);
  const file = fs.readdirSync(out).find((f) => !before.has(f) && f.endsWith('.tgz'));
  if (!file) {
    problems.push(`${dir}: pnpm pack made no tarball`);
    continue;
  }
  const tgz = path.join(out, file);
  tarballs[dir] = tgz;

  const files = capture('tar', ['-tzf', tgz]).split(/\r?\n/).map((f) => f.trim()).filter(Boolean).map((f) => f.replace(/^package\//, ''));
  for (const m of spec.must) if (!files.includes(m)) problems.push(`${dir}: missing ${m}`);
  for (const f of files) if (FORBIDDEN.some((re) => re.test(f))) problems.push(`${dir}: must not publish ${f}`);

  const manifest = JSON.parse(capture('tar', ['-xzOf', tgz, 'package/package.json']));
  versions.add(manifest.version);
  const deps = { ...manifest.dependencies, ...manifest.devDependencies, ...manifest.peerDependencies };
  for (const [name, range] of Object.entries(deps)) {
    if (String(range).startsWith('workspace:')) problems.push(`${dir}: ${name} is still "${range}"`);
  }
  if (manifest.publishConfig?.access !== 'public') problems.push(`${dir}: publishConfig.access must be "public"`);
  const size = fs.statSync(tgz).size;
  console.log(`✔ ${manifest.name}@${manifest.version}  ${files.length} files, ${(size / 1024).toFixed(0)} KB`);
}

if (versions.size > 1) problems.push(`packages have different versions: ${[...versions].join(', ')} (run scripts/set-version.mjs)`);

if (problems.length) {
  console.error(`\n✖ ${problems.length} problem(s):\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}
console.log('✔ tarball contents OK');

if (e2e) {
  const work = path.join(out, 'e2e');
  fs.mkdirSync(work);
  const starter = path.join(out, 'starter');
  fs.mkdirSync(starter);
  run('tar', ['-xzf', tarballs['create'], '-C', starter]);

  console.log('\n› npm create @cartridgejs my-game (from the packed starter)');
  run('node', [path.join(starter, 'package', 'dist', 'index.js'), 'my-game'], work);
  const game = path.join(work, 'my-game');

  // Point the game at the packed packages instead of the npm registry.
  const pkgFile = path.join(game, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
  const file = (dir) => `file:${tarballs[dir].split(path.sep).join('/')}`;
  pkg.dependencies['@cartridgejs/steam'] = file('steam');
  pkg.devDependencies['@cartridgejs/cli'] = file('cli');
  pkg.pnpm = { overrides: { '@cartridgejs/electron': file('electron'), '@cartridgejs/steam': file('steam') } };
  fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2));

  const platform = { win32: 'windows', darwin: 'macos', linux: 'linux' }[process.platform];
  console.log('\n› pnpm install');
  run('pnpm', ['install', '--no-frozen-lockfile'], game);
  console.log('\n› cartridge doctor');
  run('pnpm', ['exec', 'cartridge', 'doctor'], game);
  console.log(`\n› cartridge build -p ${platform}`);
  run('pnpm', ['exec', 'cartridge', 'build', '-p', platform], game);
  const built = path.join(game, '.cartridge', 'build', platform);
  if (!fs.existsSync(built)) {
    console.error(`✖ no build in ${built}`);
    process.exit(1);
  }
  console.log(`\n✔ end-to-end OK: a new game built for ${platform} from the packed packages`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `game_dir=${game}\n`);
}
