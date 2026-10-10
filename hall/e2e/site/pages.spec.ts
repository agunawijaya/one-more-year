// The Hall's own pages on the built site: Library, Codex, Legacy and About
// on an empty profile (accessible in every theme), and "Forget my data".
import { expect, test } from '@playwright/test';
import { THEMES, expectAccessible, returningVisitor, watchConsole } from '../support.ts';

const PAGES = [
  { route: '#/chronicles', title: /library/i },
  { route: '#/codex', title: /codex/i },
  { route: '#/legacy', title: /legacy/i },
  { route: '#/about', title: /about/i },
] as const;

for (const theme of THEMES) {
  test(`Library, Codex, Legacy and About open in ${theme}`, async ({ page }) => {
    const problems = watchConsole(page);
    await returningVisitor(page, { theme });
    for (const { route, title } of PAGES) {
      await page.goto(`/${route}`);
      await expect(page.locator('#page-title')).toBeVisible();
      await expect(page).toHaveTitle(title);
      await page.waitForTimeout(400);
      await expectAccessible(page, `${theme} ${route}`);
    }
    expect(problems).toEqual([]);
  });
}

test('About tells the story and links its sources', async ({ page }) => {
  await returningVisitor(page);
  await page.goto('/#/about');
  await expect(page.getByRole('heading', { name: 'Where these games come from' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Hamurabi \(video game\)/ })).toHaveAttribute(
    'href',
    'https://en.wikipedia.org/wiki/Hamurabi_(video_game)',
  );
  await expect(page.locator('.about__worlds li')).toHaveCount(2);
});

test('Forget my data erases everything the site kept, after a confirm', async ({ page }) => {
  const problems = watchConsole(page);
  await returningVisitor(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('omy:codex', JSON.stringify({ v: 1, d: { sims: {} } }));
    localStorage.setItem('omy:daily', JSON.stringify({ v: 1, d: { days: { '2026-10-09': {} } } }));
    localStorage.setItem('unrelated', 'kept');
  });
  await page.goto('/#/');
  await page.locator('[data-action="settings"]').click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await expect(settings).toContainText('Your chronicles in the Library');
  await settings.locator('[data-action="forget"]').click();

  // The confirm comes first; "Keep" would leave everything alone.
  const confirm = page.getByRole('dialog', { name: 'Forget everything?' });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Forget my data' }).click();
  await expect(page.getByText('Everything this site kept on your device is gone.')).toBeVisible();

  const left = await page.evaluate(() =>
    Object.keys(localStorage).filter((key) => key === 'omy:codex' || key === 'omy:daily'),
  );
  expect(left).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('unrelated'))).toBe('kept');
  expect(problems).toEqual([]);
});
