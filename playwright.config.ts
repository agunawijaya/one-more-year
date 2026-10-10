// End-to-end tests for the Hall.
//
// - site: the production build served by `vite preview` on 5479, exactly as
//   players get it: themes and appearances, keyboard navigation, intro and
//   picker, Library / Codex / Legacy pages, browser Back, axe, no network
//   requests, offline after the first load.
// - harness: the dev server on 4479 serving hall/harness.html, the only page
//   where the test-only Pond simulation exists. It drives the whole turn loop
//   through the real chrome: plan, end the turn, report, pause, reload and
//   resume, replay with a ghost, the chronicle and every navigation exit.
// - shots: regenerates docs/media/ (only with SHOTS=1, see `pnpm shots`).
//
// Byte Sized '83 (4183/5183) and Boss Key '83 (4283/5283) run on the same
// machine, so this collection keeps to 4479 and 5479.
import { defineConfig, devices, type Project } from '@playwright/test';

const SITE_URL = 'http://localhost:5479';
const DEV_URL = 'http://localhost:4479';
const desktop = { viewport: { width: 1280, height: 720 } };

const projects: Project[] = [
  {
    name: 'site',
    testMatch: /site\/.*\.spec\.ts/,
    use: { ...devices['Desktop Chrome'], ...desktop, baseURL: SITE_URL },
  },
  {
    name: 'harness',
    testMatch: /harness\/.*\.spec\.ts/,
    use: { ...devices['Desktop Chrome'], ...desktop, baseURL: DEV_URL },
  },
];
if (process.env.SHOTS) {
  projects.push({
    name: 'shots',
    testMatch: /shots\/.*\.spec\.ts/,
    timeout: 600_000,
    use: { ...devices['Desktop Chrome'], ...desktop, baseURL: DEV_URL },
  });
}

export default defineConfig({
  testDir: './hall/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,
  use: {
    trace: 'retain-on-failure',
    // A disabled button or a missing element fails fast instead of waiting out the test.
    actionTimeout: 15_000,
    // The offline worker would carry a cache from one test into the next.
    serviceWorkers: 'block',
  },
  projects,
  webServer: [
    {
      command: 'pnpm --filter @one-more-year/hall exec vite preview --port 5479 --strictPort',
      url: SITE_URL,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm --filter @one-more-year/hall exec vite --port 4479 --strictPort',
      url: `${DEV_URL}/harness.html`,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
