# kiln

**Ship your three.js game to Steam.** kiln is an Expo-style toolchain for WebGL games:
one config file, one CLI, and one small game-side API for achievements, cloud saves and the overlay.

```bash
npm create kiln-game@latest my-game
cd my-game && npm install
npm run desktop:dev      # your game in a desktop window, with Steam
npm run desktop:build    # Windows, macOS and Linux builds
npx kiln upload --branch beta
```

> **Status: early MVP (0.1).** Package names (`@kiln/*`, `create-kiln-game`) are working names and are not on npm yet.
> To try it now, clone this repo and use the example (see [Contributing](CONTRIBUTING.md)).

## Why

A three.js game is a web page. Steam sells desktop apps. To ship, you must wrap the game in a desktop shell,
connect it to Steamworks, fix the Steam overlay, package three platforms, set launch options, and upload with SteamPipe.
Every web-game developer does this by hand. kiln does it with four commands.

## What you get

| | |
|---|---|
| `kiln init` | Adds kiln to an existing Vite / webpack / Parcel game. Writes `kiln.config.mjs`, scripts, and (with `--ci`) a GitHub Actions release workflow. |
| `kiln dev` | Starts your dev server and opens it in the desktop shell, with Steam, hot reload and DevTools. |
| `kiln preview` | Runs your production web build in the desktop shell. |
| `kiln build` | Makes Windows, macOS and Linux builds in `.kiln/build/<platform>/`, and prints the Steam launch options. |
| `kiln upload` | Writes the SteamPipe scripts and runs `steamcmd`. `--dry-run` shows the scripts only. |
| `kiln doctor` | Checks the project before a release: App ID, depots, icons, builds, steamcmd. |
| `@kiln/steam` | The game-side API. Works in the desktop shell, and falls back to `localStorage` in a normal browser, so one build runs on Steam **and** on the web. |

```ts
import { steam } from '@kiln/steam';

const status = await steam.ready();            // { available, shell, appId, isSteamDeck, ... }
await steam.achievements.unlock('FIRST_WIN');  // Steam popup on desktop, localStorage on the web
await steam.cloud.writeJson('save.json', save);
const me = await steam.user.get();             // { name, steamId64, ... } or null
await steam.overlay.openStore();
```

See [docs/steam-api.md](docs/steam-api.md) for the full API.

## How it works

```
your game (three.js, Vite build)          kiln.config.mjs
        │                                       │
        ▼                                       ▼
  @kiln/steam ── window.__kiln ──▶  shell adapter (Electron today, Tauri later)
                                     ├─ app://game/ protocol (ES modules, fetch, workers work)
                                     ├─ steamworks.js (achievements, stats, cloud, overlay)
                                     └─ window, fullscreen (F11 / Alt+Enter), single instance
                                                │
                              kiln build ──▶ .kiln/build/{windows,macos,linux}
                              kiln upload ─▶ SteamPipe VDF ─▶ steamcmd
```

The shell is behind an adapter interface, and the game talks to it through one small protocol
(`@kiln/steam/protocol`). A Tauri adapter can be added later with no change to game code.
See [docs/architecture.md](docs/architecture.md).

## Docs

- [Config reference](docs/config.md)
- [Game-side Steam API](docs/steam-api.md)
- [Release checklist: from zero to a Steam build](docs/shipping.md)
- [Architecture](docs/architecture.md)

## Known limits (0.1)

- Electron only. Builds are about 270–310 MB because they include Chromium.
- A universal macOS build needs a Mac (`lipo`). On Linux and Windows, kiln makes an x64 macOS build.
- No code signing or notarization yet.
- Steam features: achievements, int stats, cloud files, user, rich presence, overlay. No lobbies, networking, Workshop or Steam Input yet.

## Roadmap

- Tauri shell adapter (small builds)
- macOS signing and notarization; Windows signing
- Float stats, leaderboards, Steam Input, Workshop
- `kiln upload` with Steam Guard–free CI login helpers
- Steam Deck checks in `kiln doctor` (controller support, 1280×800)

## License

MIT
