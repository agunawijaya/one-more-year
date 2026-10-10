/**
 * Shared helpers for the end-to-end suites: opening the Hall as a returning
 * or first-time visitor, collecting console problems, and playing Pond.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

export type ThemeName = 'almanac' | 'situation-room' | 'terrarium';
export type AppearanceName = 'light' | 'dark';

export const THEMES: readonly ThemeName[] = ['almanac', 'situation-room', 'terrarium'];
export const APPEARANCES: readonly AppearanceName[] = ['light', 'dark'];
/** The harness clock, so dates and daily numbers are stable. */
export const FIXED_NOW = '2026-10-09T09:00:00Z';

/** Seeds a returning visitor's settings before any page script runs. */
export async function returningVisitor(
  page: Page,
  look: { theme?: ThemeName; appearance?: AppearanceName | 'system' } = {},
): Promise<void> {
  await page.addInitScript(
    (settings) => {
      if (localStorage.getItem('omy:settings') === null) {
        localStorage.setItem('omy:settings', JSON.stringify({ v: 1, d: settings }));
      }
    },
    {
      introSeen: true,
      themeChosen: true,
      theme: look.theme ?? 'almanac',
      appearance: look.appearance ?? 'light',
    },
  );
}

/** Records console errors and uncaught exceptions; assert it is empty at the end of a test. */
export function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text());
  });
  page.on('pageerror', (error) => problems.push(error.message));
  return problems;
}

/** Opens the harness (the Hall with Pond) at a route. */
export async function openHarness(page: Page, route = '#/', query = ''): Promise<void> {
  await page.goto(`/harness.html?now=${FIXED_NOW}${query ? `&${query}` : ''}${route}`);
}

/** The simulation's current view as the stage knows it. */
export function stageView(page: Page): Promise<string | null> {
  return page.evaluate(() =>
    (window as unknown as { __harness: { view(): string | null } }).__harness.view(),
  );
}

export async function expectView(page: Page, view: string | null): Promise<void> {
  await expect.poll(() => stageView(page)).toBe(view);
}

/** A catch the pond can afford: never more than the fish it holds. */
async function affordable(page: Page, fish: number): Promise<number> {
  const max = Number(await page.locator('#pond-catch').getAttribute('max'));
  return Math.min(fish, Number.isFinite(max) ? max : fish);
}

/** Plays one Pond year with the mouse: types the catch, ends the year, continues from the report. */
export async function playYearWithMouse(page: Page, fish: number): Promise<void> {
  await expectView(page, 'plan');
  await page
    .getByLabel('Catch this year')
    .first()
    .fill(String(await affordable(page, fish)));
  await page.getByRole('button', { name: 'End the year' }).click();
  await expectView(page, 'report');
  await page.locator('[data-action="continue"]').click();
}

/** Plays one Pond year with the keyboard only. */
export async function playYearWithKeyboard(page: Page, fish: number): Promise<void> {
  await expectView(page, 'plan');
  const input = page.locator('#pond-catch');
  await expect(input).toBeFocused();
  await page.keyboard.press('Control+A');
  await page.keyboard.type(String(await affordable(page, fish)));
  await tabTo(page, '[data-action="end-year"]');
  await page.keyboard.press('Enter');
  await expectView(page, 'report');
  await expect(page.locator('[data-action="continue"]')).toBeFocused();
  await page.keyboard.press('Enter');
}

/** Presses Tab until the element matching the selector has focus (fails after 40 presses). */
export async function tabTo(page: Page, selector: string, backwards = false): Promise<void> {
  for (let i = 0; i < 40; i++) {
    const focused = await page.evaluate(
      (wanted) => document.activeElement?.matches(wanted) ?? false,
      selector,
    );
    if (focused) return;
    await page.keyboard.press(backwards ? 'Shift+Tab' : 'Tab');
  }
  throw new Error(`Could not reach ${selector} with Tab`);
}

/** Plays Pond years until the results page shows. */
export async function finishRun(page: Page, fish = 12, keyboard = false): Promise<void> {
  for (let year = 0; year < 8; year++) {
    if (page.url().includes('?results')) break;
    if (keyboard) await playYearWithKeyboard(page, fish);
    else await playYearWithMouse(page, fish);
  }
  await expect(page).toHaveURL(/#\/chronicles\/[^?]+\?results$/);
}

/** Switches theme and appearance for an existing profile, then reloads. */
export async function setLook(
  page: Page,
  theme: ThemeName,
  appearance: AppearanceName,
): Promise<void> {
  await page.evaluate(
    ([t, a]) => {
      const stored = JSON.parse(localStorage.getItem('omy:settings') ?? '{"v":1,"d":{}}') as {
        v: number;
        d: Record<string, unknown>;
      };
      stored.d = { ...stored.d, theme: t, appearance: a, introSeen: true, themeChosen: true };
      localStorage.setItem('omy:settings', JSON.stringify(stored));
    },
    [theme, appearance] as const,
  );
}

/**
 * Runs axe on the page against WCAG 2.1 A and AA, and fails with a readable
 * list of the rules and elements that broke.
 */
export async function expectAccessible(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const found = results.violations.map(
    (violation) =>
      `${violation.id}: ${violation.help}\n` +
      violation.nodes
        .slice(0, 5)
        .map((node) => `    ${node.target.join(' ')}  ${node.failureSummary ?? ''}`.trimEnd())
        .join('\n'),
  );
  expect(found, `axe on ${label}`).toEqual([]);
}
