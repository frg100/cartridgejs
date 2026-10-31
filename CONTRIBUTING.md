# Contributing

Needs Node.js 20.19+ or 22.12+ (see `.nvmrc`) and pnpm 10.

```bash
pnpm install
pnpm build        # builds all packages (and the create-cartridgejs template)
pnpm test
pnpm typecheck
```

Try the example game:

```bash
cd examples/cube
pnpm exec cartridge dev                 # dev server + desktop window
pnpm exec cartridge build -p linux      # or windows, macos, all
xvfb-run -a node ../../scripts/smoke.mjs .cartridge/build/linux/cube-clicker   # Linux smoke test
```

If the Steam client runs on your computer, the example connects to Spacewar (App ID 480).

## Guidelines

- Game-facing changes start in `packages/steam/src/protocol.ts`. Add the method to the protocol, the browser
  fallback (`packages/steam/src/index.ts`) and every shell.
- Keep error messages short, with a hint that tells the user what to do (`new CartridgeError(message, hint)`).
- Add a test for config, SteamPipe and fallback changes.
