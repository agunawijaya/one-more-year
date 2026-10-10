// Development screenshots on the GPU: `tsx games/ten-harvests/e2e/shoot.ts <out.png> <page path and query> [wait ms] [WxH]`.
// Uses the real GPU through ANGLE so the frames match what players see.
import { chromium } from '@playwright/test';

const [out, path = 'studio.html', wait = '2500', size = '1920x1080'] = process.argv.slice(2);
if (!out) throw new Error('Usage: tsx e2e/shoot.ts <out.png> <path> [wait] [WxH]');
const [width, height] = size.split('x').map(Number);
const browser = await chromium.launch({
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: width ?? 1920, height: height ?? 1080 } });
const problems: string[] = [];
page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text());
});
page.on('pageerror', (error) => problems.push(error.message));
// Git Bash rewrites arguments that start with a slash, so paths are passed without one.
await page.goto(`http://localhost:4480/${path.replace(/^\/+/, '')}`, { waitUntil: 'load' });
await page.waitForTimeout(Number(wait));
await page.screenshot({ path: out });
console.warn(problems.length > 0 ? problems.slice(0, 12).join('\n') : 'no console problems');
await browser.close();
