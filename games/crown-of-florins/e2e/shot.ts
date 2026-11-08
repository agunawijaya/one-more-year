// A quick screenshot of a development page on the real GPU, for art direction:
//   tsx games/crown-of-florins/e2e/shot.ts <page?query> <out.png> [width] [height] [waitMs]
// Needs the game's dev server on 4481. Prints the page's console errors.
import { chromium } from '@playwright/test';

const [path = 'studio.html', out = 'shot.png', width = '1920', height = '1080', wait = '4000'] =
  process.argv.slice(2);
const browser = await chromium.launch({
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) } });
const problems: string[] = [];
page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning')
    problems.push(`${message.type()}: ${message.text()}`);
});
await page.goto(`http://localhost:4481/${path}`, { waitUntil: 'load' });
await page.waitForTimeout(Number(wait));
await page.screenshot({ path: out });
for (const problem of problems.slice(0, 30)) console.warn(problem.slice(0, 600));
await browser.close();
