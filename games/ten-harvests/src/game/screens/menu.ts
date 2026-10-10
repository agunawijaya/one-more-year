/**
 * The game menu: the city circling slowly at the hour of the current
 * appearance, the title and tagline, and the ways in. The Hall draws
 * "← Back to the Hall" at the top left.
 */
import { formatNumber, type RunRecord, type SimContext } from '@one-more-year/kit';
import { button, el, svg } from '../../ui/dom.ts';

export interface MenuActions {
  classic: () => void;
  daily: () => void;
  scenarios: () => void;
  dynasty: () => void;
  ledger: () => void;
  resume: (runId: string) => void;
  howToPlay: () => void;
  codex: () => void;
  options: () => void;
}

function choice(
  title: string,
  detail: string,
  action: string,
  onSelect: () => void,
  primary = false,
): HTMLButtonElement {
  return button([el('strong', {}, title), el('span', {}, detail)], onSelect, {
    class: primary ? 'th-choice th-choice--primary' : 'th-choice',
    'data-action': action,
  });
}

function scenarioTitle(ctx: SimContext, id: string): string {
  return ctx.manifest.scenarios.find((s) => s.id === id)?.title ?? id;
}

export function renderMenu(
  ctx: SimContext,
  runs: readonly RunRecord[],
  actions: MenuActions,
): HTMLElement {
  const { manifest, daily } = ctx;
  const continueRuns = runs.slice(0, 3);
  const mark = svg(
    'svg',
    { viewBox: '0 0 24 24', 'aria-hidden': 'true', class: 'th-menu__emblem' },
    svg('path', { d: manifest.emblem }),
  );
  return el(
    'div',
    { class: 'th-menu' },
    el(
      'section',
      { class: 'th-menu__card th-clay', 'aria-labelledby': 'th-menu-title' },
      el('p', { class: 'th-menu__eyebrow' }, `After ${manifest.inspiredBy.uiTitle}`),
      el(
        'div',
        { class: 'th-menu__title' },
        mark,
        el('h1', { id: 'th-menu-title' }, manifest.title),
      ),
      el('p', { class: 'th-menu__tagline' }, manifest.tagline),
      el('p', { class: 'th-menu__teaser' }, manifest.teaser),
      continueRuns.length > 0
        ? el(
            'div',
            { class: 'th-menu__group th-menu__group--runs' },
            el('h2', {}, 'Continue'),
            ...continueRuns.map((run) =>
              choice(
                run.turnLabel,
                `${scenarioTitle(ctx, run.setup.scenario)} · ${formatNumber(run.signals.people ?? 0)} people`,
                `continue-${run.id}`,
                () => actions.resume(run.id),
              ),
            ),
          )
        : null,
      el(
        'div',
        { class: 'th-menu__group' },
        el('h2', {}, 'Begin'),
        choice(
          'Classic Term',
          'Ten years with the original numbers.',
          'begin-classic',
          actions.classic,
          true,
        ),
        choice(
          `Today’s world #${daily.number}`,
          daily.played ? 'Played today; replays are welcome.' : 'The same city for everyone today.',
          'begin-daily',
          actions.daily,
        ),
        choice(
          'Scenarios',
          'Six curated starts, each with one twist.',
          'scenarios',
          actions.scenarios,
        ),
        choice(
          'Dynasty',
          'Thirty years as three rulers in a row.',
          'begin-dynasty',
          actions.dynasty,
        ),
        choice(
          '1978 Ledger',
          'The original rules, quirks and all, on a teletype.',
          'begin-ledger',
          actions.ledger,
        ),
      ),
      el(
        'div',
        { class: 'th-menu__links' },
        button('How to play', actions.howToPlay, {
          class: 'th-quiet',
          'data-action': 'how-to-play',
        }),
        button('Codex', actions.codex, { class: 'th-quiet', 'data-action': 'codex' }),
        button('Options', actions.options, { class: 'th-quiet', 'data-action': 'options' }),
      ),
    ),
  );
}
