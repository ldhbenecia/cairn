import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const workspaceVersion = (
  JSON.parse(readFileSync(resolve(import.meta.dirname, '../../package.json'), 'utf8')) as {
    version: string;
  }
).version;

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: { __WORKSPACE_VERSION__: JSON.stringify(workspaceVersion) },
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
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
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
