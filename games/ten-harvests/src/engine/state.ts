/**
 * The shapes the engine works with. State and plans are plain data that
 * survive JSON, because the kit saves them after every year.
 */
import type { RuleSet } from './rules.ts';

/** The ruler's decree for one year. */
export interface Decree {
  /** Acres to buy (positive) or sell (negative); one direction per year, as in the original. */
  land: number;
  /** Bushels given out as food. */
  food: number;
  /** Acres sown with seed. */
  plant: number;
  /**
   * 1978 Ledger only: the steward was handed a negative number and walked
   * out. The normal rules never allow it.
   */
  walkout?: true;
}

/** What happened in one year, kept so the next plan screen and the scene can show it. */
export interface YearOutcome {
  year: number;
  yieldPerAcre: number;
  harvest: number;
  /** 0 when the rats stayed away. */
  ratsAte: number;
  /** The rats' die face (2 → half, 4 → quarter), or 0. */
  ratFace: number;
  newcomers: number;
  /** People lost to the fever (0 in a year without it). */
  feverLost: number;
  hungry: number;
  /** People at the start of the year, before hunger, newcomers and fever. */
  peopleBefore: number;
  fed: number;
  landPrice: number;
  landChange: number;
  planted: number;
}

/** The running tally of one ruler's term, from which the term is judged. */
export interface TermTally {
  /** 0-based: Dynasty has three terms. */
  index: number;
  /** The run's year on which this term began (1, 11, 21). */
  firstYear: number;
  /** Hungry people as a percentage of the people, one entry per year that counts. */
  hungerPercents: number[];
  /**
   * The 1978 running average, kept exactly as the original keeps it
   * (including its habit of skipping generous years); 0 under normal rules.
   */
  ledgerAverage: number;
  totalHungry: number;
  /** Years the 1978 average skipped because more people were fed than lived in the city. */
  skippedYears: number[];
  startPeople: number;
  startGrain: number;
  startAcres: number;
}

export interface TermVerdict {
  index: number;
  verdictId: string;
  tier: number;
  averageHunger: number;
  acresPerPerson: number;
  totalHungry: number;
}

export type EndingKind = 'term-complete' | 'dynasty-complete' | 'deposed' | 'walked-out';

export interface Ending {
  kind: EndingKind;
  verdictId: string;
  tier: number;
}

export interface CityState {
  ruleSet: RuleSet;
  scenario: string;
  /** The run's year now being planned, 1-based (Dynasty runs to 30). */
  year: number;
  people: number;
  grain: number;
  acres: number;
  /** This year's price of land in bushels per acre. */
  landPrice: number;
  /** The year just lived; for year 1, the scripted year before the ruler took office. */
  last: YearOutcome;
  term: TermTally;
  /** Judged terms, oldest first. */
  judged: TermVerdict[];
  ending: Ending | null;
}
