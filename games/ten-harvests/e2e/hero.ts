// The hero frames, shot live on the GPU from the development studios.
//
//   tsx games/ten-harvests/e2e/hero.ts <out folder> [frame names…]
//
// Needs the game's dev server (vite --config games/ten-harvests/vite.config.ts)
// on 4480. Every frame is the real engine and scene; the plan frame is
// captured with the budget bar's handle held mid-drag.
import { chromium, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

interface Frame {
  name: string;
  path: string;
  wait: number;
  act?: (page: Page) => Promise<void>;
}

/** Presses the land–keep handle and drags it right (buying land from the reserve), without letting go. */
async function holdBudgetHandle(page: Page): Promise<void> {
  const handle = page.locator('.th-bar__handle[data-handle="land-keep"]');
  const box = await handle.boundingBox();
  if (!box) throw new Error('budget handle not found');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 190, y, { steps: 14 });
  await page.waitForTimeout(900);
}

const PLAN = 'plan.html?years=5&seed=12';
const HARVEST = 'year.html?yield=5&beat=harvest&at=0.6&lived=3';
const STELE = 'stele.html?turn=-0.3';
const NIGHT =
  'year.html?appearance=dark&beat=newcomers&at=0.75&lived=6&newcomers=9&people=110&pose=night-city&nocaption';

const FRAMES: Frame[] = [
  { name: 'plan-noon-light', path: PLAN, wait: 4500, act: holdBudgetHandle },
  { name: 'plan-lamps-dark', path: `${PLAN}&appearance=dark`, wait: 4500, act: holdBudgetHandle },
  { name: 'harvest-light', path: HARVEST, wait: 5500 },
  { name: 'harvest-dark', path: `${HARVEST}&appearance=dark`, wait: 5500 },
  { name: 'stele-light', path: STELE, wait: 4500 },
  { name: 'stele-dark', path: `${STELE}&appearance=dark`, wait: 4500 },
  { name: 'city-night-procession', path: NIGHT, wait: 6000 },
];

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
  await page.goto(`http://localhost:4480/${frame.path}`, { waitUntil: 'load' });
  await page.waitForTimeout(frame.wait);
  if (frame.act) await frame.act(page);
  await page.screenshot({ path: join(out, `${frame.name}.png`) });
  console.warn(`${frame.name}${problems.length > 0 ? `: ${problems.join('; ')}` : ''}`);
  await page.close();
}
await browser.close();
