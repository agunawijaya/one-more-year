import { describe, expect, it } from 'vitest';
import { createRng, hashString, mixSeeds } from '../src/rng.ts';

const take = (rng: ReturnType<typeof createRng>, count: number): number[] =>
  Array.from({ length: count }, () => rng.next());

describe('rng', () => {
  it('gives the same sequence for the same seed', () => {
    expect(take(createRng(42), 50)).toEqual(take(createRng(42), 50));
    expect(take(createRng('ten-harvests:2026-10-09'), 20)).toEqual(
      take(createRng('ten-harvests:2026-10-09'), 20),
    );
  });

  it('keeps neighbouring seeds unrelated', () => {
    const one = take(createRng(1), 20);
    const two = take(createRng(2), 20);
    const shared = one.filter((value) => two.includes(value));
    expect(shared).toHaveLength(0);
  });

  it('matches a recorded sequence, so every browser replays the same world', () => {
    // If this fails, saved runs and shared daily scenarios would no longer replay.
    const rng = createRng(20261009);
    const values = Array.from({ length: 6 }, () => rng.int(0, 999));
    expect(values).toEqual([695, 679, 447, 529, 253, 390]);
  });

  it('draws integers inside the range with both ends reachable', () => {
    const rng = createRng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const value = rng.int(1, 6);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(6);
      seen.add(value);
    }
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('rejects impossible ranges', () => {
    expect(() => createRng(1).int(5, 1)).toThrow(RangeError);
    expect(() => createRng(1).pick([])).toThrow(RangeError);
    expect(() => createRng(Number.NaN)).toThrow(RangeError);
  });

  it('weights choices by their weights', () => {
    const rng = createRng(11);
    let heavy = 0;
    for (let i = 0; i < 4000; i++) {
      if (
        rng.weighted([
          { value: 'heavy', weight: 3 },
          { value: 'light', weight: 1 },
        ]) === 'heavy'
      ) {
        heavy++;
      }
    }
    expect(heavy / 4000).toBeGreaterThan(0.72);
    expect(heavy / 4000).toBeLessThan(0.78);
  });

  it('shuffles without touching the input', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = createRng(3).shuffle(items);
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(items);
  });

  it('centres normal draws on the mean', () => {
    const rng = createRng(5);
    let sum = 0;
    for (let i = 0; i < 4000; i++) sum += rng.normal(100, 10);
    expect(sum / 4000).toBeGreaterThan(99);
    expect(sum / 4000).toBeLessThan(101);
  });

  describe('fork', () => {
    it('gives the same child for the same label', () => {
      expect(take(createRng(9).fork('weather'), 10)).toEqual(
        take(createRng(9).fork('weather'), 10),
      );
    });

    it('gives different children for different labels', () => {
      const root = createRng(9);
      expect(take(root.fork('weather'), 5)).not.toEqual(take(root.fork('events'), 5));
    });

    it('is independent of how much the parent has drawn', () => {
      const fresh = createRng(9);
      const used = createRng(9);
      take(used, 37);
      expect(take(used.fork('weather'), 10)).toEqual(take(fresh.fork('weather'), 10));
    });

    it('keeps sibling streams apart when one of them draws more', () => {
      // The promise behind forks: one subsystem drawing an extra number
      // leaves every other subsystem's sequence exactly as it was.
      const before = createRng(21);
      const weatherBefore = before.fork('weather');
      const eventsBefore = before.fork('events');
      take(weatherBefore, 3);
      const eventsSequence = take(eventsBefore, 10);

      const after = createRng(21);
      const weatherAfter = after.fork('weather');
      const eventsAfter = after.fork('events');
      take(weatherAfter, 4);
      expect(take(eventsAfter, 10)).toEqual(eventsSequence);
    });

    it('nests: a fork of a fork is stable too', () => {
      const a = createRng(4).fork('year:3').fork('rats');
      const b = createRng(4).fork('year:3').fork('rats');
      expect(take(a, 5)).toEqual(take(b, 5));
      expect(take(createRng(4).fork('year:4').fork('rats'), 5)).not.toEqual(
        take(createRng(4).fork('year:3').fork('rats'), 5),
      );
    });

    it('counts draws across the whole family', () => {
      const root = createRng(1);
      expect(root.draws).toBe(0);
      root.fork('a').next();
      root.fork('b').int(1, 3);
      root.next();
      expect(root.draws).toBe(3);
    });
  });

  it('hashes strings and mixes seeds into well-spread values', () => {
    expect(hashString('pond')).toBe(hashString('pond'));
    expect(hashString('pond')).not.toBe(hashString('Pond'));
    expect(mixSeeds(1, 2)).not.toBe(mixSeeds(2, 1));
  });
});
