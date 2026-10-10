import type { Page } from '@playwright/test';

/**
 * Fixes the seed of every new run in the page. The kit draws a new run's seed
 * from crypto.getRandomValues with a single 32-bit word; every other use of
 * the browser's randomness is left alone.
 */
export async function fixSeed(page: Page, seed: number): Promise<void> {
  // Passed as source text: a compiled function would carry the bundler's helpers with it.
  await page.addInitScript(`{
    const original = crypto.getRandomValues.bind(crypto);
    Object.defineProperty(crypto, 'getRandomValues', {
      value: (array) => {
        if (array instanceof Uint32Array && array.length === 1) {
          array[0] = ${String(seed >>> 0)};
          return array;
        }
        return original(array);
      },
    });
  }`);
}
