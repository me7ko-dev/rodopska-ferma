import { defineConfig } from 'vite';

// base './' — играта работи и от GitHub Pages (/rodopska-ferma/), и от Electron/APK (file://)
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 2000, assetsInlineLimit: 0 },
  server: { port: 5191 },
});
