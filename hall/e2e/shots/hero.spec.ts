// Hero frames (stage 4 of the foundation prompt), regenerated with `pnpm shots`.
//
// The profile comes from profile.ts (Pond played through the real Hall).
// Every theme is shot in light and dark at 1920×1080, with the demos given
// time to play a few years first, plus the replay's chronicle in Almanac
// light and Situation Room dark.
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  APPEARANCES,
  THEMES,
  returningVisitor,
  setLook,
  type AppearanceName,
  type ThemeName,
} from '../support.ts';
import { buildProfile, openFresh } from './profile.ts';

const OUT = join(import.meta.dirname, '..', '..', '..', 'docs', 'media', 'hero');

async function shoot(page: Page, name: string, route: string, wait: number): Promise<void> {
  await openFresh(page, route, wait);
  await page.mouse.move(1910, 1070);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
}

test('hero frames', async ({ browser }) => {
  mkdirSync(OUT, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await returningVisitor(page);
  const { replayId } = await buildProfile(page);
  expect(replayId).not.toBe('');

  for (const theme of THEMES) {
    for (const appearance of APPEARANCES) {
      await setLook(page, theme, appearance);
      await shoot(page, `hall-${theme}-${appearance}`, '#/', 12_000);
    }
  }

  const chronicleFrames: [ThemeName, AppearanceName][] = [
    ['almanac', 'light'],
    ['situation-room', 'dark'],
  ];
  for (const [theme, appearance] of chronicleFrames) {
    await setLook(page, theme, appearance);
    await shoot(page, `chronicle-${theme}-${appearance}`, `#/chronicles/${replayId}`, 1500);
  }
  await context.close();
});
