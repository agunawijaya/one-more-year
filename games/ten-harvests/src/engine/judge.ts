/**
 * Judging a term. The measures and thresholds are the original's: the
 * average share of people who went hungry each year, and acres per person
 * when the term ends. The names and words are ours.
 */
import type { RuleSet } from './rules.ts';
import type { TermTally } from './state.ts';

export type VerdictId =
  | 'ten-quiet-years'
  | 'worth-carving'
  | 'fair-season'
  | 'heavy-hand'
  | 'sent-to-the-fields'
  | 'deposed'
  | 'walked-out';

export interface VerdictInfo {
  id: VerdictId;
  label: string;
  /** 1 (worst) to 5 (best), as the kit's Library sorts. */
  tier: number;
}

export const VERDICTS: Readonly<Record<VerdictId, VerdictInfo>> = {
  'ten-quiet-years': { id: 'ten-quiet-years', label: 'Ten Quiet Years', tier: 5 },
  'worth-carving': { id: 'worth-carving', label: 'A Reign Worth Carving', tier: 4 },
  'fair-season': { id: 'fair-season', label: 'A Fair Season of Rule', tier: 3 },
  'heavy-hand': { id: 'heavy-hand', label: 'A Heavy Hand on the Plough', tier: 2 },
  'sent-to-the-fields': { id: 'sent-to-the-fields', label: 'Sent Back to the Fields', tier: 1 },
  deposed: { id: 'deposed', label: 'The Council Has Spoken', tier: 1 },
  'walked-out': { id: 'walked-out', label: 'The Steward Walked Out', tier: 1 },
};

/** The original's four bands, best first: hunger at most this, and at least this many acres each. */
export const TIER_BANDS: readonly { id: VerdictId; maxHunger: number; minAcres: number }[] = [
  { id: 'worth-carving', maxHunger: 3, minAcres: 10 },
  { id: 'fair-season', maxHunger: 10, minAcres: 9 },
  { id: 'heavy-hand', maxHunger: 33, minAcres: 7 },
];

/**
 * The average yearly hunger of a term, in percent. The normal rules count
 * every year; the 1978 rules use the original's running average, which
 * quietly skips any year in which more people were fed than lived in the
 * city (see NOTES.md: the generosity paradox).
 */
export function averageHunger(ruleSet: RuleSet, tally: TermTally): number {
  if (ruleSet === '1978') return tally.ledgerAverage;
  const years = tally.hungerPercents;
  return years.length === 0 ? 0 : years.reduce((sum, value) => sum + value, 0) / years.length;
}

export function judgeTerm(
  ruleSet: RuleSet,
  tally: TermTally,
  acres: number,
  people: number,
): { id: VerdictId; averageHunger: number; acresPerPerson: number } {
  const hunger = averageHunger(ruleSet, tally);
  const acresPerPerson = acres / Math.max(1, people);
  const band = TIER_BANDS.find((b) => hunger <= b.maxHunger && acresPerPerson >= b.minAcres);
  let id: VerdictId = band?.id ?? 'sent-to-the-fields';
  // Our own special ending: nobody went hungry at all and there was land to spare.
  if (ruleSet === 'normal' && id === 'worth-carving' && tally.totalHungry === 0) {
    id = 'ten-quiet-years';
  }
  return { id, averageHunger: hunger, acresPerPerson };
}
