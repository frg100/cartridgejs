/**
 * Electron main process for a kiln game.
 *
 * It reads the runtime config, starts Steam, serves the game from the
 * `app://game/` protocol (so ES modules, fetch() and workers act the same as
 * on a web server), and opens one game window.
 */
import { app, BrowserWindow, ipcMain, Menu, net, powerSaveBlocker, protocol, shell, dialog } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { KilnMethods } from '@kiln/steam/protocol' with { 'resolution-mode': 'import' };
import type { RuntimeConfig } from './config';
import { prepareSteam, shouldRestartThroughSteam, startSteam, steamMethods } from './steam';

const IPC_CHANNEL = 'kiln:invoke';
const SCHEME = 'app';
const HOST = 'game';

function loadConfig(): { config: RuntimeConfig; baseDir: string } {
  const file = process.env.KILN_RUNTIME_CONFIG ?? path.join(__dirname, 'runtime.json');
  const config = JSON.parse(fs.readFileSync(file, 'utf8')) as RuntimeConfig;
  // In a packaged app, `entry.dir` is relative to the app root (the parent of kiln/).
  const baseDir = process.env.KILN_RUNTIME_CONFIG ? path.dirname(file) : path.resolve(__dirname, '..');
  return { config, baseDir };
}

const { config, baseDir } = loadConfig();

// ---------------------------------------------------------------------------
// Things that must happen before `ready`
// ---------------------------------------------------------------------------

app.setName(config.name);
if (process.platform === 'linux' && config.linuxNoSandbox) app.commandLine.appendSwitch('no-sandbox');
if (config.gpu.ignoreBlocklist) app.commandLine.appendSwitch('ignore-gpu-blocklist');

if (shouldRestartThroughSteam(config, app.isPackaged)) {
  app.exit(0);
}

if (!app.requestSingleInstanceLock()) {
  app.exit(0);
}

prepareSteam(config);

protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
  },
]);

// ---------------------------------------------------------------------------

let win: BrowserWindow | undefined;

function gameRoot(): string | undefined {
  return config.entry.kind === 'dir' ? path.resolve(baseDir, config.entry.dir) : undefined;
}

function registerGameProtocol(root: string): void {
  protocol.handle(SCHEME, async (request) => {
    const url = new URL(request.url);
    if (url.host !== HOST) return new Response('Not found', { status: 404 });
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.resolve(root, '.' + rel);
    if (file !== root && !file.startsWith(root + path.sep)) {
      return new Response('Forbidden', { status: 403 });
    }
    try {
      const stat = await fs.promises.stat(file);
      if (!stat.isFile()) return new Response('Not found', { status: 404 });
    } catch {
      return new Response('Not found', { status: 404 });
    }
    return net.fetch(pathToFileURL(file).toString());
  });
}

function startUrl(): string {
  return config.entry.kind === 'url' ? config.entry.url : `${SCHEME}://${HOST}/`;
}

function isOwnUrl(target: string): boolean {
  try {
    const u = new URL(target);
    const start = new URL(startUrl());
    return u.origin === start.origin;
  } catch {
    return false;
  }
}

function openExternal(target: string): void {
  if (/^https?:\/\//i.test(target)) void shell.openExternal(target);
}

function setMenu(): void {
  if (process.platform === 'darwin') {
    // macOS needs a menu for Cmd+Q, Cmd+H and copy/paste to work.
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }]),
    );
  } else {
    Menu.setApplicationMenu(null);
  }
}

function createWindow(): BrowserWindow {
  const w = config.window;
  const devtools = config.devtools || config.dev || process.argv.includes('--kiln-devtools');
  const bw = new BrowserWindow({
    title: config.name,
    width: w.width,
    height: w.height,
    minWidth: w.minWidth,
    minHeight: w.minHeight,
    resizable: w.resizable,
    fullscreen: w.fullscreen,
    backgroundColor: w.backgroundColor,
    show: false,
    autoHideMenuBar: true,
    useContentSize: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      devTools: devtools,
      spellcheck: false,
    },
  });

  bw.once('ready-to-show', () => bw.show());

  bw.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });
  bw.webContents.on('will-navigate', (event, url) => {
    if (!isOwnUrl(url)) {
      event.preventDefault();
      openExternal(url);
    }
  });

  bw.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const toggleFs =
      w.fullscreenShortcuts && (input.key === 'F11' || (input.alt && input.key === 'Enter'));
    if (toggleFs) {
      event.preventDefault();
      bw.setFullScreen(!bw.isFullScreen());
      return;
    }
    if (devtools && (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i'))) {
      event.preventDefault();
      bw.webContents.toggleDevTools();
    }
  });

  if (config.preventSleep) {
    let blocker: number | undefined;
    bw.on('focus', () => {
      if (blocker === undefined) blocker = powerSaveBlocker.start('prevent-display-sleep');
    });
    bw.on('blur', () => {
      if (blocker !== undefined) powerSaveBlocker.stop(blocker);
      blocker = undefined;
    });
  }

  void bw.loadURL(startUrl());
  return bw;
}

app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

app.on('window-all-closed', () => app.quit());

void app.whenReady().then(async () => {
  setMenu();

  const steamHost = startSteam(config);
  if (steamHost.status.available) {
    console.log(`[kiln] Steam ready (app ${config.steam.appId})`);
  } else {
    console.log(`[kiln] Steam not available: ${steamHost.status.reason}`);
    if (config.steam.required && !config.dev) {
      await dialog.showMessageBox({
        type: 'error',
        title: config.name,
        message: 'Steam must be running to play this game.',
        detail: steamHost.status.reason,
      });
      app.exit(1);
      return;
    }
  }

  const root = gameRoot();
  if (root) registerGameProtocol(root);

  const methods: KilnMethods = {
    ...steamMethods(steamHost),
    'app.quit': () => {
      setImmediate(() => app.quit());
    },
    'app.setFullscreen': (on) => win?.setFullScreen(!!on),
    'app.isFullscreen': () => win?.isFullScreen() ?? false,
    'app.info': () => ({
      name: config.name,
      version: config.version,
      packaged: app.isPackaged,
      platform: process.platform,
    }),
  };

  ipcMain.handle(IPC_CHANNEL, (event, method: unknown, args: unknown) => {
    if (!win || event.sender !== win.webContents) throw new Error('kiln: unknown sender');
    if (typeof method !== 'string' || !Object.prototype.hasOwnProperty.call(methods, method)) {
      throw new Error(`kiln: unknown method ${String(method)}`);
    }
    const fn = methods[method as keyof KilnMethods] as (...a: unknown[]) => unknown;
    return fn(...(Array.isArray(args) ? args : []));
  });

  win = createWindow();
  win.on('closed', () => {
    win = undefined;
  });
});
