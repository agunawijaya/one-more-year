// Development server for Ten Harvests on its own ports (dev 4480, tests 5480).
//
// dev/index.html boots the real Hall with this simulation playable (as the
// Hall's own test harness does), dev/studio.html shows the city alone for
// art work and the hero frames. Neither page is part of the site build.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL('./dev', import.meta.url)),
  server: { port: 4480, strictPort: true, fs: { allow: [repoRoot] } },
  preview: { port: 5480, strictPort: true },
});
