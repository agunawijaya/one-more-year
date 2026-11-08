/**
 * The modes and the ways a player moves through a year: Daily, a scenario,
 * Endless Dynasty for sixty years, a year by keyboard alone and one by mouse
 * alone, a reload in the middle of a step, and a replay with last time's
 * run as a ghost.
 */
import { expect, test } from '@playwright/test';
import {
  beginSolo,
  expectScreen,
  openGame,
  playYears,
  seal,
  watchConsole,
  worldOf,
} from './support.ts';

test('the daily world opens with the day’s court and plays', async ({ page }) => {
  await openGame(page);
  await page.locator('[data-action="begin-daily"]').click();
  await expectScreen(page, 'year');
  await seal(page);
  await expectScreen(page, 'review');
  const world = await worldOf(page);
  expect(world?.realms).toHaveLength(4);
});

test('a scenario changes only what it says: Harbour Town sells no land', async ({ page }) => {
  await openGame(page);
  await page.locator('[data-action="scenarios"]').click();
  await expectScreen(page, 'scenarios');
  await page.locator('[data-scenario="harbour-town"]').click();
  await page.locator('[data-action="begin"]').click();
  await expectScreen(page, 'year');
  await page.locator('.cf-step[data-step="market"]').click();
  await expect(page.locator('[data-panel="market"]')).toContainText('No one sells land here');
  const max = await page.locator('#cf-land').getAttribute('max');
  expect(max).toBe('0');
});

test('Endless Dynasty keeps going for sixty years and ends when the chronicle is closed', async ({
  page,
}) => {
  test.setTimeout(400_000);
  await openGame(page);
  await page.locator('[data-action="begin-endless"]').click();
  await page.locator('[data-action="begin"]').click();
  await playYears(page, { years: 60, policy: 'general' });
  const world = await worldOf(page);
  expect(world?.year).toBeGreaterThanOrEqual(1460);
  expect(world?.end).toBeNull();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Close the chronicle' }).click();
  await expectScreen(page, 'ending');
  expect((await worldOf(page))?.end?.ending).toBe('retired');
});

test('a whole year by keyboard alone', async ({ page }) => {
  const problems = watchConsole(page);
  await openGame(page, { speed: 'quick', valley: true });
  await page.locator('[data-action="begin-solo"]').focus();
  await page.keyboard.press('Enter');
  await expectScreen(page, 'setup');
  await page.locator('[data-action="begin"]').focus();
  await page.keyboard.press('Enter');
  await expectScreen(page, 'harvest');
  await page.keyboard.press('Space');
  await expectScreen(page, 'year');
  await page.keyboard.press('3');
  await expect(page.locator('#cf-release')).toBeFocused();
  await page.keyboard.press('Shift+ArrowLeft');
  await page.keyboard.press('4');
  await expect(page.locator('#cf-customs')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  const ask = page.locator('[data-action="seal-anyway"]');
  if (await ask.isVisible().catch(() => false)) await page.keyboard.press('Enter');
  await expectScreen(page, 'review');
  await expect(page.locator('[data-action="continue"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expectScreen(page, 'valley');
  await expect(page.locator('[data-action="continue"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expectScreen(page, 'harvest');
  await page.keyboard.press('Space');
  await expectScreen(page, 'year');
  await expect(page.locator('.cf-steps__anno')).toHaveText('Anno 1401');
  expect(problems).toEqual([]);
});

test('a whole year by mouse alone, with a sack dragged in the fresco', async ({ page }) => {
  await openGame(page);
  await beginSolo(page);
  await expectScreen(page, 'year');
  await page.locator('.cf-step[data-step="market"]').click();
  const grainNow = async (): Promise<number> =>
    page.evaluate(
      () =>
        (window as unknown as { __crown: { draft(): { grain: number } } }).__crown.draft().grain,
    );
  const before = await grainNow();
  const sack = page.locator('[data-sack="buy"]');
  const granary = page.locator('[data-target="granary"]');
  const from = await sack.boundingBox();
  const to = await granary.boundingBox();
  if (!from || !to) throw new Error('The market’s handles are not on screen');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
  // One sack carried from the merchants' stalls to the granary: a thousand bushels more bought.
  await expect.poll(grainNow).toBe(before + 1000);
  await page.locator('.cf-step[data-step="builders"]').click();
  await page.locator('[data-plot="markets"]').click();
  await expect(page.locator('[data-plot="markets"]')).toHaveAttribute('data-count', '1');
  await page.locator('[data-action="seal"]').click();
  await expectScreen(page, 'review');
  await page.locator('[data-action="continue"]').click();
  await expectScreen(page, 'year');
  await expect(page.locator('.cf-steps__anno')).toHaveText('Anno 1401');
});

test('a reload in the middle of a step comes back to the same plan', async ({ page }) => {
  await openGame(page);
  await beginSolo(page);
  await expectScreen(page, 'year');
  await page.locator('.cf-step[data-step="taxes"]').click();
  await page.locator('#cf-customs').focus();
  for (let press = 0; press < 5; press++) await page.keyboard.press('ArrowRight');
  await expect(page.locator('.cf-percent__value').first()).toHaveText('30%');
  await page.reload();
  await expectScreen(page, 'year');
  await page.locator('.cf-step[data-step="taxes"]').click();
  await expect(page.locator('.cf-percent__value').first()).toHaveText('30%');
});

test('“Replay this world” brings back the same valley with last time as a ghost', async ({
  page,
}) => {
  await openGame(page);
  await page.locator('[data-action="begin-endless"]').click();
  await page.locator('[data-action="begin"]').click();
  await playYears(page, { years: 3, policy: 'steward' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Close the chronicle' }).click();
  await expectScreen(page, 'ending');
  await page.locator('[data-action="read-chronicle"]').click();
  await expect(page).toHaveURL(/#\/chronicles\/[^?]+\?results/);
  await page.getByRole('button', { name: /Replay this world/ }).click();
  await expectScreen(page, 'year');
  await expect(page.locator('.cf-preview__ghost')).toContainText('Last time');
});
