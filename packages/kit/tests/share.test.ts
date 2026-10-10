import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText, downloadSvg, shareFileName } from '../src/share.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('share', () => {
  it('copies through the clipboard API when it is there', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    expect(await copyText('One More Year · Pond')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('One More Year · Pond');
  });

  it('downloads a card as an SVG file', () => {
    const clicks: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicks.push(this.download);
    });
    downloadSvg('<svg xmlns="http://www.w3.org/2000/svg"/>', 'card');
    expect(clicks).toEqual(['card.svg']);
  });

  it('makes tidy file names', () => {
    expect(shareFileName('Pond #3')).toBe('one-more-year-pond-3.svg');
    expect(shareFileName('***')).toBe('one-more-year-chronicle.svg');
  });
});
