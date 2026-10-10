/**
 * The grain budget: how this year's decree splits the store between food,
 * seed, land and what is kept. Pure arithmetic shared by the budget bar,
 * the steppers and the tests, so the bar and the numbers always agree.
 *
 * The bar runs food · seed · land · keep: the first things a city needs
 * come first, and buying land is a drag into what would otherwise be kept.
 */
import { BUSHELS_PER_PERSON } from '../engine/rules.ts';
import { maxSownWith, seedFor, workersLimit } from '../engine/model.ts';
import type { CityState, Decree } from '../engine/state.ts';

export interface Budget {
  /** The store, plus whatever selling land brings in. */
  total: number;
  food: number;
  seed: number;
  /** Bushels spent buying land (0 when selling). */
  land: number;
  /** Bushels received for land sold (0 when buying). */
  sale: number;
  keep: number;
}

export function budgetOf(state: CityState, decree: Decree): Budget {
  const land = Math.max(0, decree.land) * state.landPrice;
  const sale = Math.max(0, -decree.land) * state.landPrice;
  const total = state.grain + sale;
  const seed = seedFor(decree.plant);
  return { total, food: decree.food, seed, land, sale, keep: total - land - decree.food - seed };
}

/** The most acres this decree could sow: limited by land, workers and the seed left. */
export function sowingCap(state: CityState, decree: Decree): number {
  const acres = state.acres + decree.land;
  const budget = budgetOf(state, decree);
  return Math.max(
    0,
    Math.min(acres, workersLimit(state.people), maxSownWith(budget.seed + budget.keep)),
  );
}

/**
 * The bar's full length in bushels: the store, or what the decree asks for when that is more.
 * The steppers and typed numbers can ask for more than the store holds (the decree is then refused
 * with a reason); the bar stretches to show the whole request and marks where the store runs out.
 */
export function barLength(budget: Budget): number {
  return Math.max(1, budget.total, budget.food + budget.seed + budget.land);
}

/** Bushels the decree asks for beyond what the store holds; 0 when it fits. */
export function shortfallOf(budget: Budget): number {
  return Math.max(0, -budget.keep);
}

export type Handle = 'food-seed' | 'seed-land' | 'land-keep';

export const HANDLE_ORDER: readonly Handle[] = ['food-seed', 'seed-land', 'land-keep'];

/** Where each handle stands, as a share of the bar (always between 0 and 1). */
export function handlePositions(budget: Budget): Record<Handle, number> {
  const length = barLength(budget);
  return {
    'food-seed': budget.food / length,
    'seed-land': (budget.food + budget.seed) / length,
    'land-keep': (budget.food + budget.seed + budget.land) / length,
  };
}

/** Land handles stay put while land is being sold; the steppers and the field edge do that. */
export function handleEnabled(decree: Decree, handle: Handle): boolean {
  return handle === 'food-seed' || decree.land >= 0;
}

function plantFor(state: CityState, decree: Decree, seed: number): number {
  const owned = state.acres + decree.land;
  return Math.max(0, Math.min(seed * 2, owned, workersLimit(state.people)));
}

/**
 * Moves one handle to a share of the bar, trading grain only between its
 * two neighbours. Food moves in whole rations (20 bushels), seed in pairs
 * of acres, land in whole acres. Returns the new decree.
 */
export function dragHandle(
  state: CityState,
  decree: Decree,
  handle: Handle,
  share: number,
): Decree {
  if (!handleEnabled(decree, handle)) return decree;
  const budget = budgetOf(state, decree);
  const at = Math.max(0, Math.min(1, share)) * barLength(budget);
  switch (handle) {
    case 'food-seed': {
      const combined = budget.food + budget.seed;
      const seedCap = seedFor(Math.min(state.acres + decree.land, workersLimit(state.people)));
      const wanted = Math.round(at / BUSHELS_PER_PERSON) * BUSHELS_PER_PERSON;
      const food = Math.max(combined - seedCap, Math.min(combined, wanted));
      return { ...decree, food, plant: plantFor(state, decree, combined - food) };
    }
    case 'seed-land': {
      const combined = budget.seed + budget.land;
      const seed = Math.max(0, Math.min(combined, Math.round(at - budget.food)));
      const acres = Math.floor((combined - seed) / state.landPrice);
      const next = { ...decree, land: acres };
      return { ...next, plant: plantFor(state, next, combined - acres * state.landPrice) };
    }
    case 'land-keep': {
      const combined = budget.land + budget.keep;
      const spend = Math.max(0, Math.min(combined, at - budget.food - budget.seed));
      return { ...decree, land: Math.floor(spend / state.landPrice) };
    }
  }
}

/** One keyboard step for a handle: one person's food, ten acres of seed, one acre of land. */
export function nudgeHandle(
  state: CityState,
  decree: Decree,
  handle: Handle,
  steps: number,
): Decree {
  if (!handleEnabled(decree, handle)) return decree;
  const budget = budgetOf(state, decree);
  switch (handle) {
    case 'food-seed': {
      const combined = budget.food + budget.seed;
      const food = Math.max(0, Math.min(combined, decree.food + steps * BUSHELS_PER_PERSON));
      return { ...decree, food, plant: plantFor(state, decree, combined - food) };
    }
    case 'seed-land': {
      // Right: an acre bought with seed grain. Left: an acre's price back into seed.
      const acres = Math.max(0, decree.land + steps);
      const combined = budget.seed + budget.land;
      if (acres * state.landPrice > combined) return decree;
      const next = { ...decree, land: acres };
      return { ...next, plant: plantFor(state, next, combined - acres * state.landPrice) };
    }
    case 'land-keep': {
      const acres = Math.max(0, decree.land + steps);
      if ((acres - Math.max(0, decree.land)) * state.landPrice > budget.keep) return decree;
      return { ...decree, land: acres };
    }
  }
}
