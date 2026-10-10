// The Hall with a real played history (Pond, through the harness): every
// theme with twenty worlds in the catalog, and axe on the chronicle page and
// the Library, Codex and Legacy pages once they have something to show.
import { expect, test } from '@playwright/test';
import {
  APPEARANCES,
  THEMES,
  expectAccessible,
  finishRun,
  openHarness,
  returningVisitor,
  setLook,
  watchConsole,
  type ThemeName,
} from '../support.ts';

/** Each theme's element for one world in the catalog. */
const WORLD_ELEMENT: Record<ThemeName, string> = {
  almanac: '.almanac-chapter',
  'situation-room': '.room-tile',
  terrarium: '.terra-dome',
};

for (const theme of THEMES) {
  test(`${theme} draws twenty worlds without spilling sideways`, async ({ page }) => {
    const problems = watchConsole(page);
    await returningVisitor(page, { theme });
    await openHarness(page, '#/', 'fixtures=20');
    // Pond plus a catalog of twenty planned worlds (the two real ones and eighteen generated).
    await expect(page.locator(WORLD_ELEMENT[theme])).toHaveCount(21);
    for (const width of [1280, 1920]) {
      await page.setViewportSize({ width, height: width === 1280 ? 720 : 1080 });
      await page.waitForTimeout(400);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(0);
    }
    expect(problems).toEqual([]);
  });
}

test('the chronicle page and the Hall pages with history are accessible in every look', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const problems = watchConsole(page);
  await returningVisitor(page);
  await page.goto('/harness.html?now=2026-10-09T09:00:00Z#/play/pond?new=still-water');
  await finishRun(page, 12);
  const chronicleUrl = page.url();

  for (const theme of THEMES) {
    for (const appearance of APPEARANCES) {
      await setLook(page, theme, appearance);
      await page.goto(chronicleUrl);
      await expect(page.locator('.chronicle')).toBeVisible();
      await page.waitForTimeout(400);
      await expectAccessible(page, `chronicle in ${theme} ${appearance}`);
      for (const route of ['#/chronicles', '#/codex', '#/legacy']) {
        await openHarness(page, route);
        await expect(page.locator('#page-title')).toBeVisible();
        await page.waitForTimeout(300);
        await expectAccessible(page, `${route} in ${theme} ${appearance}`);
      }
    }
  }
  expect(problems).toEqual([]);
});
