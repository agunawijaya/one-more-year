/**
 * Crown of Florins in the catalog: plain data the Hall reads at start-up,
 * so it imports nothing but types.
 */
import type { SimManifest } from '@one-more-year/kit';

export const manifest: SimManifest = {
  id: 'crown-of-florins',
  title: 'Crown of Florins',
  tagline: 'From knight to crown — before your candle burns out.',
  teaser:
    'Rule an Italian city-state in the year 1400 against up to five rivals. Build markets, mills and ' +
    'cathedrals, weigh taxes against justice, and climb from knight to the crown. Every rule is on ' +
    'the table. Your lifetime is not.',
  domain: 'governance',
  turnUnit: 'year',
  typicalTurns: [20, 45],
  players: '1–6P',
  sessionMinutes: [30, 90],
  status: 'playable',
  accent: { light: '#a12e1a', dark: '#e3b65c' },
  // A three-pointed crown above a florin coin stamped with a lily.
  emblem:
    'M5.5 9.5L7 3.8L9.8 6.6L12 2.6L14.2 6.6L17 3.8L18.5 9.5Z' +
    'M5.5 11.4H18.5' +
    'M12 22.4A5.6 5.6 0 1 0 12 11.2A5.6 5.6 0 1 0 12 22.4Z' +
    'M12 20.4V14.2M12 14.2C10.9 15.1 10.6 16.6 11.4 17.6M12 14.2C13.1 15.1 13.4 16.6 12.6 17.6' +
    'M9.8 17.8C10.6 17.4 11.4 17.6 12 18.4C12.6 17.6 13.4 17.4 14.2 17.8',
  inspiredBy: {
    originalTitle: 'Santa Paravia and Fiumaccio',
    uiTitle: 'the 1978 city-state simulation',
    year: 1978,
    credit: 'George Blank (SoftSide, 1978); published by Instant Software',
  },
  hasDailyScenario: true,
  scenarios: [
    {
      id: 'standard',
      title: 'The Valley in 1400',
      twist: 'Four city-states, the 1978 starting numbers, and the century to win a crown.',
      difficulty: 2,
    },
    {
      id: 'narrow-valley',
      title: 'Narrow Valley',
      twist: 'Only 6,500 hectares each, but the soil yields two fifths more.',
      difficulty: 2,
    },
    {
      id: 'borrowed-crown',
      title: 'Borrowed Crown',
      twist: 'You begin a Barone or Baronessa, 6,000 florins in debt.',
      difficulty: 3,
    },
    {
      id: 'general-next-door',
      title: 'The General Next Door',
      twist: 'A General with twice your army arms every year to march on the weakest city.',
      difficulty: 3,
    },
    {
      id: 'year-of-fevers',
      title: 'Year of Fevers',
      twist:
        'Twice as many die in a fed year, newcomers come half as willingly, and it ends in 1460.',
      difficulty: 2,
    },
    {
      id: 'harbour-town',
      title: 'Harbour Town',
      twist: 'No land for sale, ever; customs bring a fifth more and markets a quarter more rent.',
      difficulty: 2,
    },
    {
      id: 'endless',
      title: 'Endless Dynasty',
      twist: 'No end date: the crown is a chapter, and the line rules on until you close the book.',
      difficulty: 2,
    },
  ],
  signals: [
    {
      id: 'points',
      label: 'Title points',
      unit: { singular: 'point', plural: 'points' },
      format: 'integer',
      higherIsBetter: true,
    },
    {
      id: 'treasury',
      label: 'Treasury',
      unit: { singular: 'florin', plural: 'florins' },
      format: 'compact',
      higherIsBetter: true,
    },
    {
      id: 'population',
      label: 'Population',
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
  primarySignal: 'points',
};
