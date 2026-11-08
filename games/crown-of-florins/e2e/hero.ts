// The hero frames, shot live on the GPU from the development pages.
//
//   tsx games/crown-of-florins/e2e/hero.ts <out folder> [frame names…]
//
// Needs the game's dev server on 4481 (vite --config games/crown-of-florins/vite.config.ts).
// Every frame is the real engine and the real scene: a bot plays a seeded
// game to the moment shown.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

interface Frame {
  name: string;
  path: string;
  wait: number;
}

const FRAMES: Frame[] = [];
for (const appearance of ['light', 'dark'] as const) {
  FRAMES.push(
    { name: `year-${appearance}`, path: `year.html?appearance=${appearance}`, wait: 7000 },
    {
      name: `valley-${appearance}`,
      path: `valley.html?appearance=${appearance}&march=0.55`,
      wait: 7000,
    },
    {
      name: `coronation-${appearance}`,
      path: `coronation.html?appearance=${appearance}&gold=1`,
      wait: 7000,
    },
    {
      name: `obituary-${appearance}`,
      path: `obituary.html?appearance=${appearance}&at=0.62`,
      wait: 3500,
    },
  );
}

const [out = 'hero', ...only] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
});
for (const frame of FRAMES.filter((f) => only.length === 0 || only.includes(f.name))) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text());
  });
  await page.goto(`http://localhost:4481/${frame.path}`, { waitUntil: 'load' });
  await page.waitForTimeout(frame.wait);
  await page.screenshot({ path: join(out, `${frame.name}.png`) });
  console.warn(`${frame.name}${problems.length > 0 ? `: ${problems.join('; ')}` : ''}`);
  await page.close();
}
await browser.close();
