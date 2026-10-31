# @cartridgejs/steam

The Steam API for your game code. It works in the cartridge.js desktop shell, and it falls back to
`localStorage` in a normal browser, so one build runs on Steam and on the web.

```bash
npm install @cartridgejs/steam
```

```ts
import { steam } from '@cartridgejs/steam';

const status = await steam.ready();            // { available, shell, appId, isSteamDeck, ... }
await steam.achievements.unlock('FIRST_WIN');
await steam.cloud.writeJson('save.json', { level: 3 });
const me = await steam.user.get();             // { name, steamId64, ... } or null
```

Full API: https://github.com/frg100/cartridgejs/blob/main/docs/steam-api.md · MIT
