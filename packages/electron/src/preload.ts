/**
 * Preload script. It exposes `window.__cartridge` and nothing more.
 * All real work happens in the main process (see main.ts).
 */
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('__cartridge', {
  invoke: (method: string, ...args: unknown[]) => ipcRenderer.invoke('cartridge:invoke', method, args),
});
