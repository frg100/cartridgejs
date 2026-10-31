# Config reference

kiln reads the first file it finds: `kiln.config.mjs`, `kiln.config.js`, `kiln.config.cjs`, `kiln.config.json`.
A JS config can export an object or a function (sync or async) that returns one.

```js
import { defineConfig } from '@kiln/cli';

export default defineConfig({
  name: 'Space Ducks',
  id: 'com.duckstudio.spaceducks',
  icon: 'assets/icon',
  steam: { appId: 1234560, depots: { windows: 1234561, macos: 1234562, linux: 1234563 } },
});
```

| Key | Default | Description |
|---|---|---|
| `name` | **required** | The game name that players see (window title, app name, macOS `.app` name). |
| `id` | `com.kiln.<slug>` | Reverse-DNS id (macOS bundle id). |
| `version` | `package.json` version | Must look like `1.2.3`. |
| `publisher` | `package.json` author, then `name` | Windows "Company" field and macOS copyright. |
| `executableName` | slug of `name` | File name of the executable (no extension). |
| `icon` | none | Path **without** extension. kiln uses `icon.ico` (Windows), `icon.icns` (macOS), `icon.png` (Linux, 512×512 or more). |
| `shell` | `'electron'` | Desktop shell. Only Electron is available now. |
| `web.dir` | `'dist'` | Folder of the built game. Must contain `index.html`. |
| `web.build` | `<pm> run build` if the script exists | Command for the web build. `false` to skip. |
| `web.dev` | `<pm> run dev` if the script exists | Command for the dev server. `false` to skip. |
| `web.devUrl` | `'http://localhost:5173'` | URL of the dev server. If something already answers there, kiln does not start the dev command. |
| `window.width` / `height` | `1280` / `720` | Size of the game area. |
| `window.minWidth` / `minHeight` | none | |
| `window.fullscreen` | `false` | Start in fullscreen. |
| `window.resizable` | `true` | |
| `window.backgroundColor` | `'#000000'` | Shown before the first frame. |
| `window.fullscreenShortcuts` | `true` | F11 and Alt+Enter toggle fullscreen. |
| `steam.appId` | none | Your Steam App ID. Use `480` (Valve's Spacewar test app) before you have one. |
| `steam.depots` | `{}` | Depot ID for each platform: `{ windows, macos, linux }`. Needed for `kiln upload`. |
| `steam.required` | `false` | Show an error and quit when Steam does not start (release builds only). |
| `steam.restartThroughSteam` | `true` | When a player opens the exe directly, restart the game through Steam (release builds only; never for app 480). |
| `steam.overlay` | `true` | Apply the Electron switches that make the Steam overlay draw. |
| `platforms` | all three | Platforms that `kiln build` makes. |
| `macos.arch` | `'universal'` | `'universal'`, `'x64'` or `'arm64'`. Universal needs a Mac. |
| `macos.category` | `'public.app-category.games'` | |
| `linux.noSandbox` | `true` | Turn off the Chromium sandbox on Linux. The Steam Linux Runtime often blocks it. kiln also tells you to add `--no-sandbox` to the Linux launch option. |
| `gpu.ignoreBlocklist` | `true` | Use the GPU for WebGL even on drivers that Chromium blocks. |
| `locales` | `['en-US']` | Chromium UI languages to keep (Windows/Linux). `'all'` keeps all (about 45 MB more). Your game's own text is not affected. |
| `devtools` | `false` | Allow F12 DevTools in release builds. Always on in `kiln dev`. Players can also start the game with `--kiln-devtools`. |
| `preventSleep` | `true` | Keep the display awake while the game has focus. |
| `outDir` | `'.kiln'` | Folder for all kiln output. Add it to `.gitignore`. |

## Environment variables

| Variable | Used by | Description |
|---|---|---|
| `KILN_NO_STEAM=1` | game | Do not start Steam (also turns off the restart through Steam). |
| `STEAM_USERNAME` | `kiln upload` | Steam builder account. |
| `STEAM_PASSWORD` | `kiln upload` | Optional. Without it, steamcmd uses its cached login or asks. |
| `STEAMCMD` | `kiln upload`, `kiln doctor` | Path of `steamcmd` if it is not on `PATH`. |
| `KILN_ELECTRON_ARGS` | `kiln dev`, `kiln preview` | Extra Electron arguments, for example `--remote-debugging-port=9222`. |
