import type { ResolvedConfig } from '../config.js';
import { CartridgeError } from '../log.js';
import { electronShell } from './electron.js';
import type { ShellAdapter } from './types.js';

const shells: Record<string, ShellAdapter> = {
  electron: electronShell,
};

export function getShell(config: ResolvedConfig): ShellAdapter {
  const shell = shells[config.shell];
  if (!shell) throw new CartridgeError(`Unknown shell "${config.shell}".`);
  return shell;
}
