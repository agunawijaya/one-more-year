import { describe, expect, it } from 'vitest';
import {
  MINUS,
  formatCompact,
  formatDate,
  formatDelta,
  formatDuration,
  formatNumber,
  formatPercent,
  formatQuantity,
  formatRange,
  formatStyled,
  formatTurn,
  ordinal,
} from '../src/format.ts';

describe('format', () => {
  it('groups thousands and uses a true minus sign', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(12345)).toBe('12,345');
    expect(formatNumber(1234567.891, { decimals: 2 })).toBe('1,234,567.89');
    expect(formatNumber(-340)).toBe(`${MINUS}340`);
  });

  it('never prints minus zero', () => {
    expect(formatNumber(-0.2)).toBe('0');
    expect(formatNumber(-0.04, { decimals: 1 })).toBe('0.0');
  });

  it('writes deltas with explicit signs', () => {
    expect(formatDelta(12)).toBe('+12');
    expect(formatDelta(-340)).toBe(`${MINUS}340`);
    expect(formatDelta(0)).toBe('±0');
    expect(formatDelta(0.3)).toBe('±0');
    expect(formatDelta(1500)).toBe('+1,500');
  });

  it('formats percentages, compact numbers and styles', () => {
    expect(formatPercent(0.255)).toBe('26%');
    expect(formatPercent(0.255, { decimals: 1 })).toBe('25.5%');
    expect(formatCompact(950)).toBe('950');
    expect(formatCompact(12_340)).toBe('12.3k');
    expect(formatCompact(412_000)).toBe('412k');
    expect(formatCompact(4_120_000)).toBe('4.1M');
    expect(formatStyled(3.25, 'decimal')).toBe('3.3');
    expect(formatStyled(0.5, 'percent')).toBe('50%');
  });

  it('agrees units with their numbers', () => {
    const acre = { singular: 'acre', plural: 'acres' };
    expect(formatQuantity(1, acre)).toBe('1 acre');
    expect(formatQuantity(0, acre)).toBe('0 acres');
    expect(formatQuantity(1200, acre)).toBe('1,200 acres');
    expect(formatQuantity(-1, acre)).toBe(`${MINUS}1 acre`);
  });

  it('writes ranges low to high and collapses equal ends', () => {
    expect(formatRange(2800, 1900)).toBe('1,900–2,800');
    expect(formatRange(5, 5)).toBe('5');
  });

  it('labels turns, ordinals, durations and dates', () => {
    expect(formatTurn('year', 6, 10)).toBe('Year 6 of 10');
    expect(formatTurn('season', 3)).toBe('Season 3');
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
      '23rd',
      '101st',
    ]);
    expect(formatDuration(60_000)).toBe('1 minute');
    expect(formatDuration(65 * 60_000)).toBe('1 hour 5 minutes');
    expect(formatDuration(120 * 60_000)).toBe('2 hours');
    expect(formatDate('2026-10-09')).toBe('9 October 2026');
  });
});
