/**
 * The interface's words in one place: labels, the ledger's sentences and the
 * scribe's short notes. All ours; none of the original program's lines.
 */
import { formatNumber } from '@one-more-year/kit';
import { acresOf, bushelsOf } from '../content/counts.ts';

export const n = (value: number): string => formatNumber(value);

export const WORDS = {
  title: 'Ten Harvests',
  decree: 'The Decree',
  ledger: 'The Honest Ledger',
  ledgerNote: 'Every number here is the one the year will use.',
  granary: 'The granary',
  endYear: 'End the year',
  endYearAnyway: 'End the year anyway',
  endYearConfirm: 'Press again to end your rule',
  noUndo: 'Once the year turns, it stays turned.',
  land: 'Land',
  food: 'Food',
  seed: 'Seed',
  keep: 'Keep',
};

export function landNote(price: number): string {
  return `Land trades at ${bushelsOf(price)} an acre this year.`;
}

export function landResult(acres: number, price: number): string {
  if (acres > 0) return `Buy ${acresOf(acres)} for ${bushelsOf(acres * price)}`;
  if (acres < 0) return `Sell ${acresOf(-acres)} for ${bushelsOf(-acres * price)}`;
  return 'Keep the land as it is';
}

export function foodResult(fed: number, people: number, bushels: number): string {
  return fed >= people
    ? `Everyone fed: ${bushelsOf(bushels)}`
    : `${n(fed)} of ${n(people)} fed: ${bushelsOf(bushels)}`;
}

export function seedResult(acres: number, seed: number): string {
  return acres === 0 ? 'No fields sown this year' : `Sow ${acresOf(acres)} with ${bushelsOf(seed)}`;
}

export function segmentTip(
  use: 'land' | 'food' | 'seed' | 'keep',
  bushels: number,
  detail: number,
): string {
  switch (use) {
    case 'land':
      return `${bushelsOf(bushels)} buy ${acresOf(detail)}`;
    case 'food':
      return `${bushelsOf(bushels)} feed ${n(detail)} people`;
    case 'seed':
      return `${bushelsOf(bushels)} sow ${acresOf(detail)}`;
    case 'keep':
      return `${bushelsOf(bushels)} stay in the granary`;
  }
}

export function ratsLine(
  faces: number,
  of: number,
  eaten: readonly { face: number; bushels: number }[],
  left: number,
): string {
  const parts = eaten.map((e) => `${n(e.bushels)} (1⁄${e.face})`).join(' or ');
  return `${faces} years in ${of} they come. Of the ${bushelsOf(Math.max(0, left))} left in store they would eat ${parts}.`;
}

export function feverLine(oneIn: number): string {
  return `One year in ${oneIn}. When it comes, half the city is lost to it.`;
}
