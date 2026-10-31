/**
 * @kiln/steam — the only Steam import your game needs.
 *
 *   import { steam } from '@kiln/steam';
 *   const status = await steam.ready();
 *   steam.achievements.unlock('FIRST_WIN');
 *
 * Inside the kiln desktop shell, calls go to the real Steamworks API.
 * In a normal browser (or when Steam is not running), calls fall back to
 * localStorage, so the same build works on the web and in local tests.
 */
import type {
  CloudFile,
  KilnBridge,
  KilnMethod,
  KilnMethods,
  OverlayDialog,
  SteamStatus,
  SteamUser,
} from './protocol.js';

export type { CloudFile, OverlayDialog, SteamStatus, SteamUser, ShellName } from './protocol.js';

const PREFIX = 'kiln:';

function bridge(): KilnBridge | undefined {
  return typeof window !== 'undefined' ? window.__kiln : undefined;
}

// ---------------------------------------------------------------------------
// Local fallback (browser, or desktop shell without Steam)
// ---------------------------------------------------------------------------

const memory = new Map<string, string>();

const store = {
  get(key: string): string | null {
    try {
      return globalThis.localStorage?.getItem(PREFIX + key) ?? memory.get(key) ?? null;
    } catch {
      return memory.get(key) ?? null;
    }
  },
  set(key: string, value: string): void {
    memory.set(key, value);
    try {
      globalThis.localStorage?.setItem(PREFIX + key, value);
    } catch {
      /* private mode or quota: memory copy is enough */
    }
  },
  remove(key: string): void {
    memory.delete(key);
    try {
      globalThis.localStorage?.removeItem(PREFIX + key);
    } catch {
      /* ignore */
    }
  },
  keys(prefix: string): string[] {
    const out = new Set<string>();
    for (const k of memory.keys()) if (k.startsWith(prefix)) out.add(k);
    try {
      const ls = globalThis.localStorage;
      if (ls) {
        for (let i = 0; i < ls.length; i++) {
          const k = ls.key(i);
          if (k && k.startsWith(PREFIX + prefix)) out.add(k.slice(PREFIX.length));
        }
      }
    } catch {
      /* ignore */
    }
    return [...out];
  },
};

function readJson<T>(key: string, fallback: T): T {
  const raw = store.get(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const local: { [M in KilnMethod]: (...args: Parameters<KilnMethods[M]>) => ReturnType<KilnMethods[M]> } = {
  'steam.status': () => ({
    available: false,
    shell: bridge() ? 'electron' : 'browser',
    reason: bridge() ? 'Steam did not start' : 'Not running in a kiln desktop shell',
  }),
  'achievement.unlock': (id) => {
    const set = readJson<string[]>('achievements', []);
    if (!set.includes(id)) set.push(id);
    store.set('achievements', JSON.stringify(set));
    return true;
  },
  'achievement.isUnlocked': (id) => readJson<string[]>('achievements', []).includes(id),
  'achievement.clear': (id) => {
    const set = readJson<string[]>('achievements', []).filter((a) => a !== id);
    store.set('achievements', JSON.stringify(set));
    return true;
  },
  'stats.getInt': (name) => {
    const v = readJson<Record<string, number>>('stats', {})[name];
    return typeof v === 'number' ? v : null;
  },
  'stats.setInt': (name, value) => {
    const stats = readJson<Record<string, number>>('stats', {});
    stats[name] = Math.trunc(value);
    store.set('stats', JSON.stringify(stats));
    return true;
  },
  'stats.store': () => true,
  'cloud.isEnabled': () => false,
  'cloud.read': (name) => store.get('cloud:' + name),
  'cloud.write': (name, content) => {
    store.set('cloud:' + name, content);
    return true;
  },
  'cloud.delete': (name) => {
    store.remove('cloud:' + name);
    return true;
  },
  'cloud.list': () =>
    store.keys('cloud:').map((k) => ({ name: k.slice('cloud:'.length), size: (store.get(k) ?? '').length })),
  'user.get': () => null,
  'presence.set': () => undefined,
  'overlay.openUrl': (url) => {
    if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener');
  },
  'overlay.openDialog': () => undefined,
  'overlay.openStore': () => undefined,
  'app.quit': () => {
    if (typeof window !== 'undefined') window.close();
  },
  'app.setFullscreen': (on) => {
    if (typeof document === 'undefined') return;
    if (on) void document.documentElement.requestFullscreen?.().catch(() => undefined);
    else if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => undefined);
  },
  'app.isFullscreen': () => typeof document !== 'undefined' && !!document.fullscreenElement,
  'app.info': () => ({ name: typeof document !== 'undefined' ? document.title : '', version: '0.0.0', packaged: false, platform: 'web' }),
};

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

/** Methods that must use the local fallback when Steam is not available. */
const STEAM_ONLY = new Set<KilnMethod>([
  'achievement.unlock',
  'achievement.isUnlocked',
  'achievement.clear',
  'stats.getInt',
  'stats.setInt',
  'stats.store',
  'cloud.isEnabled',
  'cloud.read',
  'cloud.write',
  'cloud.delete',
  'cloud.list',
  'user.get',
  'presence.set',
  'overlay.openUrl',
  'overlay.openDialog',
  'overlay.openStore',
]);

let statusPromise: Promise<SteamStatus> | undefined;

function ready(): Promise<SteamStatus> {
  if (!statusPromise) {
    const b = bridge();
    statusPromise = b
      ? b.invoke('steam.status').catch((err: unknown) => ({
          available: false,
          shell: 'electron' as const,
          reason: String(err),
        }))
      : Promise.resolve(local['steam.status']());
  }
  return statusPromise;
}

async function call<M extends KilnMethod>(
  method: M,
  ...args: Parameters<KilnMethods[M]>
): Promise<ReturnType<KilnMethods[M]>> {
  const b = bridge();
  if (b) {
    const status = await ready();
    if (status.available || !STEAM_ONLY.has(method)) {
      return b.invoke(method, ...args);
    }
  }
  const fn = local[method] as (...a: Parameters<KilnMethods[M]>) => ReturnType<KilnMethods[M]>;
  return fn(...args);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const steam = {
  /** Resolves when the shell reports its Steam status. Safe to call many times. */
  ready,

  /** True when the game runs inside a kiln desktop shell (with or without Steam). */
  get isDesktop(): boolean {
    return !!bridge();
  },

  achievements: {
    /** Unlock an achievement (the API name from Steamworks). Steam shows the popup. */
    unlock: (id: string) => call('achievement.unlock', id),
    isUnlocked: (id: string) => call('achievement.isUnlocked', id),
    /** Lock an achievement again. Use this only for testing. */
    clear: (id: string) => call('achievement.clear', id),
  },

  stats: {
    getInt: (name: string) => call('stats.getInt', name),
    /** Set a stat. Call `stats.store()` to send changes to Steam. */
    setInt: (name: string, value: number) => call('stats.setInt', name, value),
    store: () => call('stats.store'),
  },

  cloud: {
    /** True when Steam Cloud is on for both the account and the app. */
    isEnabled: () => call('cloud.isEnabled'),
    read: (name: string) => call('cloud.read', name),
    write: (name: string, content: string) => call('cloud.write', name, content),
    delete: (name: string) => call('cloud.delete', name),
    list: (): Promise<CloudFile[]> => call('cloud.list'),
    async readJson<T>(name: string): Promise<T | null> {
      const raw = await call('cloud.read', name);
      if (raw == null) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    },
    writeJson: (name: string, value: unknown) => call('cloud.write', name, JSON.stringify(value)),
  },

  user: {
    /** The signed-in Steam user, or null when Steam is not available. */
    get: (): Promise<SteamUser | null> => call('user.get'),
  },

  presence: {
    /** Set Steam rich presence. Pass no value to clear the key. */
    set: (key: string, value?: string | null) => call('presence.set', key, value),
  },

  overlay: {
    openUrl: (url: string) => call('overlay.openUrl', url),
    openDialog: (dialog: OverlayDialog) => call('overlay.openDialog', dialog),
    /** Open the Steam store page. Defaults to this game. */
    openStore: (appId?: number) => call('overlay.openStore', appId),
  },

  app: {
    quit: () => call('app.quit'),
    setFullscreen: (on: boolean) => call('app.setFullscreen', on),
    isFullscreen: () => call('app.isFullscreen'),
    info: () => call('app.info'),
  },
};

export default steam;

/** Reset cached state. For tests only. */
export function __resetForTests(): void {
  statusPromise = undefined;
  memory.clear();
}
