import { defineConfig } from 'vite';
export default defineConfig({
  base: '/game/',
  build: {
    outDir: 'c:/Source/KnutGame/Server/KnutGame/KnutGame/wwwroot/game',   // adjust if your Server path differs
    emptyOutDir: true,
    manifest: true,
    chunkSizeWarningLimit: 2000, // Increase limit to 2MB to accommodate Phaser
    rollupOptions: { input: 'src/main.ts' }
  }
});
