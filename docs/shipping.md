# Release checklist: from zero to a Steam build

## 1. Steamworks (one time)

1. Join Steamworks (https://partner.steamgames.com) and pay the app fee. You get an **App ID**.
2. **SteamPipe › Depots**: make one depot for each platform (for example Windows, macOS, Linux).
   Set the OS of each depot. Put the depot IDs in `steam.depots`.
3. **Installation › General**: add one launch option for each platform. `cartridge build` prints the values:

   | OS | Executable | Arguments |
   |---|---|---|
   | Windows | `my-game.exe` | |
   | macOS | `My Game.app` | |
   | Linux | `my-game` | `--no-sandbox` |

4. Make a **builder account**: a separate Steam account with only the "Edit App Metadata" and "Publish App Changes" rights.
   Do not upload with your main account.
5. **Publish** the changes in Steamworks (Publish tab).

## 2. Your project

```bash
npx cartridge init          # once
npx cartridge doctor        # fix the errors; read the warnings
npx cartridge build         # .cartridge/build/{windows,macos,linux}
```

Test each build on its OS before you upload. The Linux build also runs on Steam Deck.

## 3. Upload

Install steamcmd (https://developer.valvesoftware.com/wiki/SteamCMD), then:

```bash
STEAM_USERNAME=my_builder npx cartridge upload --branch beta
```

The first time, Steam Guard asks for a code. steamcmd keeps the login after that.
Set the build live on the `default` branch by hand in **SteamPipe › Builds**, after you test the beta.

Use `--dry-run` to see the SteamPipe scripts, or `--preview` to let Steam check the files without an upload.

## 4. CI (optional)

`cartridge init --ci` writes `.github/workflows/steam.yml`. It builds each platform on its own OS (so the macOS build is universal)
and uploads with [game-ci/steam-deploy](https://github.com/game-ci/steam-deploy). Read the comments at the top of the file
for the secrets and variables it needs.

## Steam Deck

- The Deck screen is 1280×800. Test your UI at that size (`window.width: 1280, height: 800`).
- `(await steam.ready()).isSteamDeck` tells you when the game runs on a Deck.
- Support a gamepad (the browser Gamepad API works in the shell), or players must use Steam Input templates.

## macOS

The in-game Steam overlay (Shift+Tab) does not appear on macOS with Electron. This is a known Electron limit
([electron#42656](https://github.com/electron/electron/issues/42656)), not a problem in your game. Everything else
(achievements, stats, cloud saves, user info) works. Do not make the overlay a required part of your game.

cartridge does not sign or notarize yet. Steam can start unsigned apps, but some players may see a warning. Sign the `.app` with
`codesign` (and notarize) before upload if you have an Apple Developer account.
