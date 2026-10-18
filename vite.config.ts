import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import { contentSecurityPolicy } from './security-policy.ts';

// Added only to the production build: the local dev server relies on inline scripts
// for live reloading, which this policy would (correctly) block.
function contentSecurityPolicyMeta(): Plugin {
  return {
    name: 'content-security-policy-meta',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: contentSecurityPolicy },
        injectTo: 'head-prepend',
      },
    ],
  };
}

// The site is fully static: `npm run build` writes plain HTML, CSS and JS to dist/,
// which any static host (Netlify, Cloudflare Pages, GitHub Pages) can serve as-is.
export default defineConfig({
  // Hosts that serve the site from a subfolder (e.g. GitHub Pages at /opportunity-board/)
  // can set BASE_PATH at build time; everywhere else the site lives at the root.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss(), contentSecurityPolicyMeta()],
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
