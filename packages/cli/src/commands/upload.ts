import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadConfig, type Platform } from '../config.js';
import { which } from '../exec.js';
import { c, CartridgeError, log } from '../log.js';
import { planUpload, writePlan } from '../steampipe.js';

export interface UploadFlags {
  platforms?: Platform[];
  branch?: string;
  description?: string;
  user?: string;
  dryRun: boolean;
  preview: boolean;
}

export function findSteamcmd(): string | undefined {
  const env = process.env.STEAMCMD;
  if (env && fs.existsSync(env)) return env;
  return which('steamcmd') ?? which('steamcmd.sh');
}

export async function upload(flags: UploadFlags): Promise<void> {
  const config = await loadConfig();
  const description =
    flags.description ?? `${config.name} ${config.version} (cartridge, ${new Date().toISOString().slice(0, 16).replace('T', ' ')})`;

  const plan = planUpload(config, {
    description,
    branch: flags.branch,
    platforms: flags.platforms,
    preview: flags.preview,
  });
  writePlan(plan);

  log.step(`Upload plan for app ${c.bold(String(config.steam.appId))}`);
  for (const d of plan.depots) {
    log.info(`${d.platform.padEnd(8)} depot ${d.depotId}  ←  ${path.relative(config.root, d.contentRoot)}/`);
  }
  log.info(`Branch: ${flags.branch ? c.cyan(flags.branch) : c.dim('none (set it live by hand in Steamworks)')}`);
  log.info(`Script: ${path.relative(config.root, plan.appBuildFile)}`);

  if (flags.branch === 'default') {
    log.warn('Steam usually does not allow steamcmd to set the "default" branch live. Use a beta branch, then promote it in Steamworks.');
  }

  if (flags.dryRun) {
    log.plain();
    for (const f of plan.files) {
      log.plain(c.dim(`--- ${path.relative(config.root, f.path)}`));
      log.plain(f.content);
    }
    log.ok('Dry run: the scripts are written. Nothing was uploaded.');
    return;
  }

  const steamcmd = findSteamcmd();
  if (!steamcmd) {
    throw new CartridgeError(
      'steamcmd is not installed.',
      'Install it (https://developer.valvesoftware.com/wiki/SteamCMD) or set the STEAMCMD env var to its path.',
    );
  }
  const user = flags.user ?? process.env.STEAM_USERNAME;
  if (!user) {
    throw new CartridgeError(
      'No Steam user name.',
      'Use `--user <name>` or set STEAM_USERNAME. Use a builder account that has only upload rights.',
    );
  }

  log.step(`Run steamcmd as ${c.bold(user)} ${c.dim('(Steam Guard may ask for a code the first time)')}`);
  const args = ['+login', user];
  if (process.env.STEAM_PASSWORD) args.push(process.env.STEAM_PASSWORD);
  args.push('+run_app_build', path.resolve(plan.appBuildFile), '+quit');

  const code = await new Promise<number>((resolve, reject) => {
    const child = spawn(steamcmd, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });
  if (code !== 0) {
    throw new CartridgeError(
      `steamcmd failed (exit ${code}).`,
      `Look at the logs in ${path.relative(config.root, path.join(path.dirname(plan.appBuildFile), 'output'))}/`,
    );
  }
  log.ok('Upload complete. See the build in Steamworks › SteamPipe › Builds.');
}
