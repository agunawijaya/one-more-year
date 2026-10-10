/**
 * Every way out, and every way back: the game menu's "Back to the Hall",
 * the pause menu's entries, the game's own sheets, the chronicle's buttons
 * after the hand-over, and the scenarios' way back. Then an accessibility
 * scan of the screens players spend their time on.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  expectScreen,
  openGame,
  SEEDS,
  skipTour,
  watchConsole,
  yearByKeyboard,
} from './support.ts';

async function expectHallHome(page: Page): Promise<void> {
  await expect(page).not.toHaveURL(/#\/(sim|play)\//);
  await expect(page.locator('.th')).toHaveCount(0);
}

async function startClassic(page: Page): Promise<void> {
  await page.locator('[data-action=begin-classic]').click();
  await skipTour(page);
}

async function openPause(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
}

test('the game menu leads back to the Hall', async ({ page }) => {
  await openGame(page);
  await page.getByRole('button', { name: 'Back to the Hall' }).click();
  await expectHallHome(page);
});

test('the pause menu resumes, opens the game menu and leaves for the Hall', async ({ page }) => {
  const problems = watchConsole(page);
  await openGame(page);
  await startClassic(page);
  await openPause(page);
  await page.getByRole('button', { name: 'Resume' }).click();
  await expectScreen(page, 'plan');
  // A run is offered to continue once a year of it has been lived.
  await yearByKeyboard(page);

  await openPause(page);
  await page.getByRole('button', { name: 'Game menu' }).click();
  await expectScreen(page, 'menu');
  await expect(page.locator('[data-action^=continue-]')).toHaveCount(1);

  await page.locator('[data-action^=continue-]').click();
  await expectScreen(page, 'plan');
  await openPause(page);
  await page.getByRole('button', { name: 'Back to the Hall' }).click();
  await expectHallHome(page);
  expect(problems).toEqual([]);
});

test('the pause menu carries the console, the Codex and the game’s options', async ({ page }) => {
  await openGame(page);
  await startClassic(page);

  await openPause(page);
  await page.getByRole('button', { name: /Codex/ }).click();
  const codex = page.getByRole('dialog', { name: /Codex/ });
  await expect(codex).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(codex).toHaveCount(0);

  await openPause(page);
  await page.getByRole('button', { name: /Ten Harvests options/ }).click();
  const options = page.getByRole('dialog', { name: /options/i });
  await expect(options).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(options).toHaveCount(0);

  await openPause(page);
  await page.getByRole('button', { name: /console/ }).click();
  await expect(page.locator('.th-console')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.th-console')).toHaveCount(0);
  await expectScreen(page, 'plan');
});

test('the game menu’s own links open and close', async ({ page }) => {
  await openGame(page);
  await page.locator('[data-action=how-to-play]').click();
  await expect(page.getByRole('dialog', { name: /How to play/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: /How to play/ })).toHaveCount(0);

  await page.locator('[data-action=codex]').click();
  await expect(page.getByRole('dialog', { name: /Codex/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-action=codex]')).toBeFocused();

  await page.locator('[data-action=scenarios]').click();
  await expectScreen(page, 'scenarios');
  await page.locator('[data-action=scenarios-back]').click();
  await expectScreen(page, 'menu');
});

test('after the hand-over, the chronicle leads to the game menu and to the Hall', async ({
  page,
}) => {
  await openGame(page, { seed: SEEDS.deposed });
  await startClassic(page);
  await page.keyboard.press('f');
  await page.keyboard.press('Control+a');
  await page.keyboard.type('0');
  for (let press = 0; press < 3; press++) await page.keyboard.press('Enter');
  await expectScreen(page, 'turning');
  await page.keyboard.press('Space');
  await page.locator('[data-action=continue]').click();
  await page.locator('[data-action=read-chronicle]').click();
  await expect(page).toHaveURL(/#\/chronicles\/[^?]+\?results/);
  const chronicle = page.url();

  await page.locator('[data-action=game-menu]').click();
  await expectScreen(page, 'menu');
  // A finished run is not offered as one to continue.
  await expect(page.locator('[data-action^=continue-]')).toHaveCount(0);

  await page.goto(chronicle);
  await page.getByRole('button', { name: /Back to the Hall/ }).click();
  await expectHallHome(page);
});

test.describe('accessibility', () => {
  // Contrast is measured on settled screens, not halfway through a panel fading in.
  const scan = async (page: Page) => {
    await page.waitForFunction(() =>
      document
        .getAnimations()
        .every(
          (animation) =>
            animation.playState !== 'running' ||
            animation.effect?.getTiming().iterations === Infinity,
        ),
    );
    return new AxeBuilder({ page })
      .include('.th')
      .exclude('canvas')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
  };

  for (const appearance of ['light', 'dark'] as const) {
    test(`menu, plan and report pass axe in the ${appearance} appearance`, async ({ page }) => {
      await openGame(page, { appearance, seed: SEEDS.worthCarving });
      expect((await scan(page)).violations).toEqual([]);
      await startClassic(page);
      expect((await scan(page)).violations).toEqual([]);
      await page.keyboard.press('Enter');
      await expectScreen(page, 'turning');
      await page.keyboard.press('Space');
      await expectScreen(page, 'report');
      expect((await scan(page)).violations).toEqual([]);
    });
  }

  test('every control on the plan is reachable by Tab and shows its focus', async ({ page }) => {
    await openGame(page);
    await startClassic(page);
    const seen = new Set<string>();
    for (let press = 0; press < 30; press++) {
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => {
        const active = document.activeElement as HTMLElement | null;
        if (!active || active === document.body) return null;
        const outline = getComputedStyle(active).outlineStyle;
        const ring = getComputedStyle(active).boxShadow;
        return {
          key:
            [active.id, active.dataset.action, active.dataset.handle].find(Boolean) ??
            active.tagName,
          visible: outline !== 'none' || ring !== 'none',
        };
      });
      if (!focused) continue;
      expect(focused.visible, `${focused.key} shows its focus`).toBe(true);
      seen.add(focused.key);
    }
    for (const expected of ['th-land', 'th-food', 'th-plant', 'end-year'])
      expect([...seen]).toContain(expected);
  });

  test('a year by keyboard keeps working under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openGame(page, { seed: SEEDS.worthCarving });
    await startClassic(page);
    await yearByKeyboard(page);
    await expectScreen(page, 'plan');
    await expect(page.locator('.th-year')).toContainText('Year 2 of 10');
  });
});
