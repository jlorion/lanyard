import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Deployed to GitHub Pages at https://riomar0001.github.io/lanyard/.
// For a custom domain, build with SITE_BASE=/ .
export default defineConfig({
  base: process.env.SITE_BASE ?? '/lanyard/',
  plugins: [react()],
  server: {
    // The docs and the changelog are read from the repository root.
    fs: { allow: [path.resolve(import.meta.dirname, '..')] },
  },
});
