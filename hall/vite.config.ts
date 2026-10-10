// Build config for the Hall, which is the whole website: simulations are bundled
// as lazy chunks of it and loaded with import() only when opened. BASE_PATH lets
// the same build serve from a GitHub Pages project path such as /one-more-year/.
//
// Only index.html is an entry. harness.html (the test-only Pond simulation) is
// served by the dev server for Playwright and never reaches dist/.
import { defineConfig } from 'vite';
import { offlinePrecache } from './build/offline-precache.ts';

// On GitHub Actions the repository is known, so doc links in the Hall can point at it.
if (process.env.GITHUB_REPOSITORY && !process.env.VITE_REPO_URL) {
  process.env.VITE_REPO_URL = `https://github.com/${process.env.GITHUB_REPOSITORY}`;
}

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  server: { port: 4479, strictPort: true },
  preview: { port: 5479, strictPort: true },
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
  },
  plugins: [offlinePrecache()],
});
