/**
 * The runtime config that the cartridge CLI writes for the shell.
 * In a packaged game it is at `<app>/cartridge/runtime.json`.
 * In `cartridge dev` its path comes from the CARTRIDGE_RUNTIME_CONFIG env var.
 */
export interface RuntimeConfig {
  name: string;
  version: string;
  /** Reverse-DNS id, for example com.studio.game. */
  id: string;
  /** Where the game loads from. */
  entry: { kind: 'url'; url: string } | { kind: 'dir'; dir: string };
  window: {
    width: number;
    height: number;
    minWidth?: number;
    minHeight?: number;
    fullscreen: boolean;
    resizable: boolean;
    backgroundColor: string;
    /** Toggle fullscreen with F11 and Alt+Enter. */
    fullscreenShortcuts: boolean;
  };
  steam: {
    appId?: number;
    /** Show an error and quit when Steam does not start. */
    required: boolean;
    /** Restart through Steam when the player opens the exe directly. Packaged builds only. */
    restartThroughSteam: boolean;
    /** Apply the Electron fixes that make the Steam overlay draw. */
    overlay: boolean;
  };
  gpu: { ignoreBlocklist: boolean };
  /** Allow DevTools (F12). Always true in dev. */
  devtools: boolean;
  /** Turn off the Chromium sandbox on Linux (the Steam Linux Runtime often blocks it). */
  linuxNoSandbox: boolean;
  /** Keep the display awake while the window has focus. */
  preventSleep: boolean;
  dev: boolean;
}
