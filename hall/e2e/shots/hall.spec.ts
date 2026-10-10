// Every Hall screen of every theme, regenerated with `pnpm shots` into
// docs/media/hall/<theme>/<screen>-<appearance>-<width>x<height>.png.
//
// For quicker design rounds, narrow it down with environment variables:
//   THEME=almanac  APPEARANCE=dark  SIZE=1920x1080  SCREENS=hall,library
import { test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  APPEARANCES,
  THEMES,
  expectView,
  returningVisitor,
  setLook,
  type ThemeName,
} from '../support.ts';
import { buildProfile, openFresh, type Profile } from './profile.ts';

const OUT = join(import.meta.dirname, '..', '..', '..', 'docs', 'media', 'hall');
const SIZES: readonly [number, number][] = [
  [1280, 720],
  [1920, 1080],
];

interface Screen {
  name: string;
  /** Opens the screen; the page is already set to the look. */
  open(page: Page, theme: ThemeName, profile: Profile): Promise<void>;
}

const SCREENS: readonly Screen[] = [
  { name: 'hall', open: (page) => openFresh(page, '#/', 9000) },
  // The same Hall with twenty worlds in the catalog (generated planned worlds).
  { name: 'hall-20', open: (page) => openFresh(page, '#/', 6000, 'fixtures=20') },
  {
    name: 'detail',
    async open(page, theme) {
      await openFresh(page, '#/?sim=pond', 4000);
      if (theme === 'almanac') {
        await page.locator('.almanac-page--right').evaluate((element) => {
          element.scrollTop = element.scrollHeight * 0.45;
        });
      } else if (theme === 'situation-room') {
        await page.locator('.room-tile[data-sim="pond"] [data-action="brief"]').click();
      } else {
        await page.locator('.terra-dome__glass[data-sim="pond"]').click();
      }
      await page.waitForTimeout(3000);
    },
  },
  { name: 'library', open: (page) => openFresh(page, '#/chronicles', 1200) },
  {
    name: 'chronicle',
    open: (page, _theme, profile) => openFresh(page, `#/chronicles/${profile.replayId}`, 1200),
  },
  { name: 'codex', open: (page) => openFresh(page, '#/codex', 2000) },
  { name: 'legacy', open: (page) => openFresh(page, '#/legacy', 2000) },
  { name: 'about', open: (page) => openFresh(page, '#/about', 1200) },
  {
    name: 'settings',
    async open(page) {
      await openFresh(page, '#/', 1500);
      await page.locator('[data-action="settings"]').click();
      await page.waitForTimeout(500);
    },
  },
  {
    name: 'picker',
    async open(page) {
      await openFresh(page, '#/', 800);
      await page.locator('[data-action="settings"]').click();
      await page.locator('[data-action="choose-theme"]').click();
      await page.waitForTimeout(6000);
    },
  },
  {
    name: 'pause',
    async open(page, _theme, profile) {
      await openFresh(page, `#/play/pond?run=${profile.runId}`, 1500);
      await expectView(page, 'plan');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    },
  },
];

function wanted<T extends string>(variable: string | undefined, all: readonly T[]): readonly T[] {
  if (!variable) return all;
  const names = variable.split(',');
  return all.filter((item) => names.includes(item));
}

const themes = wanted(process.env.THEME, THEMES);
const appearances = wanted(process.env.APPEARANCE, APPEARANCES);
const sizes = process.env.SIZE
  ? SIZES.filter(([width, height]) => process.env.SIZE?.split(',').includes(`${width}x${height}`))
  : SIZES;
const screens = wanted(
  process.env.SCREENS,
  SCREENS.map((screen) => screen.name),
);

for (const theme of themes) {
  test(`hall screens: ${theme}`, async ({ browser }) => {
    test.setTimeout(900_000);
    mkdirSync(join(OUT, theme), { recursive: true });
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();
    await returningVisitor(page);
    const profile = await buildProfile(page);

    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      for (const appearance of appearances) {
        await setLook(page, theme, appearance);
        for (const screen of SCREENS.filter((item) => screens.includes(item.name))) {
          await screen.open(page, theme, profile);
          await page.mouse.move(width - 4, height - 4);
          await page.screenshot({
            path: join(OUT, theme, `${screen.name}-${appearance}-${width}x${height}.png`),
          });
        }
      }
    }
    await context.close();
  });
}
