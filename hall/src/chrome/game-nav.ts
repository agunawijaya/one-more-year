/**
 * The navigation standard's controls over a running simulation (ADR-0005):
 * "← Back to the Hall" top-left on the game menu, and a visible pause button
 * with its "Esc" hint during play. The simulation draws everything else.
 */
import type { SimView } from '@one-more-year/kit';
import { button, h } from '../app/dom.ts';
import { icon } from './icons.ts';

export interface GameNav {
  readonly element: HTMLElement;
  show(view: SimView | null): void;
}

export function createGameNav(actions: { hall: () => void; pause: () => void }): GameNav {
  const back = button([icon('back', 18), h('span', {}, 'Back to the Hall')], actions.hall, {
    class: 'game-nav__back',
    'data-action': 'back-to-hall',
  });
  const pause = button(
    [icon('pause', 18), h('span', {}, 'Pause'), h('kbd', {}, 'Esc')],
    actions.pause,
    {
      class: 'game-nav__pause',
      'data-action': 'pause',
    },
  );
  const element = h('div', { class: 'game-nav' }, back, pause);
  return {
    element,
    show(view) {
      back.hidden = view !== 'menu';
      pause.hidden = view !== 'plan' && view !== 'report';
    },
  };
}

/** The pause menu's fixed order: Resume · the simulation's items · How to play · Settings · Game menu · Back to the Hall. */
export const PAUSE_ORDER = [
  'resume',
  'sim-items',
  'how-to-play',
  'settings',
  'game-menu',
  'hall',
] as const;
