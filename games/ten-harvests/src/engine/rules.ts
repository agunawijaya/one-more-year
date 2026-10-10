/**
 * The numbers of the world: the original model's constants and the six
 * curated scenarios, each of which changes one start value or one chance.
 *
 * Everything the player sees as odds on the ledger is read from here, so the
 * honest forecast and the real year can never disagree.
 */

/** 'normal' fixes the original's scoring bug; '1978' keeps every quirk (see CHANGES-FROM-ORIGINAL). */
export type RuleSet = 'normal' | '1978';

export interface StartState {
  people: number;
  grain: number;
  acres: number;
  /** The year before the ruler took office, shown on the opening report. */
  lastYield: number;
  lastRatsAte: number;
  lastNewcomers: number;
}

export interface WorldRules {
  id: string;
  ruleSet: RuleSet;
  start: StartState;
  /** Bushels per planted acre, a whole number drawn evenly from this range. */
  yieldRange: readonly [number, number];
  /** Bushels per acre of land, drawn evenly each year. */
  priceRange: readonly [number, number];
  /**
   * Rats roll a die from 1 to 5. On these faces they come, and eat the store
   * divided by the face: on a 2 half of it, on a 4 a quarter.
   */
  ratFaces: readonly number[];
  /** Fever (the original's plague) as "one year in N". */
  feverOneIn: number;
  yearsPerTerm: number;
  terms: number;
}

/** Bushels one person eats in a year. */
export const BUSHELS_PER_PERSON = 20;
/** One person can tend fewer than this many acres (the original's limit is strict). */
export const ACRES_PER_WORKER = 10;
/** More than this share of the people going hungry in one year ends the ruler's term at once. */
export const DEPOSITION_SHARE = 0.45;
/** The newcomers die and the rats die both have five faces. */
export const DIE_FACES = 5;

export const CLASSIC_START: StartState = {
  people: 100,
  grain: 2800,
  acres: 1000,
  lastYield: 3,
  lastRatsAte: 200,
  lastNewcomers: 5,
};

const CLASSIC: Omit<WorldRules, 'id' | 'ruleSet'> = {
  start: CLASSIC_START,
  yieldRange: [1, 5],
  priceRange: [17, 26],
  ratFaces: [2, 4],
  feverOneIn: 5,
  yearsPerTerm: 10,
  terms: 1,
};

export type ScenarioId =
  | 'classic'
  | 'dry-decade'
  | 'crowded-gate'
  | 'year-of-rats'
  | 'land-fever'
  | 'thin-inheritance'
  | 'generous-delta'
  | 'dynasty'
  | 'ledger-1978';

/** The six curated twists, in menu order. */
export const CURATED_SCENARIOS: readonly ScenarioId[] = [
  'dry-decade',
  'crowded-gate',
  'year-of-rats',
  'land-fever',
  'thin-inheritance',
  'generous-delta',
];

const TWEAKS: Readonly<Record<ScenarioId, Partial<Omit<WorldRules, 'id'>>>> = {
  classic: {},
  'dry-decade': { yieldRange: [1, 3] },
  // Tuned with the careful bot (NOTES.md): 300 people left almost no way to the top tier.
  'crowded-gate': { start: { ...CLASSIC_START, people: 150, grain: 3000 } },
  'year-of-rats': { ratFaces: [2, 3, 4] },
  'land-fever': { priceRange: [10, 40] },
  'thin-inheritance': { start: { ...CLASSIC_START, grain: 500 } },
  'generous-delta': { yieldRange: [3, 6], feverOneIn: 3 },
  dynasty: { terms: 3 },
  'ledger-1978': { ruleSet: '1978' },
};

export function isScenarioId(id: string): id is ScenarioId {
  return id in TWEAKS;
}

/** The full rules of a scenario; unknown ids fall back to the classic term. */
export function rulesFor(scenario: string): WorldRules {
  const id: ScenarioId = isScenarioId(scenario) ? scenario : 'classic';
  return { id, ruleSet: 'normal', ...CLASSIC, ...TWEAKS[id] };
}

/** How many faces of the yield range there are: each is equally likely. */
export function yieldFaces(rules: WorldRules): number[] {
  const [low, high] = rules.yieldRange;
  return Array.from({ length: high - low + 1 }, (_, i) => low + i);
}
