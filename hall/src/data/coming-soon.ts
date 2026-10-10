/**
 * The simulations that are planned but not built yet. Each one is a full
 * manifest with status 'coming-soon', so every theme can draw it properly
 * (a blank plate with a pencilled emblem, a dark tile, an empty dome).
 *
 * When a simulation's own prompt creates games/<id>/manifest.ts, that file
 * takes over and the placeholder here is ignored (the registry prefers a
 * discovered manifest with the same id). Titles live only in manifests, so
 * a rename is a one-file change. A built simulation's entry points at its
 * own manifest, which keeps the catalog order; the other titles are still
 * provisional, as are their taglines, teasers, accents and signals, until
 * each simulation's prompt finalises them.
 */
import type { SimManifest } from '@one-more-year/kit';
import { manifest as tenHarvests } from '../../../games/ten-harvests/manifest.ts';

/** Built: the placeholder is replaced by the simulation's own manifest. */
export const TEN_HARVESTS: SimManifest = tenHarvests;

export const CROWN_OF_FLORINS: SimManifest = {
  id: 'crown-of-florins',
  title: 'Crown of Florins',
  tagline: 'Grow a small city-state into a crown before your years run out.',
  teaser:
    'Set taxes, build markets and mills, raise a cathedral and keep the granary honest. ' +
    'Up to six rulers share one table, each racing time and one another toward the highest title.',
  domain: 'governance',
  turnUnit: 'year',
  typicalTurns: [20, 45],
  players: '1–6P',
  sessionMinutes: [30, 90],
  status: 'coming-soon',
  accent: { light: '#6b3a8c', dark: '#c9a6ec' },
  // A three-pointed crown above a florin.
  emblem:
    'M5 11.5L6.6 4.8L9.6 8.6L12 3.6L14.4 8.6L17.4 4.8L19 11.5Z' +
    'M5 13.6H19' +
    'M8.6 19A3.4 3.4 0 1 0 15.4 19A3.4 3.4 0 1 0 8.6 19Z' +
    'M12 17.4V20.6',
  inspiredBy: {
    originalTitle: 'Santa Paravia and Fiumaccio',
    uiTitle: 'the 1978 city-state simulation',
    year: 1978,
    credit: 'George Blank',
  },
  hasDailyScenario: true,
  scenarios: [],
  signals: [
    {
      id: 'treasury',
      label: 'Treasury',
      unit: { singular: 'florin', plural: 'florins' },
      format: 'compact',
      higherIsBetter: true,
    },
    {
      id: 'people',
      label: 'People',
      unit: { singular: 'person', plural: 'people' },
      format: 'integer',
      higherIsBetter: true,
    },
    {
      id: 'land',
      label: 'Land',
      unit: { singular: 'hectare', plural: 'hectares' },
      format: 'integer',
      higherIsBetter: true,
    },
  ],
  primarySignal: 'treasury',
};

/** In catalog order. */
export const COMING_SOON: readonly SimManifest[] = [TEN_HARVESTS, CROWN_OF_FLORINS];
