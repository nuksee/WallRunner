import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the build runs from any sub-path (GitHub Pages, game portals).
  base: './',
  server: { host: true },
  build: {
    // main.ts awaits Rapier's WASM init at the top level.
    target: 'es2022',
    // Three.js and Rapier (WASM inlined) are large; splitting buys little for one page.
    chunkSizeWarningLimit: 3000,
  },
});
