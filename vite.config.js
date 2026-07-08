import { defineConfig } from 'vite';

// This site is a plain static site (no ESM entry points), so Vite is used as
// a dev server only. Deploy by uploading the project folder (minus
// node_modules and src/) to any static host — do NOT rely on `vite build`,
// which cannot see the runtime-loaded planet/audio assets.
export default defineConfig({
  root: '.',
  publicDir: false,
  server: {
    port: 3000,
    open: true,
    cors: true,
  },
});
