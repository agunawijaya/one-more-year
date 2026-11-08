/**
 * The short manual the pause menu's How to play shows. The full manual is
 * docs/HOW-TO-PLAY.md.
 */
import type { HowToPlaySection } from '@one-more-year/kit';

export const HOW_TO_PLAY: readonly HowToPlaySection[] = [
  {
    heading: 'The race',
    text: 'You rule a small city-state in the year 1400, against up to five rivals. Climb the eight titles, from Cavaliere or Dama to Re or Regina, before your candle burns out. The first to be crowned wins the race. If a rival wins it, the heralds tell you at once, and you may play on for a crown of your own or close the chronicle there.',
  },
  {
    heading: 'A year in five steps',
    text: '1 Harvest: watch the year’s weather, rats and harvest. 2 Market: buy or sell grain and land at this year’s prices. 3 Bread: release grain to the people. 4 Taxes and justice: set three taxes and a seal of justice. 5 Builders: raise marketplaces, mills, the palace, the cathedral, or arm a platoon. Then seal the year (Enter) and the heralds review your title. Jump back to any step with the step bar or the keys 1–5.',
  },
  {
    heading: 'Bread',
    text: 'The people need a set number of bushels, shown as the demand line. Release less and some go hungry; release at least 130 % of it and newcomers arrive, bringing merchants, a noble and clergy. The release must lie between a fifth and four fifths of the grain in store.',
  },
  {
    heading: 'Taxes and justice',
    text: 'Customs, sales and wealth taxes share one willingness to pay: raising one lowers what the others bring. Harsher justice brings in fines but drives serfs away, and every level of it is taken from the title the heralds give.',
  },
  {
    heading: 'The title',
    text: 'Twelve pillars each count up to ten points: marketplaces, palace, cathedral, mills, treasury, land, merchants, nobles, soldiers, clergy, serfs and prosperity. The title is the points ÷ (difficulty + 5), less the justice level, plus one, rounded down. Titles never fall. The glass box on the right shows every number.',
  },
  {
    heading: 'The border and the debt',
    text: 'Keep a soldier for every 1,000 hectares, and never let a rival’s army be more than 2.4 times yours: the border watch says in advance if an army will march. Debt grows by half each year; below −10,000 florins per title step the creditors take nearly everything.',
  },
  {
    heading: 'Lifetime and dynasty',
    text: 'Your ruler’s last year is fixed but hidden; the court panel shows the honest odds. In Dynasty, an heir takes the throne one title lower with the city intact. Under Classic fate, death ends that seat’s game.',
  },
  {
    heading: 'Keys',
    text: '1–5 or Tab: steps. Arrows on a control: change it (Shift ×10, Ctrl ×100). B: pick a building, arrows to choose, Enter to place. Enter: seal the year. Space: skip a cinematic. L: the ledger. Q/E and +/−: turn and zoom the fresco. Esc: pause.',
  },
];
