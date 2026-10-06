import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import type { PluginOption } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The CSP in index.html allows what the Vite dev server needs (inline <style>
 * injection and the HMR websocket). Production builds drop both.
 */
const productionCsp: PluginOption = {
  name: 'lanyard:production-csp',
  apply: 'build',
  transformIndexHtml: (html) => html.replace(" 'unsafe-inline'", '').replace(' ws://localhost:*', ''),
};

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        // The CLI is a second entry of the main build so it shares the compiled core.
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
          cli: resolve(__dirname, 'src/cli/index.ts'),
        },
      },
    },
  },
  preload: {
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') },
      },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [react(), productionCsp],
    build: {
      // electron-vite leaves output unminified by default; the renderer is the only bundle where size matters.
      minify: true,
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer/index.html') },
      },
    },
  },
});
