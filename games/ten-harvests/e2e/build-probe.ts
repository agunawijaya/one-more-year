// Development probe: how long the city takes to build, warm its shaders and draw its first frame,
// and the longest stall of the page's main thread meanwhile. Needs the dev server on 4480.
//   tsx games/ten-harvests/e2e/build-probe.ts [quality]
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

// The scene's sources as the dev server serves files by absolute path.
const sceneSources = `/@fs/${fileURLToPath(new URL('../src/scene/', import.meta.url)).replaceAll('\\', '/')}`;

const quality = process.argv[2] ?? 'light';
// SOFTWARE=1 leaves out the GPU flags, as the Hall's own suite runs: WebGL then draws on the CPU.
const browser = await chromium.launch(
  process.env.SOFTWARE
    ? {}
    : { args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] },
);
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
// A quiet page on the dev server's origin, so nothing else is drawing while we measure.
await page.goto('http://localhost:4480/@vite/env');
await page.waitForTimeout(500);
// Passed as text: a compiled function would carry the bundler's helpers into the page.
const result: unknown = await page.evaluate(`(async () => {
  const src = '${sceneSources}';
  const world = await import(src + 'world.ts');
  const view = await import(src + 'view.ts');
  const t0 = performance.now();
  const w = world.createCityWorld('light');
  w.show({ people: 100, grain: 2800, acres: 1000, planted: 999, season: 1, yieldPerAcre: 3 });
  const host = document.createElement('div');
  host.style.cssText = 'width:640px;height:360px';
  document.body.append(host);
  let longest = 0;
  let last = performance.now();
  let watching = true;
  const tick = () => {
    const now = performance.now();
    longest = Math.max(longest, now - last);
    last = now;
    if (watching) setTimeout(tick, 0);
  };
  setTimeout(tick, 0);
  const t1 = performance.now();
  const v = view.createCityView(host, w, { quality: '${quality}', label: 'x', loop: false });
  await v.ready;
  const t2 = performance.now();
  v.renderOnce();
  const t3 = performance.now();
  await new Promise((resolve) => setTimeout(resolve, 50));
  watching = false;
  return { build: t1 - t0, warm: t2 - t1, firstFrame: t3 - t2, longestStall: longest, software: v.software };
})()`);
console.warn(JSON.stringify(result));
await browser.close();
