/**
 * The contract between the game (renderer) and the desktop shell (main process).
 *
 * The shell's preload script exposes `window.__cartridge` with this shape. Every shell
 * adapter (Electron today, Tauri later) must implement the same methods, so that
 * game code never changes when the shell changes.
 */

export type ShellName = 'electron' | 'tauri' | 'browser';

export interface SteamStatus {
  /** True when the Steamworks API started and is ready to use. */
  available: boolean;
  /** The shell that runs the game. */
  shell: ShellName;
  appId?: number;
  /** Why Steam is not available (for logs and debug overlays). */
  reason?: string;
  isSteamDeck?: boolean;
  /** Current Steam beta branch, if the player uses one. */
  betaName?: string | null;
  language?: string;
}

export interface SteamUser {
  name: string;
  /** SteamID64 as a string (BigInt values cannot be sent safely over every bridge). */
  steamId64: string;
  accountId: number;
  level: number;
}

export interface CloudFile {
  name: string;
  size: number;
}

export type OverlayDialog =
  | 'friends'
  | 'community'
  | 'players'
  | 'settings'
  | 'officialgamegroup'
  | 'stats'
  | 'achievements';

/** Every method the shell must answer. Arguments are positional. */
export interface CartridgeMethods {
  'steam.status': () => SteamStatus;
  'achievement.unlock': (id: string) => boolean;
  'achievement.isUnlocked': (id: string) => boolean;
  'achievement.clear': (id: string) => boolean;
  'stats.getInt': (name: string) => number | null;
  'stats.setInt': (name: string, value: number) => boolean;
  'stats.store': () => boolean;
  'cloud.isEnabled': () => boolean;
  'cloud.read': (name: string) => string | null;
  'cloud.write': (name: string, content: string) => boolean;
  'cloud.delete': (name: string) => boolean;
  'cloud.list': () => CloudFile[];
  'user.get': () => SteamUser | null;
  'presence.set': (key: string, value?: string | null) => void;
  'overlay.openUrl': (url: string) => void;
  'overlay.openDialog': (dialog: OverlayDialog) => void;
  'overlay.openStore': (appId?: number) => void;
  'app.quit': () => void;
  'app.setFullscreen': (on: boolean) => void;
  'app.isFullscreen': () => boolean;
  'app.info': () => { name: string; version: string; packaged: boolean; platform: string };
}

export type CartridgeMethod = keyof CartridgeMethods;

export interface CartridgeBridge {
  invoke<M extends CartridgeMethod>(
    method: M,
    ...args: Parameters<CartridgeMethods[M]>
  ): Promise<ReturnType<CartridgeMethods[M]>>;
}

declare global {
  interface Window {
    __cartridge?: CartridgeBridge;
  }
}

export const CARTRIDGE_IPC_CHANNEL = 'cartridge:invoke';
