// A close look at one element of a development page, at three times the pixels:
//   tsx games/crown-of-florins/e2e/shot-element.ts <page?query> <css selector> <out.png> [waitMs]
import { chromium } from '@playwright/test';

const [path = 'year.html', selector = '.cf-portrait', out = 'element.png', wait = '3000'] =
  process.argv.slice(2);
const browser = await chromium.launch({
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 3,
});
await page.goto(`http://localhost:4481/${path}`, { waitUntil: 'load' });
await page.waitForTimeout(Number(wait));
await page.locator(selector).first().screenshot({ path: out });
await browser.close();
