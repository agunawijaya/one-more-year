import { describe, expect, it } from 'vitest';
import { averageHunger, judgeTerm } from '../src/engine/judge.ts';
import {
  cityModel,
  countsTowardAverage,
  nextLedgerAverage,
  newcomersFor,
  seedFor,
  walksOut,
  workersLimit,
} from '../src/engine/model.ts';
import { rulesFor } from '../src/engine/rules.ts';
import type { CityState, Decree, TermTally } from '../src/engine/state.ts';
import { cityWith, scriptedRng, type Dice } from './helpers.ts';

const QUIET: Dice = { yield: 4, rats: 1, newcomers: 3, plague: 0.9, 'land-price': 22 };

function year(state: CityState, decree: Decree, dice: Dice = QUIET) {
  return cityModel.resolve(state, decree, scriptedRng(dice));
}

describe('the opening', () => {
  it('starts the classic term as the original does', () => {
    const state = cityModel.init({ seed: 42, scenario: 'classic', seats: 1 });
    expect(state).toMatchObject({
      year: 1,
      people: 100,
      grain: 2800,
      acres: 1000,
      ruleSet: 'normal',
    });
    expect(state.landPrice).toBeGreaterThanOrEqual(17);
    expect(state.landPrice).toBeLessThanOrEqual(26);
    expect(state.last).toMatchObject({
      yieldPerAcre: 3,
      harvest: 3000,
      ratsAte: 200,
      newcomers: 5,
    });
  });

  it('gives each scenario its own start or chance', () => {
    expect(rulesFor('crowded-gate').start).toMatchObject({ people: 150, grain: 3000, acres: 1000 });
    expect(rulesFor('thin-inheritance').start.grain).toBe(500);
    expect(rulesFor('dry-decade').yieldRange).toEqual([1, 3]);
    expect(rulesFor('generous-delta')).toMatchObject({ yieldRange: [3, 6], feverOneIn: 3 });
    expect(rulesFor('year-of-rats').ratFaces).toEqual([2, 3, 4]);
    expect(rulesFor('land-fever').priceRange).toEqual([10, 40]);
    expect(rulesFor('dynasty').terms).toBe(3);
    expect(rulesFor('ledger-1978').ruleSet).toBe('1978');
    expect(rulesFor('no-such-scenario').id).toBe('classic');
  });
});

describe('one year, by hand', () => {
  it('takes land, food and seed, then harvest, rats, newcomers and the next price', () => {
    const state = cityWith();
    const { state: next } = year(
      state,
      { land: 10, food: 2000, plant: 900 },
      { ...QUIET, rats: 2 },
    );
    // 2,800 − 200 (land) − 2,000 (food) − 450 (seed) = 150 left; rats take half before the harvest.
    const left = 150;
    const store = left - 75 + 900 * 4;
    expect(next.grain).toBe(store);
    expect(next.acres).toBe(1010);
    expect(next.last).toMatchObject({ harvest: 3600, ratsAte: 75, ratFace: 2, hungry: 0 });
    expect(next.last.newcomers).toBe(newcomersFor(3, 1010, store, 100));
    expect(next.last.newcomers).toBe(8);
    expect(next.people).toBe(108);
    expect(next.landPrice).toBe(22);
    expect(next.year).toBe(2);
  });

  it('lets an odd acre go without its half bushel of seed', () => {
    expect(seedFor(901)).toBe(450);
    const { state: next } = year(
      cityWith(),
      { land: 0, food: 2000, plant: 901 },
      { ...QUIET, yield: 1 },
    );
    expect(next.grain).toBe(2800 - 2000 - 450 + 901);
  });

  it('keeps the rats away on odd faces, and in Year of Rats lets them take a third on a 3', () => {
    const decree = { land: 0, food: 2000, plant: 0 };
    expect(year(cityWith(), decree, { ...QUIET, rats: 3 }).state.last.ratsAte).toBe(0);
    const rats = year(cityWith({}, 'year-of-rats'), decree, { ...QUIET, rats: 3 });
    expect(rats.state.last.ratsAte).toBe(Math.floor(800 / 3));
  });

  it('halves the city with fever after the newcomers have arrived', () => {
    const { state: next, events } = year(
      cityWith(),
      { land: 0, food: 2000, plant: 0 },
      { ...QUIET, plague: 0.1 },
    );
    const arrived = next.last.newcomers;
    const before = 100 + arrived;
    expect(next.last.feverLost).toBe(before - Math.floor(before / 2));
    expect(next.people).toBe(Math.floor(before / 2));
    expect(events.some((e) => e.kind === 'fever')).toBe(true);
  });

  it('counts the hungry: twenty bushels a person, rounded down', () => {
    const { state: next } = year(cityWith(), { land: 0, food: 1519, plant: 0 });
    expect(next.last.fed).toBe(75);
    expect(next.last.hungry).toBe(25);
    expect(next.people).toBe(75 + next.last.newcomers);
  });

  it('deposes the ruler when more than 45 in 100 go hungry, and not at exactly 45', () => {
    const exactly = year(cityWith(), { land: 0, food: 1100, plant: 0 });
    expect(exactly.state.ending).toBeNull();
    expect(exactly.state.last.hungry).toBe(45);
    const deposed = year(cityWith(), { land: 0, food: 1080, plant: 0 });
    expect(deposed.state.ending).toMatchObject({ kind: 'deposed', tier: 1 });
    expect(deposed.state.people).toBe(100);
    expect(deposed.events.some((e) => e.kind === 'newcomers')).toBe(false);
    expect(cityModel.outcome(deposed.state)?.verdict.id).toBe('deposed');
  });
});

describe('the decree is checked before the year turns', () => {
  const issues = (decree: Decree, state = cityWith()) => cityModel.validate(state, decree);
  const errors = (decree: Decree, state = cityWith()) =>
    issues(decree, state).filter((issue) => issue.level === 'error');

  it('accepts a sensible decree', () => {
    expect(errors({ land: 0, food: 2000, plant: 999 })).toEqual([]);
  });

  it('refuses land the store cannot pay for, and selling the last acre', () => {
    expect(errors({ land: 141, food: 0, plant: 0 })[0]?.field).toBe('land');
    expect(errors({ land: 140, food: 0, plant: 0 })).toEqual([]);
    expect(errors({ land: -1000, food: 0, plant: 0 })[0]?.field).toBe('land');
    expect(errors({ land: -999, food: 0, plant: 0 })).toEqual([]);
  });

  it('refuses food or seed the store does not hold', () => {
    expect(errors({ land: 0, food: 2801, plant: 0 })[0]?.field).toBe('food');
    expect(errors({ land: 0, food: 2000, plant: 999 })).toEqual([]);
    expect(errors({ land: 0, food: 2400, plant: 802 })[0]?.field).toBe('plant');
    expect(errors({ land: 0, food: 2400, plant: 801 })).toEqual([]);
  });

  it('refuses more acres than the city owns or its people can tend (strictly fewer than ten each)', () => {
    expect(workersLimit(100)).toBe(999);
    expect(errors({ land: 0, food: 0, plant: 1000 }).map((i) => i.field)).toContain('plant');
    expect(
      errors({ land: 0, food: 0, plant: 1000 }, cityWith({ acres: 2000 }))[0]?.message,
    ).toMatch(/999/);
  });

  it('refuses negative or fractional numbers under the normal rules', () => {
    expect(errors({ land: 0, food: -1, plant: 0 })[0]?.field).toBe('food');
    expect(errors({ land: 0, food: 0, plant: 1.5 })[0]?.field).toBe('plant');
    expect(errors({ land: 0, food: 0, plant: 0, walkout: true })).not.toEqual([]);
  });

  it('warns, without refusing, when people would go hungry or the decree would end the rule', () => {
    expect(issues({ land: 0, food: 1900, plant: 0 })).toEqual([
      { field: 'food', message: '5 people would go hungry.', level: 'warning' },
    ]);
    expect(issues({ land: 0, food: 1000, plant: 0 })[0]).toMatchObject({
      level: 'warning',
      message: /end your rule/,
    });
  });
});

describe('the two rule sets differ only where they are named', () => {
  it('countsTowardAverage: the 1978 rules skip a year when more are fed than live in the city', () => {
    expect(countsTowardAverage('normal', 101, 100)).toBe(true);
    expect(countsTowardAverage('1978', 101, 100)).toBe(false);
    expect(countsTowardAverage('1978', 100, 100)).toBe(true);
    expect(countsTowardAverage('normal', 80, 100)).toBe(true);
    expect(countsTowardAverage('1978', 80, 100)).toBe(true);
  });

  it('nextLedgerAverage: the running average that assumes every earlier year was counted', () => {
    expect(nextLedgerAverage(0, 1, 30)).toBe(30);
    expect(nextLedgerAverage(30, 2, 0)).toBe(15);
    expect(nextLedgerAverage(30, 3, 0)).toBe(20);
  });

  it('walksOut: only the 1978 rules accept a negative answer, and it ends the game', () => {
    expect(walksOut('1978', { land: 0, food: 0, plant: 0, walkout: true })).toBe(true);
    expect(walksOut('normal', { land: 0, food: 0, plant: 0, walkout: true })).toBe(false);
    const ledger = cityWith({}, 'ledger-1978');
    expect(cityModel.validate(ledger, { land: 0, food: 0, plant: 0, walkout: true })).toEqual([]);
    const { state } = year(ledger, { land: 0, food: 0, plant: 0, walkout: true });
    expect(state.ending).toMatchObject({ kind: 'walked-out', verdictId: 'walked-out' });
  });
});

describe('judging a term', () => {
  const tally = (percents: number[], extra: Partial<TermTally> = {}): TermTally => ({
    index: 0,
    firstYear: 1,
    hungerPercents: percents,
    ledgerAverage: 0,
    totalHungry: percents.some((p) => p > 0) ? 1 : 0,
    skippedYears: [],
    startPeople: 100,
    startGrain: 2800,
    startAcres: 1000,
    ...extra,
  });

  it('uses the original bands, worst first', () => {
    expect(judgeTerm('normal', tally([34]), 2000, 100).id).toBe('sent-to-the-fields');
    expect(judgeTerm('normal', tally([0]), 690, 100).id).toBe('sent-to-the-fields');
    expect(judgeTerm('normal', tally([11]), 2000, 100).id).toBe('heavy-hand');
    expect(judgeTerm('normal', tally([0]), 890, 100).id).toBe('heavy-hand');
    expect(judgeTerm('normal', tally([4]), 2000, 100).id).toBe('fair-season');
    expect(judgeTerm('normal', tally([0]), 990, 100).id).toBe('fair-season');
    expect(judgeTerm('normal', tally([3]), 1000, 100).id).toBe('worth-carving');
  });

  it('names ten quiet years when nobody went hungry and there was land to spare (normal rules only)', () => {
    expect(judgeTerm('normal', tally([0, 0]), 1000, 100).id).toBe('ten-quiet-years');
    expect(judgeTerm('1978', tally([0, 0]), 1000, 100).id).toBe('worth-carving');
  });

  it('reads the average from the rule set: a true mean, or the 1978 running average', () => {
    const t = tally([30, 0, 0], { ledgerAverage: 30 });
    expect(averageHunger('normal', t)).toBe(10);
    expect(averageHunger('1978', t)).toBe(30);
  });
});

describe('the generosity paradox, end to end', () => {
  /** A bad first year (30 % hungry), then nine years of feeding everyone and one ration more. */
  function generousTerm(scenario: string): CityState {
    let state = cityWith({ grain: 100000 }, scenario);
    state = year(state, { land: 0, food: 1400, plant: 0 }, { ...QUIET, newcomers: 1 }).state;
    for (let y = 2; y <= 10; y++) {
      const food = (state.people + 1) * 20;
      state = year(state, { land: 0, food, plant: 0 }, { ...QUIET, newcomers: 1 }).state;
    }
    return state;
  }

  it('in the 1978 Ledger, generous years vanish from the average and the bad year counts for all ten', () => {
    const final = generousTerm('ledger-1978');
    expect(final.judged[0]?.averageHunger).toBeCloseTo(30, 6);
    expect(final.term.skippedYears).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('under the normal rules every year counts', () => {
    const final = generousTerm('classic');
    expect(final.judged[0]?.averageHunger).toBeCloseTo(3, 6);
    expect(final.term.skippedYears).toEqual([]);
  });
});

describe('terms and dynasties', () => {
  it('judges the term after ten years and ends a classic run', () => {
    let state = cityWith();
    for (let y = 0; y < 10; y++) state = year(state, cityModel.draft(state)).state;
    expect(state.ending?.kind).toBe('term-complete');
    expect(state.judged).toHaveLength(1);
    expect(cityModel.position(state).turn).toBe(10);
  });

  it('hands the city to the heir after each Dynasty term and ends after thirty years', () => {
    // A fever every year keeps the city small enough to feed for thirty years on fixed dice.
    const feverish = { ...QUIET, plague: 0.1 };
    let state = cityWith({}, 'dynasty');
    for (let y = 0; y < 10; y++) state = year(state, cityModel.draft(state), feverish).state;
    expect(state.ending).toBeNull();
    expect(state.term).toMatchObject({ index: 1, firstYear: 11 });
    for (let y = 0; y < 20; y++) state = year(state, cityModel.draft(state), feverish).state;
    expect(state.ending?.kind).toBe('dynasty-complete');
    expect(state.judged).toHaveLength(3);
  });
});
