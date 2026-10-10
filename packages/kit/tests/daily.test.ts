import { describe, expect, it } from 'vitest';
import {
  LAUNCH_DAY,
  SHARE_LIMITS,
  addDays,
  computeStreak,
  createDailyBook,
  dailyNumber,
  dailySeed,
  dayKey,
  shareString,
} from '../src/daily.ts';
import { createStorage } from '../src/save.ts';
import { MemoryStorage } from './storage-doubles.ts';

/** Day keys counted from a start day: run('2026-01-01', 0, 1, 2) → three consecutive days. */
const days = (start: string, ...offsets: number[]): string[] =>
  offsets.map((offset) => addDays(start, offset));

describe('daily numbering', () => {
  it('numbers launch day #1', () => {
    expect(dailyNumber(LAUNCH_DAY)).toBe(1);
    expect(dailyNumber(addDays(LAUNCH_DAY, 11))).toBe(12);
    expect(dailyNumber(addDays(LAUNCH_DAY, -1))).toBe(0);
  });

  it('changes day exactly at midnight UTC', () => {
    expect(dayKey(Date.UTC(2026, 9, 9, 23, 59, 59))).toBe('2026-10-09');
    expect(dayKey(Date.UTC(2026, 9, 10, 0, 0, 0))).toBe('2026-10-10');
  });

  it('is unaffected by daylight-saving changes', () => {
    // Europe moves its clocks on 25 October 2026 and 28 March 2027; US on 1 November 2026.
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(addDays('2026-10-31', 2)).toBe('2026-11-02');
    expect(addDays('2027-03-27', 2)).toBe('2027-03-29');
    expect(dailyNumber('2027-03-29') - dailyNumber('2027-03-27')).toBe(2);
    // 23:30 local in a UTC+2 summer evening is still the earlier UTC day.
    expect(dayKey(new Date('2026-10-24T23:30:00+02:00'))).toBe('2026-10-24');
    expect(dayKey(new Date('2026-10-25T23:30:00+01:00'))).toBe('2026-10-25');
  });

  it('seeds each simulation and day differently, and the same for everyone', () => {
    expect(dailySeed('ten-harvests', '2026-10-09')).toBe(dailySeed('ten-harvests', '2026-10-09'));
    expect(dailySeed('ten-harvests', '2026-10-09')).not.toBe(
      dailySeed('ten-harvests', '2026-10-10'),
    );
    expect(dailySeed('ten-harvests', '2026-10-09')).not.toBe(
      dailySeed('crown-of-florins', '2026-10-09'),
    );
  });
});

describe('daily book', () => {
  it('keeps only the first attempt of the day', () => {
    const book = createDailyBook(createStorage(new MemoryStorage()));
    const first = { chronicleId: 'c1', share: 'first', verdictTier: 3 };
    expect(book.record('pond', '2026-10-09', first)).toBe(true);
    expect(book.record('pond', '2026-10-09', { ...first, share: 'second' })).toBe(false);
    expect(book.result('pond', '2026-10-09')?.share).toBe('first');
    expect(book.played('pond', '2026-10-09')).toBe(true);
    expect(book.played('pond', '2026-10-10')).toBe(false);
  });

  it('counts a begun daily for the streak before it is finished', () => {
    const book = createDailyBook(createStorage(new MemoryStorage()));
    book.markPlayed('pond', '2026-10-09');
    expect(book.played('pond', '2026-10-09')).toBe(true);
    expect(book.result('pond', '2026-10-09')).toBeNull();
    expect(book.streak('2026-10-09').current).toBe(1);
    // Finishing it later still records the first result.
    expect(
      book.record('pond', '2026-10-09', { chronicleId: 'c', share: 's', verdictTier: 2 }),
    ).toBe(true);
  });
});

describe('the Almanac streak', () => {
  const start = '2026-10-01';

  it('counts consecutive days', () => {
    const streak = computeStreak(days(start, 0, 1, 2, 3), addDays(start, 3));
    expect(streak).toMatchObject({ current: 4, volume: 1, best: 4, playedToday: true });
    expect(streak.days.map((d) => d.mark)).toEqual(['played', 'played', 'played', 'played']);
  });

  it('waits for today without breaking', () => {
    const streak = computeStreak(days(start, 0, 1, 2), addDays(start, 3));
    expect(streak).toMatchObject({ current: 3, playedToday: false });
    expect(streak.days.at(-1)).toEqual({ day: addDays(start, 3), mark: 'today' });
  });

  it('forgives one missed day as a pressed flower', () => {
    const streak = computeStreak(days(start, 0, 1, 3, 4), addDays(start, 4));
    expect(streak.current).toBe(4);
    expect(streak.days.map((d) => d.mark)).toEqual([
      'played',
      'played',
      'grace',
      'played',
      'played',
    ]);
  });

  it('forgives a day missed yesterday while today is still open', () => {
    const streak = computeStreak(days(start, 0, 1), addDays(start, 3));
    expect(streak.current).toBe(2);
    expect(streak.days.map((d) => d.mark)).toEqual(['played', 'played', 'grace', 'today']);
  });

  it('forgives only one day in seven', () => {
    // Missed day 2 (forgiven) and day 5 (only three days later): a new volume begins on day 6.
    const streak = computeStreak(days(start, 0, 1, 3, 4, 6, 7), addDays(start, 7));
    expect(streak).toMatchObject({ current: 2, volume: 2, best: 4 });
    expect(streak.days.map((d) => d.mark)).toEqual(['played', 'played']);
  });

  it('forgives again once seven days have passed', () => {
    const streak = computeStreak(days(start, 0, 2, 3, 4, 5, 6, 7, 8, 10), addDays(start, 10));
    expect(streak.current).toBe(9);
    expect(streak.days.filter((d) => d.mark === 'grace').map((d) => d.day)).toEqual(
      days(start, 1, 9),
    );
  });

  it('does not forgive two missed days in a row', () => {
    const streak = computeStreak(days(start, 0, 1, 2), addDays(start, 5));
    expect(streak).toMatchObject({ current: 0, volume: 2, best: 3, days: [] });
  });

  it('starts empty', () => {
    expect(computeStreak([], start)).toEqual({
      current: 0,
      volume: 1,
      best: 0,
      days: [],
      playedToday: false,
    });
  });

  it('is decided by UTC days across midnight', () => {
    const lateEvening = dayKey(Date.UTC(2026, 9, 9, 23, 55));
    const nextMorning = dayKey(Date.UTC(2026, 9, 10, 0, 5));
    expect(computeStreak([lateEvening, nextMorning], nextMorning).current).toBe(2);
  });

  it('counts across the daylight-saving weekend like any other days', () => {
    const streak = computeStreak(['2026-10-24', '2026-10-25', '2026-10-26'], '2026-10-26');
    expect(streak.current).toBe(3);
  });
});

describe('share string', () => {
  it('reads like a postcard and carries no personal data', () => {
    const text = shareString({
      simTitle: 'Ten Harvests',
      dailyNumber: 12,
      glyphs: ['🌾', '🌾', '🌧️', '🐀', '🌾', '🌾', '☀️', '🌾', '🌾', '🌾'],
      line: 'Fed 100% · Land +40%',
      epithet: 'Keeper of Full Granaries',
    });
    expect(text).toBe(
      'One More Year · Ten Harvests #12\n🌾🌾🌧️🐀🌾🌾☀️🌾🌾🌾\nFed 100% · Land +40% · "Keeper of Full Granaries"',
    );
  });

  it('wraps long runs and caps the glyphs', () => {
    const text = shareString({
      simTitle: 'Long',
      glyphs: Array.from({ length: 45 }, () => '•'),
      line: 'x',
      epithet: 'y',
    });
    const rows = text.split('\n');
    expect(rows[0]).toBe('One More Year · Long');
    expect(rows.slice(1, 4).every((row) => row.length === SHARE_LIMITS.glyphsPerRow)).toBe(true);
    expect(rows[4]).toBe('+15 more');
  });
});
