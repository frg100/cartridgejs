import * as fs from 'node:fs';
import * as path from 'node:path';
import { findConfigFile, loadConfig, readPackageJson } from '../config.js';
import { c, log } from '../log.js';
import { getShell } from '../shells/index.js';
import { builtPlatforms } from '../steampipe.js';
import { findSteamcmd } from './upload.js';

type Level = 'ok' | 'warn' | 'error';

/** `cartridge doctor`: check the project before a release. Returns the number of errors. */
export async function doctor(): Promise<number> {
  const root = process.cwd();
  const checks: { level: Level; msg: string; hint?: string }[] = [];
  const add = (level: Level, msg: string, hint?: string) => checks.push({ level, msg, hint });

  const major = Number(process.versions.node.split('.')[0]);
  add(major >= 20 ? 'ok' : 'error', `Node.js ${process.versions.node}`, major >= 20 ? undefined : 'cartridge needs Node.js 20 or newer.');

  if (!findConfigFile(root)) {
    add('error', 'No cartridge config', 'Run `cartridge init`.');
    return report(checks);
  }

  let config;
  try {
    config = await loadConfig(root);
    add('ok', `Config: ${path.basename(config.configFile)} (${config.name} ${config.version}, ${config.id})`);
  } catch (err) {
    add('error', (err as Error).message);
    return report(checks);
  }

  add('ok', `Shell: ${getShell(config).version()}`);

  const pkg = readPackageJson(root);
  const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };
  if (deps['@cartridgejs/steam']) add('ok', '@cartridgejs/steam is installed');
  else add('warn', '@cartridgejs/steam is not a dependency', 'Install it to use achievements, cloud saves and the overlay.');

  const rel = (p: string) => path.relative(root, p) || '.';
  if (config.web.build) add('ok', `Web build command: ${config.web.build}`);
  else add('warn', 'No web build command', 'Add a "build" script or set `web.build`. cartridge will package the folder as it is.');
  if (fs.existsSync(path.join(config.web.dir, 'index.html'))) add('ok', `Built game found in ${rel(config.web.dir)}/`);
  else add('warn', `No index.html in ${rel(config.web.dir)}/ yet`, 'Run `cartridge build`; it builds the web game first.');

  const appId = config.steam.appId;
  if (!appId) add('warn', 'No steam.appId', 'Set 480 (Spacewar) to test Steam features before you have an App ID.');
  else if (appId === 480) add('warn', 'steam.appId is 480 (Spacewar test app)', 'Change it to your own App ID before you upload.');
  else add('ok', `Steam App ID ${appId}`);

  for (const p of config.platforms) {
    const d = config.steam.depots[p];
    if (d) add('ok', `Depot for ${p}: ${d}`);
    else add('warn', `No depot for ${p}`, `Set steam.depots.${p} before you upload.`);
  }

  if (config.icon) {
    for (const [p, ext] of [['windows', '.ico'], ['macos', '.icns'], ['linux', '.png']] as const) {
      if (!config.platforms.includes(p)) continue;
      const f = config.icon.replace(/\.(ico|icns|png)$/i, '') + ext;
      if (fs.existsSync(f)) add('ok', `Icon for ${p}: ${rel(f)}`);
      else add('warn', `No ${ext} icon for ${p}`, `Add ${rel(f)}.`);
    }
  } else {
    add('warn', 'No icon', 'Set `icon` to a path without extension (icon.ico, icon.icns, icon.png).');
  }

  const built = builtPlatforms(config);
  add(built.length ? 'ok' : 'warn', built.length ? `Builds: ${built.join(', ')}` : 'No builds yet', built.length ? undefined : 'Run `cartridge build`.');

  const steamcmd = findSteamcmd();
  if (steamcmd) add('ok', `steamcmd: ${steamcmd}`);
  else add('warn', 'steamcmd not found', 'Needed only for `cartridge upload`. Set STEAMCMD or add it to PATH.');

  if (config.devtools) add('warn', 'devtools is on for release builds', 'Players can open DevTools with F12.');
  if (config.platforms.includes('macos')) {
    add('warn', 'macOS builds are not signed or notarized by cartridge yet', 'Steam starts unsigned apps, but sign them if you can.');
    add('warn', 'No in-game Steam overlay on macOS (Electron limit)', 'Achievements, stats and cloud saves work. Overlay calls open in the Steam window. See docs/steam-api.md#overlay.');
  }

  return report(checks);
}

function report(checks: { level: Level; msg: string; hint?: string }[]): number {
  for (const ch of checks) {
    if (ch.level === 'ok') log.ok(ch.msg);
    else if (ch.level === 'warn') log.warn(ch.msg);
    else log.error(ch.msg);
    if (ch.hint) log.info(c.dim(ch.hint));
  }
  const errors = checks.filter((x) => x.level === 'error').length;
  const warns = checks.filter((x) => x.level === 'warn').length;
  log.plain();
  log.plain(errors ? c.red(`${errors} error(s), ${warns} warning(s)`) : c.green(`No errors · ${warns} warning(s)`));
  return errors;
}
