/**
 * Screenshots for design review, against the harness on the dev server:
 *
 *   pnpm dev   (in another terminal)
 *   tsx scripts/shoot.ts <out.png> [--theme almanac] [--appearance light]
 *       [--size 1920x1080] [--route '#/'] [--query fixtures=20] [--wait 5000] [--fresh]
 *
 * The clock is fixed so dates and daily numbers stay the same between shots.
 * The final screenshots in docs/media/ come from `pnpm shots` instead.
 */
import { chromium } from '@playwright/test';

interface Options {
  out: string;
  theme: string;
  appearance: string;
  width: number;
  height: number;
  route: string;
  query: string;
  wait: number;
  fresh: boolean;
}

function parse(args: string[]): Options {
  const value = (name: string, fallback: string): string => {
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? (args[index + 1] ?? fallback) : fallback;
  };
  const [width = '1920', height = '1080'] = value('size', '1920x1080').split('x');
  const out = args[0];
  if (!out || out.startsWith('--'))
    throw new Error('Usage: tsx scripts/shoot.ts <out.png> [options]');
  return {
    out,
    theme: value('theme', 'almanac'),
    appearance: value('appearance', 'light'),
    width: Number(width),
    height: Number(height),
    route: value('route', '#/'),
    query: value('query', ''),
    wait: Number(value('wait', '5000')),
    fresh: args.includes('--fresh'),
  };
}

const options = parse(process.argv.slice(2));
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: options.width, height: options.height },
});
if (!options.fresh) {
  await context.addInitScript(
    ([theme, appearance]) => {
      if (!localStorage.getItem('omy:settings')) {
        localStorage.setItem(
          'omy:settings',
          JSON.stringify({ v: 1, d: { introSeen: true, themeChosen: true, theme, appearance } }),
        );
      }
    },
    [options.theme, options.appearance],
  );
}
const page = await context.newPage();
const problems: string[] = [];
page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text());
});
page.on('pageerror', (error) => problems.push(error.message));
const query = ['now=2026-10-09T09:00:00Z', options.query].filter(Boolean).join('&');
await page.goto(`http://localhost:4479/harness.html?${query}${options.route}`, {
  waitUntil: 'networkidle',
});
await page.waitForTimeout(options.wait);
await page.screenshot({ path: options.out });
console.warn(problems.length > 0 ? problems.join('\n') : 'no console problems');
await browser.close();
