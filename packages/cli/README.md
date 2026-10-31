# @cartridgejs/cli

The `cartridge` command: run, build and upload your three.js / WebGL game to Steam.

```bash
npm install -D @cartridgejs/cli
npx cartridge init        # add cartridge to your game
npx cartridge dev         # dev server + desktop window, with Steam
npx cartridge build       # Windows, macOS and Linux builds
npx cartridge upload      # SteamPipe + steamcmd
npx cartridge doctor      # check the project before a release
```

To start a new game, use `npm create cartridgejs@latest my-game`.

Config: `cartridge.config.mjs`

```js
import { defineConfig } from '@cartridgejs/cli';

export default defineConfig({
  name: 'My Game',
  steam: { appId: 480 },
});
```

Docs: https://github.com/frg100/cartridgejs#readme · MIT
