import { defineConfig } from 'vite';
export default defineConfig({
  base: '/game/',
  build: {
    outDir: '../KnutGame.Server/wwwroot/game',   // Updated path for new structure
    emptyOutDir: true,
    manifest: true,
    chunkSizeWarningLimit: 2000, // Increase limit to 2MB to accommodate Phaser
    rollupOptions: { input: 'src/main.ts' }
  }
});
