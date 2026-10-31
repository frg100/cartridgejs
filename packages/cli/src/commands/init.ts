import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { detectPackageManager, findConfigFile, readPackageJson, slugify } from '../config.js';
import { c, KilnError, log } from '../log.js';
import { configTemplate, workflowTemplate } from '../templates.js';

export interface InitFlags {
  ci: boolean;
  install: boolean;
  force: boolean;
}

const SCRIPTS: Record<string, string> = {
  'desktop:dev': 'kiln dev',
  'desktop:preview': 'kiln preview',
  'desktop:build': 'kiln build',
  'steam:upload': 'kiln upload',
};

/** Guess the web build folder and dev URL from the project's tools. */
function detectWeb(pkg: Record<string, any>): { webDir: string; devUrl: string; tool: string } {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (deps.vite) return { webDir: 'dist', devUrl: 'http://localhost:5173', tool: 'Vite' };
  if (deps.parcel) return { webDir: 'dist', devUrl: 'http://localhost:1234', tool: 'Parcel' };
  if (deps.webpack || deps['webpack-dev-server']) return { webDir: 'dist', devUrl: 'http://localhost:8080', tool: 'webpack' };
  if (deps['@sveltejs/kit']) return { webDir: 'build', devUrl: 'http://localhost:5173', tool: 'SvelteKit (use adapter-static)' };
  return { webDir: 'dist', devUrl: 'http://localhost:5173', tool: 'unknown' };
}

export async function init(flags: InitFlags): Promise<void> {
  const root = process.cwd();
  const pkg = readPackageJson(root);
  if (!pkg) {
    throw new KilnError('No package.json here.', 'Run `kiln init` in your game folder, or start a new game with `npm create kiln-game`.');
  }

  const existing = findConfigFile(root);
  const pm = detectPackageManager(root);
  const web = detectWeb(pkg);
  const name: string = pkg.productName ?? pkg.displayName ?? titleCase(pkg.name ?? path.basename(root));
  const id = `com.example.${slugify(name).replace(/-/g, '')}`;

  if (existing && !flags.force) {
    log.ok(`${path.basename(existing)} is already here ${c.dim('(use --force to replace it)')}`);
  } else {
    fs.writeFileSync(path.join(root, 'kiln.config.mjs'), configTemplate({ name, id, webDir: web.webDir, devUrl: web.devUrl }));
    log.ok(`Wrote kiln.config.mjs ${c.dim(`(web tool: ${web.tool})`)}`);
  }

  pkg.scripts ??= {};
  const added: string[] = [];
  for (const [k, v] of Object.entries(SCRIPTS)) {
    if (!pkg.scripts[k]) {
      pkg.scripts[k] = v;
      added.push(k);
    }
  }
  if (added.length) {
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
    log.ok(`Added scripts: ${added.join(', ')}`);
  }

  const gi = path.join(root, '.gitignore');
  const giText = fs.existsSync(gi) ? fs.readFileSync(gi, 'utf8') : '';
  if (!/^\/?\.kiln\/?$/m.test(giText)) {
    fs.writeFileSync(gi, giText + (giText && !giText.endsWith('\n') ? '\n' : '') + '.kiln/\n');
    log.ok('Added .kiln/ to .gitignore');
  }

  if (flags.ci) {
    const wf = path.join(root, '.github', 'workflows', 'steam.yml');
    if (fs.existsSync(wf) && !flags.force) {
      log.ok('.github/workflows/steam.yml is already here');
    } else {
      fs.mkdirSync(path.dirname(wf), { recursive: true });
      fs.writeFileSync(wf, workflowTemplate(pm));
      log.ok('Wrote .github/workflows/steam.yml');
    }
  }

  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const installs: string[][] = [];
  if (!deps['@kiln/steam']) installs.push(addCmd(pm, ['@kiln/steam'], false));
  if (!deps['@kiln/cli']) installs.push(addCmd(pm, ['@kiln/cli'], true));

  if (installs.length && flags.install) {
    for (const cmd of installs) {
      log.step(cmd.join(' '));
      const r = spawnSync(cmd[0]!, cmd.slice(1), { stdio: 'inherit', cwd: root, shell: process.platform === 'win32' });
      if (r.status !== 0) throw new KilnError(`Install failed: ${cmd.join(' ')}`);
    }
  }

  log.plain();
  log.plain(c.bold('Next steps'));
  if (installs.length && !flags.install) for (const cmd of installs) log.info(c.cyan(cmd.join(' ')));
  log.info(`${c.cyan(`${pm} run desktop:dev`)}     open the game in a desktop window`);
  log.info(`${c.cyan(`${pm} run desktop:build`)}   make Windows, macOS and Linux builds`);
  log.info(`${c.cyan('kiln doctor')}             check the project before release`);
}

function addCmd(pm: string, pkgs: string[], dev: boolean): string[] {
  if (pm === 'npm') return ['npm', 'install', ...(dev ? ['-D'] : []), ...pkgs];
  if (pm === 'yarn' || pm === 'pnpm' || pm === 'bun') return [pm, 'add', ...(dev ? ['-D'] : []), ...pkgs];
  return ['npm', 'install', ...pkgs];
}

function titleCase(s: string): string {
  return s
    .replace(/^@[^/]+\//, '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ');
}
