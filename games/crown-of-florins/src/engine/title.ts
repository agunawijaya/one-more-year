/**
 * The title review at the end of a ruler's year.
 *
 * Twelve pillars, each worth a whole number of points up to 10 (the
 * treasury's can fall below zero when the realm is in debt). The title is
 * points ÷ (difficulty + 5), less the justice level, plus 1, rounded down
 * and capped at 8 (Re or Regina). A title never falls in a ruler's
 * lifetime. Two years before a ruler dies, the court grants one step for
 * long service, whatever the points say.
 *
 * All original, except that the 1978 conversion stored the chosen
 * difficulty in the wrong variable, so every game ran at the easiest
 * level; here the four levels apply.
 */
import { DIFFICULTY_OFFSET, PILLAR_CAP, TOP_TITLE } from './rules.ts';
import type { Difficulty, Holdings, People } from './state.ts';

export type PillarId =
  | 'markets'
  | 'palace'
  | 'cathedral'
  | 'mills'
  | 'treasury'
  | 'land'
  | 'merchants'
  | 'nobles'
  | 'soldiers'
  | 'clergy'
  | 'serfs'
  | 'prosperity';

export interface PillarRule {
  id: PillarId;
  /** How much of the quantity earns one point. */
  per: number;
}

/** The twelve pillars in the program's order, with what one point costs. */
export const PILLARS: readonly PillarRule[] = [
  { id: 'markets', per: 1 },
  { id: 'palace', per: 1 },
  { id: 'cathedral', per: 1 },
  { id: 'mills', per: 1 },
  { id: 'treasury', per: 5000 },
  { id: 'land', per: 6000 },
  { id: 'merchants', per: 50 },
  { id: 'nobles', per: 5 },
  { id: 'soldiers', per: 50 },
  { id: 'clergy', per: 10 },
  { id: 'serfs', per: 2000 },
  { id: 'prosperity', per: 5 },
];

export interface TitleInputs {
  people: People;
  holdings: Holdings;
  treasury: number;
  land: number;
  prosperity: number;
}

export function quantityOf(id: PillarId, inputs: TitleInputs): number {
  switch (id) {
    case 'markets':
    case 'palace':
    case 'cathedral':
    case 'mills':
      return inputs.holdings[id];
    case 'treasury':
      return inputs.treasury;
    case 'land':
      return inputs.land;
    case 'prosperity':
      return inputs.prosperity;
    default:
      return inputs.people[id];
  }
}

/** One pillar's points: the quantity ÷ its price, capped at 10 and rounded down. */
export function pillarPoints(rule: PillarRule, quantity: number): number {
  return Math.floor(Math.min(PILLAR_CAP, quantity / rule.per));
}

export function pillarBreakdown(inputs: TitleInputs): { id: PillarId; points: number }[] {
  return PILLARS.map((rule) => ({
    id: rule.id,
    points: pillarPoints(rule, quantityOf(rule.id, inputs)),
  }));
}

export function titlePoints(inputs: TitleInputs): number {
  return pillarBreakdown(inputs).reduce((sum, pillar) => sum + pillar.points, 0);
}

/** The divisor for a difficulty: Apprentice 6, Journeyman 7, Master 8, Grand Master 9. */
export function divisorFor(difficulty: Difficulty): number {
  return difficulty + DIFFICULTY_OFFSET;
}

/** The title the points alone would earn this year. */
export function earnedTitle(points: number, justice: number, difficulty: Difficulty): number {
  return Math.min(TOP_TITLE, Math.floor(points / divisorFor(difficulty) - justice + 1));
}

/** The points needed to reach a title at this justice and difficulty. */
export function pointsForTitle(title: number, justice: number, difficulty: Difficulty): number {
  return Math.max(0, (title + justice - 1) * divisorFor(difficulty));
}

export interface Review {
  title: number;
  deathbed: boolean;
}

/** The year's review: never lower, one step for long service, then the points. */
export function reviewTitle(
  current: number,
  points: number,
  justice: number,
  difficulty: Difficulty,
  deathbed: boolean,
): Review {
  const honoured = deathbed ? Math.min(TOP_TITLE, current + 1) : current;
  const earned = earnedTitle(points, justice, difficulty);
  return { title: Math.max(honoured, earned), deathbed };
}
