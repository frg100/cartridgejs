import { spawn, spawnSync, type ChildProcess, type SpawnOptions } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { KilnError } from './log.js';

/** Run a shell command and wait. Throws when the exit code is not 0. */
export function runShell(command: string, cwd: string, env?: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { cwd, shell: true, stdio: 'inherit', env: { ...process.env, ...env } });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new KilnError(`Command failed (${signal ?? `exit ${code}`}): ${command}`));
    });
  });
}

/** Start a long-running shell command (for example a dev server). */
export function startShell(command: string, cwd: string, opts: SpawnOptions = {}): ChildProcess {
  return spawn(command, {
    cwd,
    shell: true,
    stdio: 'inherit',
    // Own process group on POSIX, so that we can stop the whole tree.
    detached: process.platform !== 'win32',
    ...opts,
  });
}

export function killTree(child: ChildProcess | undefined): void {
  if (!child || child.exitCode !== null || child.pid === undefined) return;
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      process.kill(-child.pid, 'SIGTERM');
    }
  } catch {
    try {
      child.kill('SIGTERM');
    } catch {
      /* already gone */
    }
  }
}

export async function isUp(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return res.status < 500;
  } catch {
    return false;
  }
}

export async function waitForUrl(url: string, timeoutMs: number, aborted: () => boolean): Promise<void> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (aborted()) throw new KilnError('The dev server stopped before it was ready.');
    if (await isUp(url)) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new KilnError(
    `The dev server did not answer at ${url} in ${Math.round(timeoutMs / 1000)}s.`,
    'Set `web.devUrl` in the kiln config to the URL that your dev server prints.',
  );
}

/** Find an executable on PATH. */
export function which(cmd: string): string | undefined {
  const exts = process.platform === 'win32' ? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT').split(';') : [''];
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      const p = path.join(dir, cmd + ext);
      try {
        if (fs.statSync(p).isFile()) return p;
      } catch {
        /* not here */
      }
    }
  }
  return undefined;
}

export function copyDir(src: string, dest: string, filter?: (src: string) => boolean): void {
  fs.cpSync(src, dest, { recursive: true, dereference: true, filter: filter ? (s) => filter(s) : undefined });
}

export function rmrf(p: string): void {
  fs.rmSync(p, { recursive: true, force: true });
}

export function dirSize(p: string): number {
  let total = 0;
  const stack = [p];
  while (stack.length) {
    const cur = stack.pop()!;
    const st = fs.lstatSync(cur);
    if (st.isDirectory()) for (const e of fs.readdirSync(cur)) stack.push(path.join(cur, e));
    else total += st.size;
  }
  return total;
}

export function formatBytes(n: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
