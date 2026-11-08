/**
 * The ways a reign goes: to the crown, through a death and an heir, to the
 * end of a line under Classic fate, into the creditors' hands and out again,
 * and under an army's banners. Plus hot-seat with three rulers, whose curtain
 * must hide every realm's numbers until Ready.
 */
import { expect, test } from '@playwright/test';
import {
  beginSolo,
  expectScreen,
  openGame,
  patchPlan,
  playYears,
  seal,
  SEEDS,
  watchConsole,
  worldOf,
} from './support.ts';

test('a solo reign against three rivals reaches the crown and hands over to the chronicle', async ({
  page,
}) => {
  const problems = watchConsole(page);
  await openGame(page, { seed: SEEDS.crowned });
  await beginSolo(page);
  const met = await playYears(page, { years: 60, policy: 'general' });
  expect(met).toContain('obituary');
  expect(met).toContain('coronation');
  await expectScreen(page, 'ending');
  await expect(page.locator('.cf-ending__verdict')).toHaveText(/Crown/);
  await expect(page.locator('.cf-tree__ruler')).toHaveCount(2);
  await page.locator('[data-action="read-chronicle"]').click();
  await expect(page).toHaveURL(/#\/chronicles\/[^?]+\?results/);
  expect(problems).toEqual([]);
});

test('a ruler dies, the page is lettered, and the heir takes the throne one title lower', async ({
  page,
}) => {
  await openGame(page, { seed: SEEDS.crowned });
  await beginSolo(page);
  const before = await (async () => {
    await playYears(page, { years: 40, policy: 'general', until: (s) => s === 'obituary' });
    return worldOf(page);
  })();
  await expectScreen(page, 'obituary');
  await expect(page.locator('.cf-ms__head h1')).toContainText('Of the life and reign of');
  await page.locator('[data-action="continue"]').click();
  await playYears(page, { years: 1, until: (s) => s === 'year' });
  const after = await worldOf(page);
  expect(after?.realms[0]?.generation).toBe(2);
  expect(after?.realms[0]?.title).toBeLessThanOrEqual(before?.realms[0]?.title ?? 8);
  await expect(page.locator('.cf-report__news')).toContainText('takes the throne');
});

test('under Classic fate the founder’s death ends the game', async ({ page }) => {
  await openGame(page, { seed: SEEDS.crowned });
  await page.locator('[data-action="begin-solo"]').click();
  await page.locator('[data-fate="classic"]').click();
  await page.locator('[data-action="begin"]').click();
  const met = await playYears(page, { years: 40, policy: 'builder' });
  expect(met).toContain('obituary');
  await expectScreen(page, 'ending');
  const world = await worldOf(page);
  expect(world?.end?.ending).toBe('extinct');
  await expect(page.locator('.cf-ending__verdict')).toHaveText('The Last of the Line');
});

test('the creditors come, take nearly everything, and the realm goes on', async ({ page }) => {
  await openGame(page);
  await beginSolo(page);
  await expectScreen(page, 'year');
  // Ten pieces of cathedral at once: 50,000 florins, far past the creditors' line. As in 1978 the
  // builders are paid after the creditors have looked at the books, so they come the year after.
  await patchPlan(page, { build: { markets: 0, mills: 0, palace: 0, cathedral: 10, platoons: 0 } });
  await expect(page.locator('.cf-debt__warn')).toContainText('past the creditors’ line');
  await seal(page);
  await expectScreen(page, 'review');
  await page.locator('[data-action="continue"]').click();
  await seal(page);
  await expectScreen(page, 'review');
  await expect(page.locator('.cf-scroll__events')).toContainText('The creditors came');
  const world = await worldOf(page);
  expect(world?.realms[0]?.treasury).toBe(100);
  await page.locator('[data-action="continue"]').click();
  await playYears(page, { years: 2, policy: 'steward' });
  const later = await worldOf(page);
  expect(later?.year).toBeGreaterThanOrEqual(1403);
  expect(later?.end).toBeNull();
});

test('a neighbour’s army marches when the border watch is red', async ({ page }) => {
  await openGame(page, { valley: true });
  await page.locator('[data-action="scenarios"]').click();
  await page.locator('[data-scenario="general-next-door"]').click();
  await page.locator('[data-action="begin"]').click();
  // The first year without a single platoon; the General arms past 2.4 times our soldiers.
  await expectScreen(page, 'year');
  await seal(page);
  await playYears(page, { years: 1, until: (s) => s === 'year' });
  await expect(page.locator('.cf-verdict[data-border="open"]')).toBeVisible();
  await seal(page);
  await expectScreen(page, 'review');
  await expect(page.locator('.cf-scroll__events')).toContainText('army took');
  await page.locator('[data-action="continue"]').click();
  await expectScreen(page, 'valley');
  await expect(page.locator('.cf-valley__news')).toContainText('marched on');
});

test('hot-seat with three rulers hides every realm behind the curtain until Ready', async ({
  page,
}) => {
  const problems = watchConsole(page);
  await openGame(page);
  await page.locator('[data-action="begin-hotseat"]').click();
  await expectScreen(page, 'setup');
  // Turn the first AI seat into a third human.
  await page.locator('#cf-seat-2-who').selectOption('human');
  await page.locator('[data-action="begin"]').click();
  for (let turn = 0; turn < 4; turn++) {
    await expectScreen(page, 'handover');
    // Nothing of any realm while the device changes hands: only arms, a name and the year.
    const text = (await page.locator('.cf').textContent()) ?? '';
    expect(text).not.toMatch(/Serfs|Treasury|Grain|Soldiers|points|\bbu\b|\bfl\b/);
    expect(text.match(/\d+/g) ?? []).toEqual([expect.stringMatching(/^14\d\d$/)]);
    await page.locator('[data-action="ready"]').click();
    await expectScreen(page, 'year');
    // The other two rulers stay hidden in the rival bar until the year's end.
    await expect(page.locator('.cf-rival[data-hidden]')).toHaveCount(2);
    await seal(page);
    await expectScreen(page, 'review');
    await page.locator('[data-action="continue"]').click();
  }
  expect(problems).toEqual([]);
});

test('when a rival is crowned the table is told, and the player may play on', async ({ page }) => {
  const problems = watchConsole(page);
  await openGame(page, { seed: SEEDS.rivalCrowned });
  await beginSolo(page);
  await playYears(page, { years: 40, until: (s) => s === 'herald' });
  await expectScreen(page, 'herald');
  await expect(page.locator('.cf-race-won__title')).toContainText('has crowned');
  await page.locator('[data-action="continue"]').click();
  await playYears(page, { years: 1, until: (s) => s === 'year' });
  await expect(page.locator('.cf-steps__race')).toBeVisible();
  await expect(page.locator('.cf-steps__race')).toContainText('crowned');
  await expect(page.locator('.cf-rival[data-crowned="first"]')).toHaveCount(1);
  const world = await worldOf(page);
  expect(world?.end).toBeNull();
  expect(problems).toEqual([]);
});

test('when a rival is crowned the player may end the game and read the chronicle', async ({
  page,
}) => {
  await openGame(page, { seed: SEEDS.rivalCrowned });
  await beginSolo(page);
  await playYears(page, { years: 40, until: (s) => s === 'herald' });
  await page.locator('[data-action="end-here"]').click();
  await expectScreen(page, 'ending');
  const world = await worldOf(page);
  expect(world?.end?.ending).toBe('retired');
});
