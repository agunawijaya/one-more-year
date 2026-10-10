/**
 * The lived-in profile every screenshot is taken against, built the honest
 * way: by playing Pond through the real Hall. Daily scenarios on four of
 * five days (the missed day becomes a pressed flower), a replay of the last
 * daily world with its ghost, and one run left in progress.
 */
import { type Page } from '@playwright/test';
import { expectView, finishRun, playYearWithMouse } from '../support.ts';

/** The day the screenshots are taken on (the harness clock). */
export const SHOT_DAY = '2026-10-13T16:00:00Z';

const DAILIES: readonly [string, number][] = [
  ['2026-10-09', 14],
  ['2026-10-10', 6],
  ['2026-10-12', 10],
  ['2026-10-13', 24],
];

export interface Profile {
  /** The replay's chronicle: it has a ghost to draw. */
  replayId: string;
  /** The run left in progress. */
  runId: string;
}

export async function buildProfile(page: Page): Promise<Profile> {
  for (const [day, fish] of DAILIES) {
    await page.goto(`/harness.html?now=${day}T10:00:00Z#/play/pond?daily`);
    await expectView(page, 'plan');
    await finishRun(page, fish);
  }
  await page.locator('[data-action="replay"]').click();
  await expectView(page, 'plan');
  await finishRun(page, 14);
  const replayId = /#\/chronicles\/([^?]+)/.exec(page.url())?.[1] ?? '';
  await page.goto(`/harness.html?now=${SHOT_DAY}#/play/pond?new=overgrown`);
  for (let year = 0; year < 3; year++) await playYearWithMouse(page, 9);
  await expectView(page, 'plan');
  const runId = /run=([^&]+)/.exec(page.url())?.[1] ?? '';
  return { replayId, runId };
}

/** Opens a route as a fresh boot, so changed settings take effect. */
export async function openFresh(
  page: Page,
  route: string,
  wait: number,
  query = '',
): Promise<void> {
  await page.goto('about:blank');
  await page.goto(`/harness.html?now=${SHOT_DAY}${query ? `&${query}` : ''}${route}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(wait);
}
