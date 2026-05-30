import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/main',
      rollupOptions: {
        input: { index: resolve(import.meta.dirname, 'src/main/index.ts') },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/preload',
      rollupOptions: {
        input: { index: resolve(import.meta.dirname, 'src/preload/index.ts') },
      },
    },
  },
  renderer: {
    root: resolve(import.meta.dirname, 'src/renderer'),
    plugins: [react(), tailwindcss()],
    build: {
      outDir: 'out/renderer',
      rollupOptions: {
        input: {
          index: resolve(import.meta.dirname, 'src/renderer/index.html'),
        },
      },
    },
  },
});
