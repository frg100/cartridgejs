# cartridge.js

**Put your three.js game in a cartridge, and ship it to Steam.** cartridge.js is an Expo-style toolchain for WebGL games:
one config file, one CLI, and one small game-side API for achievements, cloud saves and the overlay.

```bash
npm create cartridgejs@latest my-game
cd my-game && npm install
npm run desktop:dev      # your game in a desktop window, with Steam
npm run desktop:build    # Windows, macOS and Linux builds
npx cartridge upload --branch beta
```

> **Status: early MVP (0.1).** The npm names (`@cartridgejs/*`, `create-cartridgejs`) are not published yet.
> To try it now, clone this repo and use the example (see [Contributing](CONTRIBUTING.md)).

## Why

A three.js game is a web page. Steam sells desktop apps. To ship, you must wrap the game in a desktop shell,
connect it to Steamworks, fix the Steam overlay, package three platforms, set launch options, and upload with SteamPipe.
Every web-game developer does this by hand. cartridge.js does it with four commands.

## What you get

| | |
|---|---|
| `cartridge init` | Adds cartridge to an existing Vite / webpack / Parcel game. Writes `cartridge.config.mjs`, scripts, and (with `--ci`) a GitHub Actions release workflow. |
| `cartridge dev` | Starts your dev server and opens it in the desktop shell, with Steam, hot reload and DevTools. |
| `cartridge preview` | Runs your production web build in the desktop shell. |
| `cartridge build` | Makes Windows, macOS and Linux builds in `.cartridge/build/<platform>/`, and prints the Steam launch options. |
| `cartridge upload` | Writes the SteamPipe scripts and runs `steamcmd`. `--dry-run` shows the scripts only. |
| `cartridge doctor` | Checks the project before a release: App ID, depots, icons, builds, steamcmd. |
| `@cartridgejs/steam` | The game-side API. Works in the desktop shell, and falls back to `localStorage` in a normal browser, so one build runs on Steam **and** on the web. |

```ts
import { steam } from '@cartridgejs/steam';

const status = await steam.ready();            // { available, shell, appId, isSteamDeck, ... }
await steam.achievements.unlock('FIRST_WIN');  // Steam popup on desktop, localStorage on the web
await steam.cloud.writeJson('save.json', save);
const me = await steam.user.get();             // { name, steamId64, ... } or null
await steam.overlay.openStore();
```

See [docs/steam-api.md](docs/steam-api.md) for the full API.

## How it works

```
your game (three.js, Vite build)          cartridge.config.mjs
        │                                       │
        ▼                                       ▼
  @cartridgejs/steam ── window.__cartridge ──▶  shell adapter (Electron today, Tauri later)
                                     ├─ app://game/ protocol (ES modules, fetch, workers work)
                                     ├─ steamworks.js (achievements, stats, cloud, overlay)
                                     └─ window, fullscreen (F11 / Alt+Enter), single instance
                                                │
                              cartridge build ──▶ .cartridge/build/{windows,macos,linux}
                              cartridge upload ─▶ SteamPipe VDF ─▶ steamcmd
```

The shell is behind an adapter interface, and the game talks to it through one small protocol
(`@cartridgejs/steam/protocol`). A Tauri adapter can be added later with no change to game code.
See [docs/architecture.md](docs/architecture.md).

## Docs

- [Config reference](docs/config.md)
- [Game-side Steam API](docs/steam-api.md)
- [Release checklist: from zero to a Steam build](docs/shipping.md)
- [Architecture](docs/architecture.md)

## Known limits (0.1)

- Electron only. Builds are about 270–310 MB because they include Chromium.
- A universal macOS build needs a Mac (`lipo`). On Linux and Windows, cartridge makes an x64 macOS build.
- No code signing or notarization yet.
- Steam features: achievements, int stats, cloud files, user, rich presence, overlay. No lobbies, networking, Workshop or Steam Input yet.

## Roadmap

- Tauri shell adapter (small builds)
- macOS signing and notarization; Windows signing
- Float stats, leaderboards, Steam Input, Workshop
- `cartridge upload` with Steam Guard–free CI login helpers
- Steam Deck checks in `cartridge doctor` (controller support, 1280×800)

## License

MIT
