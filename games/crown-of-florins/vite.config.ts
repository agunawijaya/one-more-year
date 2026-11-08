// Development server for Crown of Florins on its own ports (dev 4481, tests 5481).
//
// The pages in dev/ are studios for art direction and the hero frames: the
// fresco city, the valley, the coronation and the obituary, each drawn live
// from the real engine. None of them is part of the site build.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL('./dev', import.meta.url)),
  cacheDir: fileURLToPath(new URL('./node_modules/.vite', import.meta.url)),
  server: { port: 4481, strictPort: true, fs: { allow: [repoRoot] } },
  preview: { port: 5481, strictPort: true },
});
