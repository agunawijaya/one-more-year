/**
 * Whole runs through the real Hall: a Classic term by mouse alone and by
 * keyboard alone, a deposition, a year through the scribe's console,
 * resuming after a reload and replaying a world with its ghost.
 */
import { expect, test } from '@playwright/test';
import {
  expectChronicle,
  expectScreen,
  leaveStele,
  openGame,
  SEEDS,
  skipTour,
  topBar,
  watchConsole,
  yearByKeyboard,
  yearByMouse,
} from './support.ts';

test('a Classic term by mouse alone, from the game menu to the chronicle', async ({ page }) => {
  const problems = watchConsole(page);
  await openGame(page, { seed: SEEDS.worthCarving });
  await page.locator('[data-action=begin-classic]').click();
  await skipTour(page);
  for (let year = 1; year <= 10; year++) {
    await expect(page.locator('.th-year')).toContainText(`Year ${year} of 10`);
    await yearByMouse(page);
  }
  await expect(page.locator('.th-stele-panel h1')).toHaveText('A Reign Worth Carving');
  await leaveStele(page, 'mouse');
  await expectChronicle(page, 'A Reign Worth Carving');
  expect(problems).toEqual([]);
});

test('the same term by keyboard alone ends the same way', async ({ page }) => {
  const problems = watchConsole(page);
  await openGame(page, { seed: SEEDS.worthCarving });
  await expect(page.locator('[data-action=begin-classic]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expectScreen(page, 'plan');
  await page.locator('[data-action=coach-next]').focus();
  for (let step = 0; step < 5; step++) await page.keyboard.press('Enter');
  await expect(page.locator('.th-coach')).toHaveCount(0);
  for (let year = 1; year <= 10; year++) await yearByKeyboard(page);
  await leaveStele(page, 'keyboard');
  await expectChronicle(page, 'A Reign Worth Carving');
  expect(problems).toEqual([]);
});

test('a ruinous decree asks twice, then the council meets at dusk', async ({ page }) => {
  const problems = watchConsole(page);
  await openGame(page, { seed: SEEDS.deposed });
  await page.locator('[data-action=begin-classic]').click();
  await skipTour(page);
  await page.keyboard.press('f');
  await expect(page.locator('#th-food')).toBeFocused();
  await page.keyboard.press('Control+a');
  await page.keyboard.type('0');
  await page.keyboard.press('Enter');
  await expect(page.locator('.th-warning-line')).toBeVisible();
  // The first Enter arms the button; nothing happens until the second.
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-action=end-year]')).toContainText('Press again');
  await expectScreen(page, 'plan');
  await page.keyboard.press('Enter');
  await expectScreen(page, 'turning');
  await page.keyboard.press('Space');
  await expectScreen(page, 'report');
  await expect(page.locator('[data-action=continue]')).toContainText('The council meets');
  await page.keyboard.press('Enter');
  await expectScreen(page, 'dusk');
  await expect(page.locator('.th-dusk h1')).toHaveText('The Council Has Spoken');
  await page.locator('[data-action=read-chronicle]').click();
  await expectChronicle(page, 'The Council Has Spoken');
  expect(problems).toEqual([]);
});

test("a year decreed through the scribe's console", async ({ page }) => {
  const problems = watchConsole(page);
  await openGame(page, { seed: SEEDS.worthCarving });
  await page.locator('[data-action=begin-classic]').click();
  await skipTour(page);
  await page.keyboard.press('t');
  const input = page.locator('.th-console .th-paper__input');
  await expect(input).toBeFocused({ timeout: 20_000 });
  // Too dear first: refused with a reason, and asked again.
  await input.fill('500');
  await input.press('Enter');
  await expect(page.locator('.th-console')).toContainText('ENOUGH FOR');
  for (const typed of ['0', '0', '2000', '999']) {
    await expect(input).toBeFocused({ timeout: 20_000 });
    await input.fill(typed);
    await input.press('Enter');
  }
  await expectScreen(page, 'turning');
  await page.keyboard.press('Space');
  await expectScreen(page, 'report');
  await expect(page.locator('.th-report')).toContainText('999 acres were sown');
  expect(problems).toEqual([]);
});

test('a run resumes after a reload exactly where it was', async ({ page }) => {
  await openGame(page, { seed: SEEDS.worthCarving });
  await page.locator('[data-action=begin-classic]').click();
  await skipTour(page);
  await yearByKeyboard(page);
  await yearByKeyboard(page);
  await expectScreen(page, 'plan');
  const before = await topBar(page);
  expect(before).toContain('Year 3 of 10');
  await page.reload();
  await expectScreen(page, 'plan');
  expect(await topBar(page)).toBe(before);
  // And from the game menu, by its Continue entry.
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Game menu' }).click();
  await expectScreen(page, 'menu');
  await page.locator('[data-action^=continue-]').first().click();
  await expectScreen(page, 'plan');
  expect(await topBar(page)).toBe(before);
});

test('replaying a world brings the same dice and the earlier run as a ghost', async ({ page }) => {
  await openGame(page, { seed: SEEDS.deposed });
  await page.locator('[data-action=begin-classic]').click();
  await skipTour(page);
  await yearByKeyboard(page);
  const firstYear = await topBar(page);
  // End the run quickly: nobody fed, asked twice.
  await page.keyboard.press('f');
  await page.keyboard.press('Control+a');
  await page.keyboard.type('0');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expectScreen(page, 'turning');
  await page.keyboard.press('Space');
  await page.locator('[data-action=continue]').click();
  await page.locator('[data-action=read-chronicle]').click();
  await expect(page).toHaveURL(/#\/chronicles\//);
  await page.getByRole('button', { name: 'Replay this world' }).click();
  await expectScreen(page, 'plan');
  await yearByKeyboard(page);
  expect(await topBar(page)).toBe(firstYear);
  await expect(page.locator('.th-ghost').first()).toContainText('Last time');
});
