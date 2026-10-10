import { describe, expect, it } from 'vitest';
import {
  describeForecast,
  forecast,
  forecastHolds,
  forecastMany,
  forecastSeed,
  summarise,
} from '../src/forecast.ts';
import { formatNumber } from '../src/format.ts';
import { resolveStep, type TurnModel } from '../src/turns.ts';
import { orchard } from './orchard-model.ts';

/** A granary whose stock is exact to plan but whose harvest is a roll of the weather. */
interface Granary {
  turn: number;
  grain: number;
}
interface GranaryPlan {
  eat: number;
  sow: number;
}
const granary: TurnModel<Granary, GranaryPlan> = {
  init: () => ({ turn: 1, grain: 1000 }),
  draft: () => ({ eat: 100, sow: 0 }),
  validate: () => [],
  resolve(state, plan, rng) {
    // Sowing nothing means nothing random can happen this year.
    const harvest = plan.sow > 0 ? Math.round(plan.sow * rng.fork('weather').normal(3, 0.8)) : 0;
    return {
      state: { turn: state.turn + 1, grain: state.grain - plan.eat - plan.sow + harvest },
      events: [],
    };
  },
  signals: (state) => ({ grain: state.grain }),
  position: (state) => ({ turn: state.turn, seat: 0 }),
  outcome: () => null,
};

const grainAfter = (after: Granary): number => after.grain;

describe('forecast', () => {
  it('is exact when the step draws no random numbers', () => {
    const result = forecast(
      granary,
      granary.init({ seed: 1, scenario: '', seats: 1 }),
      { eat: 300, sow: 0 },
      grainAfter,
    );
    expect(result).toEqual({ kind: 'exact', value: 700 });
    expect(describeForecast(result, formatNumber)).toBe('exactly 700');
  });

  it('gives a labelled range when the weather is involved', () => {
    const state = granary.init({ seed: 1, scenario: '', seats: 1 });
    const result = forecast(granary, state, { eat: 100, sow: 200 }, grainAfter, { seed: 'x' });
    expect(result.kind).toBe('range');
    if (result.kind !== 'range') return;
    expect(result.coverage).toBe(0.8);
    expect(result.samples).toBe(200);
    expect(result.low).toBeLessThan(result.median);
    expect(result.median).toBeLessThan(result.high);
    expect(describeForecast(result, formatNumber)).toMatch(
      /^[\d,]+–[\d,]+ in 8 of 10 years \(most likely [\d,]+\)$/,
    );
  });

  it('is stable for the same seed, so the screen does not flicker', () => {
    const state = granary.init({ seed: 1, scenario: '', seats: 1 });
    const plan = { eat: 100, sow: 200 };
    expect(forecast(granary, state, plan, grainAfter, { seed: forecastSeed(9, 2) })).toEqual(
      forecast(granary, state, plan, grainAfter, { seed: forecastSeed(9, 2) }),
    );
  });

  it('contains the realised value at the stated rate', () => {
    // For many worlds: forecast the year, then let the real year happen with
    // the world's own stream. An honest 80 % range holds about 80 % of the time.
    let held = 0;
    const worlds = 600;
    const plan = { eat: 100, sow: 250 };
    for (let seed = 1; seed <= worlds; seed++) {
      const state = granary.init({ seed, scenario: '', seats: 1 });
      const predicted = forecast(granary, state, plan, grainAfter, { seed: forecastSeed(seed, 0) });
      const actual = resolveStep(granary, state, plan, seed, 0).state.grain;
      if (forecastHolds(predicted, actual)) held++;
    }
    const rate = held / worlds;
    expect(rate).toBeGreaterThan(0.75);
    expect(rate).toBeLessThan(0.86);
  });

  it('honours other coverage levels too', () => {
    let held = 0;
    const worlds = 600;
    const plan = { eat: 0, sow: 300 };
    for (let seed = 1; seed <= worlds; seed++) {
      const state = granary.init({ seed, scenario: '', seats: 1 });
      const predicted = forecast(granary, state, plan, grainAfter, {
        seed: forecastSeed(seed, 0),
        coverage: 0.5,
      });
      if (forecastHolds(predicted, resolveStep(granary, state, plan, seed, 0).state.grain)) held++;
    }
    expect(held / worlds).toBeGreaterThan(0.44);
    expect(held / worlds).toBeLessThan(0.57);
  });

  it('measures several numbers from one set of samples', () => {
    const state = orchard.init({ seed: 3, scenario: 'standard', seats: 1 });
    const result = forecastMany(
      orchard,
      state,
      { sell: 0, plant: 2 },
      {
        trees: (after) => after.trees[0] ?? 0,
        apples: (after) => after.apples[0] ?? 0,
      },
      { seed: 'orchard' },
    );
    // Planting is certain even though the harvest is not.
    expect(result.trees).toMatchObject({ kind: 'range', low: 12, high: 12 });
    expect(describeForecast(result.trees, formatNumber)).toBe('12 in every trial year');
    expect(result.apples.kind).toBe('range');
  });

  it('summarises small samples sensibly', () => {
    expect(summarise([5, 1, 3], 0.8)).toMatchObject({ low: 1, median: 3, high: 5 });
    expect(summarise([4], 0.8)).toMatchObject({ low: 4, median: 4, high: 4 });
  });
});
