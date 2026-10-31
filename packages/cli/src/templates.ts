import type { PackageManager } from './config.js';

export function configTemplate(opts: { name: string; id: string; webDir: string; devUrl: string }): string {
  return `// cartridge config. Docs: https://github.com/cartridgejs/cartridgejs/blob/main/docs/config.md
import { defineConfig } from '@cartridgejs/cli';

export default defineConfig({
  name: ${JSON.stringify(opts.name)},
  id: ${JSON.stringify(opts.id)},
  // icon: 'assets/icon', // icon.ico (Windows), icon.icns (macOS), icon.png (Linux)

  web: {
    dir: ${JSON.stringify(opts.webDir)},
    devUrl: ${JSON.stringify(opts.devUrl)},
  },

  window: {
    width: 1280,
    height: 720,
  },

  steam: {
    // 480 is Valve's "Spacewar" test app. Change it to your App ID.
    appId: 480,
    // Depot IDs from Steamworks › SteamPipe › Depots (needed for \`cartridge upload\`).
    depots: {
      // windows: 0,
      // macos: 0,
      // linux: 0,
    },
  },
});
`;
}

function setupPm(pm: PackageManager): string {
  if (pm === 'pnpm') return '      - uses: pnpm/action-setup@v4\n';
  if (pm === 'bun') return '      - uses: oven-sh/setup-bun@v2\n';
  return '';
}

function installCmd(pm: PackageManager): string {
  return { npm: 'npm ci', pnpm: 'pnpm install --frozen-lockfile', yarn: 'yarn install --frozen-lockfile', bun: 'bun install --frozen-lockfile' }[pm];
}

function execCmd(pm: PackageManager): string {
  return { npm: 'npx cartridge', pnpm: 'pnpm exec cartridge', yarn: 'yarn cartridge', bun: 'bunx cartridge' }[pm];
}

/** GitHub Actions: build on each OS, then upload with game-ci/steam-deploy. */
export function workflowTemplate(pm: PackageManager): string {
  const cartridge = execCmd(pm);
  return `# Build the game for Windows, macOS and Linux and upload it to Steam.
# Repository secrets:   STEAM_USERNAME, STEAM_CONFIG_VDF
#                        (see https://github.com/game-ci/steam-deploy#configvdf)
# Repository variables: STEAM_APP_ID, STEAM_FIRST_DEPOT_ID
# The three depots must have consecutive IDs in this order: windows, macos, linux.
# (Or replace the upload job with \`cartridge upload\` on a machine that has steamcmd.)
name: Steam release

on:
  workflow_dispatch:
    inputs:
      branch:
        description: Steam beta branch to set live
        default: beta
  push:
    tags: ['v*']

jobs:
  build:
    strategy:
      matrix:
        include:
          - { os: ubuntu-latest, platform: windows }
          - { os: ubuntu-latest, platform: linux }
          - { os: macos-latest, platform: macos }
    runs-on: \${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
${setupPm(pm)}      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: ${pm === 'bun' ? "''" : pm}
      - run: ${installCmd(pm)}
      - run: ${cartridge} build --platform \${{ matrix.platform }}
      # tar keeps the executable bit and the macOS .app symlinks (artifacts alone do not).
      - run: tar -C .cartridge/build -cf build-\${{ matrix.platform }}.tar \${{ matrix.platform }}
      - uses: actions/upload-artifact@v4
        with:
          name: build-\${{ matrix.platform }}
          path: build-\${{ matrix.platform }}.tar

  upload:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          pattern: build-*
          merge-multiple: true
      - name: Unpack builds
        run: |
          mkdir -p .cartridge/build
          for p in windows macos linux; do tar -C .cartridge/build -xf "build-$p.tar"; done
      - uses: game-ci/steam-deploy@v3
        with:
          username: \${{ secrets.STEAM_USERNAME }}
          configVdf: \${{ secrets.STEAM_CONFIG_VDF }}
          appId: \${{ vars.STEAM_APP_ID }}
          # steam-deploy numbers depots from this ID: depot1 = this ID, depot2 = +1, depot3 = +2.
          firstDepotIdOverride: \${{ vars.STEAM_FIRST_DEPOT_ID }}
          buildDescription: \${{ github.ref_name }}
          rootPath: .cartridge/build
          depot1Path: windows
          depot2Path: macos
          depot3Path: linux
          releaseBranch: \${{ inputs.branch || 'beta' }}
`;
}
