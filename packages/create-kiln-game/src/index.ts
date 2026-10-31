#!/usr/bin/env node
/**
 * npm create kiln-game@latest my-game
 * pnpm create kiln-game my-game
 */
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const VERSION = (require('../package.json') as { version: string }).version;
const TEMPLATE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../template');

const TEMPLATE_NAME = 'Cube Clicker';
const TEMPLATE_ID = 'com.example.cubeclicker';

const color = process.stdout.isTTY && !process.env.NO_COLOR;
const cyan = (s: string) => (color ? `\x1b[36m${s}\x1b[0m` : s);
const bold = (s: string) => (color ? `\x1b[1m${s}\x1b[0m` : s);

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'my-game';
}

export function titleCase(slug: string): string {
  return slug.split('-').filter(Boolean).map((w) => w[0]!.toUpperCase() + w.slice(1)).join(' ');
}

function packageManager(): string {
  const ua = process.env.npm_config_user_agent ?? '';
  for (const pm of ['pnpm', 'yarn', 'bun']) if (ua.startsWith(pm)) return pm;
  return 'npm';
}

export function create(targetArg: string, cwd = process.cwd(), version = VERSION): { dir: string; name: string } {
  const dir = path.resolve(cwd, targetArg);
  if (fs.existsSync(dir) && fs.readdirSync(dir).length > 0) {
    throw new Error(`${dir} is not empty. Choose a new folder name.`);
  }
  const slug = slugify(path.basename(dir));
  const name = titleCase(slug);

  fs.cpSync(TEMPLATE, dir, { recursive: true });
  fs.renameSync(path.join(dir, '_gitignore'), path.join(dir, '.gitignore'));

  const pkgFile = path.join(dir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
  pkg.name = slug;
  pkg.version = '0.1.0';
  for (const field of ['dependencies', 'devDependencies'] as const) {
    for (const [dep, range] of Object.entries<string>(pkg[field] ?? {})) {
      if (range.startsWith('workspace:')) pkg[field][dep] = `^${version}`;
    }
  }
  fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + '\n');

  const replace = (file: string) => {
    const p = path.join(dir, file);
    const text = fs.readFileSync(p, 'utf8');
    fs.writeFileSync(
      p,
      text.replaceAll(TEMPLATE_NAME, name).replaceAll(TEMPLATE_ID, `com.example.${slug.replace(/-/g, '')}`),
    );
  };
  replace('kiln.config.mjs');
  replace('index.html');
  return { dir, name };
}

function main(): void {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('Usage: npm create kiln-game@latest <folder>');
    return;
  }
  const target = args[0] ?? 'my-kiln-game';
  const { dir, name } = create(target);
  const pm = packageManager();
  const rel = path.relative(process.cwd(), dir) || '.';
  console.log(`\n${bold(name)} is ready in ${cyan(rel)}\n`);
  console.log('Next steps:');
  console.log(`  ${cyan(`cd ${rel}`)}`);
  console.log(`  ${cyan(`${pm} install`)}`);
  console.log(`  ${cyan(`${pm} run dev`)}            play in the browser`);
  console.log(`  ${cyan(`${pm} run desktop:dev`)}    play in a desktop window with Steam`);
  console.log(`  ${cyan(`${pm} run desktop:build`)}  make Windows, macOS and Linux builds\n`);
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (err) {
    console.error(`✖ ${(err as Error).message}`);
    process.exit(1);
  }
}
