/// <reference types="node" />
// @vitest-environment node
/**
 * Every text colour passes WCAG AA on the surface it sits on, in both
 * appearances: 4.5 : 1 for text, 3 : 1 for large lettering and for the
 * focus ring. The tokens are read from crown.css itself, so a change there
 * cannot slip past.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './colour.ts';

const css = readFileSync(new URL('../src/ui/crown.css', import.meta.url), 'utf8');

function tokens(appearance: 'light' | 'dark'): Record<string, string> {
  const block = new RegExp(`\\.cf\\[data-appearance='${appearance}'\\]\\s*\\{([^}]*)\\}`).exec(
    css,
  )?.[1];
  if (!block) throw new Error(`No ${appearance} token block in crown.css`);
  const found: Record<string, string> = {};
  for (const match of block.matchAll(/--cf-([a-z0-9-]+):\s*(#[0-9a-f]{3,6})\s*;/gi)) {
    found[match[1] ?? ''] = match[2] ?? '';
  }
  return found;
}

describe.each(['light', 'dark'] as const)('the %s appearance', (appearance) => {
  const t = tokens(appearance);
  const ratio = (fg: string, bg: string): number => contrastRatio(t[fg] ?? '', t[bg] ?? '');

  it.each([
    ['ink', 'paper'],
    ['ink', 'paper-2'],
    ['ink-soft', 'paper'],
    ['ink-soft', 'paper-2'],
    ['rubric', 'paper'],
    ['rubric', 'paper-2'],
    ['first', 'paper'],
    ['first', 'paper-2'],
    ['gold', 'paper'],
    ['good', 'paper'],
    ['warning', 'paper'],
    ['danger', 'paper'],
    ['seal-ink', 'seal'],
  ])('%s text on %s passes 4.5 : 1', (fg, bg) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('letters the illuminated initials in leaf on lapis at 3 : 1 or more', () => {
    expect(ratio('leaf', 'lapis')).toBeGreaterThanOrEqual(3);
  });

  it('draws the focus ring at 3 : 1 against the wall and the parchment', () => {
    expect(ratio('focus', 'wall')).toBeGreaterThanOrEqual(3);
    expect(ratio('focus', 'paper')).toBeGreaterThanOrEqual(3);
  });
});

describe('the fixed colours of cartouches and captions', () => {
  it.each([
    ['#8e2614', '#e9d6a8', 'the cartouche title'],
    ['#84590e', '#f6ead0', 'the cartouche eyebrow'],
    ['#2b1f15', '#e9d6a8', 'the curtain card'],
    ['#8e2614', '#f6ead0', 'the curtain title'],
    ['#f6ecd6', '#3a2a1e', 'the skip button'],
  ])('%s on %s (%s) passes 4.5 : 1', (fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('letters a promotion in gold that stays above 3 : 1 on parchment, as large text', () => {
    // The lightest stop of the light appearance's gold gradient.
    expect(contrastRatio('#a0721a', '#f4e8cf')).toBeGreaterThanOrEqual(3);
  });
});
