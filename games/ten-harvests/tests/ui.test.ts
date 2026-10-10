/**
 * The budget bar and the scribe's console are pure arithmetic over the
 * decree; these tests hold them to the same rules the engine uses.
 */
import { describe, expect, it } from 'vitest';
import { cityModel, seedFor, workersLimit } from '../src/engine/model.ts';
import type { CityState, Decree } from '../src/engine/state.ts';
import {
  barLength,
  budgetOf,
  dragHandle,
  handleEnabled,
  handlePositions,
  nudgeHandle,
  shortfallOf,
  sowingCap,
} from '../src/ui/budget.ts';
import { answer, parseAnswer, reportLines, startConsole } from '../src/ui/console-flow.ts';

const classic = (): CityState => ({
  ...cityModel.init({ seed: 7, scenario: 'classic', seats: 1 }),
  landPrice: 20,
});
const valid = (state: CityState, decree: Decree): boolean =>
  !cityModel.validate(state, decree).some((issue) => issue.level === 'error');

describe('the grain budget', () => {
  it('splits the whole store into food, seed, land and keep', () => {
    const state = classic();
    const decree = { land: 10, food: 2000, plant: 600 };
    const budget = budgetOf(state, decree);
    expect(budget.food + budget.seed + budget.land + budget.keep).toBe(budget.total);
    expect(budget).toMatchObject({ total: 2800, land: 200, seed: 300, keep: 300, sale: 0 });
  });

  it('counts the price of land sold into the total', () => {
    const budget = budgetOf(classic(), { land: -10, food: 2000, plant: 0 });
    expect(budget).toMatchObject({ total: 3000, sale: 200, land: 0, keep: 1000 });
  });

  it('places the handles in order along the bar', () => {
    const positions = handlePositions(budgetOf(classic(), { land: 10, food: 2000, plant: 600 }));
    expect(positions['food-seed']).toBeLessThanOrEqual(positions['seed-land']);
    expect(positions['seed-land']).toBeLessThanOrEqual(positions['land-keep']);
    expect(positions['land-keep']).toBeCloseTo(2500 / 2800, 6);
  });

  it('keeps every handle on the bar when the decree asks for more than the store holds', () => {
    const state = classic();
    // Typed into the tablet: food for 130 and 999 acres sown, or 30 acres bought on top.
    for (const decree of [
      { land: 0, food: 2600, plant: 999 },
      { land: 30, food: 2000, plant: 999 },
      { land: 200, food: 2800, plant: 999 },
    ]) {
      const budget = budgetOf(state, decree);
      expect(shortfallOf(budget)).toBe(-budget.keep);
      expect(barLength(budget)).toBe(budget.food + budget.seed + budget.land);
      for (const position of Object.values(handlePositions(budget))) {
        expect(position).toBeGreaterThanOrEqual(0);
        expect(position).toBeLessThanOrEqual(1);
      }
    }
    const fits = budgetOf(state, cityModel.draft(state));
    expect(shortfallOf(fits)).toBe(0);
    expect(barLength(fits)).toBe(fits.total);
  });

  it('lets the land handle bring an overspent decree back within the store', () => {
    const state = classic();
    const overspent = { land: 30, food: 2000, plant: 999 };
    const next = dragHandle(state, overspent, 'land-keep', 1);
    expect(shortfallOf(budgetOf(state, next))).toBe(0);
    expect(next.land).toBe(Math.floor(budgetOf(state, { ...overspent, land: 0 }).keep / 20));
  });

  it('caps sowing by land, by hands and by seed', () => {
    const state = classic();
    expect(sowingCap(state, { land: 0, food: 2000, plant: 0 })).toBe(workersLimit(100));
    expect(sowingCap({ ...state, people: 20 }, { land: 0, food: 400, plant: 0 })).toBe(199);
    expect(sowingCap(state, { land: 0, food: 2700, plant: 0 })).toBe(201);
  });

  it('keeps every drag a decree the rules accept, with the grain conserved', () => {
    const state = classic();
    let decree = cityModel.draft(state);
    for (const handle of ['food-seed', 'seed-land', 'land-keep'] as const) {
      for (let share = 0; share <= 1.0001; share += 0.05) {
        const next = dragHandle(state, decree, handle, share);
        expect(valid(state, next)).toBe(true);
        const budget = budgetOf(state, next);
        expect(budget.food + budget.seed + budget.land + budget.keep).toBe(budget.total);
        expect(budget.keep).toBeGreaterThanOrEqual(0);
        decree = next;
      }
    }
  });

  it('moves food in whole rations and land in whole acres', () => {
    const state = classic();
    const draft = cityModel.draft(state);
    const fed = dragHandle(state, draft, 'food-seed', 0.5);
    expect(fed.food % 20).toBe(0);
    const bought = dragHandle(state, draft, 'land-keep', 0.99);
    expect(Number.isInteger(bought.land)).toBe(true);
    expect(bought.land * state.landPrice).toBeLessThanOrEqual(budgetOf(state, draft).keep);
  });

  it('nudges one ration or one acre at a time, and refuses what the store cannot pay', () => {
    const state = classic();
    const draft = cityModel.draft(state);
    expect(nudgeHandle(state, draft, 'food-seed', -1).food).toBe(draft.food - 20);
    expect(nudgeHandle(state, draft, 'land-keep', 1).land).toBe(1);
    const broke = { ...draft, food: 2800 - seedFor(draft.plant) };
    expect(nudgeHandle(state, broke, 'land-keep', 1)).toBe(broke);
  });

  it('leaves the land handles alone while land is being sold', () => {
    const selling = { land: -5, food: 2000, plant: 0 };
    expect(handleEnabled(selling, 'seed-land')).toBe(false);
    expect(handleEnabled(selling, 'land-keep')).toBe(false);
    expect(dragHandle(classic(), selling, 'land-keep', 0.9)).toBe(selling);
  });
});

describe("the scribe's console", () => {
  it('reads whole numbers only', () => {
    expect(parseAnswer(' 1,200 ')).toBe(1200);
    expect(parseAnswer('-3')).toBe(-3);
    expect(parseAnswer('12.5')).toBeNull();
    expect(parseAnswer('lots')).toBeNull();
  });

  it('asks to sell only when nothing was bought', () => {
    const state = classic();
    const bought = answer(state, startConsole(), '5');
    expect(bought.kind === 'next' && bought.state.question).toBe('food');
    const none = answer(state, startConsole(), '0');
    expect(none.kind === 'next' && none.state.question).toBe('sell');
  });

  it('refuses what the store, the land or the people cannot do, and asks again', () => {
    const state = classic();
    const tooDear = answer(state, startConsole(), '1000');
    expect(tooDear.kind).toBe('refused');
    expect(tooDear.kind === 'refused' && tooDear.state.question).toBe('buy');
    const atPlant = { question: 'plant' as const, decree: { land: 0, food: 2000, plant: 0 } };
    expect(answer(state, atPlant, '1001').kind).toBe('refused');
    expect(answer(state, atPlant, '1000').kind).toBe('refused');
    expect(answer(state, atPlant, '999')).toEqual({
      kind: 'decree',
      decree: { land: 0, food: 2000, plant: 999 },
    });
  });

  it('turns a negative answer into a walk-out under the 1978 rules, and refuses it otherwise', () => {
    const ledger = { ...classic(), ruleSet: '1978' as const };
    expect(answer(ledger, startConsole(), '-1')).toMatchObject({
      kind: 'decree',
      decree: { walkout: true },
    });
    expect(answer(classic(), startConsole(), '-1').kind).toBe('refused');
  });

  it('always ends with a decree the rules accept', () => {
    const state = classic();
    let current = startConsole();
    for (const typed of ['0', '0', '2000', '999']) {
      const result = answer(state, current, typed);
      if (result.kind === 'decree') {
        expect(valid(state, result.decree)).toBe(true);
        return;
      }
      if (result.kind === 'next') current = result.state;
    }
    throw new Error('the console never produced a decree');
  });

  it('prints the year just lived in plain numbers', () => {
    const lines = reportLines(classic(), 'Year 1 of 10').join(' ');
    expect(lines.startsWith('YEAR 1 OF 10.')).toBe(true);
    expect(lines).toContain('IN STORE 2,800 BUSHELS.');
    expect(lines).toContain('LAND GOES FOR 20 AN ACRE.');
  });
});
