/**
 * Pond's manifest. Test-only: the harness registers it; the shipped
 * registry never sees it (hall/tests/pond-stays-out.test.ts checks that).
 */
import type { SimManifest } from '@one-more-year/kit';

export const POND_ID = 'pond';

export const manifest: SimManifest = {
  id: POND_ID,
  title: 'Pond',
  tagline: 'Eight years of fish, weed and weather in one small pond.',
  teaser:
    'Decide each year how many fish to take. The weed shelters the young, until it chokes the water; ' +
    'a heron or a dry summer can undo a careful plan. Leave the pond fuller than you found it.',
  domain: 'ecology',
  turnUnit: 'year',
  typicalTurns: [8, 8],
  players: '1–6P',
  sessionMinutes: [5, 10],
  status: 'playable',
  accent: { light: '#14706e', dark: '#5fd3c6' },
  // A fish above two ripples.
  emblem:
    'M4 10C7 6.5 12.5 6.5 15.5 10C12.5 13.5 7 13.5 4 10Z M15.5 10L19.5 7V13Z' +
    'M8 9.6V10.4 M4 17C6 15.8 8 15.8 10 17C12 18.2 14 18.2 16 17C17.6 16 19 16 20 16.6' +
    'M7 20.5C8.4 19.7 9.8 19.7 11.2 20.5C12.6 21.3 14 21.3 15.4 20.5',
  inspiredBy: {
    originalTitle: 'Pond (test fixture)',
    uiTitle: 'the collection’s own test world',
    year: 2026,
    credit: 'One More Year contributors',
  },
  hasDailyScenario: true,
  scenarios: [
    {
      id: 'still-water',
      title: 'Still Water',
      twist: 'A settled pond in good balance.',
      difficulty: 2,
    },
    {
      id: 'overgrown',
      title: 'Overgrown',
      twist: 'The weed has the upper hand and blooms are close.',
      difficulty: 3,
    },
    {
      id: 'young-pond',
      title: 'Young Pond',
      twist: 'Few fish and plenty of room: patience pays.',
      difficulty: 1,
    },
  ],
  signals: [
    {
      id: 'fish',
      label: 'Fish',
      unit: { singular: 'fish', plural: 'fish' },
      format: 'integer',
      higherIsBetter: true,
    },
    { id: 'weed', label: 'Weed', unit: null, format: 'percent', higherIsBetter: null },
    {
      id: 'caught',
      label: 'Caught',
      unit: { singular: 'fish', plural: 'fish' },
      format: 'integer',
      higherIsBetter: true,
    },
  ],
  primarySignal: 'fish',
};
