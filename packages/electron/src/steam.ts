/**
 * Wraps steamworks.js and turns it into the method table of the kiln protocol.
 * When Steam is not available, every Steam method gives a safe empty result.
 * (The game-side library then uses its local fallback.)
 */
import type { KilnMethods, OverlayDialog, SteamStatus } from '@kiln/steam/protocol' with { 'resolution-mode': 'import' };
import type { RuntimeConfig } from './config';

type SteamClient = Omit<typeof import('steamworks.js/client'), 'init' | 'runCallbacks' | 'restartAppIfNecessary'>;
type SteamworksModule = typeof import('steamworks.js');

// Values of the `const enum`s in steamworks.js (const enums do not exist at runtime).
const DIALOG: Record<OverlayDialog, number> = {
  friends: 0,
  community: 1,
  players: 2,
  settings: 3,
  officialgamegroup: 4,
  stats: 5,
  achievements: 6,
};
const STORE_FLAG_NONE = 0;

export interface SteamHost {
  status: SteamStatus;
  client?: SteamClient;
}

let steamworks: SteamworksModule | undefined;
let loadError: string | undefined;

function load(): SteamworksModule | undefined {
  if (steamworks || loadError) return steamworks;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    steamworks = require('steamworks.js') as SteamworksModule;
  } catch (err) {
    loadError = `Could not load steamworks.js: ${(err as Error).message}`;
  }
  return steamworks;
}

/** Call before `app.whenReady()`: the overlay fix adds Chromium switches. */
export function prepareSteam(config: RuntimeConfig): void {
  if (!config.steam.appId || !config.steam.overlay) return;
  const sw = load();
  if (!sw) return;
  try {
    sw.electronEnableSteamOverlay();
  } catch (err) {
    console.warn('[kiln] Steam overlay setup failed:', (err as Error).message);
  }
}

/**
 * Returns true when the game must quit at once, because Steam will start it again.
 * This happens when a player opens the exe directly instead of from Steam.
 */
export function shouldRestartThroughSteam(config: RuntimeConfig, packaged: boolean): boolean {
  const appId = config.steam.appId;
  if (!appId || !packaged || config.dev || !config.steam.restartThroughSteam) return false;
  // Local test runs, and Valve's Spacewar test app, which you cannot launch from a library.
  if (process.env.KILN_NO_STEAM === '1' || appId === 480) return false;
  const sw = load();
  if (!sw) return false;
  try {
    return sw.restartAppIfNecessary(appId);
  } catch {
    return false;
  }
}

export function startSteam(config: RuntimeConfig): SteamHost {
  const base: SteamStatus = { available: false, shell: 'electron', appId: config.steam.appId };
  if (process.env.KILN_NO_STEAM === '1') {
    return { status: { ...base, reason: 'Steam is off (KILN_NO_STEAM=1)' } };
  }
  if (!config.steam.appId) {
    return { status: { ...base, reason: 'No steam.appId in the kiln config' } };
  }
  const sw = load();
  if (!sw) return { status: { ...base, reason: loadError } };
  try {
    const client = sw.init(config.steam.appId) as SteamClient;
    let isSteamDeck = false;
    let betaName: string | null = null;
    let language: string | undefined;
    try {
      isSteamDeck = client.utils.isSteamRunningOnSteamDeck();
      betaName = client.apps.currentBetaName();
      language = client.apps.currentGameLanguage();
    } catch {
      /* optional info */
    }
    return { client, status: { ...base, available: true, isSteamDeck, betaName, language } };
  } catch (err) {
    return {
      status: {
        ...base,
        reason: `Steam did not start (is the Steam client running and do you own app ${config.steam.appId}?): ${(err as Error).message}`,
      },
    };
  }
}

type SteamMethods = Pick<
  KilnMethods,
  | 'steam.status'
  | 'achievement.unlock'
  | 'achievement.isUnlocked'
  | 'achievement.clear'
  | 'stats.getInt'
  | 'stats.setInt'
  | 'stats.store'
  | 'cloud.isEnabled'
  | 'cloud.read'
  | 'cloud.write'
  | 'cloud.delete'
  | 'cloud.list'
  | 'user.get'
  | 'presence.set'
  | 'overlay.openUrl'
  | 'overlay.openDialog'
  | 'overlay.openStore'
>;

export function steamMethods(host: SteamHost): SteamMethods {
  const c = host.client;
  const appId = host.status.appId;
  return {
    'steam.status': () => host.status,
    'achievement.unlock': (id) => (c ? c.achievement.activate(String(id)) : false),
    'achievement.isUnlocked': (id) => (c ? c.achievement.isActivated(String(id)) : false),
    'achievement.clear': (id) => (c ? c.achievement.clear(String(id)) : false),
    'stats.getInt': (name) => (c ? c.stats.getInt(String(name)) : null),
    'stats.setInt': (name, value) => (c ? c.stats.setInt(String(name), Math.trunc(Number(value))) : false),
    'stats.store': () => (c ? c.stats.store() : false),
    'cloud.isEnabled': () => (c ? c.cloud.isEnabledForAccount() && c.cloud.isEnabledForApp() : false),
    'cloud.read': (name) => {
      if (!c || !c.cloud.fileExists(String(name))) return null;
      return c.cloud.readFile(String(name));
    },
    'cloud.write': (name, content) => (c ? c.cloud.writeFile(String(name), String(content)) : false),
    'cloud.delete': (name) => (c ? c.cloud.deleteFile(String(name)) : false),
    'cloud.list': () => (c ? c.cloud.listFiles().map((f) => ({ name: f.name, size: Number(f.size) })) : []),
    'user.get': () => {
      if (!c) return null;
      const id = c.localplayer.getSteamId();
      return {
        name: c.localplayer.getName(),
        steamId64: id.steamId64.toString(),
        accountId: id.accountId,
        level: c.localplayer.getLevel(),
      };
    },
    'presence.set': (key, value) => {
      c?.localplayer.setRichPresence(String(key), value == null ? undefined : String(value));
    },
    'overlay.openUrl': (url) => {
      c?.overlay.activateToWebPage(String(url));
    },
    'overlay.openDialog': (dialog) => {
      const d = DIALOG[dialog];
      if (c && d !== undefined) c.overlay.activateDialog(d as never);
    },
    'overlay.openStore': (id) => {
      const target = id ?? appId;
      if (c && target) c.overlay.activateToStore(target, STORE_FLAG_NONE as never);
    },
  };
}
