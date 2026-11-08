/**
 * Every way out, and every way back: the Hall's "Back to the Hall" on the
 * game menu (and Escape there), the pause menu's entries, the game's own
 * sheets, the end screen's buttons and the chronicle's. Then an
 * accessibility scan of the screens players spend their time on.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { beginSolo, expectScreen, openGame, seal, watchConsole } from './support.ts';

async function expectHallHome(page: Page): Promise<void> {
  await expect(page).not.toHaveURL(/#\/(sim|play)\//);
  await expect(page.locator('.cf')).toHaveCount(0);
}

async function openPause(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
}

test('the game menu leads back to the Hall, by its button and by Escape', async ({ page }) => {
  await openGame(page);
  await page.getByRole('button', { name: 'Back to the Hall' }).click();
  await expectHallHome(page);
  await openGame(page);
  await page.keyboard.press('Escape');
  await expectHallHome(page);
});

test('the pause menu resumes, opens the game menu, and leaves for the Hall', async ({ page }) => {
  const problems = watchConsole(page);
  await openGame(page);
  await beginSolo(page);
  await expectScreen(page, 'year');
  await openPause(page);
  await page.getByRole('button', { name: 'Resume' }).click();
  await expectScreen(page, 'year');
  await seal(page);
  await expectScreen(page, 'review');
  await page.locator('[data-action="continue"]').click();
  await expectScreen(page, 'year');

  await openPause(page);
  await page.getByRole('button', { name: 'Game menu' }).click();
  await expectScreen(page, 'menu');
  await expect(page.locator('[data-action^="resume-"]')).toHaveCount(1);
  await page.locator('[data-action^="resume-"]').click();
  await expectScreen(page, 'year');
  await openPause(page);
  await page.getByRole('button', { name: 'Back to the Hall' }).click();
  await expectHallHome(page);
  expect(problems).toEqual([]);
});

test('the pause menu carries the Ledger, the Codex and the game’s options', async ({ page }) => {
  await openGame(page);
  await beginSolo(page);
  await expectScreen(page, 'year');
  for (const [item, dialog] of [
    ['Ledger', /Ledger/],
    ['Codex', /Codex/],
    ['Crown of Florins options', /options/],
  ] as const) {
    await openPause(page);
    await page.getByRole('button', { name: item }).click();
    await expect(page.getByRole('dialog', { name: dialog })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: dialog })).toHaveCount(0);
  }
  // The Ledger opens by its key too.
  await page.keyboard.press('l');
  await expect(page.getByRole('dialog', { name: /Ledger/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expectScreen(page, 'year');
});

test('the court setup and the scenarios lead back to the game menu', async ({ page }) => {
  await openGame(page);
  await page.locator('[data-action="begin-solo"]').click();
  await page.locator('[data-action="back"]').click();
  await expectScreen(page, 'menu');
  await page.locator('[data-action="scenarios"]').click();
  await page.locator('[data-action="back"]').click();
  await expectScreen(page, 'menu');
  await page.locator('[data-action="codex"]').click();
  await expect(page.getByRole('dialog', { name: /Codex/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-action="codex"]')).toBeFocused();
});

test('the end screen and the chronicle offer Play again, the game menu and the Hall', async ({
  page,
}) => {
  await openGame(page);
  await page.locator('[data-action="begin-endless"]').click();
  await page.locator('[data-action="begin"]').click();
  await expectScreen(page, 'year');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Close the chronicle' }).click();
  await expectScreen(page, 'ending');
  const order = await page.locator('.cf-ending__actions button').allTextContents();
  expect(order.map((t) => t.replace(/\s+/g, ' ').trim())).toEqual([
    'Read the chronicle',
    'Play again R',
    'Game menu',
    'Back to the Hall H',
  ]);
  await page.locator('[data-action="read-chronicle"]').click();
  await expect(page).toHaveURL(/#\/chronicles\/[^?]+\?results/);
  const chronicle = page.url();
  await page.keyboard.press('r');
  await expectScreen(page, 'year');
  await page.goto(chronicle);
  await page.getByRole('button', { name: /Back to the Hall/ }).click();
  await expectHallHome(page);
});

test.describe('accessibility', () => {
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
      .include('.cf')
      .exclude('canvas')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
  };

  for (const appearance of ['light', 'dark'] as const) {
    test(`menu, setup, the year and the scroll pass axe in the ${appearance} appearance`, async ({
      page,
    }) => {
      await openGame(page, { appearance });
      expect((await scan(page)).violations).toEqual([]);
      await page.locator('[data-action="begin-solo"]').click();
      await expectScreen(page, 'setup');
      expect((await scan(page)).violations).toEqual([]);
      await page.locator('[data-action="begin"]').click();
      await expectScreen(page, 'year');
      for (const step of ['harvest', 'market', 'bread', 'taxes', 'builders']) {
        await page.locator(`.cf-step[data-step="${step}"]`).click();
        expect((await scan(page)).violations).toEqual([]);
      }
      await seal(page);
      await expectScreen(page, 'review');
      expect((await scan(page)).violations).toEqual([]);
    });
  }

  test('every control of a step is reachable by Tab and shows its focus', async ({ page }) => {
    await openGame(page);
    await beginSolo(page);
    await expectScreen(page, 'year');
    await page.locator('.cf-step[data-step="taxes"]').click();
    const seen = new Set<string>();
    for (let press = 0; press < 40; press++) {
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => {
        const active = document.activeElement as HTMLElement | null;
        if (!active || active === document.body) return null;
        const style = getComputedStyle(active);
        return {
          key:
            [active.id, active.dataset.action, active.dataset.level].find(Boolean) ??
            active.tagName,
          visible: style.outlineStyle !== 'none' || style.boxShadow !== 'none',
        };
      });
      if (!focused) continue;
      expect(focused.visible, `${focused.key} shows its focus`).toBe(true);
      seen.add(focused.key);
    }
    for (const expected of ['cf-customs', 'cf-sales', 'cf-wealth', 'seal']) {
      expect([...seen]).toContain(expected);
    }
  });
});
