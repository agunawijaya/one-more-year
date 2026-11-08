/**
 * Critique screenshots and frame rates (SHOTS=1 only).
 *
 * Every key screen at 1280×720 and 1920×1080, in both appearances, from real
 * games: the game menu, the court setup, the season passing, each of the
 * five steps, the heralds' scroll, the valley with an army on the road, an
 * obituary being lettered, the coronation half gilded and fully gilded, the
 * dynasty and the chronicle. Files go to SHOTS_DIR (default
 * test-results/shots), which is not part of the repository.
 *
 * Then the frame rate of the valley, the invasion's clash and the coronation
 * at each quality level, with the frame-rate cap lifted so the numbers show
 * headroom, written to fps.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, expect, test, type Page } from '@playwright/test';
import {
  expectScreen,
  openGame,
  playYears,
  screenOf,
  seal,
  SEEDS,
  planWith,
} from '../specs/support.ts';

const OUT = process.env.SHOTS_DIR ?? join('test-results', 'shots');
mkdirSync(OUT, { recursive: true });

const SIZES = [
  { name: '1280', width: 1280, height: 720 },
  { name: '1920', width: 1920, height: 1080 },
] as const;
const APPEARANCES = ['light', 'dark'] as const;

async function shot(page: Page, name: string, settle = 1600): Promise<void> {
  // Let panels finish rising and the camera finish gliding before the picture.
  await page.waitForTimeout(settle);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
}

for (const size of SIZES) {
  for (const appearance of APPEARANCES) {
    const tag = `${size.name}-${appearance}`;

    test(`a reign’s screens at ${tag}`, async ({ page }) => {
      test.setTimeout(1_800_000);
      await page.setViewportSize({ width: size.width, height: size.height });
      await openGame(page, { appearance, seed: SEEDS.crowned, speed: 'cinematic', valley: true });
      await shot(page, `${tag}-01-menu`, 2500);
      await page.locator('[data-action="begin-solo"]').click();
      await expectScreen(page, 'setup');
      await shot(page, `${tag}-02-setup`);
      await page.locator('[data-action="begin"]').click();
      await expectScreen(page, 'harvest');
      await shot(page, `${tag}-03-harvest`, 4200);
      await page.keyboard.press('Space');
      await expectScreen(page, 'year');
      const steps = ['harvest', 'market', 'bread', 'taxes', 'builders'];
      for (const [i, step] of steps.entries()) {
        await page.locator(`.cf-step[data-step="${step}"]`).click();
        if (step === 'builders') {
          await planWith(page, 'builder');
          await page.locator('.cf-step[data-step="builders"]').click();
        }
        await shot(page, `${tag}-0${4 + i}-step-${step}`, 1800);
      }
      await seal(page);
      await expectScreen(page, 'review');
      await shot(page, `${tag}-09-review`);
      await page.locator('[data-action="continue"]').click();
      await expectScreen(page, 'valley');
      await shot(page, `${tag}-10-valley`, 2500);
      await page.locator('[data-action="continue"]').click();

      await playYears(page, { years: 40, policy: 'general', until: (s) => s === 'obituary' });
      await expectScreen(page, 'obituary');
      await shot(page, `${tag}-12-obituary`, 9000);
      await page.locator('[data-action="continue"]').click();
      await playYears(page, { years: 20, policy: 'general', until: (s) => s === 'coronation' });
      await expectScreen(page, 'coronation');
      // The gold takes eight seconds to cover the painting, then lingers before the valley.
      await shot(page, `${tag}-13-coronation-gilding`, 3200);
      await shot(page, `${tag}-14-coronation-gilded`, 4900);
      await page
        .locator('[data-action="skip"]')
        .click()
        .catch(() => undefined);
      await shot(page, `${tag}-15-coronation-valley`, 3000);
      await page.locator('.cf-coronation__next').click();
      await expectScreen(page, 'ending');
      await shot(page, `${tag}-16-dynasty`, 5000);
      await page.locator('[data-action="read-chronicle"]').click();
      await expect(page).toHaveURL(/#\/chronicles\//);
      await shot(page, `${tag}-17-chronicle`);
    });

    test(`the valley with an army on the road at ${tag}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await openGame(page, { appearance, speed: 'cinematic', valley: true });
      await page.locator('[data-action="scenarios"]').click();
      await shot(page, `${tag}-18-scenarios`);
      await page.locator('[data-scenario="general-next-door"]').click();
      await page.locator('[data-action="begin"]').click();
      for (let year = 0; year < 2; year++) {
        await playYears(page, { years: 1, until: (s) => s === 'year' });
        await seal(page);
        await expectScreen(page, 'review');
        await page.locator('[data-action="continue"]').click();
      }
      await expectScreen(page, 'valley');
      await shot(page, `${tag}-11-valley-march`, 2200);
      expect(await screenOf(page)).toBe('valley');
    });
  }
}

test('the frame rate of the valley and the coronation at each quality level', async () => {
  const browser = await chromium.launch({
    args: [
      '--enable-gpu',
      '--ignore-gpu-blocklist',
      '--disable-gpu-vsync',
      '--disable-frame-rate-limit',
      ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : []),
    ],
  });
  const results: {
    scene: string;
    size: string;
    quality: string;
    fps: number;
    settledAt: string;
  }[] = [];
  const scenes = [
    { scene: 'valley', page: 'valley.html?march=0.5', hook: '__valley' },
    { scene: 'invasion', page: 'valley.html?march=1.1&clash', hook: '__valley' },
    { scene: 'coronation', page: 'coronation.html', hook: '__coronation' },
  ];
  for (const size of SIZES) {
    const page = await browser.newPage({ viewport: { width: size.width, height: size.height } });
    for (const { scene, page: path, hook } of scenes) {
      for (const quality of ['high', 'balanced', 'light']) {
        await page.goto(
          `http://localhost:5481/${path}${path.includes('?') ? '&' : '?'}quality=${quality}`,
        );
        await page.waitForTimeout(3000);
        const samples: number[] = [];
        for (let second = 0; second < 8; second++) {
          await page.waitForTimeout(1000);
          samples.push(
            await page.evaluate(
              (h) =>
                (window as unknown as Record<string, { view: { fps: number } }>)[h]?.view.fps ?? 0,
              hook,
            ),
          );
        }
        const settledAt = await page.evaluate(
          (h) =>
            (window as unknown as Record<string, { view: { ladder: { level: string } } }>)[h]?.view
              .ladder.level ?? '?',
          hook,
        );
        samples.sort((a, b) => a - b);
        // The median second: shader compiles and the loop's restart do not count.
        const fps = Math.round(samples[Math.floor(samples.length / 2)] ?? 0);
        results.push({ scene, size: size.name, quality, fps, settledAt });
      }
    }
    await page.close();
  }
  await browser.close();
  writeFileSync(join(OUT, 'fps.json'), JSON.stringify(results, null, 2));
  console.warn(JSON.stringify(results));
  for (const result of results) expect(result.fps).toBeGreaterThan(0);
});
