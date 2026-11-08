/**
 * The words on the year screen: steps, pillars, buildings, weather. All
 * written for this game.
 */
import { formatNumber } from '@one-more-year/kit';
import type { PillarId } from '../engine/title.ts';
import { CATHEDRAL_STAGES, PALACE_PIECES } from '../scene/layout.ts';

export const STEPS = [
  { id: 'harvest', number: 1, label: 'Harvest' },
  { id: 'market', number: 2, label: 'Market' },
  { id: 'bread', number: 3, label: 'Bread' },
  { id: 'taxes', number: 4, label: 'Taxes & justice' },
  { id: 'builders', number: 5, label: 'Builders' },
  { id: 'review', number: 6, label: 'Title review' },
] as const;

export type StepId = (typeof STEPS)[number]['id'];

export const PILLAR_WORDS: Readonly<Record<PillarId, { label: string; raise: string }>> = {
  markets: { label: 'Marketplaces', raise: 'One point for each marketplace, up to ten.' },
  palace: { label: 'Palace', raise: 'One point for each piece of the palace raised.' },
  cathedral: { label: 'Cathedral', raise: 'One point for each piece of the cathedral raised.' },
  mills: { label: 'Woollen mills', raise: 'One point for each woollen mill.' },
  treasury: {
    label: 'Treasury',
    raise: 'One point for every 5,000 florins kept; debt counts against you.',
  },
  land: { label: 'Land', raise: 'One point for every 6,000 hectares.' },
  merchants: { label: 'Merchants', raise: 'One point for every 50 merchants.' },
  nobles: { label: 'Nobles', raise: 'One point for every 5 nobles.' },
  soldiers: { label: 'Soldiers', raise: 'One point for every 50 soldiers.' },
  clergy: { label: 'Clergy', raise: 'One point for every 10 clergy.' },
  serfs: { label: 'Serfs', raise: 'One point for every 2,000 serfs.' },
  prosperity: {
    label: 'Prosperity',
    raise: 'One point for every 5 of prosperity; building and newcomers raise it.',
  },
};

export const WEATHER_NAMES = [
  'Drought',
  'A poor year',
  'A fair year',
  'A good year',
  'An excellent year',
] as const;

export function cathedralPiece(next: number): string {
  if (next <= CATHEDRAL_STAGES.length) return `the ${CATHEDRAL_STAGES[next - 1] ?? 'work'}`;
  return 'an adornment';
}

export function palacePiece(next: number): string {
  if (next <= PALACE_PIECES.length) return `the ${PALACE_PIECES[next - 1] ?? 'work'}`;
  return 'an adornment';
}

export function florins(value: number): string {
  return `${formatNumber(value)} fl`;
}

/** "1 in 34", or "none" before the band opens, for the odds of a ruler's death this year. */
export function oddsInWords(chance: number): string {
  if (chance <= 0) return 'none yet';
  if (chance >= 1) return 'certain';
  return `1 in ${Math.round(1 / chance)}`;
}
