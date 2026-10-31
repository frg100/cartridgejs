import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadConfig } from '../config.js';
import { isUp, killTree, runShell, startShell, waitForUrl } from '../exec.js';
import { c, KilnError, log } from '../log.js';
import { getShell } from '../shells/index.js';

export interface DevFlags {
  noSteam: boolean;
  url?: string;
}

/** `kiln dev`: start the web dev server and open it in the desktop shell. */
export async function dev(flags: DevFlags): Promise<number> {
  const config = await loadConfig();
  const shell = getShell(config);
  const url = flags.url ?? config.web.devUrl;

  let server: ReturnType<typeof startShell> | undefined;
  let serverExited = false;

  if (await isUp(url)) {
    log.ok(`Dev server is already running at ${c.bold(url)}`);
  } else if (config.web.dev) {
    log.step(`Start dev server: ${c.dim(config.web.dev)}`);
    server = startShell(config.web.dev, config.root);
    server.on('exit', () => (serverExited = true));
    try {
      await waitForUrl(url, 60_000, () => serverExited);
    } catch (err) {
      killTree(server);
      throw err;
    }
    log.ok(`Dev server ready at ${c.bold(url)}`);
  } else {
    throw new KilnError(
      `Nothing answers at ${url}, and there is no dev command.`,
      'Add a "dev" script to package.json, or set `web.dev` in the kiln config.',
    );
  }

  const cleanup = () => killTree(server);
  process.once('exit', cleanup);

  log.step(`Open ${c.bold(config.name)} in ${shell.version()}${flags.noSteam ? c.dim(' (Steam off)') : ''}`);
  log.info(c.dim('F11 or Alt+Enter: fullscreen · F12: DevTools · close the window to stop'));
  try {
    return await shell.dev(config, { entry: { kind: 'url', url }, noSteam: flags.noSteam });
  } finally {
    cleanup();
  }
}

export interface PreviewFlags {
  noSteam: boolean;
  build: boolean;
}

/** `kiln preview`: run the production web build in the desktop shell (no packaging). */
export async function preview(flags: PreviewFlags): Promise<number> {
  const config = await loadConfig();
  const shell = getShell(config);
  if (flags.build && config.web.build) {
    log.step(`Build web game: ${c.dim(config.web.build)}`);
    await runShell(config.web.build, config.root);
  }
  if (!fs.existsSync(path.join(config.web.dir, 'index.html'))) {
    throw new KilnError(`No index.html in ${path.relative(config.root, config.web.dir) || '.'}.`, 'Build the web game first, or check `web.dir`.');
  }
  log.step(`Preview ${c.bold(config.name)} from ${path.relative(config.root, config.web.dir)}/`);
  return shell.dev(config, { entry: { kind: 'dir', dir: config.web.dir }, noSteam: flags.noSteam });
}
