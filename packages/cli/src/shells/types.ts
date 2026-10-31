import type { Platform, ResolvedConfig } from '../config.js';

export interface DevOptions {
  /** URL to load, or a folder with a built game. */
  entry: { kind: 'url'; url: string } | { kind: 'dir'; dir: string };
  noSteam: boolean;
}

export interface BuildResult {
  platform: Platform;
  /** The folder to upload as the Steam depot content root. */
  dir: string;
  /** Path of the executable, relative to `dir`. Use it as the Steam launch option. */
  launchExecutable: string;
  /** Arguments to set in the Steam launch option, if any. */
  launchArguments?: string;
  arch: string;
}

/**
 * A desktop shell. Electron is the first one. A Tauri adapter must implement
 * the same interface and the same `window.__kiln` protocol (see @kiln/steam/protocol).
 */
export interface ShellAdapter {
  name: string;
  /** Version string for `kiln doctor`. */
  version(): string;
  /** Start the game in the shell and resolve when the window closes. */
  dev(config: ResolvedConfig, opts: DevOptions): Promise<number>;
  /** Package the built game (web.dir) for one platform. */
  build(config: ResolvedConfig, platform: Platform): Promise<BuildResult>;
}
