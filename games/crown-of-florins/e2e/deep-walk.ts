// A long walk through the real screens, with a bot choosing each year's plan through the
// development hook, screenshotting the first time each screen appears:
//   tsx games/crown-of-florins/e2e/deep-walk.ts <outDir> [appearance] [seed] [years] [policy] [speed]
// Needs the game's dev server on 4481. Prints the screens met, and console errors.
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { fixSeed } from './fixed-seed.ts';

const [
  out = 'deep',
  appearance = 'light',
  seed = '7',
  years = '60',
  policy = 'general',
  speed = 'quick',
] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await fixSeed(page, Number(seed));
await page.addInitScript(
  `localStorage.setItem('omy:sim-settings:crown-of-florins', JSON.stringify({ v: 1, d: { speed: '${speed}', tutorialDone: true } }));`,
);
const problems: string[] = [];
page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}\n${error.stack ?? ''}`));
page.on('console', (message) => {
  if (message.type() === 'error') problems.push(`console: ${message.text()}`);
});

const seen = new Set<string>();
const trail: string[] = [];
const screen = async (): Promise<string> =>
  (await page
    .locator('.cf')
    .getAttribute('data-screen')
    .catch(() => null)) ?? '?';
async function firstShot(name: string): Promise<void> {
  if (seen.has(name)) return;
  seen.add(name);
  await page.waitForTimeout(name === 'coronation' ? 6000 : 1500);
  await page.screenshot({ path: `${out}/${String(seen.size).padStart(2, '0')}-${name}.png` });
}

try {
  await page.goto(
    `http://localhost:4481/index.html?now=2026-10-13T09:00:00Z&appearance=${appearance}#/sim/crown-of-florins`,
  );
  await page.locator('.cf[data-screen="menu"]').waitFor({ timeout: 30_000 });
  await page.locator('[data-action="begin-solo"]').click();
  await page.locator('[data-action="begin"]').click();
  let sealed = 0;
  for (let guard = 0; guard < Number(years) * 8 && sealed < Number(years); guard++) {
    await page.waitForTimeout(250);
    const now = await screen();
    if (trail.at(-1) !== now) trail.push(now);
    await firstShot(now);
    if (now === 'year') {
      await page.evaluate(
        (p) =>
          (window as unknown as { __crown: { planWith(p: string): boolean } }).__crown.planWith(p),
        policy,
      );
      await page.waitForTimeout(150);
      await page.locator('[data-action="seal"]').click();
      const ask = page.locator('[data-action="seal-anyway"]');
      if (await ask.count()) await ask.click();
      sealed++;
    } else if (now === 'ending') {
      await page.waitForTimeout(4000);
      await page.screenshot({ path: `${out}/zz-ending.png` });
      break;
    } else if (now === 'handover') {
      await page.locator('[data-action="ready"]').click();
    } else if (now === 'harvest') {
      await page.keyboard.press('Space');
    } else if (now === 'coronation') {
      const next = page.locator('.cf-coronation__next:not([hidden])');
      if (await next.count()) await next.click();
      else await page.waitForTimeout(500);
    } else {
      const next = page.locator('[data-action="continue"]');
      if (await next.count())
        await next
          .first()
          .click()
          .catch(() => undefined);
    }
  }
  console.warn(`sealed ${sealed} years; screens: ${trail.join(' → ').slice(0, 2000)}`);
  const state = await page.evaluate(() => {
    const crown = (
      window as unknown as { __crown?: { state(): { year: number; end: unknown } | null } }
    ).__crown;
    const s = crown?.state();
    return s ? { year: s.year, end: s.end } : null;
  });
  console.warn(`world: ${JSON.stringify(state)}`);
} catch (error) {
  problems.push(`walk stopped: ${String(error)}`);
  await page.screenshot({ path: `${out}/stopped.png` });
}
for (const problem of problems.slice(0, 20)) console.warn(problem.slice(0, 1500));
await browser.close();
