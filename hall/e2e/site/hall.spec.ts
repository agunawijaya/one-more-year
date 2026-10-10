// The built Hall as players get it (vite preview on 5479): every theme in
// light and dark, live theme and appearance changes, the OS colour scheme on
// System, keyboard-only navigation to a world's detail, and browser Back.
// The worlds here are the two in the catalog (Ten Harvests, playable, and a
// planned one); the full turn loop is covered by the harness suite and by
// each simulation's own suite.
import { expect, test, type Page } from '@playwright/test';
import {
  APPEARANCES,
  THEMES,
  expectAccessible,
  returningVisitor,
  tabTo,
  watchConsole,
  type ThemeName,
} from '../support.ts';

/**
 * The element each theme draws for one world, and the control that opens its
 * detail. Crown of Florins, because the first world is already focused.
 */
const WORLD: Record<ThemeName, { world: string; open: string }> = {
  almanac: {
    world: '.almanac-chapter[data-sim="crown-of-florins"]',
    open: '.almanac-chapter[data-sim="crown-of-florins"]',
  },
  'situation-room': {
    world: '.room-tile[data-sim="crown-of-florins"]',
    open: '.room-tile[data-sim="crown-of-florins"] [data-action="brief"]',
  },
  terrarium: {
    world: '.terra-dome[data-sim="crown-of-florins"]',
    open: '.terra-dome__glass[data-sim="crown-of-florins"]',
  },
};

async function openHall(page: Page): Promise<void> {
  await page.goto('/#/');
  await expect(page.locator('html')).toHaveAttribute('data-view', 'hall');
}

for (const theme of THEMES) {
  for (const appearance of APPEARANCES) {
    test(`${theme} in ${appearance}: both planned worlds, no errors, accessible`, async ({
      page,
    }) => {
      const problems = watchConsole(page);
      await returningVisitor(page, { theme, appearance });
      await openHall(page);
      const html = page.locator('html');
      await expect(html).toHaveAttribute('data-theme', theme);
      await expect(html).toHaveAttribute('data-appearance', appearance);
      await expect(page.locator(WORLD[theme].world)).toBeVisible();
      await expect(page.locator('[data-sim="ten-harvests"]').first()).toBeAttached();
      // Let the entrance motion settle so axe sees final colours.
      await page.waitForTimeout(1200);
      await expectAccessible(page, `${theme} ${appearance}`);
      expect(problems).toEqual([]);
    });
  }
}

test('the top bar switches theme and appearance live', async ({ page }) => {
  const problems = watchConsole(page);
  await returningVisitor(page);
  await openHall(page);
  const html = page.locator('html');

  await page.locator('[data-theme-choice="terrarium"]').click();
  await expect(html).toHaveAttribute('data-theme', 'terrarium');
  await expect(page.locator('.terra')).toBeVisible();
  await page.locator('[data-theme-choice="situation-room"]').click();
  await expect(html).toHaveAttribute('data-theme', 'situation-room');
  await expect(page.locator('.room')).toBeVisible();

  await page.locator('[data-action="toggle-appearance"]').click();
  await expect(html).toHaveAttribute('data-appearance', 'dark');
  await page.locator('[data-action="toggle-appearance"]').click();
  await expect(html).toHaveAttribute('data-appearance', 'light');

  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'situation-room');
  expect(problems).toEqual([]);
});

test('on System, the Hall follows the OS colour scheme as it changes', async ({ page }) => {
  await returningVisitor(page, { appearance: 'system' });
  await page.emulateMedia({ colorScheme: 'light' });
  await openHall(page);
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-appearance', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(html).toHaveAttribute('data-appearance', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(html).toHaveAttribute('data-appearance', 'light');
});

for (const theme of THEMES) {
  test(`keyboard only reaches a world and its detail in ${theme}`, async ({ page }) => {
    const problems = watchConsole(page);
    await returningVisitor(page, { theme });
    await openHall(page);
    await page.locator('body').focus();
    await tabTo(page, WORLD[theme].open);
    await page.keyboard.press('Enter');

    if (theme === 'almanac') {
      await expect(page.locator('.almanac-page--right')).toContainText('Crown of Florins');
      await expect(page).toHaveURL(/#\/\?sim=crown-of-florins$/);
    } else {
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText('Crown of Florins');
      await expect(dialog).toContainText(/in preparation/i);
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
    }
    expect(problems).toEqual([]);
  });
}

test('browser Back walks back through the Hall pages', async ({ page }) => {
  const problems = watchConsole(page);
  await returningVisitor(page);
  await openHall(page);
  await page.locator('.top-bar__link[data-page="library"]').click();
  await expect(page).toHaveURL(/#\/chronicles$/);
  await page.locator('.top-bar__link[data-page="codex"]').click();
  await expect(page).toHaveURL(/#\/codex$/);
  await page.locator('.top-bar__link[data-page="legacy"]').click();
  await expect(page).toHaveURL(/#\/legacy$/);

  await page.goBack();
  await expect(page).toHaveURL(/#\/codex$/);
  await expect(page.locator('#page-title')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/#\/chronicles$/);
  await page.goBack();
  await expect(page.locator('html')).toHaveAttribute('data-view', 'hall');
  expect(problems).toEqual([]);
});
