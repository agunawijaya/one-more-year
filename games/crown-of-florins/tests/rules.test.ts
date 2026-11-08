/**
 * The 1978 program's working rules, each stated in our own words and held
 * against the engine (docs/NOTES.md records where each was read).
 */
import { describe, expect, it } from 'vitest';
import { createRng } from '@one-more-year/kit';
import { rollWeather } from '../src/engine/economy.ts';
import { debtView } from '../src/engine/glass.ts';
import { capSeizure, rivalTooStrong, tooFewSoldiers } from '../src/engine/invasion.ts';
import { releaseBounds } from '../src/engine/plan.ts';
import { revenueFor } from '../src/engine/taxes.ts';
import { divisorFor, earnedTitle, pillarPoints, reviewTitle } from '../src/engine/title.ts';
import type { Standing } from '../src/engine/state.ts';

describe('weather', () => {
  it('comes up fair most often and drought or excellent one year in ten', () => {
    const counts = [0, 0, 0, 0, 0];
    const rng = createRng('weather-test');
    for (let i = 0; i < 30_000; i++) {
      const grade = rollWeather(rng);
      counts[grade - 1] = (counts[grade - 1] ?? 0) + 1;
    }
    const total = counts.reduce((a, b) => a + b, 0);
    const shares = counts.map((c) => c / total);
    // Exactly 3, 7, 10, 7 and 3 chances in 30 by the two dice.
    [3, 7, 10, 7, 3].forEach((expected, grade) => {
      expect(shares[grade]).toBeCloseTo(expected / 30, 1);
    });
  });
});

describe('the title review', () => {
  it('divides the points by difficulty + 5, takes away the justice level and adds one', () => {
    expect(divisorFor(1)).toBe(6);
    expect(divisorFor(4)).toBe(9);
    // 48 points at the easiest level and very fair justice: 48 ÷ 6 − 1 + 1 = 8, the crown.
    expect(earnedTitle(48, 1, 1)).toBe(8);
    // The same points under moderate justice fall a whole step short.
    expect(earnedTitle(48, 2, 1)).toBe(7);
    // Never above the crown.
    expect(earnedTitle(120, 1, 1)).toBe(8);
  });

  it('counts each pillar up to ten, rounding down, and lets debt count against you', () => {
    expect(pillarPoints({ id: 'land', per: 6000 }, 17_999)).toBe(2);
    expect(pillarPoints({ id: 'markets', per: 1 }, 14)).toBe(10);
    expect(pillarPoints({ id: 'treasury', per: 5000 }, -2000)).toBe(-1);
  });

  it('never lowers a title, and grants one step two years before death', () => {
    expect(reviewTitle(5, 0, 2, 2, false).title).toBe(5);
    expect(reviewTitle(5, 0, 2, 2, true).title).toBe(6);
    // When the points earn more than the honour, the points win.
    expect(reviewTitle(3, 70, 1, 2, true).title).toBe(8);
  });
});

describe('bread', () => {
  it('must lie between a fifth and four fifths of the reserves', () => {
    expect(releaseBounds(5000)).toEqual({ least: 1000, most: 4000 });
    expect(releaseBounds(0)).toEqual({ least: 0, most: 0 });
  });
});

describe('taxes and justice', () => {
  it('brings in the 1978 opening ledger for the starting realm', () => {
    const revenue = revenueFor(
      { serfs: 2000, soldiers: 25, merchants: 25, nobles: 4, clergy: 5 },
      1,
      { customs: 25, sales: 10, wealth: 5, justice: 2 },
      1,
    );
    expect(revenue).toEqual({ customs: 463, sales: 137, wealth: 55, justice: 100, total: 755 });
  });

  it('charges very fair justice and fines harsh justice, scaled by the title', () => {
    const at = (justice: 1 | 2 | 3 | 4, title: number): number =>
      revenueFor(
        { serfs: 0, soldiers: 0, merchants: 0, nobles: 0, clergy: 0 },
        0,
        { customs: 0, sales: 0, wealth: 0, justice },
        title,
      ).justice;
    expect(at(1, 3)).toBe(-600);
    expect(at(4, 2)).toBe(1400);
  });
});

describe('debt', () => {
  it('sends the creditors below −10,000 florins per title step', () => {
    expect(debtView(100, 1).line).toBe(-10_000);
    expect(debtView(100, 6).line).toBe(-60_000);
  });

  it('grows by half each year while it lasts', () => {
    const view = debtView(-2000, 1);
    expect(view.interest).toBe(-1000);
    // −2,000 → −3,000 → −4,500 → −6,750 → −10,125: the creditors arrive in the fourth year.
    expect(view.yearsToCreditors).toBe(4);
  });
});

describe('the border', () => {
  const standing = (seat: number, soldiers: number, land = 10_000): Standing => ({
    seat,
    title: 1,
    points: 0,
    land,
    soldiers,
    serfs: 2000,
    merchants: 25,
    nobles: 4,
    clergy: 5,
    treasury: 1000,
    status: 'reigning',
    aggressive: false,
  });

  it('opens when there are fewer soldiers than thousands of hectares', () => {
    expect(tooFewSoldiers(10_000, 10)).toBe(false);
    expect(tooFewSoldiers(10_001, 10)).toBe(true);
  });

  it('opens when a rival has more than 2.4 times your soldiers, and not otherwise', () => {
    expect(rivalTooStrong(0, 25, [standing(0, 25), standing(1, 60)])).toBe(false);
    expect(rivalTooStrong(0, 25, [standing(0, 25), standing(1, 61)])).toBe(true);
  });

  it('keeps the first 5,000 hectares: a seizure reaching them takes half of what lies beyond', () => {
    expect(capSeizure(2000, 20_000)).toBe(2000);
    expect(capSeizure(20_000, 20_000)).toBe(7500);
    expect(capSeizure(9000, 5000)).toBe(0);
  });
});
