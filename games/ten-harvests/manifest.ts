/**
 * Ten Harvests in the catalog: plain data the Hall reads at start-up, so it
 * imports nothing but types.
 */
import type { SimManifest } from '@one-more-year/kit';

export const manifest: SimManifest = {
  id: 'ten-harvests',
  title: 'Ten Harvests',
  tagline: 'Ten years. Three numbers. One river.',
  teaser:
    'Rule a city on the Euphrates for ten harvests. Every bushel is a choice: bread today, seed for ' +
    'next year, or land for your grandchildren. The odds are honest. The river is not.',
  domain: 'governance',
  turnUnit: 'year',
  typicalTurns: [10, 30],
  players: '1P',
  sessionMinutes: [10, 20],
  status: 'playable',
  accent: { light: '#24479a', dark: '#e8b85a' },
  // A sheaf of three stalks, tied at the waist, crossing a wavy river line.
  emblem:
    'M12 21.5V7' +
    'M12 15C10.6 12.6 9.2 10.4 7.6 8.2' +
    'M12 15C13.4 12.6 14.8 10.4 16.4 8.2' +
    'M10.2 15.4H13.8' +
    'M12 7C10.9 5.8 10.9 3.8 12 2.4C13.1 3.8 13.1 5.8 12 7Z' +
    'M7.6 8.2C6.3 7.5 5.7 5.7 6.2 4.2C7.6 4.8 8.2 6.6 7.6 8.2Z' +
    'M16.4 8.2C17.7 7.5 18.3 5.7 17.8 4.2C16.4 4.8 15.8 6.6 16.4 8.2Z' +
    'M2.5 18.6C4.2 17.3 5.8 17.3 7.5 18.6S10.8 19.9 12.5 18.6S15.8 17.3 17.5 18.6S20 19.7 21.5 18.8',
  inspiredBy: {
    originalTitle: 'Hamurabi',
    uiTitle: 'the 1968 grain-and-land simulation',
    year: 1968,
    credit: 'Doug Dyment; BASIC version by David H. Ahl',
  },
  hasDailyScenario: true,
  scenarios: [
    {
      id: 'classic',
      title: 'Classic Term',
      twist: 'Ten years on the river with the original numbers.',
      difficulty: 2,
    },
    {
      id: 'dry-decade',
      title: 'Dry Decade',
      twist: 'The river runs low: fields yield one to three bushels an acre, never more.',
      difficulty: 3,
    },
    {
      id: 'crowded-gate',
      title: 'Crowded Gate',
      twist: 'Half again as many people at the gate, and the same thousand acres.',
      difficulty: 3,
    },
    {
      id: 'year-of-rats',
      title: 'Year of Rats',
      twist: 'Rats come three years in five, and they bring friends.',
      difficulty: 2,
    },
    {
      id: 'land-fever',
      title: 'Land Fever',
      twist: 'Land swings between 10 and 40 bushels an acre.',
      difficulty: 2,
    },
    {
      id: 'thin-inheritance',
      title: 'Thin Inheritance',
      twist: 'The last ruler left you 500 bushels and a lot of goodwill.',
      difficulty: 3,
    },
    {
      id: 'generous-delta',
      title: 'Generous Delta',
      twist: 'Rich silt: three to six bushels an acre, but fever one year in three.',
      difficulty: 1,
    },
    {
      id: 'dynasty',
      title: 'Dynasty',
      twist: 'Thirty years as three rulers in a row; each heir inherits the city.',
      difficulty: 2,
    },
    {
      id: 'ledger-1978',
      title: '1978 Ledger',
      twist: 'The original rules, quirks included, typed on a teletype.',
      difficulty: 2,
    },
  ],
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
      label: 'Grain in store',
      unit: { singular: 'bushel', plural: 'bushels' },
      format: 'integer',
      higherIsBetter: true,
    },
    {
      id: 'acres',
      label: 'Acres',
      unit: { singular: 'acre', plural: 'acres' },
      format: 'integer',
      higherIsBetter: true,
    },
  ],
  primarySignal: 'people',
};
