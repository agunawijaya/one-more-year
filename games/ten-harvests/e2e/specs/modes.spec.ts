/**
 * The other ways in: today's world (the same for everyone), a curated
 * scenario, a thirty-year Dynasty with its interludes, and the 1978 Ledger
 * on the teletype, including the old averaging quirk.
 */
import { expect, test, type Page } from '@playwright/test';
import {
  expectChronicle,
  expectScreen,
  leaveStele,
  openGame,
  SEEDS,
  topBar,
  watchConsole,
  yearByKeyboard,
} from './support.ts';

test('today’s world is the same world in two separate browsers', async ({ browser }) => {
  const seen: string[][] = [];
  for (let visit = 0; visit < 2; visit++) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await openGame(page);
    await page.locator('[data-action=begin-daily]').click();
    const opening = await topBar(page);
    await yearByKeyboard(page);
    await yearByKeyboard(page);
    seen.push([opening, await topBar(page)]);
    await context.close();
  }
  expect(seen[1]).toEqual(seen[0]);
});

test('a scenario starts from its own numbers and states its own odds', async ({ page }) => {
  const problems = watchConsole(page);
  await openGame(page);
  await page.locator('[data-action=scenarios]').click();
  await expectScreen(page, 'scenarios');
  await page.locator('[data-scenario=dry-decade]').click();
  await expectScreen(page, 'plan');
  await expect(page.locator('.th-title')).toContainText('Dry Decade');
  await expect(page.locator('.th-ledger')).toContainText('1 to 3 bushels an acre');
  await expect(page.locator('.th-odds__bar')).toHaveCount(3);
  await yearByKeyboard(page);
  await expect(page.locator('.th-year')).toContainText('Year 2 of 10');
  expect(problems).toEqual([]);
});

test('a Dynasty passes the city to two heirs, a stele for each term', async ({ page }) => {
  test.slow();
  const problems = watchConsole(page);
  await openGame(page, { seed: SEEDS.dynasty });
  await page.locator('[data-action=begin-dynasty]').click();
  for (let term = 1; term <= 3; term++) {
    for (let year = 1; year <= 10; year++) await yearByKeyboard(page);
    if (term < 3) {
      await expectScreen(page, 'stele');
      await expect(page.locator('[data-action=stele-continue]')).toContainText(
        'The heir takes the city',
      );
      await leaveStele(page, 'keyboard');
      await expect(page.locator('.th-year')).toContainText(`Year ${term * 10 + 1} of 30`);
    }
  }
  await expect(page.locator('.th-stele-panel')).toContainText('Three rulers, three stones');
  await leaveStele(page, 'keyboard');
  await expect(page).toHaveURL(/#\/chronicles\//);
  expect(problems).toEqual([]);
});

/** The three numbers from the top bar. */
async function cityNumbers(page: Page): Promise<{ people: number; grain: number; acres: number }> {
  const read = async (name: string): Promise<number> =>
    Number(
      (await page.locator('.th-signal', { hasText: name }).locator('b').innerText()).replace(
        /,/g,
        '',
      ),
    );
  return { people: await read('People'), grain: await read('Grain'), acres: await read('Acres') };
}

async function answer(page: Page, typed: number): Promise<void> {
  const input = page.locator('.th-dock .th-paper__input');
  await expect(input).toBeFocused({ timeout: 30_000 });
  await input.fill(String(typed));
  await input.press('Enter');
}

test('the 1978 Ledger: a term on the teletype, one generous year skipped by the average', async ({
  page,
}) => {
  test.slow();
  const problems = watchConsole(page);
  await openGame(page, { seed: SEEDS.ledger });
  await page.locator('[data-action=begin-ledger]').click();
  await expectScreen(page, 'plan');
  await expect(page.locator('.th-dock')).toContainText('ACRES TO BUY?', { timeout: 30_000 });
  for (let year = 1; year <= 10; year++) {
    const { people, grain, acres } = await cityNumbers(page);
    // In the first year, one ration more than there are people: the old program then leaves
    // the year out of its average of hunger.
    const food = Math.min(grain, people * 20 + (year === 1 ? 20 : 0));
    const plant = Math.max(0, Math.min(acres, people * 10 - 1, (grain - food) * 2 + 1));
    for (const typed of [0, 0, food, plant]) await answer(page, typed);
    await expectScreen(page, 'turning');
    await page.keyboard.press('Space');
    await expectScreen(page, 'report');
    if (year === 1) {
      await expect(page.locator('.th-report')).toContainText(
        'More rations were handed out than there were mouths to feed.',
      );
    }
    await page.keyboard.press('Enter');
  }
  await expectScreen(page, 'stele');
  await expect(page.getByText('The Generosity Paradox').first()).toBeVisible();
  await leaveStele(page, 'keyboard');
  await expectChronicle(page, 'A Reign Worth Carving');
  expect(problems).toEqual([]);
});
