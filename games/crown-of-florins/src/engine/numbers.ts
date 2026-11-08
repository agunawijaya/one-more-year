/**
 * The two ways the 1978 program turned numbers into whole ones, and its die.
 *
 * - Assigning a fraction to an integer variable rounded to the nearest
 *   whole number; `whole` does that, with halves away from zero.
 * - Its INT() function floored; the engine uses Math.floor where the
 *   original did.
 * - Its die, "a whole number from 1 to n", was INT(RND × n) + 1, which also
 *   works for a fractional n (and gives 1 for n of zero); `rollUpTo` is
 *   exactly that on the kit's seeded stream.
 */
import type { Rng } from '@one-more-year/kit';

/** Nearest whole number, halves away from zero ("2.5 → 3", "−2.5 → −3"). */
export function whole(value: number): number {
  return Math.sign(value) * Math.floor(Math.abs(value) + 0.5);
}

/** A whole number from 1 to `max` (fractional `max` allowed, as in the original). */
export function rollUpTo(rng: Rng, max: number): number {
  return Math.floor(rng.next() * Math.max(0, max)) + 1;
}

/** Two decimals, so repeated small additions never drift between browsers. */
export function hundredths(value: number): number {
  return Math.round(value * 100) / 100;
}

export function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}
