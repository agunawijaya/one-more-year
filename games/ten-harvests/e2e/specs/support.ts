/**
 * Shared steps for the Ten Harvests suites: opening the development Hall on
 * a fixed clock and seed, reading which screen is up, and the moves a player
 * makes through a year by mouse or by keyboard.
 *
 * Seeds used below were found with e2e/seed-search.ts: on each, simply
 * accepting the drafted decree every year has a known ending.
 */
import { expect, type Page } from '@playwright/test';
import { fixSeed } from '../fixed-seed.ts';

/** A fixed clock: the daily world and dates on the chronicle stay the same. */
export const FIXED_NOW = '2026-10-10T09:00:00Z';

export const SEEDS = {
  /** Classic, drafted decrees: ten years, "A Reign Worth Carving". */
  worthCarving: 109,
  /** Classic, drafted decrees: deposed. */
  deposed: 2,
  /** Dynasty, drafted decrees: all three terms complete. */
  dynasty: 8,
  /** 1978 Ledger, drafted decrees: ten years complete. */
  ledger: 1,
} as const;

export interface OpenOptions {
  seed?: number;
  appearance?: 'light' | 'dark';
  route?: string;
}

/** Opens the game's own menu in the development Hall as a returning visitor. */
export async function openGame(page: Page, options: OpenOptions = {}): Promise<void> {
  if (options.seed !== undefined) await fixSeed(page, options.seed);
  const appearance = options.appearance ?? 'light';
  await page.goto(
    `/index.html?now=${FIXED_NOW}&appearance=${appearance}${options.route ?? '#/sim/ten-harvests'}`,
  );
  await expect(page.locator('.th')).toBeVisible();
}

export async function expectScreen(page: Page, name: string): Promise<void> {
  await expect(page.locator('.th')).toHaveAttribute('data-screen', name, { timeout: 30_000 });
}

/** Console errors and uncaught exceptions; expect it empty at the end of a test. */
export function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text());
  });
  page.on('pageerror', (error) => problems.push(error.message));
  return problems;
}

/** The first classic term starts with the tour; most tests step past it. */
export async function skipTour(page: Page): Promise<void> {
  await page.locator('[data-action=coach-skip]').click();
  await expect(page.locator('.th-coach')).toHaveCount(0);
}

/** The three numbers and the year, as the top bar shows them. */
export async function topBar(page: Page): Promise<string> {
  return (await page.locator('.th-topbar').innerText()).replace(/\s+/g, ' ').trim();
}

/** One year by keyboard: Enter ends it, Space skips the cinematic, Enter continues. */
export async function yearByKeyboard(page: Page): Promise<void> {
  await expectScreen(page, 'plan');
  await page.keyboard.press('Enter');
  await expectScreen(page, 'turning');
  await page.keyboard.press('Space');
  await expectScreen(page, 'report');
  await expect(page.locator('[data-action=continue]')).toBeFocused();
  await page.keyboard.press('Enter');
}

/** One year by mouse: the button, a click on the city to skip, the report's button. */
export async function yearByMouse(page: Page): Promise<void> {
  await expectScreen(page, 'plan');
  await page.locator('[data-action=end-year]').click();
  await expectScreen(page, 'turning');
  await page.mouse.click(640, 360);
  await expectScreen(page, 'report');
  await page.locator('[data-action=continue]').click();
}

/** On the stele: finish the carving and go on to whatever comes next. */
export async function leaveStele(page: Page, by: 'mouse' | 'keyboard'): Promise<void> {
  await expectScreen(page, 'stele');
  const next = page.locator('[data-action=stele-continue]');
  if (by === 'mouse') {
    await page.mouse.click(640, 300);
    await next.click();
  } else {
    await page.keyboard.press('Space');
    await expect(next).toBeFocused();
    await page.keyboard.press('Enter');
  }
}

/** The chronicle the game handed over to, as the Hall shows it. */
export async function expectChronicle(page: Page, verdict: string): Promise<void> {
  await expect(page).toHaveURL(/#\/chronicles\/[^?]+\?results/);
  await expect(page.getByText(verdict, { exact: true }).first()).toBeVisible();
}
