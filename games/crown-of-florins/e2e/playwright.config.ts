// End-to-end tests for Crown of Florins, run against the game's development Hall
// (dev/index.html: the real Hall with the game playable before release) on port 5481.
// `pnpm --filter @one-more-year/crown-of-florins e2e`.
//
// - game: every mode and every way out, by mouse and by keyboard, at 1280×720.
// - shots: the critique screenshots at two sizes and both appearances, and the frame
//   rate of the valley and the coronation at each quality level (only with SHOTS=1).
//
// The fresco is WebGL. On Windows the browser is pointed at the real GPU through
// ANGLE so frame rates mean something; elsewhere it falls back to the software
// renderer, which is slow but paints the same pictures.
import { defineConfig, devices, type Project } from '@playwright/test';

const BASE_URL = 'http://localhost:5481';
const gpu = [
  '--enable-gpu',
  '--ignore-gpu-blocklist',
  ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : []),
];
const desktop = {
  ...devices['Desktop Chrome'],
  viewport: { width: 1280, height: 720 },
  baseURL: BASE_URL,
  launchOptions: { args: gpu },
};

const projects: Project[] = [{ name: 'game', testMatch: /specs\/.*\.spec\.ts/, use: desktop }];
if (process.env.SHOTS) {
  projects.push({
    name: 'shots',
    testMatch: /shots\/.*\.spec\.ts/,
    timeout: 1_800_000,
    use: desktop,
  });
}

export default defineConfig({
  testDir: '.',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // Each test drives a GPU scene; a few at a time keeps frame timings honest.
  workers: 3,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 240_000,
  use: {
    trace: 'retain-on-failure',
    actionTimeout: 15_000,
    serviceWorkers: 'block',
  },
  projects,
  webServer: {
    command: 'pnpm exec vite --config vite.config.ts --port 5481 --strictPort',
    cwd: '..',
    url: `${BASE_URL}/index.html`,
    reuseExistingServer: !process.env.CI,
  },
});
