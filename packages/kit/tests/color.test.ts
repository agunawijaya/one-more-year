import { describe, expect, it } from 'vitest';
import { contrastRatio, meetsAA, mix, parseColor, toHex, withAlpha } from '../src/color.ts';

describe('color', () => {
  it('parses hex and functional colours', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor('#1f2a44')).toEqual({ r: 31, g: 42, b: 68, a: 1 });
    expect(parseColor('#00000080').a).toBeCloseTo(0.502, 2);
    expect(parseColor('rgb(10, 20, 30)')).toEqual({ r: 10, g: 20, b: 30, a: 1 });
    expect(parseColor('rgba(10 20 30 / 0.5)')).toEqual({ r: 10, g: 20, b: 30, a: 0.5 });
    expect(() => parseColor('tomato')).toThrow();
  });

  it('round-trips through hex', () => {
    expect(toHex(parseColor('#a1b2c3'))).toBe('#a1b2c3');
    expect(withAlpha('#000000', 0.5)).toBe('#00000080');
  });

  it('mixes linearly', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mix('#102030', '#102030', 0.3)).toBe('#102030');
  });

  it('measures contrast as WCAG does', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    expect(contrastRatio('#767676', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(meetsAA('#777777', '#ffffff')).toBe(false);
    expect(meetsAA('#777777', '#ffffff', true)).toBe(true);
  });

  it('accounts for translucent text over its background', () => {
    const solid = contrastRatio('#000000', '#ffffff');
    const faded = contrastRatio('#00000080', '#ffffff');
    expect(faded).toBeLessThan(solid);
    expect(faded).toBeGreaterThan(3);
  });
});
