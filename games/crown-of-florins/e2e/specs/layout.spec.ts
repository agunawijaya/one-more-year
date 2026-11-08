/**
 * The year screen fits: at 1280×720 and at 1920×1080, on every step, no
 * panel runs under the rival bar or past the edge of the window, and no
 * card is cut off by its column. Shot on the studio page of a mature city
 * (dev/year.html), where the panels are at their longest.
 */
import { expect, test } from '@playwright/test';

const SIZES = [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
] as const;
const STEPS = ['harvest', 'market', 'bread', 'taxes', 'builders'] as const;

interface Overlap {
  what: string;
  bottom: number;
  limit: number;
}

for (const size of SIZES) {
  for (const step of STEPS) {
    test(`at ${size.width}×${size.height} the ${step} step fits above the rival bar`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await page.goto(`/year.html?appearance=light&step=${step}&quality=light`);
      await expect(page.locator('.cf-rival').first()).toBeVisible({ timeout: 30_000 });
      await expect(page.locator(`[data-panel="${step}"]`)).toBeVisible();
      const problems = await page.evaluate(() => {
        const found: Overlap[] = [];
        const rivals = document.querySelector('.cf-rivals')?.getBoundingClientRect();
        if (!rivals) return [{ what: 'no rival bar', bottom: 0, limit: 0 }];
        const width = window.innerWidth;
        const height = window.innerHeight;
        const check = (selector: string, limit: number): void => {
          for (const node of document.querySelectorAll<HTMLElement>(selector)) {
            if (node.offsetParent === null) continue;
            const box = node.getBoundingClientRect();
            const what = `${selector} ${node.className}`;
            if (box.bottom > limit + 0.5) found.push({ what, bottom: box.bottom, limit });
            if (box.left < -0.5 || box.right > width + 0.5 || box.top < -0.5)
              found.push({ what: `${what} (edge)`, bottom: box.right, limit: width });
          }
        };
        check('.cf-year__court > *', rivals.top);
        check('.cf-year__glass > *', rivals.top);
        check('.cf-year__fresco', rivals.top);
        check('.cf-steps > *', rivals.top);
        check('.cf-rival', height);
        // No card is clipped by its column: each ends inside the column that holds it.
        for (const column of document.querySelectorAll<HTMLElement>(
          '.cf-year__court, .cf-year__glass',
        )) {
          const bottom = column.getBoundingClientRect().bottom;
          for (const card of column.children) {
            const box = card.getBoundingClientRect();
            if (box.bottom > bottom + 0.5)
              found.push({ what: `clipped ${card.className}`, bottom: box.bottom, limit: bottom });
          }
        }
        return found;
      });
      expect(problems).toEqual([]);
    });
  }
}
