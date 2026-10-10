/**
 * The simulations that are planned but not built yet. Each one is a full
 * manifest with status 'coming-soon', so every theme can draw it properly
 * (a blank plate with a pencilled emblem, a dark tile, an empty dome).
 *
 * When a simulation's own prompt creates games/<id>/manifest.ts, that file
 * takes over and the placeholder here is ignored (the registry prefers a
 * discovered manifest with the same id). Titles live only in manifests, so
 * a rename is a one-file change. Both titles below are provisional, as are
 * the taglines, teasers, accents and signals; each simulation's prompt
 * finalises them.
 */
import type { SimManifest } from '@one-more-year/kit';

export const TEN_HARVESTS: SimManifest = {
  id: 'ten-harvests',
  title: 'Ten Harvests',
  tagline: 'Ten years, one granary, and a whole city counting on you.',
  teaser:
    'Feed your people, sow your fields and trade land against grain, one harvest at a time. ' +
    'Rats, weather and the odd plague never ask permission. Can you hand over a fuller city than the one you were given?',
  domain: 'governance',
  turnUnit: 'year',
  typicalTurns: [10, 10],
  players: '1P',
  sessionMinutes: [10, 20],
  status: 'coming-soon',
  accent: { light: '#9a4a12', dark: '#e9b660' },
  // A sheaf of three stalks tied at the waist.
  emblem:
    'M12 22V9M12 17C10 14 8.2 11.6 6.6 8.2M12 17C14 14 15.8 11.6 17.4 8.2M9.4 17.4H14.6' +
    'M12 9C10.6 7.6 10.6 4.6 12 3C13.4 4.6 13.4 7.6 12 9Z' +
    'M6.6 8.2C5 7.2 4.4 4.4 5.3 2.8C6.9 3.7 7.4 6.4 6.6 8.2Z' +
    'M17.4 8.2C19 7.2 19.6 4.4 18.7 2.8C17.1 3.7 16.6 6.4 17.4 8.2Z',
  inspiredBy: {
    originalTitle: 'Hamurabi',
    uiTitle: 'the 1968 grain-and-land simulation',
    year: 1968,
    credit: 'Doug Dyment; BASIC version by David H. Ahl',
  },
  hasDailyScenario: true,
  scenarios: [],
  signals: [
    {
      id: 'people',
      label: 'People',
      unit: { singular: 'person', plural: 'people' },
      format: 'integer',
      higherIsBetter: true,
    },
    {
      id: 'grain',
      label: 'Grain',
      unit: { singular: 'bushel', plural: 'bushels' },
      format: 'integer',
      higherIsBetter: true,
    },
    {
      id: 'land',
      label: 'Land',
      unit: { singular: 'acre', plural: 'acres' },
      format: 'integer',
      higherIsBetter: true,
    },
  ],
  primarySignal: 'people',
};

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
