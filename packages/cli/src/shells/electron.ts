import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import type { Platform, ResolvedConfig } from '../config.js';
import { copyDir, rmrf } from '../exec.js';
import { c, CartridgeError, log } from '../log.js';
import type { BuildResult, DevOptions, ShellAdapter } from './types.js';

const require = createRequire(import.meta.url);
// @cartridgejs/electron is CommonJS; load it with require.
const runtime = require('@cartridgejs/electron') as typeof import('@cartridgejs/electron');

type RuntimeConfig = import('@cartridgejs/electron').RuntimeConfig;

/** Which steamworks.js native folder each platform needs. */
const STEAMWORKS_DIST: Record<Platform, string> = { windows: 'win64', macos: 'osx', linux: 'linux64' };

export function runtimeConfig(config: ResolvedConfig, entry: RuntimeConfig['entry'], dev: boolean): RuntimeConfig {
  return {
    name: config.name,
    version: config.version,
    id: config.id,
    entry,
    window: config.window,
    steam: {
      appId: config.steam.appId,
      required: config.steam.required,
      restartThroughSteam: config.steam.restartThroughSteam,
      overlay: config.steam.overlay,
    },
    gpu: config.gpu,
    devtools: config.devtools,
    linuxNoSandbox: config.linux.noSandbox,
    preventSleep: config.preventSleep,
    dev,
  };
}

function macArch(config: ResolvedConfig): 'universal' | 'x64' | 'arm64' {
  const arch = config.macos.arch;
  if (arch === 'universal' && process.platform !== 'darwin') {
    log.warn('A universal macOS build needs a Mac (it uses `lipo`). This build is x64 only (Apple Silicon runs it with Rosetta).');
    log.info(c.dim('Build on macOS (for example a GitHub Actions macos runner) to get a universal app.'));
    return 'x64';
  }
  return arch;
}

/** Make the app folder that Electron Packager turns into a game. */
function stage(config: ResolvedConfig, platform: Platform, stageDir: string): void {
  rmrf(stageDir);
  fs.mkdirSync(path.join(stageDir, 'cartridge'), { recursive: true });

  fs.writeFileSync(
    path.join(stageDir, 'package.json'),
    JSON.stringify(
      {
        name: config.executableName,
        productName: config.name,
        version: config.version,
        author: config.publisher,
        private: true,
        main: 'cartridge/main.js',
      },
      null,
      2,
    ),
  );

  for (const f of runtime.runtimeFiles) {
    fs.copyFileSync(path.join(runtime.runtimeDir, f), path.join(stageDir, 'cartridge', f));
  }
  fs.writeFileSync(
    path.join(stageDir, 'cartridge', 'runtime.json'),
    JSON.stringify(runtimeConfig(config, { kind: 'dir', dir: 'game' }, false), null, 2),
  );

  copyDir(config.web.dir, path.join(stageDir, 'game'), (src) => !src.endsWith('.map'));

  // steamworks.js with only this platform's native files.
  const swSrc = runtime.steamworksDir();
  const swDest = path.join(stageDir, 'node_modules', 'steamworks.js');
  fs.mkdirSync(path.join(swDest, 'dist'), { recursive: true });
  for (const f of ['package.json', 'index.js', 'LICENSE']) {
    if (fs.existsSync(path.join(swSrc, f))) fs.copyFileSync(path.join(swSrc, f), path.join(swDest, f));
  }
  const dist = STEAMWORKS_DIST[platform];
  copyDir(path.join(swSrc, 'dist', dist), path.join(swDest, 'dist', dist), (src) => !src.endsWith('.lib'));
}

/** Remove Chromium UI language packs that the game does not need (Windows and Linux). */
function trimLocales(config: ResolvedConfig, appDir: string): void {
  if (config.locales === 'all') return;
  const dir = path.join(appDir, 'locales');
  if (!fs.existsSync(dir)) return;
  const keep = new Set([...config.locales, 'en-US'].map((l) => `${l}.pak`));
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith('.pak') && !keep.has(f)) fs.rmSync(path.join(dir, f));
  }
}

function launchExecutable(config: ResolvedConfig, platform: Platform, appDir: string): string {
  if (platform === 'windows') return `${config.executableName}.exe`;
  if (platform === 'linux') return config.executableName;
  const app = fs.readdirSync(appDir).find((f) => f.endsWith('.app'));
  return app ?? `${config.name}.app`;
}

function iconFor(config: ResolvedConfig, platform: Platform): string | undefined {
  if (!config.icon) return undefined;
  const ext = { windows: '.ico', macos: '.icns', linux: '.png' }[platform];
  const base = config.icon.replace(/\.(ico|icns|png)$/i, '');
  const file = base + ext;
  if (fs.existsSync(file)) return file;
  log.warn(`No ${path.basename(file)} found. The ${platform} build uses the default Electron icon.`);
  return undefined;
}

export const electronShell: ShellAdapter = {
  name: 'electron',

  version: () => `Electron ${runtime.electronVersion()}`,

  dev(config: ResolvedConfig, opts: DevOptions): Promise<number> {
    const devDir = path.join(config.outDir, 'dev');
    fs.mkdirSync(devDir, { recursive: true });
    const file = path.join(devDir, 'runtime.json');
    // A `dir` entry is relative to the runtime.json folder.
    const entry: RuntimeConfig['entry'] =
      opts.entry.kind === 'dir' ? { kind: 'dir', dir: path.relative(devDir, opts.entry.dir) } : opts.entry;
    fs.writeFileSync(file, JSON.stringify(runtimeConfig(config, entry, true), null, 2));

    const env: NodeJS.ProcessEnv = { ...process.env, CARTRIDGE_RUNTIME_CONFIG: file };
    if (opts.noSteam) env.CARTRIDGE_NO_STEAM = '1';
    delete env.ELECTRON_RUN_AS_NODE;

    const args = [runtime.mainFile, ...(process.env.CARTRIDGE_ELECTRON_ARGS?.split(' ').filter(Boolean) ?? [])];
    // Chromium refuses to start as root with its sandbox on (containers, some CI).
    if (process.platform === 'linux' && process.getuid?.() === 0) args.push('--no-sandbox');
    return new Promise((resolve, reject) => {
      const binary = runtime.devBinary({
        name: config.name,
        id: config.id,
        icon: config.icon ? config.icon.replace(/\.(ico|icns|png)$/i, '') + '.icns' : undefined,
        cacheDir: path.join(config.outDir, 'dev', 'mac-app'),
      });
      const child = spawn(binary, args, { stdio: 'inherit', env, cwd: config.root });
      child.on('error', reject);
      child.on('exit', (code) => resolve(code ?? 0));
      const stop = () => child.kill('SIGTERM');
      process.once('SIGINT', stop);
      process.once('SIGTERM', stop);
    });
  },

  async build(config: ResolvedConfig, platform: Platform): Promise<BuildResult> {
    const { packager } = (await import('@electron/packager')) as typeof import('@electron/packager');
    const stageDir = path.join(config.outDir, 'stage', platform);
    const tmpOut = path.join(config.outDir, 'stage', `${platform}-out`);
    const finalDir = path.join(config.outDir, 'build', platform);

    stage(config, platform, stageDir);
    rmrf(tmpOut);

    const arch = platform === 'macos' ? macArch(config) : 'x64';
    const electronPlatform = { windows: 'win32', macos: 'darwin', linux: 'linux' }[platform] as
      | 'win32'
      | 'darwin'
      | 'linux';

    const paths = await packager({
      dir: stageDir,
      out: tmpOut,
      platform: electronPlatform,
      arch,
      electronVersion: runtime.electronVersion(),
      name: config.name,
      executableName: config.executableName,
      appVersion: config.version,
      buildVersion: config.version,
      appBundleId: config.id,
      appCategoryType: config.macos.category,
      appCopyright: `© ${new Date().getFullYear()} ${config.publisher}`,
      icon: iconFor(config, platform),
      asar: { unpack: '**/node_modules/steamworks.js/dist/**' },
      // steamworks.js ships one .node file per Mac CPU and a universal libsteam_api.dylib.
      // They are the same in the x64 and arm64 builds, so copy them as they are (no lipo).
      osxUniversal: {
        x64ArchFiles: 'Contents/Resources/app.asar.unpacked/node_modules/steamworks.js/dist/osx/*',
      },
      prune: false,
      overwrite: true,
      quiet: true,
      derefSymlinks: true,
      win32metadata: {
        ProductName: config.name,
        CompanyName: config.publisher,
        FileDescription: config.name,
        InternalName: config.executableName,
        OriginalFilename: `${config.executableName}.exe`,
      },
    });

    if (!paths.length) throw new CartridgeError(`Electron Packager made no output for ${platform}.`);
    rmrf(finalDir);
    fs.mkdirSync(path.dirname(finalDir), { recursive: true });
    fs.renameSync(paths[0]!, finalDir);
    rmrf(tmpOut);
    if (platform !== 'macos') trimLocales(config, finalDir);

    return {
      platform,
      dir: finalDir,
      arch,
      launchExecutable: launchExecutable(config, platform, finalDir),
      // The Steam Linux Runtime container often blocks Chromium's sandbox helper.
      launchArguments: platform === 'linux' && config.linux.noSandbox ? '--no-sandbox' : undefined,
    };
  },
};
