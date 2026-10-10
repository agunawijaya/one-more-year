// A first visit on a fresh profile: the intro (skippable, at most five
// seconds, a still cross-fade under reduced motion) and the "Choose your
// study" picker, neither shown again unless asked for from Settings.
import { expect, test } from '@playwright/test';
import { watchConsole } from '../support.ts';

test('the intro plays once, any key skips it, and the picker chooses a theme', async ({ page }) => {
  const problems = watchConsole(page);
  await page.goto('/#/');
  const intro = page.locator('.intro');
  await expect(intro).toBeVisible();
  await expect(intro).toContainText('Just one more year.');
  await page.keyboard.press('Space');
  await expect(intro).toBeHidden();

  const picker = page.getByRole('dialog', { name: 'Choose your study' });
  await expect(picker).toBeVisible();
  await expect(picker.locator('.picker__card')).toHaveCount(3);
  await picker.locator('.picker__card[data-theme-choice="terrarium"]').click();
  await expect(picker).toBeHidden();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'terrarium');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-view', 'hall');
  await expect(page.locator('.intro')).toHaveCount(0);
  await expect(page.locator('.picker')).toHaveCount(0);
  expect(problems).toEqual([]);
});

test('the intro ends by itself within five seconds, and Skip picks the Almanac', async ({
  page,
}) => {
  await page.goto('/#/');
  await expect(page.locator('.intro')).toBeVisible();
  await expect(page.locator('.intro')).toBeHidden({ timeout: 5500 });
  await page.locator('[data-action="skip-picker"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'almanac');
});

test('under reduced motion the intro is a single still frame', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#/');
  await expect(page.locator('.intro.intro--still')).toBeVisible();
  await expect(page.locator('.intro__year--new')).toHaveCSS('opacity', '1');
  await page.mouse.click(10, 10);
  await expect(page.locator('.intro')).toBeHidden();
});

test('Settings can show the intro and the picker again', async ({ page }) => {
  await page.goto('/#/');
  await page.keyboard.press('Space');
  await page.locator('[data-action="skip-picker"]').click();

  await page.locator('[data-action="settings"]').click();
  await page.locator('[data-action="replay-intro"]').click();
  await expect(page.locator('.intro')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('.intro')).toBeHidden();

  await page.locator('[data-action="settings"]').click();
  await page.locator('[data-action="choose-theme"]').click();
  const picker = page.getByRole('dialog', { name: 'Choose your study' });
  await expect(picker).toBeVisible();
  await picker.locator('.picker__card[data-theme-choice="situation-room"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'situation-room');
});
