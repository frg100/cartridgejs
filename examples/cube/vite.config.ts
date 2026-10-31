import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths work on the web, in subfolders (itch.io) and in the desktop shell.
  base: './',
  // three.js alone is about 540 KB, so raise the warning limit.
  build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 1000 },
});
