/**
 * A chronicle: one finished run as a page of history (§6.1). It doubles as
 * a run's results screen, where it carries the navigation standard's
 * results actions: Play again (R) · Replay this world · Game menu · Back to
 * the Hall (H).
 *
 * Every chart has its text alternative: the summary is the chart's
 * accessible name, and "Show the numbers" opens the full table.
 */
import {
  chartTable,
  formatDate,
  formatDelta,
  formatStyled,
  lineChart,
  type ChartTokens,
  type ChronicleEntry,
  type KeyMoment,
  type SimManifest,
  type TurnTone,
} from '@one-more-year/kit';
import { button, emblem, h, svgFrom } from '../app/dom.ts';
import { icon } from './icons.ts';

export interface ChronicleActions {
  playAgain: () => void;
  replay: () => void;
  gameMenu: () => void;
  hall: () => void;
  library: () => void;
  share: () => void;
}

export interface ChronicleView {
  entry: ChronicleEntry;
  manifest: SimManifest;
  /** The chronicle this run replayed, drawn as a ghost on every chart. */
  ghost: ChronicleEntry | null;
  /** True when shown as the results of a run just finished. */
  results: boolean;
  /** False for a simulation that is no longer playable here. */
  playable: boolean;
  chartTokens: ChartTokens;
  chartFont: string;
  /** The simulation's accent in the current appearance: the colour of its lines. */
  lineColor: string;
}

const TONE_NAMES: Readonly<Record<TurnTone, string>> = {
  good: 'a good year',
  quiet: 'a quiet year',
  hard: 'a hard year',
  disaster: 'a disaster',
};

const MOMENT_NAMES: Readonly<Record<KeyMoment['kind'], string>> = {
  'biggest-swing': 'The biggest swing',
  'worst-survived': 'The worst it got',
  'best-turn': 'The finest hour',
  'hardest-turn': 'The hardest year',
};

export function renderChronicle(view: ChronicleView, actions: ChronicleActions): HTMLElement {
  const { entry, manifest } = view;
  document.title = `${entry.epithet.text} · ${manifest.title} · One More Year`;
  const unitName = entry.turnUnit;
  const capitalUnit = unitName.charAt(0).toUpperCase() + unitName.slice(1);

  const header = h(
    'header',
    { class: 'chronicle__header' },
    h(
      'div',
      { class: 'chronicle__plate', style: `color:${view.lineColor}` },
      emblem(manifest.emblem),
    ),
    h(
      'div',
      { class: 'chronicle__heading' },
      h(
        'p',
        { class: 'chronicle__rubric' },
        [
          manifest.title,
          entry.daily ? `Daily #${entry.daily.number}` : null,
          entry.replayOf ? 'a second chance' : null,
        ]
          .filter(Boolean)
          .join(' · '),
      ),
      h('h1', { class: 'chronicle__title' }, entry.title),
      h(
        'p',
        { class: 'chronicle__epithet' },
        h('span', { class: 'chronicle__epithet-label' }, 'Remembered as '),
        `“${entry.epithet.text}”`,
      ),
      h(
        'p',
        { class: 'chronicle__verdict' },
        h(
          'span',
          { class: `verdict verdict--${entry.outcome.verdict.tier}` },
          entry.outcome.verdict.label,
        ),
        h(
          'span',
          { class: 'chronicle__facts' },
          `${entry.scenarioTitle} · ${entry.turns} ${unitName}${entry.turns === 1 ? '' : 's'} · ${formatDate(entry.finishedAt)}`,
        ),
      ),
    ),
  );

  const timeline = h(
    'section',
    { class: 'chronicle__timeline', 'aria-labelledby': 'chronicle-timeline' },
    h('h2', { id: 'chronicle-timeline', class: 'chronicle__section-title' }, 'Year by year'),
    h(
      'ol',
      { class: 'timeline' },
      entry.timeline.map((turn, index) =>
        h(
          'li',
          {
            class: `timeline__turn timeline__turn--${turn.tone}`,
            tabindex: 0,
            'data-turn': turn.turn,
            'aria-label': `${capitalUnit} ${turn.turn}${entry.setup.seats > 1 ? `, seat ${turn.seat + 1}` : ''}: ${TONE_NAMES[turn.tone]}. ${turn.headline}`,
          },
          h('span', { class: 'timeline__mark', 'aria-hidden': 'true' }),
          h(
            'span',
            { class: 'timeline__label tabular', 'aria-hidden': 'true' },
            index % stride(entry.timeline.length) === 0 ? turn.turn : '',
          ),
          h(
            'span',
            { class: 'timeline__tip', role: 'tooltip' },
            h('strong', {}, `${capitalUnit} ${turn.turn}`),
            ' ',
            turn.headline,
          ),
        ),
      ),
    ),
    h(
      'p',
      { class: 'timeline__legend' },
      (['good', 'quiet', 'hard', 'disaster'] as const).map((tone) =>
        h(
          'span',
          { class: `timeline__key timeline__key--${tone}` },
          h('span', { class: 'timeline__mark', 'aria-hidden': 'true' }),
          tone === 'disaster' ? 'Disaster' : tone.charAt(0).toUpperCase() + tone.slice(1),
        ),
      ),
    ),
  );

  const moments = h(
    'section',
    { class: 'chronicle__moments', 'aria-labelledby': 'chronicle-moments' },
    h('h2', { id: 'chronicle-moments', class: 'chronicle__section-title' }, 'Key moments'),
    h(
      'ol',
      { class: 'moments' },
      entry.keyMoments.map((moment) =>
        h(
          'li',
          { class: `moment moment--${moment.kind}` },
          h('p', { class: 'moment__kind' }, MOMENT_NAMES[moment.kind]),
          h('p', { class: 'moment__when' }, `${capitalUnit} ${moment.turn}`),
          h('p', { class: 'moment__text' }, moment.text || 'A turning point.'),
          moment.delta !== null && moment.delta !== 0
            ? h(
                'p',
                { class: 'moment__delta tabular' },
                `${signalLabel(manifest, entry.primarySignal)} ${formatDelta(moment.delta)}`,
              )
            : null,
        ),
      ),
    ),
  );

  const charts = h(
    'section',
    { class: 'chronicle__charts', 'aria-labelledby': 'chronicle-charts' },
    h(
      'h2',
      { id: 'chronicle-charts', class: 'chronicle__section-title' },
      view.ghost ? 'The numbers, against last time' : 'The numbers',
    ),
    view.ghost
      ? h(
          'p',
          { class: 'chronicle__legend' },
          h('span', { class: 'chronicle__legend-line', style: `background:${view.lineColor}` }),
          'This run',
          h('span', { class: 'chronicle__legend-line chronicle__legend-line--ghost' }),
          `Last time, remembered as “${view.ghost.epithet.text}”`,
        )
      : null,
    h(
      'div',
      { class: 'chronicle__chart-grid' },
      manifest.signals.map((signal) => {
        const values = entry.series[signal.id] ?? [];
        const ghostValues = view.ghost?.series[signal.id];
        const format = (value: number): string => formatStyled(value, signal.format);
        const chart = lineChart({
          label: signal.label,
          series: [{ label: signal.label, values, color: view.lineColor }],
          ...(ghostValues ? { ghost: { label: 'Last time', values: ghostValues } } : {}),
          tokens: view.chartTokens,
          format,
          turnName: unitName,
          width: 400,
          height: 190,
          fontFamily: view.chartFont,
        });
        const svg = svgFrom(chart.markup);
        svg.removeAttribute('width');
        svg.removeAttribute('height');
        const final = values.at(-1) ?? 0;
        return h(
          'figure',
          { class: 'chronicle__chart' },
          h(
            'figcaption',
            {},
            h('span', { class: 'chronicle__chart-label' }, signal.label),
            h('span', { class: 'chronicle__chart-value tabular' }, format(final)),
          ),
          svg,
          h(
            'details',
            { class: 'chronicle__numbers' },
            h('summary', {}, 'Show the numbers'),
            tableFrom(
              chartTable(
                `${signal.label} by ${unitName}`,
                [
                  { label: signal.label, values },
                  ...(ghostValues ? [{ label: 'Last time', values: ghostValues }] : []),
                ],
                { format, turnName: unitName },
              ),
            ),
          ),
        );
      }),
    ),
  );

  const facts = h(
    'section',
    { class: 'chronicle__record', 'aria-label': 'Record' },
    h(
      'dl',
      {},
      fact('Scenario', entry.scenarioTitle),
      fact('Seed', String(entry.setup.seed)),
      fact('Begun', formatDate(entry.startedAt)),
      fact('Finished', formatDate(entry.finishedAt)),
      entry.setup.seats > 1 ? fact('Seats', String(entry.setup.seats)) : null,
      entry.replayOf
        ? fact('A second chance at', view.ghost ? view.ghost.epithet.text : 'an earlier run')
        : null,
    ),
  );

  const actionsRow = view.results
    ? h(
        'nav',
        { class: 'chronicle__actions', 'aria-label': 'What next' },
        view.playable
          ? button(
              [icon('play', 18), h('span', {}, 'Play again'), h('kbd', {}, 'R')],
              actions.playAgain,
              { class: 'button button--primary', 'data-action': 'play-again' },
            )
          : null,
        view.playable
          ? button([icon('replay', 18), h('span', {}, 'Replay this world')], actions.replay, {
              class: 'button',
              'data-action': 'replay',
            })
          : null,
        view.playable
          ? button('Game menu', actions.gameMenu, { class: 'button', 'data-action': 'game-menu' })
          : null,
        button([h('span', {}, 'Back to the Hall'), h('kbd', {}, 'H')], actions.hall, {
          class: 'button',
          'data-action': 'hall',
        }),
        button([icon('share', 18), h('span', {}, 'Share')], actions.share, {
          class: 'button button--quiet',
          'data-action': 'share',
        }),
      )
    : h(
        'nav',
        { class: 'chronicle__actions', 'aria-label': 'Chronicle actions' },
        button([icon('back', 18), h('span', {}, 'Back to the Library')], actions.library, {
          class: 'button',
          'data-action': 'library',
        }),
        view.playable
          ? button([icon('replay', 18), h('span', {}, 'Replay this world')], actions.replay, {
              class: 'button button--primary',
              'data-action': 'replay',
            })
          : null,
        button([icon('share', 18), h('span', {}, 'Share')], actions.share, {
          class: 'button',
          'data-action': 'share',
        }),
      );

  return h(
    'article',
    {
      class: `chronicle ${view.results ? 'chronicle--results' : ''}`.trim(),
      style: `--sim-accent-light:${manifest.accent.light};--sim-accent-dark:${manifest.accent.dark}`,
      'data-sim': manifest.id,
    },
    header,
    actionsRow,
    timeline,
    charts,
    moments,
    facts,
  );
}

function fact(label: string, value: string): HTMLElement[] {
  return [h('dt', {}, label), h('dd', { class: 'tabular' }, value)];
}

function signalLabel(manifest: SimManifest, id: string): string {
  return manifest.signals.find((signal) => signal.id === id)?.label ?? id;
}

/** Label every n-th turn so a 45-year reign stays readable. */
function stride(count: number): number {
  if (count <= 12) return 1;
  if (count <= 24) return 2;
  return 5;
}

function tableFrom(markup: string): HTMLElement {
  const holder = document.createElement('div');
  holder.className = 'chronicle__table';
  holder.innerHTML = markup;
  return holder;
}
