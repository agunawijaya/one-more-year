/**
 * Balance targets, locked with the numbers recorded in docs/NOTES.md. The
 * runs are seeded (seeds 1…N), so the results are exact; the tolerances
 * leave room for small, deliberate changes to the bots.
 */
import { describe, expect, it } from 'vitest';
import { BOTS } from '../src/engine/bots.ts';
import { CURATED_SCENARIOS } from '../src/engine/rules.ts';
import { tallyRuns } from '../src/engine/simulate.ts';

const RUNS = 1000;

describe('Classic Term', () => {
  const careful = tallyRuns(BOTS.careful, 'classic', RUNS);

  it('lets a careful steward reach the top tier in 25–45 % of worlds', () => {
    expect(careful.topTier).toBeGreaterThanOrEqual(0.25);
    expect(careful.topTier).toBeLessThanOrEqual(0.45);
  });

  it('almost never deposes a careful steward', () => {
    expect(careful.deposed).toBeLessThan(0.02);
  });

  it('deposes a naive steward about two times in five (the original is hard on the unwary)', () => {
    const naive = tallyRuns(BOTS.naive, 'classic', RUNS);
    expect(naive.deposed).toBeGreaterThan(0.33);
    expect(naive.deposed).toBeLessThan(0.48);
  });

  it('punishes buying land at the people’s expense, and chance alone', () => {
    expect(tallyRuns(BOTS.greedy, 'classic', 300).deposed).toBeGreaterThan(0.85);
    expect(tallyRuns(BOTS.random, 'classic', 300).topTier).toBe(0);
  });
});

describe('scenarios', () => {
  for (const scenario of CURATED_SCENARIOS) {
    it(`${scenario}: winnable at the top tier by a careful steward in at least 10 % of worlds`, () => {
      const tally = tallyRuns(BOTS.careful, scenario, RUNS);
      expect(tally.topTier).toBeGreaterThanOrEqual(0.1);
      expect(tally.deposed).toBeLessThan(0.05);
    });
  }

  it('Dynasty: a careful line of rulers lasts all three terms in at least 70 % of worlds', () => {
    expect(tallyRuns(BOTS.careful, 'dynasty', 500).completed).toBeGreaterThanOrEqual(0.7);
  });
});
