/**
 * The shape of a game of Crown of Florins: the valley (World), the
 * city-states in it (Realm), the decisions of one year (Plan) and what each
 * year did (YearLog). Plain data only, so every state survives JSON and a
 * saved game is its setup plus its plans.
 */
import type { ArmsSpec } from '../lib/heraldry.ts';
import type { Terms } from './scenarios.ts';

export type Justice = 1 | 2 | 3 | 4;
export type Weather = 1 | 2 | 3 | 4 | 5;
export type Difficulty = 1 | 2 | 3 | 4;
export type Fate = 'dynasty' | 'classic';
/** Which form of each title a ruler uses: Barone or Baronessa, Re or Regina. */
export type TitleForm = 'm' | 'f';

export type Personality = 'merchant' | 'general' | 'builder' | 'miser' | 'saint';

export type Controller =
  | { kind: 'human' }
  /** `aggressive` arms to march on the weakest realm (The General Next Door). */
  | { kind: 'ai'; personality: Personality; aggressive?: boolean };

export interface People {
  serfs: number;
  soldiers: number;
  merchants: number;
  nobles: number;
  clergy: number;
}

export interface Holdings {
  markets: number;
  mills: number;
  /** Palace pieces: hall, wings, loggia, tower and adornments. */
  palace: number;
  /** Cathedral pieces: six stages (foundations to campanile), then adornments. */
  cathedral: number;
}

export interface Taxes {
  /** Percent, 0–100. */
  customs: number;
  /** Percent, 0–50. */
  sales: number;
  /** Percent, 0–25. */
  wealth: number;
  justice: Justice;
}

export type CauseOfDeath = 'old-age' | 'winter-chill' | 'fever' | 'fall' | 'heart' | 'sleep';

export interface Ruler {
  name: string;
  form: TitleForm;
  /** The year this ruler took the throne. */
  accession: number;
  ageAtAccession: number;
  /** Hidden from the screen: the engine knows it, the player sees only the odds. */
  deathYear: number;
  /** 1 for the founder of the line, 2 for the first heir, and so on. */
  generation: number;
}

export interface PastRuler {
  ruler: Ruler;
  died: number;
  cause: CauseOfDeath;
  /** The highest title reached in this ruler's reign. */
  title: number;
}

/** The opening of a realm's year, rolled before its ruler decides anything. */
export interface Opening {
  year: number;
  weather: Weather;
  /** Percent of the reserves the rats ate. */
  ratPercent: number;
  ratsAte: number;
  /** Hectares under the plough. */
  worked: number;
  harvest: number;
  /** Bushels the people need this year. */
  demand: number;
  /** Florins per 1,000 bushels. */
  grainPrice: number;
  /** Florins per hectare, to one decimal. */
  landPrice: number;
  /** Set when the previous ruler died at the start of this year (Dynasty). */
  succession: PastRuler | null;
}

export interface Construction {
  markets: number;
  mills: number;
  palace: number;
  cathedral: number;
  platoons: number;
}

/** The decisions of one realm's year, in the order of the five steps. */
export interface Plan {
  /** Bushels bought (+) or sold (−). */
  grain: number;
  /** Hectares bought (+) or sold (−). */
  land: number;
  /** Bushels released to the people. */
  release: number;
  customs: number;
  sales: number;
  wealth: number;
  justice: Justice;
  build: Construction;
  /** Endless Dynasty: close the chronicle here instead of playing the year. */
  retire?: boolean;
}

export interface Invasion {
  /** The invader's seat, or null for a band of mercenaries. */
  by: number | null;
  hectares: number;
  soldiersLost: number;
  /** Which condition opened the gates. */
  reason: 'too-few-soldiers' | 'strong-rival';
}

/** What a realm's year did, kept for the report, the scene and the chronicle. */
export interface YearLog {
  year: number;
  opening: Opening;
  plan: Plan;
  births: number;
  deaths: number;
  newcomers: number;
  fled: number;
  merchantsArrived: number;
  merchantsLeft: number;
  noblesArrived: number;
  clergyArrived: number;
  marketRent: number;
  millIncome: number;
  soldiersPay: number;
  revenue: { customs: number; sales: number; wealth: number; justice: number };
  interest: number;
  bankrupt: boolean;
  invaded: Invasion | null;
  /** Land this realm took from others while marching on them this year. */
  conquered: number;
  titleBefore: number;
  titleAfter: number;
  deathbed: boolean;
  points: number;
}

/** Counters the chronicle's epithets and the milestones read. */
export interface RealmRecord {
  taxRaised: boolean;
  invadedCount: number;
  repelledCount: number;
  bankruptcies: number;
  famineYears: number;
  weathersSeen: number[];
  crownedYear: number | null;
  /** The most soldiers the realm ever had above the opening 25, for "won without an army". */
  peakSoldiers: number;
}

export type RealmStatus = 'reigning' | 'crowned' | 'ended';

export interface Realm {
  seat: number;
  controller: Controller;
  city: string;
  arms: ArmsSpec;
  ruler: Ruler;
  pastRulers: PastRuler[];
  /** 1 (Cavaliere/Dama) to 8 (Re/Regina). */
  title: number;
  people: People;
  /** Hectares. */
  land: number;
  /** Bushels in the granary. */
  grain: number;
  /** Florins; negative is debt. */
  treasury: number;
  holdings: Holdings;
  taxes: Taxes;
  /** The 1978 program's "economic health": raised by building and newcomers, halved by famine. */
  prosperity: number;
  status: RealmStatus;
  /** Set when it is this realm's turn (or about to be). */
  opening: Opening | null;
  last: YearLog | null;
  /** Title points at the end of each of this realm's years, for the rival bar's sparkline. */
  pointsHistory: number[];
  record: RealmRecord;
}

/** What every ruler can see of every realm: the standings published at the end of each year. */
export interface Standing {
  seat: number;
  title: number;
  points: number;
  land: number;
  soldiers: number;
  serfs: number;
  merchants: number;
  nobles: number;
  clergy: number;
  treasury: number;
  status: RealmStatus;
  /** True for a rival the scenario announces as aggressive (The General Next Door). */
  aggressive: boolean;
}

export type Ending = 'crowned' | 'extinct' | 'year-limit' | 'retired';

export interface WorldEnd {
  ending: Ending;
  /** The seat the run belongs to (the first human), or the crowned seat. */
  seat: number;
  year: number;
}

export interface World {
  /** The engine's state version; bump when the shape changes. */
  version: 1;
  scenario: string;
  /** What this world's scenario changes about the year (see scenarios.ts). */
  terms: Terms;
  difficulty: Difficulty;
  fate: Fate;
  /** The last year played, or null for open-ended games. */
  endYear: number | null;
  year: number;
  realms: Realm[];
  /** Seats in this year's order (rotated each year so no seat is always first). */
  order: number[];
  /** Index into `order` of the realm whose turn it is. */
  cursor: number;
  standings: Standing[];
  /** The first seat to be crowned, if any. */
  firstCrowned: number | null;
  /** Things that happened in AI turns since the last human turn, for the valley and the report. */
  between: BetweenNote[];
  end: WorldEnd | null;
}

/** A line from the turns played between two human turns (AI rivals, deaths, invasions). */
export interface BetweenNote {
  seat: number;
  year: number;
  kind: 'invaded' | 'promoted' | 'crowned' | 'died' | 'bankrupt' | 'built';
  numbers: Readonly<Record<string, number>>;
}
