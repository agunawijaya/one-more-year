/**
 * How a game of Crown of Florins is judged when it ends: by the ending, and
 * otherwise by the highest title the line ever held. The tiers (1–5) are the
 * ones the Hall's Library sorts by; the lines the verdict screen prints are
 * in content/verdicts.ts.
 */
import type { Verdict } from '@one-more-year/kit';
import { TOP_TITLE } from './rules.ts';
import type { Realm, World } from './state.ts';

export type VerdictId =
  | 'crowned-first'
  | 'crowned-after'
  | 'crowned-line'
  | 'great-house'
  | 'respected-house'
  | 'small-seat'
  | 'line-ended';

export const VERDICTS: Readonly<Record<VerdictId, Verdict>> = {
  'crowned-first': { id: 'crowned-first', label: 'First Crown of the Valley', tier: 5 },
  'crowned-after': { id: 'crowned-after', label: 'A Crown Worth the Wait', tier: 4 },
  'crowned-line': { id: 'crowned-line', label: 'A Line That Wore the Crown', tier: 5 },
  'great-house': { id: 'great-house', label: 'A Great House, Uncrowned', tier: 3 },
  'respected-house': { id: 'respected-house', label: 'A Respected House', tier: 2 },
  'small-seat': { id: 'small-seat', label: 'A Small Seat in a Wide Valley', tier: 1 },
  'line-ended': { id: 'line-ended', label: 'The Last of the Line', tier: 1 },
};

/** The highest title any ruler of this line has held. */
export function highestTitle(realm: Realm): number {
  return Math.max(realm.title, ...realm.pastRulers.map((past) => past.title));
}

export function verdictFor(world: World): Verdict | null {
  const end = world.end;
  if (!end) return null;
  const realm = world.realms[end.seat];
  if (!realm) return VERDICTS['small-seat'];
  if (end.ending === 'crowned') {
    return world.firstCrowned === end.seat ? VERDICTS['crowned-first'] : VERDICTS['crowned-after'];
  }
  if (end.ending === 'extinct' && realm.record.crownedYear === null) return VERDICTS['line-ended'];
  const best = highestTitle(realm);
  if (best >= TOP_TITLE) return VERDICTS['crowned-line'];
  if (best >= 6) return VERDICTS['great-house'];
  if (best >= 4) return VERDICTS['respected-house'];
  return VERDICTS['small-seat'];
}
