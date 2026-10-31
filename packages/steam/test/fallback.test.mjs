import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { steam, __resetForTests } from '../dist/index.js';

class MemoryStorage {
  #m = new Map();
  get length() { return this.#m.size; }
  key(i) { return [...this.#m.keys()][i] ?? null; }
  getItem(k) { return this.#m.has(k) ? this.#m.get(k) : null; }
  setItem(k, v) { this.#m.set(k, String(v)); }
  removeItem(k) { this.#m.delete(k); }
}

beforeEach(() => {
  globalThis.localStorage = new MemoryStorage();
  delete globalThis.window;
  __resetForTests();
});

test('browser: status says Steam is not available', async () => {
  const s = await steam.ready();
  assert.equal(s.available, false);
  assert.equal(s.shell, 'browser');
  assert.equal(steam.isDesktop, false);
});

test('browser: achievements, stats and cloud use localStorage', async () => {
  assert.equal(await steam.achievements.isUnlocked('A'), false);
  await steam.achievements.unlock('A');
  assert.equal(await steam.achievements.isUnlocked('A'), true);
  assert.equal(localStorage.getItem('kiln:achievements'), '["A"]');

  assert.equal(await steam.stats.getInt('kills'), null);
  await steam.stats.setInt('kills', 4.7);
  assert.equal(await steam.stats.getInt('kills'), 4);

  await steam.cloud.writeJson('save.json', { level: 3 });
  assert.deepEqual(await steam.cloud.readJson('save.json'), { level: 3 });
  assert.deepEqual((await steam.cloud.list()).map((f) => f.name), ['save.json']);
  await steam.cloud.delete('save.json');
  assert.equal(await steam.cloud.read('save.json'), null);
  assert.equal(await steam.user.get(), null);
});

test('desktop with Steam: calls go to the bridge', async () => {
  const calls = [];
  globalThis.window = {
    __kiln: {
      invoke: async (method, ...args) => {
        calls.push([method, ...args]);
        if (method === 'steam.status') return { available: true, shell: 'electron', appId: 480 };
        if (method === 'achievement.unlock') return true;
        return null;
      },
    },
  };
  assert.equal(steam.isDesktop, true);
  assert.equal((await steam.ready()).available, true);
  assert.equal(await steam.achievements.unlock('WIN'), true);
  assert.deepEqual(calls.at(-1), ['achievement.unlock', 'WIN']);
  assert.equal(localStorage.getItem('kiln:achievements'), null);
});

test('desktop without Steam: Steam calls use the fallback, app calls use the bridge', async () => {
  const calls = [];
  globalThis.window = {
    __kiln: {
      invoke: async (method, ...args) => {
        calls.push(method);
        if (method === 'steam.status') return { available: false, shell: 'electron', reason: 'no steam' };
        if (method === 'app.isFullscreen') return true;
        throw new Error('must not be called: ' + method);
      },
    },
  };
  await steam.achievements.unlock('A');
  assert.equal(await steam.achievements.isUnlocked('A'), true);
  assert.equal(await steam.app.isFullscreen(), true);
  assert.deepEqual(calls, ['steam.status', 'app.isFullscreen']);
});
