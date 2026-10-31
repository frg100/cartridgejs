/**
 * Preload script. It exposes `window.__kiln` and nothing more.
 * All real work happens in the main process (see main.ts).
 */
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('__kiln', {
  invoke: (method: string, ...args: unknown[]) => ipcRenderer.invoke('kiln:invoke', method, args),
});
