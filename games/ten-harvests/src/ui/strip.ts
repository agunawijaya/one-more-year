/**
 * The ten-year strip along the foot of the plan screen: one tile per year,
 * the years lived marked with their glyph, the current year outlined, the
 * years to come left empty.
 */
import { el } from './dom.ts';

export interface YearTile {
  year: number;
  state: 'past' | 'now' | 'future';
  glyph: string;
  caption: string;
}

export interface YearStrip {
  element: HTMLElement;
  update(tiles: readonly YearTile[]): void;
}

export function createYearStrip(): YearStrip {
  const element = el('ol', { class: 'th-strip', 'aria-label': 'The years of this term' });
  return {
    element,
    update(tiles) {
      element.style.setProperty('--years', String(tiles.length));
      element.replaceChildren(
        ...tiles.map((tile) =>
          el(
            'li',
            {
              class: 'th-strip__year',
              'data-state': tile.state,
              'aria-current': tile.state === 'now' ? 'step' : undefined,
            },
            el('span', { class: 'th-strip__glyph', 'aria-hidden': 'true' }, tile.glyph),
            el(
              'span',
              {},
              el('b', {}, `Year ${tile.year}`),
              tile.caption ? el('br') : null,
              tile.caption,
            ),
          ),
        ),
      );
    },
  };
}
