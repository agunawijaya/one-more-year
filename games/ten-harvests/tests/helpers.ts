/**
 * Test helpers: a scripted random stream that answers every fork with a
 * chosen die face, so a year's arithmetic can be checked by hand.
 */
import type { Rng } from '@one-more-year/kit';
import { cityModel } from '../src/engine/model.ts';
import type { CityState } from '../src/engine/state.ts';

/** Faces by stream label: 'yield', 'rats', 'newcomers', 'land-price' (ints) and 'plague' (a float in [0, 1)). */
export type Dice = Partial<
  Record<'yield' | 'rats' | 'newcomers' | 'land-price' | 'plague', number>
>;

export function scriptedRng(dice: Dice, label = 'root'): Rng {
  const value = (dice as Record<string, number | undefined>)[label];
  const rng: Rng = {
    key: 0,
    draws: 0,
    next: () => value ?? 0.5,
    int: (min, max) => Math.max(min, Math.min(max, value ?? min)),
    float: (min, max) => min + (max - min) * (value ?? 0.5),
    chance: (p) => (value ?? 0.5) < p,
    pick: <T>(items: readonly T[]): T => items[0] as T,
    weighted: <T>(options: readonly { value: T; weight: number }[]): T => {
      const first = options[0];
      if (!first) throw new RangeError('no options');
      return first.value;
    },
    shuffle: (items) => [...items],
    normal: (mean) => mean,
    fork: (next) => scriptedRng(dice, next),
  };
  return rng;
}

/** A classic city at the start of year 1, with any numbers overridden. */
export function cityWith(overrides: Partial<CityState> = {}, scenario = 'classic'): CityState {
  return { ...cityModel.init({ seed: 1, scenario, seats: 1 }), landPrice: 20, ...overrides };
}
