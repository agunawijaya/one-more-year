/**
 * The game menu: the valley at the appearance's hour behind a parchment
 * card. The Hall draws "← Back to the Hall" top-left over it (and answers
 * Escape) whenever the game says it is on its menu.
 *
 * Begin (Solo) · Hot-seat · Daily · Scenarios · Endless Dynasty · Continue
 * · How to play · Codex · Settings.
 */
import { formatNumber, type RunRecord, type SimContext } from '@one-more-year/kit';
import { el } from '../../ui/dom.ts';

export interface MenuActions {
  solo: () => void;
  hotseat: () => void;
  daily: () => void;
  scenarios: () => void;
  endless: () => void;
  resume: (runId: string) => void;
  howToPlay: () => void;
  codex: () => void;
  settings: () => void;
}

export function renderMenu(
  ctx: SimContext,
  runs: readonly RunRecord[],
  actions: MenuActions,
): HTMLElement {
  const item = (label: string, action: () => void, id: string, note?: string): HTMLElement => {
    const node = el(
      'button',
      { type: 'button', class: 'cf-menu__item', 'data-action': id },
      el('span', { class: 'cf-menu__label' }, label),
      note ? el('span', { class: 'cf-menu__note' }, note) : null,
    );
    node.addEventListener('click', action);
    return node;
  };
  const daily = ctx.daily;
  const continueList =
    runs.length > 0
      ? el(
          'div',
          { class: 'cf-menu__continue' },
          el('p', { class: 'cf-menu__section' }, 'Continue'),
          el(
            'ul',
            { class: 'cf-menu__runs' },
            ...runs.slice(0, 4).map((run) =>
              el(
                'li',
                {},
                item(
                  run.turnLabel,
                  () => actions.resume(run.id),
                  `resume-${run.id}`,
                  `${ctx.manifest.scenarios.find((s) => s.id === run.setup.scenario)?.title ?? run.setup.scenario} · ${formatNumber(run.signals.points ?? 0)} points`,
                ),
              ),
            ),
          ),
        )
      : null;

  return el(
    'div',
    { class: 'cf-menu' },
    el(
      'section',
      { class: 'cf-menu__card cf-card', 'aria-labelledby': 'cf-menu-title' },
      el('p', { class: 'cf-menu__eyebrow' }, 'One More Year'),
      el('h1', { id: 'cf-menu-title', class: 'cf-menu__title' }, ctx.manifest.title),
      el('p', { class: 'cf-menu__tagline' }, ctx.manifest.tagline),
      el(
        'nav',
        { class: 'cf-menu__list', 'aria-label': 'Begin' },
        item('Begin', actions.solo, 'begin-solo', 'You against three rivals'),
        item('Hot-seat', actions.hotseat, 'begin-hotseat', 'Two to six rulers at one table'),
        item(
          'Daily',
          actions.daily,
          'begin-daily',
          daily.played
            ? `#${daily.number} · played today`
            : `#${daily.number} · the same valley for everyone today`,
        ),
        item('Scenarios', actions.scenarios, 'scenarios', 'Five valleys of our own'),
        item('Endless Dynasty', actions.endless, 'begin-endless', 'No end date: the line rules on'),
      ),
      continueList,
      el(
        'nav',
        { class: 'cf-menu__small', 'aria-label': 'More' },
        item('How to play', actions.howToPlay, 'how-to-play'),
        item('Codex', actions.codex, 'codex'),
        item('Settings', actions.settings, 'settings'),
      ),
      el('p', { class: 'cf-menu__credit' }, `Inspired by ${ctx.manifest.inspiredBy.uiTitle}.`),
    ),
  );
}
