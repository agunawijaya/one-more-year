/** Counted nouns, so that one acre is never "1 acres". */
import { formatNumber } from '@one-more-year/kit';

export const plural = (count: number, one: string, many: string): string =>
  count === 1 ? one : many;

export const acresOf = (count: number): string =>
  `${formatNumber(count)} ${plural(count, 'acre', 'acres')}`;

export const bushelsOf = (count: number): string =>
  `${formatNumber(count)} ${plural(count, 'bushel', 'bushels')}`;
