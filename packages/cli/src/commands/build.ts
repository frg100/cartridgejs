import * as fs from 'node:fs';
import * as path from 'node:path';
import { ALL_PLATFORMS, loadConfig, type Platform } from '../config.js';
import { dirSize, formatBytes, rmrf, runShell } from '../exec.js';
import { c, CartridgeError, log } from '../log.js';
import { getShell } from '../shells/index.js';
import type { BuildResult } from '../shells/types.js';

export interface BuildFlags {
  platforms?: Platform[];
  skipWeb: boolean;
}

export function parsePlatforms(value: string | undefined): Platform[] | undefined {
  if (!value) return undefined;
  const aliases: Record<string, Platform> = {
    win: 'windows', windows: 'windows', win32: 'windows',
    mac: 'macos', macos: 'macos', darwin: 'macos', osx: 'macos',
    linux: 'linux',
  };
  if (value === 'all') return [...ALL_PLATFORMS];
  return value.split(',').map((v) => {
    const p = aliases[v.trim().toLowerCase()];
    if (!p) throw new CartridgeError(`Unknown platform "${v}". Use windows, macos, linux or all.`);
    return p;
  });
}

export async function build(flags: BuildFlags): Promise<BuildResult[]> {
  const config = await loadConfig();
  const shell = getShell(config);
  const platforms = flags.platforms ?? config.platforms;

  if (!flags.skipWeb && config.web.build) {
    log.step(`Build web game: ${c.dim(config.web.build)}`);
    await runShell(config.web.build, config.root);
  }

  const index = path.join(config.web.dir, 'index.html');
  if (!fs.existsSync(index)) {
    throw new CartridgeError(
      `No index.html in ${path.relative(config.root, config.web.dir) || '.'}/.`,
      'Check `web.dir` and `web.build` in the cartridge config.',
    );
  }
  const html = fs.readFileSync(index, 'utf8');
  if (/(src|href)=["']https?:\/\//i.test(html)) {
    log.warn('index.html loads files from the internet. Players without a connection will see a broken game. Bundle all assets.');
  }

  const results: BuildResult[] = [];
  for (const platform of platforms) {
    log.step(`Package ${c.bold(platform)} with ${shell.version()}…`);
    const started = Date.now();
    const result = await shell.build(config, platform);
    results.push(result);
    log.ok(
      `${platform}: ${path.relative(config.root, result.dir)}/ ${c.dim(`(${result.arch}, ${formatBytes(dirSize(result.dir))}, ${((Date.now() - started) / 1000).toFixed(1)}s)`)}`,
    );
  }
  rmrf(path.join(config.outDir, 'stage'));

  log.plain();
  log.plain(c.bold('Steamworks launch options') + c.dim(' (App Admin › Installation › General)'));
  for (const r of results) {
    const argsText = r.launchArguments ? `   Arguments: ${c.cyan(r.launchArguments)}` : '';
    log.info(`${r.platform.padEnd(8)} Executable: ${c.cyan(r.launchExecutable)}${argsText}`);
  }
  log.plain();
  log.info(`Next: ${c.cyan('cartridge upload')} to send the build to Steam.`);
  return results;
}
