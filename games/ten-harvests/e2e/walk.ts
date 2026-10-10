// Development walk-through on the GPU: opens a page, runs a short script of steps, saves screenshots.
//   tsx games/ten-harvests/e2e/walk.ts <out-dir> <path> '<steps>' [WxH]
// Steps are separated by ';':
//   click:<selector>   press:<key>   type:<text>   wait:<ms>   shot:<name>   eval:<expression>
//   drag:<x1>,<y1>,<x2>,<y2>   mouse:<x>,<y>   waitfor:<selector>
import { chromium } from '@playwright/test';
import { fixSeed } from './fixed-seed.ts';

const [outDir, path = 'index.html', script = 'shot:start', size = '1280x720'] =
  process.argv.slice(2);
if (!outDir) throw new Error('Usage: tsx e2e/walk.ts <out-dir> <path> <steps> [WxH]');
const [width, height] = size.split('x').map(Number);
// SOFTWARE=1 leaves out the GPU flags: WebGL then runs on the CPU, as on a CI runner.
const browser = await chromium.launch(
  process.env.SOFTWARE
    ? {}
    : { args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] },
);
const page = await browser.newPage({ viewport: { width: width ?? 1280, height: height ?? 720 } });
// SEED=<n> fixes the seed of every new run, so a walk can aim at a known world.
if (process.env.SEED) await fixSeed(page, Number(process.env.SEED));
page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning')
    console.warn(`[console ${message.type()}] ${message.text()}`);
});
page.on('pageerror', (error) => console.warn(`[pageerror] ${error.message}\n${error.stack ?? ''}`));
await page.goto(`http://localhost:4480/${path.replace(/^\/+/, '')}`, { waitUntil: 'load' });
await page.waitForTimeout(1500);

for (const step of script
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean)) {
  const colon = step.indexOf(':');
  const verb = colon < 0 ? step : step.slice(0, colon);
  const arg = colon < 0 ? '' : step.slice(colon + 1);
  try {
    switch (verb) {
      case 'click':
        await page.click(arg, { timeout: 8000 });
        break;
      case 'press':
        await page.keyboard.press(arg);
        break;
      case 'type':
        await page.keyboard.type(arg);
        break;
      case 'wait':
        await page.waitForTimeout(Number(arg));
        break;
      case 'waitfor':
        await page.waitForSelector(arg, { timeout: 30000 });
        break;
      case 'shot':
        await page.screenshot({ path: `${outDir}/${arg}.png` });
        break;
      case 'eval':
        console.warn(`[eval] ${JSON.stringify(await page.evaluate(arg))}`);
        break;
      case 'mouse': {
        const [x, y] = arg.split(',').map(Number);
        await page.mouse.move(x ?? 0, y ?? 0);
        break;
      }
      case 'drag': {
        const [x1, y1, x2, y2] = arg.split(',').map(Number);
        await page.mouse.move(x1 ?? 0, y1 ?? 0);
        await page.mouse.down();
        await page.mouse.move(x2 ?? 0, y2 ?? 0, { steps: 12 });
        await page.mouse.up();
        break;
      }
      default:
        console.warn(`unknown step ${step}`);
    }
  } catch (error) {
    console.warn(`[step failed] ${step}: ${(error as Error).message.split('\n')[0] ?? ''}`);
    await page.screenshot({ path: `${outDir}/failed.png` });
    break;
  }
}
await browser.close();
