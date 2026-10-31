# `@cartridgejs/steam` — game-side API

```ts
import { steam } from '@cartridgejs/steam';
```

All methods return promises. You can call any method before `ready()`; it waits for the shell.

## Where calls go

| Where the game runs | Steam methods | App methods |
|---|---|---|
| Desktop shell, Steam started | Steamworks | shell |
| Desktop shell, Steam not available | `localStorage` fallback | shell |
| Normal browser | `localStorage` fallback | browser APIs |

So your game needs no `if (steam)` checks. Use `steam.ready()` only when you want to show Steam info.

## Reference

### Status
- `ready(): Promise<SteamStatus>` — `{ available, shell, appId?, reason?, isSteamDeck?, betaName?, language? }`
- `isDesktop: boolean` — true inside a cartridge shell.

### Achievements
Use the **API name** from Steamworks › Stats & Achievements.
- `achievements.unlock(id)` → `boolean`
- `achievements.isUnlocked(id)` → `boolean`
- `achievements.clear(id)` → `boolean` (for tests)

### Stats (integer)
- `stats.getInt(name)` → `number | null`
- `stats.setInt(name, value)` → `boolean`
- `stats.store()` → `boolean` — sends changed stats and achievements to Steam. Call it after a group of changes, not every frame.

### Cloud files
Turn on Steam Cloud in Steamworks and set a byte and file quota.
- `cloud.isEnabled()` → `boolean`
- `cloud.read(name)` → `string | null`
- `cloud.write(name, content)` → `boolean`
- `cloud.delete(name)` → `boolean`
- `cloud.list()` → `{ name, size }[]`
- `cloud.readJson<T>(name)` / `cloud.writeJson(name, value)`

### User and presence
- `user.get()` → `{ name, steamId64, accountId, level } | null`
- `presence.set(key, value?)` — Steam rich presence. Clear a key with no value.

### Overlay

Where the in-game overlay (Shift+Tab, and the calls below) appears:

| Platform | Started by Steam | `cartridge dev` / started from a terminal |
|---|---|---|
| Windows, Linux | Expected to work (not yet tested by the project) | Usually not: Steam loads the overlay only into games that it starts |
| macOS | **No.** Steam does not draw over Electron windows ([electron#42656](https://github.com/electron/electron/issues/42656)). Calls open the page in Steam's own window | No |

To test the overlay, start the game from your Steam library, not from a terminal.

- `overlay.openUrl(url)` — in a normal browser, opens a new tab.
- `overlay.openDialog('friends' | 'community' | 'players' | 'settings' | 'officialgamegroup' | 'stats' | 'achievements')`
- `overlay.openStore(appId?)` — defaults to your game.

### App
- `app.quit()`
- `app.setFullscreen(on)` / `app.isFullscreen()`
- `app.info()` → `{ name, version, packaged, platform }`

## Test with Spacewar (App ID 480)

Before you have an App ID, set `steam.appId: 480`, start the Steam client, and run `cartridge dev`.
Spacewar has the achievements `ACH_WIN_ONE_GAME`, `ACH_WIN_100_GAMES`, `ACH_TRAVEL_FAR_ACCUM`, `ACH_TRAVEL_FAR_SINGLE`
and the stat `NumGames`. The example game uses them.
