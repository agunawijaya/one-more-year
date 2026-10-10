/**
 * Original fidelity. A second, independent implementation of one year,
 * written from the description in docs/NOTES.md (not from the engine and
 * not by translating the old listing), is compared with the engine's 1978
 * rules over 10,000 seeded years. The same seeded draws feed both; the
 * reference reads them its own way, including the plague's original
 * arithmetic. Then the dice themselves are checked against their stated
 * distributions.
 */
import { describe, expect, it } from 'vitest';
import { createRng, rngForStep } from '@one-more-year/kit';
import { cityModel } from '../src/engine/model.ts';
import type { CityState, Decree } from '../src/engine/state.ts';

interface Draws {
  yieldDraw: number;
  ratDraw: number;
  newcomerDraw: number;
  plagueDraw: number;
}

/** The four uniform draws of a step, read straight from the step's streams. */
function drawsFor(seed: number, step: number): Draws {
  const stream = rngForStep(seed, step);
  return {
    yieldDraw: stream.fork('yield').next(),
    ratDraw: stream.fork('rats').next(),
    newcomerDraw: stream.fork('newcomers').next(),
    plagueDraw: stream.fork('plague').next(),
  };
}

const die = (draw: number): number => Math.floor(draw * 5) + 1;

/** One year as NOTES.md describes it. Returns null if the ruler is deposed. */
function referenceYear(
  city: { people: number; grain: number; acres: number; price: number },
  decree: Decree,
  draws: Draws,
): { people: number; grain: number; acres: number; percent: number | null } | null {
  const acres = city.acres + decree.land;
  let store = city.grain - decree.land * city.price - decree.food - Math.floor(decree.plant / 2);
  const harvest = decree.plant * die(draws.yieldDraw);
  const ratRoll = die(draws.ratDraw);
  const eaten = ratRoll % 2 === 0 ? Math.floor(store / ratRoll) : 0;
  store = store - eaten + harvest;
  const arriving = Math.floor(
    (die(draws.newcomerDraw) * (20 * acres + store)) / city.people / 100 + 1,
  );
  const fed = Math.floor(decree.food / 20);
  const hungry = fed > city.people ? 0 : city.people - fed;
  if (hungry > 0.45 * city.people) return null;
  // The plague's own arithmetic: ten times (twice the draw minus three tenths), rounded down, at most zero.
  const plague = Math.floor(10 * (2 * draws.plagueDraw - 0.3)) <= 0;
  let people = city.people - hungry + arriving;
  if (plague) people = Math.floor(people / 2);
  return {
    people,
    grain: store,
    acres,
    percent: fed > city.people ? null : (hungry * 100) / city.people,
  };
}

/** A random decree that the 1978 rules accept, drawn from its own stream. */
function someDecree(state: CityState, seed: number, step: number): Decree {
  const rng = createRng(seed).fork('decree').fork(`step:${step}`);
  const buy = rng.chance(0.3) ? rng.int(0, Math.floor((state.grain * 0.2) / state.landPrice)) : 0;
  const sell = buy === 0 && rng.chance(0.2) ? rng.int(0, Math.floor(state.acres * 0.1)) : 0;
  const land = buy - sell;
  const afterLand = state.grain - land * state.landPrice;
  const food = Math.min(afterLand, Math.round(state.people * 20 * rng.float(0.6, 1.2)));
  const plantCap = Math.min(state.acres + land, state.people * 10 - 1, (afterLand - food) * 2 + 1);
  const plant = Math.max(0, rng.int(0, Math.max(0, plantCap)));
  return { land, food, plant };
}

describe('the 1978 rules match the description in NOTES.md', () => {
  it('agrees with an independent reference on 10,000 seeded years', () => {
    let years = 0;
    let mismatches = 0;
    for (let seed = 1; years < 10000; seed++) {
      let state = cityModel.init({ seed, scenario: 'ledger-1978', seats: 1 });
      for (let step = 0; step < 10 && !state.ending; step++) {
        const decree = someDecree(state, seed, step);
        if (cityModel.validate(state, decree).some((issue) => issue.level === 'error')) break;
        const expected = referenceYear(
          { people: state.people, grain: state.grain, acres: state.acres, price: state.landPrice },
          decree,
          drawsFor(seed, step),
        );
        const { state: next } = cityModel.resolve(state, decree, rngForStep(seed, step));
        years++;
        if (expected === null) {
          if (next.ending?.kind !== 'deposed') mismatches++;
          break;
        }
        if (
          next.people !== expected.people ||
          next.grain !== expected.grain ||
          next.acres !== expected.acres
        ) {
          mismatches++;
        }
        state = next;
      }
    }
    expect(mismatches).toBe(0);
  });
});

describe('the dice have the stated distributions', () => {
  const N = 10000;
  const counts = (values: number[]): Map<number, number> => {
    const map = new Map<number, number>();
    for (const value of values) map.set(value, (map.get(value) ?? 0) + 1);
    return map;
  };
  const seeds = Array.from({ length: N }, (_, i) => i + 1);

  it('land costs 17 to 26 bushels an acre, each price equally likely', () => {
    const prices = seeds.map(
      (seed) => cityModel.init({ seed, scenario: 'ledger-1978', seats: 1 }).landPrice,
    );
    const tally = counts(prices);
    expect([...tally.keys()].sort((a, b) => a - b)).toEqual([
      17, 18, 19, 20, 21, 22, 23, 24, 25, 26,
    ]);
    for (const n of tally.values()) expect(n / N).toBeGreaterThan(0.085);
    for (const n of tally.values()) expect(n / N).toBeLessThan(0.115);
  });

  it('yields 1 to 5 bushels an acre, each one year in five', () => {
    const tally = counts(seeds.map((seed) => die(drawsFor(seed, 0).yieldDraw)));
    for (let face = 1; face <= 5; face++) expect((tally.get(face) ?? 0) / N).toBeCloseTo(0.2, 1);
  });

  it('sends rats two years in five, half of them eating a half and half a quarter', () => {
    const state = cityModel.init({ seed: 1, scenario: 'ledger-1978', seats: 1 });
    let ratYears = 0;
    let halves = 0;
    for (const seed of seeds) {
      const { state: next } = cityModel.resolve(
        { ...state, grain: 4000 },
        { land: 0, food: 2000, plant: 0 },
        rngForStep(seed, 0),
      );
      if (next.last.ratsAte > 0) ratYears++;
      if (next.last.ratsAte === 1000) halves++;
    }
    expect(ratYears / N).toBeCloseTo(0.4, 1);
    expect(halves / ratYears).toBeCloseTo(0.5, 1);
  });

  it('brings the plague one year in five: 20 %, not the 15 % the original comment promises', () => {
    const plague = seeds.filter(
      (seed) => Math.floor(10 * (2 * drawsFor(seed, 0).plagueDraw - 0.3)) <= 0,
    );
    expect(plague.length / N).toBeGreaterThan(0.185);
    expect(plague.length / N).toBeLessThan(0.215);
    // The engine's fever roll is the same event: below 0.2 on the same draw.
    for (const seed of seeds.slice(0, 2000)) {
      const draw = drawsFor(seed, 0).plagueDraw;
      expect(draw < 0.2).toBe(Math.floor(10 * (2 * draw - 0.3)) <= 0);
    }
  });
});
