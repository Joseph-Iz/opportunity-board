import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// The site is fully static: `npm run build` writes plain HTML, CSS and JS to dist/,
// which any static host (Netlify, Cloudflare Pages, GitHub Pages) can serve as-is.
export default defineConfig({
  // Hosts that serve the site from a subfolder (e.g. GitHub Pages at /opportunity-board/)
  // can set BASE_PATH at build time; everywhere else the site lives at the root.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
