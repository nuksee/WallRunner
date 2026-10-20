import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the build runs from any sub-path (test URL, game portals).
  base: './',
  server: { host: true },
  // Phaser alone is ~1.4 MB minified; splitting it buys nothing for a single-scene game.
  build: { chunkSizeWarningLimit: 2000 },
});
