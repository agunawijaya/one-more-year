/**
 * How long a ruler lives, and what the screen may say about it.
 *
 * original: a ruler's last year is fixed when they take the throne, between
 * 21 and 55 years later, every year in that band equally likely; the
 * founders of 1400 die between 1421 and 1455. The engine knows the year; the
 * player never sees it, only the honest odds that follow from the rule:
 * nothing before the band opens, then one in (years left in the band) each
 * year. Heirs take the same rule from their own accession (designed: the
 * 1978 program had no heirs).
 */
import type { Rng } from '@one-more-year/kit';
import { LIFESPAN } from './rules.ts';
import { rollUpTo } from './numbers.ts';
import type { CauseOfDeath, Ruler } from './state.ts';

export function rollDeathYear(accession: number, rng: Rng): number {
  return accession + LIFESPAN.least + rollUpTo(rng, LIFESPAN.roll);
}

/** The earliest and latest year this ruler can die, as the rule allows. */
export function lifeBand(ruler: Ruler): { first: number; last: number } {
  return {
    first: ruler.accession + LIFESPAN.least + 1,
    last: ruler.accession + LIFESPAN.least + LIFESPAN.roll,
  };
}

/**
 * The chance that a ruler alive at the start of `year` dies in it, from the
 * rule alone (never from the hidden year). 0 before the band, 1 in its last
 * year.
 */
export function deathOdds(ruler: Ruler, year: number): number {
  const { first, last } = lifeBand(ruler);
  if (year < first) return 0;
  if (year > last) return 1;
  return 1 / (last - year + 1);
}

/** The chance of living through the next `years` years, from the rule alone. */
export function survivalOdds(ruler: Ruler, from: number, years: number): number {
  let alive = 1;
  for (let year = from; year < from + years; year++) alive *= 1 - deathOdds(ruler, year);
  return alive;
}

export function ageIn(ruler: Ruler, year: number): number {
  return ruler.ageAtAccession + (year - ruler.accession);
}

/** designed: the gentle causes the obituary names; old age only after fifty years on the throne. */
export function causeOfDeath(ruler: Ruler, year: number, rng: Rng): CauseOfDeath {
  if (year - ruler.accession > LIFESPAN.oldAgeAfter) return 'old-age';
  return rng.pick(['winter-chill', 'fever', 'fall', 'heart', 'sleep'] as const);
}
