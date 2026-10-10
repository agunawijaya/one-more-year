// The whole loop through the real chrome, with the test-only Pond simulation:
// begin → plan → end the turn → report → pause → resume after reload →
// finish → chronicle → back to the Hall, by mouse and by keyboard alone.
import { expect, test, type Page } from '@playwright/test';
import {
  expectView,
  finishRun,
  openHarness,
  playYearWithMouse,
  returningVisitor,
  stageView,
  tabTo,
  watchConsole,
} from '../support.ts';

async function beginPond(page: Page, scenario = 'still-water'): Promise<void> {
  await page.goto(`/harness.html?now=2026-10-09T09:00:00Z#/play/pond?new=${scenario}`);
  await expectView(page, 'plan');
}

test.beforeEach(async ({ page }) => {
  await returningVisitor(page);
});

test('a full run by mouse ends in a chronicle and returns to the Hall', async ({ page }) => {
  const problems = watchConsole(page);
  await openHarness(page);
  await page.locator('.almanac-page--right [data-action="begin"]').click();
  await expectView(page, 'plan');
  await finishRun(page, 15);

  const chronicle = page.locator('.chronicle--results');
  await expect(chronicle.locator('.chronicle__title')).toContainText('at the pond');
  await expect(chronicle.locator('.chronicle__epithet')).toContainText('“');
  await expect(chronicle.locator('.timeline__turn')).toHaveCount(8);
  await expect(chronicle.locator('.chronicle__actions button')).toHaveText([
    /Play again\s*R/,
    'Replay this world',
    'Game menu',
    /Back to the Hall\s*H/,
    'Share',
  ]);
  await chronicle.getByRole('button', { name: 'Share' }).click();
  await expect(page.locator('.share__text')).toContainText('One More Year · Pond');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Back to the Hall/ }).click();
  await expect(page).toHaveURL(/#\/(\?sim=pond)?$/);
  await expect(page.locator('.almanac-chapter[data-sim="pond"]')).toContainText('1 chronicle');
  expect(problems).toEqual([]);
});

test('a full run by keyboard only', async ({ page }) => {
  const problems = watchConsole(page);
  await openHarness(page);
  await tabTo(page, '.almanac-page--right [data-action="begin"]');
  await page.keyboard.press('Enter');
  await expectView(page, 'plan');
  await finishRun(page, 10, true);
  await expect(page.locator('.chronicle--results')).toBeVisible();
  await page.keyboard.press('h');
  await expect(page).toHaveURL(/#\/(\?sim=pond)?$/);
  expect(problems).toEqual([]);
});

test('a reload mid-run resumes on the plan screen of the current year', async ({ page }) => {
  await beginPond(page);
  await playYearWithMouse(page, 20);
  await playYearWithMouse(page, 20);
  await expectView(page, 'plan');
  await expect(page).toHaveURL(/#\/play\/pond\?run=/);
  await page.reload();
  await expectView(page, 'plan');
  await expect(page.locator('.pond__eyebrow')).toHaveText('Year 3 of 8');
  await expect(page.locator('.pond__signal').filter({ hasText: 'Caught' })).toContainText('40');
});

test('two runs in progress are both offered to continue', async ({ page }) => {
  await beginPond(page, 'still-water');
  await playYearWithMouse(page, 5);
  await page.keyboard.press('Escape');
  await page.locator('[data-action="hall"]').click();
  await expect(page.locator('.almanac')).toBeVisible();

  await beginPond(page, 'overgrown');
  await playYearWithMouse(page, 5);
  await page.goto('/harness.html?now=2026-10-09T09:00:00Z#/');
  const bookmarks = page.locator('.almanac-bookmarks__item');
  await expect(bookmarks).toHaveCount(2);
  await expect(bookmarks.first()).toContainText('Year 2 of 8');
  await bookmarks.first().click();
  await expectView(page, 'plan');
});

test('the pause menu keeps the standard order and every exit works', async ({ page }) => {
  await beginPond(page);
  await expect(page.locator('[data-action="pause"]')).toBeVisible();
  await page.keyboard.press('Escape');
  const items = page.locator('.dialog--pause .menu-list__label');
  await expect(items).toHaveText([
    'Resume',
    'Reset this year’s plan',
    'How to play',
    'Settings',
    'Game menu',
    'Back to the Hall',
  ]);
  await page.keyboard.press('Escape');
  await expect(page.locator('.dialog--pause')).toHaveCount(0);

  await page.locator('[data-action="pause"]').click();
  await page.locator('[data-action="game-menu"]').click();
  await expectView(page, 'menu');
  await expect(page).toHaveURL(/#\/sim\/pond$/);
  await expect(page.locator('[data-action="back-to-hall"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/#\/(\?sim=pond)?$/);
  expect(await stageView(page)).toBeNull();
});

test('leaving with an edited plan offers to keep it as a draft', async ({ page }) => {
  await beginPond(page);
  await page.getByLabel('Catch this year').first().fill('33');
  await page.keyboard.press('Escape');
  await page.locator('[data-action="hall"]').click();
  await expect(page.locator('.dialog--confirm')).toContainText('Keep this year’s plan?');
  await page.locator('[data-answer="keep"]').click();
  await expect(page.locator('.almanac')).toBeVisible();
  await page.locator('.almanac-bookmarks__item').first().click();
  await expectView(page, 'plan');
  await expect(page.locator('#pond-catch')).toHaveValue('33');
});

test('replaying a world draws the earlier run as a ghost', async ({ page }) => {
  await beginPond(page);
  await finishRun(page, 18);
  await page.locator('[data-action="replay"]').click();
  await expectView(page, 'plan');
  await expect(page.locator('.pond__note').filter({ hasText: 'Last time' })).toContainText(
    '180 fish',
  );
  await finishRun(page, 6);
  await expect(page.locator('.chronicle__charts h2')).toHaveText('The numbers, against last time');
  await expect(page.locator('.chronicle__chart svg path[stroke-dasharray]').first()).toBeVisible();
  await expect(page.locator('.chronicle__record')).toContainText('A second chance at');
});

test('hot-seat play hands the device over between two seats', async ({ page }) => {
  await page.goto('/harness.html?now=2026-10-09T09:00:00Z#/sim/pond');
  await expectView(page, 'menu');
  await page.locator('[data-action="begin-hot-seat"]').click();
  await expect(page.locator('.omy-handover')).toContainText('Seat 1, the room is yours');
  await page.getByRole('button', { name: 'Ready' }).click();
  await expect(page.locator('.pond__eyebrow')).toHaveText('Year 1 of 8 · Seat 1');
  await page.getByRole('button', { name: 'End the year' }).click();
  await page.locator('[data-action="continue"]').click();
  await expect(page.locator('.omy-handover')).toContainText('Seat 2, the room is yours');
  await expect(page.locator('.pond__panel')).toHaveCount(0);
  await page.getByRole('button', { name: 'Ready' }).click();
  await expect(page.locator('.pond__eyebrow')).toHaveText('Year 1 of 8 · Seat 2');
});

test('the daily scenario counts its first attempt and shares a numbered string', async ({
  page,
}) => {
  await openHarness(page);
  await page.locator('[data-daily="pond"]').click();
  await expectView(page, 'plan');
  await finishRun(page, 12);
  await page.locator('[data-action="share"]').click();
  await expect(page.locator('.share__text')).toContainText('One More Year · Pond #1');
  await page.keyboard.press('Escape');
  await page.keyboard.press('h');
  await expect(page.locator('[data-daily="pond"]')).toContainText('Written');
});

test('browser Back leaves a run for the Hall', async ({ page }) => {
  await openHarness(page);
  await page.locator('.almanac-page--right [data-action="begin"]').click();
  await expectView(page, 'plan');
  await page.goBack();
  await expect(page.locator('.almanac')).toBeVisible();
  expect(await stageView(page)).toBeNull();
});
