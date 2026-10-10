/**
 * Critique screenshots and frame rates (SHOTS=1 only).
 *
 * Every key screen at 1280×720 and 1920×1080, in both appearances: the game
 * menu, the plan, the report, the 1978 Ledger, the stele and the chronicle
 * from a real run, and the cinematic at a yield of one and of five, with rats
 * and with fever, from the year studio. Files go to SHOTS_DIR (default
 * test-results/shots), which is not part of the repository.
 *
 * Then the cinematic's frame rate at each quality level, measured with the
 * frame-rate cap lifted so the numbers show headroom, written to fps.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, expect, test, type Page } from '@playwright/test';
import { expectScreen, openGame, SEEDS, skipTour, yearByKeyboard } from '../specs/support.ts';

const OUT = process.env.SHOTS_DIR ?? join('test-results', 'shots');
mkdirSync(OUT, { recursive: true });

const SIZES = [
  { name: '1280', width: 1280, height: 720 },
  { name: '1920', width: 1920, height: 1080 },
] as const;
const APPEARANCES = ['light', 'dark'] as const;

async function shot(page: Page, name: string): Promise<void> {
  // Let panels finish rising and the camera finish gliding before the picture.
  await page.waitForTimeout(1600);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
}

for (const size of SIZES) {
  for (const appearance of APPEARANCES) {
    const tag = `${size.name}-${appearance}`;

    test(`a run's screens at ${tag}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await openGame(page, { appearance, seed: SEEDS.worthCarving });
      await shot(page, `${tag}-01-menu`);
      await page.locator('[data-action=begin-classic]').click();
      await expectScreen(page, 'plan');
      await shot(page, `${tag}-02-tour`);
      await skipTour(page);
      await shot(page, `${tag}-03-plan`);
      await page.keyboard.press('Enter');
      await expectScreen(page, 'turning');
      await page.keyboard.press('Space');
      await expectScreen(page, 'report');
      await shot(page, `${tag}-04-report`);
      await page.keyboard.press('Enter');
      for (let year = 2; year <= 10; year++) await yearByKeyboard(page);
      await expectScreen(page, 'stele');
      await page.keyboard.press('Space');
      await shot(page, `${tag}-05-stele`);
      await page.locator('[data-action=stele-continue]').click();
      await expect(page).toHaveURL(/#\/chronicles\//);
      await shot(page, `${tag}-06-chronicle`);
    });

    test(`the 1978 Ledger and the scenarios at ${tag}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await openGame(page, { appearance, seed: SEEDS.ledger });
      await page.locator('[data-action=scenarios]').click();
      await expectScreen(page, 'scenarios');
      await shot(page, `${tag}-07-scenarios`);
      await page.locator('[data-action=scenarios-back]').click();
      await page.locator('[data-action=begin-ledger]').click();
      await expect(page.locator('.th-dock .th-paper__input')).toBeFocused({ timeout: 30_000 });
      await shot(page, `${tag}-08-ledger`);
    });

    test(`the cinematic at ${tag}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      const frames = {
        '09-yield-1': 'yield=1&beat=harvest&at=0.55',
        '10-yield-5': 'yield=5&beat=harvest&at=0.55',
        '11-rats': 'rats&beat=rats&at=0.5',
        '12-fever': 'fever&beat=fever&at=0.5',
        '13-newcomers': 'newcomers=12&beat=newcomers&at=0.6',
      };
      for (const [name, query] of Object.entries(frames)) {
        await page.goto(`/year.html?appearance=${appearance}&lived=2&${query}`);
        await shot(page, `${tag}-${name}`);
      }
    });
  }
}

test('the cinematic’s frame rate at each quality level', async () => {
  const browser = await chromium.launch({
    args: [
      '--enable-gpu',
      '--ignore-gpu-blocklist',
      '--disable-gpu-vsync',
      '--disable-frame-rate-limit',
      ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : []),
    ],
  });
  const results: { size: string; quality: string; fps: number; settledAt: string }[] = [];
  for (const size of SIZES) {
    const page = await browser.newPage({ viewport: { width: size.width, height: size.height } });
    for (const quality of ['high', 'balanced', 'light']) {
      await page.goto(`http://localhost:5480/year.html?quality=${quality}&lived=2&yield=5`);
      await page.waitForTimeout(3000);
      const samples: number[] = [];
      for (let second = 0; second < 8; second++) {
        await page.waitForTimeout(1000);
        samples.push(
          await page.evaluate(
            () => (window as unknown as { __year: { view: { fps: number } } }).__year.view.fps,
          ),
        );
      }
      const settledAt = await page.evaluate(
        () =>
          (window as unknown as { __year: { view: { ladder: { level: string } } } }).__year.view
            .ladder.level,
      );
      samples.sort((a, b) => a - b);
      // The median second: shader compiles and the loop's restart do not count.
      const fps = Math.round(samples[Math.floor(samples.length / 2)] ?? 0);
      results.push({ size: size.name, quality, fps, settledAt });
    }
    await page.close();
  }
  await browser.close();
  writeFileSync(join(OUT, 'fps.json'), JSON.stringify(results, null, 2));
  console.warn(JSON.stringify(results));
  for (const result of results) expect(result.fps).toBeGreaterThan(0);
});
