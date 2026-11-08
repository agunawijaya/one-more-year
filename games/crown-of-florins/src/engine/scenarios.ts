/**
 * The scenarios: the 1978 valley, five worlds of our own, Endless Dynasty,
 * and the Hall's demo.
 *
 * A scenario changes the start and a few switches of the year (the Terms)
 * and nothing else: every formula stays the same function with the same
 * constants, and the Terms are copied into the world so the ledger can show
 * exactly what this world does differently.
 */
import type { Personality } from './state.ts';

/** The switches a scenario may turn. Every one is 1 or true in the 1978 valley. */
export interface Terms {
  /** Multiplies the yield of every worked hectare (rich soil). */
  yieldFactor: number;
  /** False when no land can be bought (it can still be sold). */
  landForSale: boolean;
  /** Multiplies what customs bring in. */
  customsFactor: number;
  /** Multiplies the rent each market pays. */
  marketRentFactor: number;
  /** Multiplies the death roll of a fed year (fevers). */
  deathFactor: number;
  /** Multiplies the newcomers a generous release draws. */
  newcomerFactor: number;
  /** True when the first human crowned ends the game; false keeps the chronicle growing. */
  crownEnds: boolean;
}

export const VALLEY_TERMS: Terms = {
  yieldFactor: 1,
  landForSale: true,
  customsFactor: 1,
  marketRentFactor: 1,
  deathFactor: 1,
  newcomerFactor: 1,
  crownEnds: true,
};

/** Changes to a realm's opening numbers. */
export interface StartChanges {
  land?: number;
  treasury?: number;
  title?: number;
  grain?: number;
  merchants?: number;
  soldiers?: number;
}

export interface Scenario {
  id: string;
  terms: Terms;
  /** The last year played, or null for an open-ended game. */
  endYear: number | null;
  /** Applied to every realm. */
  everyone: StartChanges;
  /** Applied to the human seats only (the scenario's challenge is theirs). */
  humans: StartChanges;
  /** A rival the scenario insists on, made aggressive and given a head start. */
  aggressor: { personality: Personality; start: StartChanges } | null;
}

/** designed: every game ends by 1500 unless a crown ends it first, so no run is endless by accident. */
export const CENTURY_END = 1500;

const SCENARIOS: Readonly<Record<string, Scenario>> = {
  standard: {
    id: 'standard',
    terms: VALLEY_TERMS,
    endYear: CENTURY_END,
    everyone: {},
    humans: {},
    aggressor: null,
  },
  'narrow-valley': {
    id: 'narrow-valley',
    terms: { ...VALLEY_TERMS, yieldFactor: 1.4 },
    endYear: CENTURY_END,
    everyone: { land: 6500 },
    humans: {},
    aggressor: null,
  },
  'borrowed-crown': {
    id: 'borrowed-crown',
    terms: VALLEY_TERMS,
    endYear: CENTURY_END,
    everyone: {},
    humans: { title: 2, treasury: -6000 },
    aggressor: null,
  },
  'general-next-door': {
    id: 'general-next-door',
    terms: VALLEY_TERMS,
    endYear: CENTURY_END,
    everyone: {},
    humans: {},
    aggressor: { personality: 'general', start: { soldiers: 55, treasury: 2500 } },
  },
  'year-of-fevers': {
    id: 'year-of-fevers',
    terms: { ...VALLEY_TERMS, deathFactor: 2, newcomerFactor: 0.5 },
    endYear: 1460,
    everyone: {},
    humans: {},
    aggressor: null,
  },
  'harbour-town': {
    id: 'harbour-town',
    terms: { ...VALLEY_TERMS, landForSale: false, customsFactor: 1.2, marketRentFactor: 1.25 },
    endYear: CENTURY_END,
    everyone: {},
    humans: {},
    aggressor: null,
  },
  endless: {
    id: 'endless',
    terms: { ...VALLEY_TERMS, crownEnds: false },
    endYear: null,
    everyone: {},
    humans: {},
    aggressor: null,
  },
};

/** The five curated scenarios, in the order the menu shows them. */
export const CURATED_SCENARIOS = [
  'narrow-valley',
  'borrowed-crown',
  'general-next-door',
  'year-of-fevers',
  'harbour-town',
] as const;

/**
 * The daily world is the 1978 valley; the day's seed alone draws the rivals,
 * the weather and every lifespan, so everyone meets the same court that day.
 */
export function dailyScenarioFor(_seed: number): string {
  return 'standard';
}

/** The scenario with this id; unknown ids (and the Hall's demo) play the 1978 valley. */
export function scenarioFor(id: string): Scenario {
  return SCENARIOS[id] ?? (SCENARIOS.standard as Scenario);
}
