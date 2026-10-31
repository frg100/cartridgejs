// cartridge config. See docs/config.md for every option.
import { defineConfig } from '@cartridgejs/cli';

export default defineConfig({
  name: 'Cube Clicker',
  id: 'com.example.cubeclicker',
  icon: 'assets/icon', // icon.ico (Windows), icon.icns (macOS), icon.png (Linux)

  web: {
    dir: 'dist',
    devUrl: 'http://localhost:5173',
  },

  window: {
    width: 1280,
    height: 720,
    backgroundColor: '#0b0d12',
  },

  steam: {
    // 480 is Valve's "Spacewar" test app. Change it to your App ID.
    appId: 480,
    // Depot IDs from Steamworks › SteamPipe › Depots (needed for `cartridge upload`).
    depots: {},
  },
});
