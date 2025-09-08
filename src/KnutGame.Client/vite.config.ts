import { defineConfig } from 'vitest/config';
export default defineConfig({
  base: '/game/',
  build: {
    outDir: '../KnutGame.Server/wwwroot/game',   // Updated path for new structure
    emptyOutDir: true,
    manifest: 'manifest.json',
    chunkSizeWarningLimit: 2000, // Increase limit to 2MB to accommodate Phaser
    rollupOptions: { input: 'src/main.ts' }
  },
  test: {
    environment: 'jsdom'
  }
});
