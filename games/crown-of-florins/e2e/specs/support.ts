/**
 * Shared steps for the Crown of Florins suites: opening the development Hall
 * on a fixed clock and seed, reading which screen is up, and walking years
 * through the real screens.
 *
 * A long reign is walked with the development hook `__crown`: a bot fills in
 * each year's plan (as a player could, by hand), and the test then seals it
 * and goes through every screen that follows exactly as a player would.
 *
 * Seeds were found by walking games with e2e/deep-walk.ts.
 */
import { expect, type Page } from '@playwright/test';
import { fixSeed } from '../fixed-seed.ts';

/** A fixed clock: the daily world, the court suggestions and dates stay the same. */
export const FIXED_NOW = '2026-10-13T09:00:00Z';

export const SEEDS = {
  /** Solo, the default court: the founder dies in 1426; ruled by the General's plans, crowned in 1432. */
  crowned: 7,
  /** Solo, the default court, the year screen's own plan each year: a rival is crowned in 1425. */
  rivalCrowned: 51,
} as const;

export type Speed = 'cinematic' | 'quick' | 'instant';

export interface OpenOptions {
  seed?: number;
  appearance?: 'light' | 'dark';
  speed?: Speed;
  valley?: boolean;
  tour?: boolean;
  route?: string;
}

/** Opens the game's own menu in the development Hall as a returning visitor. */
export async function openGame(page: Page, options: OpenOptions = {}): Promise<void> {
  await fixSeed(page, options.seed ?? SEEDS.crowned);
  const settings = {
    speed: options.speed ?? 'instant',
    valley: options.valley ?? false,
    tutorialDone: !(options.tour ?? false),
  };
  await page.addInitScript(
    `if (!sessionStorage.getItem('cf-seeded')) { sessionStorage.setItem('cf-seeded', '1'); localStorage.setItem('omy:sim-settings:crown-of-florins', ${JSON.stringify(JSON.stringify({ v: 1, d: settings }))}); }`,
  );
  const appearance = options.appearance ?? 'light';
  await page.goto(
    `/index.html?now=${FIXED_NOW}&appearance=${appearance}${options.route ?? '#/sim/crown-of-florins'}`,
  );
  // The development server may still be transforming the game's modules on a first visit.
  await expect(page.locator('.cf')).toBeVisible({ timeout: 30_000 });
}

export async function expectScreen(page: Page, name: string): Promise<void> {
  await expect(page.locator('.cf')).toHaveAttribute('data-screen', name, { timeout: 30_000 });
}

export async function screenOf(page: Page): Promise<string> {
  return (
    (await page
      .locator('.cf')
      .getAttribute('data-screen')
      .catch(() => null)) ?? ''
  );
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

/** From the menu, through the court setup with its defaults, into the first year. */
export async function beginSolo(page: Page): Promise<void> {
  await page.locator('[data-action="begin-solo"]').click();
  await expectScreen(page, 'setup');
  await page.locator('[data-action="begin"]').click();
}

export type Policy = 'steward' | 'merchant' | 'general' | 'builder' | 'miser' | 'saint';

export async function planWith(page: Page, policy: Policy): Promise<void> {
  await page.evaluate(
    (p) => (window as unknown as { __crown: { planWith(p: string): boolean } }).__crown.planWith(p),
    policy,
  );
}

export async function patchPlan(page: Page, patch: Record<string, unknown>): Promise<void> {
  await page.evaluate(
    (p) =>
      (window as unknown as { __crown: { patchPlan(p: unknown): boolean } }).__crown.patchPlan(p),
    patch,
  );
}

export interface WorldSummary {
  year: number;
  end: { ending: string; seat: number; year: number } | null;
  realms: { seat: number; title: number; status: string; generation: number; treasury: number }[];
}

export async function worldOf(page: Page): Promise<WorldSummary | null> {
  return page.evaluate(() => {
    const state = (
      window as unknown as {
        __crown?: {
          state(): {
            year: number;
            end: WorldSummary['end'];
            realms: {
              seat: number;
              title: number;
              status: string;
              treasury: number;
              ruler: { generation: number };
            }[];
          } | null;
        };
      }
    ).__crown?.state();
    if (!state) return null;
    return {
      year: state.year,
      end: state.end,
      realms: state.realms.map((r) => ({
        seat: r.seat,
        title: r.title,
        status: r.status,
        generation: r.ruler.generation,
        treasury: r.treasury,
      })),
    };
  });
}

/** Seals the year on screen (agreeing to the question if the plan asks one). */
export async function seal(page: Page): Promise<void> {
  await expectScreen(page, 'year');
  await page.locator('[data-action="seal"]').click();
  const ask = page.locator('[data-action="seal-anyway"]');
  if (await ask.isVisible().catch(() => false)) await ask.click();
}

/**
 * Plays years through the screens until `until` holds or `years` are sealed:
 * the plan from a bot, then every screen that follows answered as a player would.
 * Returns the screens met, in order.
 */
export async function playYears(
  page: Page,
  options: { years: number; policy?: Policy; until?: (screen: string) => boolean },
): Promise<string[]> {
  const met: string[] = [];
  let sealed = 0;
  for (let guard = 0; guard < options.years * 12 + 20; guard++) {
    const screen = await screenOf(page);
    if (met.at(-1) !== screen) met.push(screen);
    if (options.until?.(screen)) return met;
    if (screen === 'year') {
      if (sealed >= options.years) return met;
      if (options.policy) await planWith(page, options.policy);
      await seal(page);
      sealed++;
    } else if (screen === 'ending') {
      return met;
    } else if (screen === 'handover') {
      await page.locator('[data-action="ready"]').click();
    } else if (screen === 'harvest') {
      await page.keyboard.press('Space');
    } else if (screen === 'coronation') {
      const next = page.locator('.cf-coronation__next:not([hidden])');
      if (await next.isVisible().catch(() => false)) await next.click();
      else
        await page
          .locator('[data-action="skip"]')
          .click()
          .catch(() => undefined);
    } else {
      const next = page.locator('[data-action="continue"]');
      if (
        await next
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        await next
          .first()
          .click()
          .catch(() => undefined);
      }
    }
    await page.waitForTimeout(60);
  }
  return met;
}
