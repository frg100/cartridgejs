import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { KilnError } from './log.js';

export type Platform = 'windows' | 'macos' | 'linux';
export const ALL_PLATFORMS: Platform[] = ['windows', 'macos', 'linux'];

/** The config that you write in `kiln.config.mjs` (or `.js` / `.json`). */
export interface KilnConfig {
  /** The game name that players see (window title, app name). */
  name: string;
  /** Reverse-DNS id, for example `com.mystudio.mygame`. */
  id?: string;
  /** Defaults to the `version` in package.json. */
  version?: string;
  /** Studio or developer name (Windows "Company", macOS copyright). Defaults to package.json `author`, then `name`. */
  publisher?: string;
  /** File name of the game executable, without extension. Defaults to a slug of `name`. */
  executableName?: string;
  /**
   * Icon path WITHOUT extension, for example `assets/icon`.
   * kiln uses `icon.ico` (Windows), `icon.icns` (macOS) and `icon.png` (Linux).
   */
  icon?: string;
  /** Desktop shell. Only `electron` is available now. */
  shell?: 'electron';

  web?: {
    /** Folder with the built game (must contain index.html). Default: `dist`. */
    dir?: string;
    /** Command that builds the game. Default: `<pm> run build` if that script exists. `false` to skip. */
    build?: string | false;
    /** Command that starts the dev server. Default: `<pm> run dev` if that script exists. `false` to skip. */
    dev?: string | false;
    /** URL of the dev server. Default: `http://localhost:5173` (Vite). */
    devUrl?: string;
  };

  window?: {
    width?: number;
    height?: number;
    minWidth?: number;
    minHeight?: number;
    fullscreen?: boolean;
    resizable?: boolean;
    backgroundColor?: string;
    fullscreenShortcuts?: boolean;
  };

  steam?: {
    /** Your Steam App ID. Use 480 (Spacewar) to test before you have one. */
    appId?: number;
    /** Depot IDs for each platform (from Steamworks › SteamPipe › Depots). */
    depots?: Partial<Record<Platform, number>>;
    /** Quit with an error when Steam does not start. Default: false. */
    required?: boolean;
    /** Restart through Steam when the exe opens directly. Default: true. */
    restartThroughSteam?: boolean;
    /** Apply the Electron fixes for the Steam overlay. Default: true. */
    overlay?: boolean;
  };

  /** Platforms that `kiln build` makes. Default: all three. */
  platforms?: Platform[];
  macos?: { arch?: 'universal' | 'x64' | 'arm64'; category?: string };
  linux?: { noSandbox?: boolean };
  gpu?: { ignoreBlocklist?: boolean };
  /**
   * Chromium UI languages to keep in Windows and Linux builds (for example ['en-US', 'de']).
   * Games draw their own text, so the default keeps only en-US and saves about 45 MB. Use 'all' to keep all.
   */
  locales?: string[] | 'all';
  /** Allow DevTools (F12) in release builds. Default: false. */
  devtools?: boolean;
  /** Keep the display awake while the game has focus. Default: true. */
  preventSleep?: boolean;
  /** Folder for all kiln output. Default: `.kiln`. */
  outDir?: string;
}

/** Helper for typed config files: `export default defineConfig({...})`. */
export function defineConfig(config: KilnConfig): KilnConfig {
  return config;
}

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

export interface ResolvedConfig {
  root: string;
  configFile: string;
  name: string;
  id: string;
  version: string;
  publisher: string;
  executableName: string;
  icon?: string;
  shell: 'electron';
  packageManager: PackageManager;
  web: { dir: string; build: string | false; dev: string | false; devUrl: string };
  window: Required<Omit<NonNullable<KilnConfig['window']>, 'minWidth' | 'minHeight'>> & {
    minWidth?: number;
    minHeight?: number;
  };
  steam: {
    appId?: number;
    depots: Partial<Record<Platform, number>>;
    required: boolean;
    restartThroughSteam: boolean;
    overlay: boolean;
  };
  platforms: Platform[];
  macos: { arch: 'universal' | 'x64' | 'arm64'; category: string };
  linux: { noSandbox: boolean };
  gpu: { ignoreBlocklist: boolean };
  locales: string[] | 'all';
  devtools: boolean;
  preventSleep: boolean;
  outDir: string;
}

export const CONFIG_FILES = ['kiln.config.mjs', 'kiln.config.js', 'kiln.config.cjs', 'kiln.config.json'];

export function findConfigFile(root: string): string | undefined {
  for (const f of CONFIG_FILES) {
    const p = path.join(root, f);
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

export function slugify(s: string): string {
  return (
    s
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'game'
  );
}

export function detectPackageManager(root: string): PackageManager {
  const ua = process.env.npm_config_user_agent ?? '';
  if (fs.existsSync(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(root, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(root, 'bun.lockb')) || fs.existsSync(path.join(root, 'bun.lock'))) return 'bun';
  if (fs.existsSync(path.join(root, 'package-lock.json'))) return 'npm';
  if (ua.startsWith('pnpm')) return 'pnpm';
  if (ua.startsWith('yarn')) return 'yarn';
  if (ua.startsWith('bun')) return 'bun';
  return 'npm';
}

export function readPackageJson(root: string): Record<string, any> | undefined {
  const p = path.join(root, 'package.json');
  if (!fs.existsSync(p)) return undefined;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

export async function loadUserConfig(file: string): Promise<KilnConfig> {
  if (file.endsWith('.json')) {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as KilnConfig;
  }
  // Cache-bust so that `kiln dev` restarts see config changes.
  const mod = await import(pathToFileURL(file).href + `?t=${Date.now()}`);
  const value = mod.default ?? mod;
  return (typeof value === 'function' ? await value() : value) as KilnConfig;
}

function isPositiveInt(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n > 0;
}

/** Fill in defaults and check the config. Pure (except reading package.json). */
export function resolveConfig(user: KilnConfig, root: string, configFile: string): ResolvedConfig {
  const problems: string[] = [];
  if (!user || typeof user !== 'object') throw new KilnError(`${configFile} must export a config object.`);
  if (!user.name || typeof user.name !== 'string') problems.push('`name` is required (the game name players see).');

  const pkg = readPackageJson(root) ?? {};
  const scripts: Record<string, string> = pkg.scripts ?? {};
  const pm = detectPackageManager(root);
  const run = (s: string) => (pm === 'npm' ? `npm run ${s}` : `${pm} run ${s}`);

  const name = user.name ?? 'Game';
  const slug = slugify(name);
  const version = user.version ?? pkg.version ?? '0.1.0';
  if (!/^\d+\.\d+\.\d+/.test(version)) problems.push(`\`version\` must look like 1.2.3 (got "${version}").`);

  const id = user.id ?? `com.kiln.${slug.replace(/-/g, '')}`;
  if (!/^[a-zA-Z][\w-]*(\.[a-zA-Z][\w-]*)+$/.test(id)) problems.push(`\`id\` must be reverse-DNS like com.studio.game (got "${id}").`);

  const executableName = user.executableName ?? slug;
  if (!/^[\w.-]+$/.test(executableName)) problems.push('`executableName` can contain only letters, digits, ".", "-" and "_".');

  const steam = user.steam ?? {};
  if (steam.appId !== undefined && !isPositiveInt(steam.appId)) problems.push('`steam.appId` must be a positive integer.');
  for (const [p, d] of Object.entries(steam.depots ?? {})) {
    if (!ALL_PLATFORMS.includes(p as Platform)) problems.push(`\`steam.depots.${p}\`: unknown platform (use windows, macos, linux).`);
    if (!isPositiveInt(d)) problems.push(`\`steam.depots.${p}\` must be a positive integer.`);
  }

  const platforms = user.platforms ?? ALL_PLATFORMS;
  for (const p of platforms) {
    if (!ALL_PLATFORMS.includes(p)) problems.push(`\`platforms\`: unknown platform "${p}" (use windows, macos, linux).`);
  }

  if (user.shell && user.shell !== 'electron') problems.push(`\`shell\`: "${user.shell}" is not available yet. Use "electron".`);

  if (problems.length) {
    throw new KilnError(`Problems in ${path.basename(configFile)}:\n  - ${problems.join('\n  - ')}`);
  }

  const w = user.window ?? {};
  return {
    root,
    configFile,
    name,
    id,
    version,
    publisher:
      user.publisher ?? (typeof pkg.author === 'string' ? pkg.author.replace(/\s*[<(].*$/, '') : pkg.author?.name) ?? name,
    executableName,
    icon: user.icon ? path.resolve(root, user.icon) : undefined,
    shell: 'electron',
    packageManager: pm,
    web: {
      dir: path.resolve(root, user.web?.dir ?? 'dist'),
      build: user.web?.build ?? (scripts.build ? run('build') : false),
      dev: user.web?.dev ?? (scripts.dev ? run('dev') : false),
      devUrl: user.web?.devUrl ?? 'http://localhost:5173',
    },
    window: {
      width: w.width ?? 1280,
      height: w.height ?? 720,
      minWidth: w.minWidth,
      minHeight: w.minHeight,
      fullscreen: w.fullscreen ?? false,
      resizable: w.resizable ?? true,
      backgroundColor: w.backgroundColor ?? '#000000',
      fullscreenShortcuts: w.fullscreenShortcuts ?? true,
    },
    steam: {
      appId: steam.appId,
      depots: steam.depots ?? {},
      required: steam.required ?? false,
      restartThroughSteam: steam.restartThroughSteam ?? true,
      overlay: steam.overlay ?? true,
    },
    platforms: [...new Set(platforms)],
    macos: { arch: user.macos?.arch ?? 'universal', category: user.macos?.category ?? 'public.app-category.games' },
    linux: { noSandbox: user.linux?.noSandbox ?? true },
    gpu: { ignoreBlocklist: user.gpu?.ignoreBlocklist ?? true },
    locales: user.locales ?? ['en-US'],
    devtools: user.devtools ?? false,
    preventSleep: user.preventSleep ?? true,
    outDir: path.resolve(root, user.outDir ?? '.kiln'),
  };
}

export async function loadConfig(root = process.cwd()): Promise<ResolvedConfig> {
  const file = findConfigFile(root);
  if (!file) {
    throw new KilnError(`No kiln config found in ${root}.`, 'Run `kiln init` to make one.');
  }
  return resolveConfig(await loadUserConfig(file), root, file);
}
