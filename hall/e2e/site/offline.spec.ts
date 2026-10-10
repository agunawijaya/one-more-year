// What the built site asks the network for: nothing outside its own origin,
// and nothing at all once the service worker has the files. Also checks that
// the test-only Pond simulation never ships.
import { expect, test } from '@playwright/test';
import { THEMES, returningVisitor, watchConsole } from '../support.ts';

test('the site never requests another origin', async ({ page, baseURL }) => {
  const foreign: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith(baseURL ?? '') && !url.startsWith('data:') && !url.startsWith('blob:')) {
      foreign.push(url);
    }
  });
  await returningVisitor(page);
  await page.goto('/#/');
  for (const theme of THEMES) {
    await page.locator(`[data-theme-choice="${theme}"]`).click();
    await page.waitForTimeout(800);
  }
  for (const route of ['#/chronicles', '#/codex', '#/legacy', '#/about']) {
    await page.goto(`/${route}`);
    await expect(page.locator('#page-title')).toBeVisible();
  }
  expect(foreign).toEqual([]);
});

test.describe('offline', () => {
  test.use({ serviceWorkers: 'allow' });

  test('after the first load the Hall works with the network off', async ({ page, context }) => {
    const problems = watchConsole(page);
    await returningVisitor(page);
    await page.goto('/#/');
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    // Every theme's fonts and chunks are in the precache, not only the ones seen so far.
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-view', 'hall');
    await page.locator('[data-theme-choice="terrarium"]').click();
    await expect(page.locator('.terra')).toBeVisible();
    await page.goto('/#/about');
    await expect(page.locator('#page-title')).toBeVisible();
    const fontsReady = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].filter((font) => font.status === 'error').length;
    });
    expect(fontsReady).toBe(0);
    await context.setOffline(false);
    expect(problems).toEqual([]);
  });
});

test('the test-only Pond simulation is not part of the site', async ({ page }) => {
  await returningVisitor(page);
  await page.goto('/#/');
  await expect(page.locator('html')).toHaveAttribute('data-view', 'hall');
  await expect(page.locator('[data-sim="pond"]')).toHaveCount(0);
  // Its address leads back to the Hall with a word of why, not to an empty stage.
  await page.goto('/#/play/pond');
  await expect(page.getByText('There is no world at that address.')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-view', 'hall');
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.locator('[data-sim="pond"]')).toHaveCount(0);
});

test('a planned world cannot be opened from its address', async ({ page }) => {
  const problems = watchConsole(page);
  await returningVisitor(page);
  await page.goto('/#/play/crown-of-florins?new=standard');
  await expect(page.getByText('This world cannot be opened yet.')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-view', 'hall');
  await expect(page).toHaveURL(/#\/\?sim=crown-of-florins$/);
  expect(problems).toEqual([]);
});
