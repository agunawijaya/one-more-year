/**
 * What the heralds say at the end of a game, verdict by verdict. Warm, a
 * little wry, and never unkind to a ruler who tried.
 */
import type { VerdictId } from '../engine/verdict.ts';

export const VERDICT_LINES: Readonly<Record<VerdictId, readonly string[]>> = {
  'crowned-first': [
    'No other city in the valley had a crown when yours was lowered onto the ruler’s head.',
    'The rivals sent gifts. Some of them even meant it.',
  ],
  'crowned-after': [
    'Another city wore a crown first, and yours shone no less for the wait.',
    'The heralds note that patience, too, is a pillar of the realm.',
  ],
  'crowned-line': [
    'The line wore the crown and kept on ruling, year after year, until the chronicle was closed.',
    'Somewhere in the archive a scribe is still adding pages.',
  ],
  'great-house': [
    'The city stood among the great houses of the valley, one or two steps short of the crown.',
    'The masons were already measuring the palace for it.',
  ],
  'respected-house': [
    'A respected house: its markets busy, its walls sound, its name known in every other town.',
    'The crown stayed on someone else’s shelf, this time.',
  ],
  'small-seat': [
    'A small seat in a wide valley, held honestly for as long as it lasted.',
    'Every great house began with one marketplace.',
  ],
  'line-ended': [
    'The candle went out and no heir came forward to light another.',
    'The town remembers the ruler kindly, and the creditors remember them precisely.',
  ],
};
