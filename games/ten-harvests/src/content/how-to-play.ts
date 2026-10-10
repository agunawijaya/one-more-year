/**
 * The short manual the Hall's How to play dialog shows. The full one is
 * docs/HOW-TO-PLAY.md.
 */
import type { HowToPlaySection } from '@one-more-year/kit';

export const HOW_TO_PLAY: readonly HowToPlaySection[] = [
  {
    heading: 'Three numbers, ten years',
    text:
      'You rule a city on the river for ten harvests. Watch three numbers: the people, the grain in ' +
      'store and the acres the city owns. Each year you decide how much land to buy or sell, how much ' +
      'grain to give out as food and how many acres to sow.',
  },
  {
    heading: 'One year',
    text:
      'Each person eats 20 bushels a year. Sowing an acre takes half a bushel of seed, and each person ' +
      'can tend fewer than ten acres. When you end the year the fields grow and are reaped (one to five ' +
      'bushels an acre), rats may raid the store, newcomers may arrive and a fever may pass through.',
  },
  {
    heading: 'The granary bar',
    text:
      'The bar under the city is all the grain you have: food, seed, land and what you keep. Drag the ' +
      'handles to move grain between neighbours, or Tab to a handle and use the arrow keys (Shift for ' +
      'ten). The decree tablet on the left does the same with steppers and typed numbers.',
  },
  {
    heading: 'The fields',
    text:
      'Drag the glowing edge of your fields outward to buy land or inward to sell it. Click a field to ' +
      'sow it or leave it fallow; drag across fields to paint. Escape cancels a drag.',
  },
  {
    heading: 'The honest ledger',
    text:
      'The ledger on the right shows exactly what your decree does: who is fed, every possible harvest, ' +
      'the odds of rats and fever, the range of newcomers. Every number is the one the year will use.',
  },
  {
    heading: 'How a term is judged',
    text:
      'After ten years the term is judged on two things: how many went hungry on average, and how many ' +
      'acres each person has at the end. If more than 45 in every 100 go hungry in a single year, the ' +
      'term ends there and then.',
  },
  {
    heading: 'Keys',
    text:
      'Enter ends the year. L, F and P jump to land, food and seed. T opens the scribe’s console, which ' +
      'asks the four questions in order, the old way. Q and E turn the city. Space skips the year’s ' +
      'cinematic. Escape pauses.',
  },
];
