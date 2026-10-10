// Development probe: opens a studio page and prints values from its debug handle.
//   tsx games/ten-harvests/e2e/probe.ts '<path>' '<expression over window>'
import { chromium } from '@playwright/test';

const [path = 'studio.html', expression = 'null'] = process.argv.slice(2);
const browser = await chromium.launch({
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (error) => console.error(error.message));
await page.goto(`http://localhost:4480/${path.replace(/^\/+/, '')}`, { waitUntil: 'load' });
await page.waitForTimeout(3000);
console.warn(JSON.stringify(await page.evaluate(expression), null, 1));
await browser.close();
