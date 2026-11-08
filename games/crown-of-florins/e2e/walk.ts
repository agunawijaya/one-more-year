// A walk through the real game in the development Hall, screenshotting each screen:
//   tsx games/crown-of-florins/e2e/walk.ts <outDir> [appearance] [width] [height] [seed]
// Needs the game's dev server on 4481. Prints the page's console errors.
import { mkdirSync } from 'node:fs';
import { chromium, type Page } from '@playwright/test';
import { fixSeed } from './fixed-seed.ts';

const [out = 'walk', appearance = 'light', width = '1280', height = '720', seed = '7'] =
  process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) } });
await fixSeed(page, Number(seed));
const problems: string[] = [];
page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}\n${error.stack ?? ''}`));
page.on('console', (message) => {
  if (message.type() === 'error') problems.push(`console: ${message.text()}`);
});

let shot = 0;
async function snap(page: Page, name: string): Promise<void> {
  shot += 1;
  await page.screenshot({ path: `${out}/${String(shot).padStart(2, '0')}-${name}.png` });
}
async function screen(page: Page): Promise<string> {
  return (await page.locator('.cf').getAttribute('data-screen')) ?? '?';
}
async function waitScreen(page: Page, name: string): Promise<void> {
  await page.locator(`.cf[data-screen="${name}"]`).waitFor({ timeout: 30_000 });
}

try {
  await page.goto(
    `http://localhost:4481/index.html?now=2026-10-13T09:00:00Z&appearance=${appearance}#/sim/crown-of-florins`,
  );
  await waitScreen(page, 'menu');
  await page.waitForTimeout(2500);
  await snap(page, 'menu');
  await page.locator('[data-action="begin-solo"]').click();
  await waitScreen(page, 'setup');
  await page.waitForTimeout(500);
  await snap(page, 'setup');
  await page.locator('[data-action="begin"]').click();
  await waitScreen(page, 'harvest');
  await page.waitForTimeout(3500);
  await snap(page, 'harvest');
  await page.keyboard.press('Space');
  await waitScreen(page, 'year');
  await page.waitForTimeout(2500);
  await snap(page, 'year-harvest-tour');
  const skip = page.locator('[data-action="coach-skip"]');
  if (await skip.count()) await skip.click();
  for (const step of ['market', 'bread', 'taxes', 'builders'] as const) {
    await page.locator(`.cf-step[data-step="${step}"]`).click();
    await page.waitForTimeout(1200);
    await snap(page, `year-${step}`);
  }
  await page.locator('[data-action="seal"]').click();
  const ask = page.locator('[data-action="seal-anyway"]');
  if (await ask.count()) await ask.click();
  await waitScreen(page, 'review');
  await page.waitForTimeout(1500);
  await snap(page, 'review');
  await page.locator('[data-action="continue"]').click();
  await page.waitForTimeout(2500);
  await snap(page, `after-review-${await screen(page)}`);
  if ((await screen(page)) === 'valley') {
    await page.waitForTimeout(3000);
    await snap(page, 'valley');
    await page.locator('[data-action="continue"]').click();
  }
  await page.waitForTimeout(3000);
  await snap(page, `next-${await screen(page)}`);
} catch (error) {
  problems.push(`walk stopped: ${String(error)}`);
  await snap(page, 'stopped');
}
for (const problem of problems.slice(0, 20)) console.warn(problem.slice(0, 1200));
await browser.close();
