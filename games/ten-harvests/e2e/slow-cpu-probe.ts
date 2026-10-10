// Development probe: long tasks on the Hall's home page with WebGL drawn in software and the CPU
// slowed four times, close to a CI runner. Needs the dev server on 4480.
//   tsx games/ten-harvests/e2e/slow-cpu-probe.ts [theme]
import { chromium } from '@playwright/test';

const theme = process.argv[2] ?? 'almanac';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const cdp = await page.context().newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await page.addInitScript(`{
  window.__long = [];
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) window.__long.push(Math.round(entry.duration));
  }).observe({ type: 'longtask', buffered: true });
}`);
await page.goto(`http://localhost:4480/index.html?now=2026-10-10T09:00:00Z&theme=${theme}#/`);
await page.waitForTimeout(15000);
const long = await page.evaluate<number[]>('window.__long');
console.warn(
  JSON.stringify({ theme, longest: Math.max(0, ...long), over200: long.filter((t) => t > 200) }),
);
await browser.close();
