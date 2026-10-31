/**
 * Used by the cartridge CLI (in Node, not in Electron) to find the shell files.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

export type { RuntimeConfig } from './config';

/** Folder with main.js and preload.js. */
export const runtimeDir = __dirname;
export const mainFile = path.join(__dirname, 'main.js');
export const preloadFile = path.join(__dirname, 'preload.js');

/** Files to copy into a packaged app's `cartridge/` folder. */
export const runtimeFiles = ['main.js', 'preload.js', 'steam.js', 'config.js'];

/** Folder of the installed steamworks.js package. */
export function steamworksDir(): string {
  return path.dirname(require.resolve('steamworks.js/package.json'));
}

/**
 * Path of the Electron binary (for `cartridge dev`). Downloads it when it is missing:
 * pnpm 10 (and `--ignore-scripts`) skip the electron package's postinstall step.
 */
export function electronBinary(): string {
  const pkgDir = path.dirname(require.resolve('electron/package.json'));
  const pathFile = path.join(pkgDir, 'path.txt');
  const ok = () => {
    if (!fs.existsSync(pathFile)) return false;
    return fs.existsSync(path.join(pkgDir, 'dist', fs.readFileSync(pathFile, 'utf8').trim()));
  };
  if (!ok()) {
    console.log(`[cartridge] Download Electron ${electronVersion()} (one time)…`);
    const r = spawnSync(process.execPath, [path.join(pkgDir, 'install.js')], { cwd: pkgDir, stdio: 'inherit' });
    if (r.status !== 0 || !ok()) {
      throw new Error('Could not download Electron. Check your network, then run `node node_modules/electron/install.js`.');
    }
  }
  // The `electron` package exports the binary path when required from Node.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('electron') as unknown as string;
}

export interface DevAppOptions {
  /** Name to show in the macOS menu bar and Dock. */
  name: string;
  /** Bundle id of the game. The dev app uses `<id>.dev`. */
  id: string;
  /** Path of an .icns file for the Dock, if any. */
  icon?: string;
  /** Folder for the dev app (it is made once and reused). */
  cacheDir: string;
}

function run(cmd: string, args: string[]): boolean {
  return spawnSync(cmd, args, { stdio: 'ignore' }).status === 0;
}

/**
 * The Electron binary to use for `cartridge dev` and `cartridge preview`.
 *
 * On macOS, the menu bar and the Dock show the name from the app bundle's
 * Info.plist, so the plain binary shows "Electron". There, this makes a copy of
 * Electron.app with the game's name, id and icon (an APFS clone, so it is fast
 * and uses almost no disk space), signs it ad hoc, and returns its binary.
 * On other systems, or when a step fails, it returns the plain Electron binary.
 */
export function devBinary(opts: DevAppOptions): string {
  const plain = electronBinary();
  if (process.platform !== 'darwin') return plain;

  const srcApp = path.resolve(path.dirname(plain), '..', '..');
  if (!srcApp.endsWith('.app')) return plain;

  const safeName = opts.name.replace(/[/:]/g, '-').trim() || 'Game';
  const destApp = path.join(opts.cacheDir, `${safeName}.app`);
  const binary = path.join(destApp, 'Contents', 'MacOS', path.basename(plain));
  const stampFile = path.join(opts.cacheDir, 'stamp.json');
  const iconMtime = opts.icon && fs.existsSync(opts.icon) ? fs.statSync(opts.icon).mtimeMs : 0;
  const stamp = JSON.stringify({ electron: electronVersion(), name: safeName, id: opts.id, icon: opts.icon, iconMtime, v: 1 });

  try {
    if (fs.existsSync(binary) && fs.existsSync(stampFile) && fs.readFileSync(stampFile, 'utf8') === stamp) {
      return binary;
    }

    fs.rmSync(opts.cacheDir, { recursive: true, force: true });
    fs.mkdirSync(opts.cacheDir, { recursive: true });
    // -c: APFS clone (copy-on-write). Fall back to a normal copy on other file systems.
    if (!run('cp', ['-Rc', srcApp, destApp]) && !run('cp', ['-R', srcApp, destApp])) {
      throw new Error('could not copy Electron.app');
    }

    const plist = path.join(destApp, 'Contents', 'Info.plist');
    for (const [key, value] of [
      ['CFBundleName', safeName],
      ['CFBundleDisplayName', safeName],
      ['CFBundleIdentifier', `${opts.id}.dev`],
    ] as const) {
      if (!run('plutil', ['-replace', key, '-string', value, plist])) throw new Error(`could not set ${key}`);
    }
    if (opts.icon && fs.existsSync(opts.icon)) {
      fs.copyFileSync(opts.icon, path.join(destApp, 'Contents', 'Resources', 'electron.icns'));
    }

    // The change to Info.plist breaks Electron's signature. Apple Silicon needs a valid one.
    if (!run('codesign', ['--force', '--deep', '--sign', '-', destApp])) throw new Error('could not sign the dev app');

    // Tell Launch Services about the new name and icon (not required, so ignore failures).
    run('/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister', ['-f', destApp]);

    fs.writeFileSync(stampFile, stamp);
    return binary;
  } catch (err) {
    console.warn(`[cartridge] Using plain Electron for dev (the menu bar will say "Electron"): ${(err as Error).message}`);
    fs.rmSync(opts.cacheDir, { recursive: true, force: true });
    return plain;
  }
}

export function electronVersion(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('electron/package.json') as { version: string }).version;
}
