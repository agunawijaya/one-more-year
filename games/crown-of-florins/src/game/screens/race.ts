/**
 * The day the race is won by someone else: the heralds tell the whole table
 * at once, and each player who has not been crowned is given the choice the
 * rules allow (prompt 02 §3.7): play on for a crown of their own, which
 * still counts in the chronicle as a crown won later, or end the game here
 * and read the chronicle as it stands.
 *
 * The card is shown in the valley interlude when it is on, and on its own
 * over the city when it is not, so nobody misses it.
 */
import type { RaceWon } from '../year-model.ts';
import { el } from '../../ui/dom.ts';

export type RaceChoice = 'play-on' | 'end-here';

export interface RaceAnnouncement {
  readonly element: HTMLElement;
  /** The first choice, for focus. */
  readonly playOn: HTMLButtonElement;
}

export function raceAnnouncement(
  won: RaceWon,
  onChoose: (choice: RaceChoice) => void,
): RaceAnnouncement {
  const playOn = el(
    'button',
    { type: 'button', class: 'cf-button cf-button--primary', 'data-action': 'continue' },
    'Play on for your own chronicle',
  );
  const endHere = el(
    'button',
    { type: 'button', class: 'cf-button', 'data-action': 'end-here' },
    'End here and see the chronicle',
  );
  playOn.addEventListener('click', () => onChoose('play-on'));
  endHere.addEventListener('click', () => onChoose('end-here'));
  const element = el(
    'section',
    {
      class: 'cf-race-won cf-card',
      role: 'alertdialog',
      'aria-labelledby': 'cf-race-won-title',
      'aria-describedby': 'cf-race-won-text',
    },
    el('p', { class: 'cf-scroll__eyebrow' }, `Anno ${won.year} · by the heralds of the valley`),
    el(
      'h2',
      { id: 'cf-race-won-title', class: 'cf-race-won__title' },
      `${won.city} has crowned ${won.title} ${won.ruler}`,
    ),
    el(
      'div',
      { id: 'cf-race-won-text', class: 'cf-race-won__text' },
      el(
        'p',
        {},
        'The first crown of the valley is worn, and the race to it is over. Every city heard the bells.',
      ),
      el(
        'p',
        {},
        'You may rule on for a crown of your own: it will stand in your chronicle as a crown won later. Or you may close the book here and read the chronicle as it stands.',
      ),
    ),
    el('div', { class: 'cf-scroll__actions cf-race-won__actions' }, playOn, endHere),
  );
  return { element, playOn };
}
