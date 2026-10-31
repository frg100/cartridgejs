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

export function electronVersion(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('electron/package.json') as { version: string }).version;
}
