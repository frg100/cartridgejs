# Architecture

```
packages/
  steam/             @cartridgejs/steam       game-side API + the shell protocol (types)
  electron/          @cartridgejs/electron    Electron main + preload, steamworks.js bridge
  cli/               @cartridgejs/cli         config, commands, shell adapters, SteamPipe
  create-cartridgejs/                    starter (copies examples/cube)
examples/cube/                         three.js example, also the starter template
scripts/smoke.mjs                      starts a packaged build and checks it with Playwright
```

## The protocol

The game never imports Electron or steamworks.js. It calls `window.__cartridge.invoke(method, ...args)`, which the
shell's preload script exposes. `CartridgeMethods` in `packages/steam/src/protocol.ts` is the full list of methods.
`@cartridgejs/steam` wraps this and adds the browser fallback.

Rules for the protocol:
- Only JSON-safe values (SteamID64 is a string, not a BigInt).
- Every method is in one table in the main process. Unknown methods and other senders are refused.

## The Electron shell

- `main.js` reads `cartridge/runtime.json` (or `CARTRIDGE_RUNTIME_CONFIG` in dev).
- The game loads from `app://game/`, a privileged custom protocol that serves `web.dir`. ES modules, `fetch()`,
  workers and WASM act as on a web server, and the protocol refuses paths outside the game folder.
- `contextIsolation`, `sandbox` and no `nodeIntegration`: the page cannot use Node.
- Steam: `restartAppIfNecessary` (release builds), `init(appId)`, and the overlay fix from steamworks.js
  (`in-process-gpu`, `disable-direct-composition`, and a repaint every frame).
- `backgroundThrottling: false`, so the game loop does not slow down when the window loses focus.

## `cartridge build`

For each platform:
1. Stage an app folder: `package.json`, `cartridge/` (runtime files + `runtime.json`), `game/` (the web build, no source maps),
   and `node_modules/steamworks.js` with **only** that platform's native files.
2. Run `@electron/packager` with `asar` (native Steam files unpacked), icon and Windows metadata (`resedit`, so no Wine).
3. Move the result to `.cartridge/build/<platform>/` and remove unused Chromium language packs.

## Shell adapters

`packages/cli/src/shells/types.ts`:

```ts
interface ShellAdapter {
  name: string;
  version(): string;
  dev(config, { entry, noSteam }): Promise<number>;
  build(config, platform): Promise<BuildResult>;
}
```

### Plan for Tauri

- A `@cartridgejs/tauri` package with a Rust host that uses the `steamworks` crate and answers the same `CartridgeMethods`.
- A preload (`initialization_script`) that sets `window.__cartridge.invoke` on top of Tauri's `invoke`.
- `tauriShell` in `packages/cli/src/shells/tauri.ts`, chosen with `shell: 'tauri'`.
- Note: Tauri uses the system webview (WebView2, WKWebView, WebKitGTK), so WebGL behavior differs per OS.
