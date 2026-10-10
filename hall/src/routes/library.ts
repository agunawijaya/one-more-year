/**
 * The Library (#/chronicles): every chronicle, newest first, filterable by
 * simulation, verdict and scenario and sortable by date or verdict. Each
 * card shows the epithet, the verdict, a timeline strip and a sparkline of
 * the run's leading number.
 */
import { formatDate, sparkline, type ChronicleEntry } from '@one-more-year/kit';
import { button, emblem, h, svgFrom } from '../app/dom.ts';
import { filterChronicles, type LibraryFilter } from '../data/library.ts';
import { pageFrame, type PageContext } from './page.ts';

let filter: LibraryFilter = { sort: 'date' };

export function renderLibrary(ctx: PageContext): HTMLElement {
  const { snapshot } = ctx;
  const all = snapshot.chronicles;
  const manifests = new Map(snapshot.entries.map((entry) => [entry.manifest.id, entry.manifest]));
  const shown = filterChronicles(all, filter);

  const select = (
    label: string,
    name: string,
    options: readonly { value: string; label: string }[],
    current: string,
    apply: (value: string) => void,
  ): HTMLLabelElement => {
    const control = h(
      'select',
      { name },
      options.map((option) =>
        h('option', { value: option.value, selected: option.value === current }, option.label),
      ),
    );
    control.addEventListener('change', () => {
      apply(control.value);
      ctx.rerender();
    });
    return h('label', { class: 'filter' }, h('span', {}, label), control);
  };

  const simsWithChronicles = [...new Set(all.map((entry) => entry.simId))];
  const scenarios = [
    ...new Map(all.map((entry) => [entry.setup.scenario, entry.scenarioTitle])).entries(),
  ];

  const controls = h(
    'div',
    { class: 'library__filters', role: 'group', 'aria-label': 'Filter and sort' },
    select(
      'World',
      'sim',
      [
        { value: '', label: 'Every world' },
        ...simsWithChronicles.map((id) => ({ value: id, label: manifests.get(id)?.title ?? id })),
      ],
      filter.simId ?? '',
      (value) => (filter = { ...filter, simId: value || null }),
    ),
    select(
      'Verdict',
      'verdict',
      [
        { value: '', label: 'Any verdict' },
        { value: '3', label: 'Middling or better' },
        { value: '4', label: 'Good or better' },
        { value: '5', label: 'Only the best' },
      ],
      filter.verdictTier ? String(filter.verdictTier) : '',
      (value) => (filter = { ...filter, verdictTier: value ? Number(value) : null }),
    ),
    select(
      'Scenario',
      'scenario',
      [
        { value: '', label: 'Any scenario' },
        ...scenarios.map(([value, label]) => ({ value, label })),
      ],
      filter.scenario ?? '',
      (value) => (filter = { ...filter, scenario: value || null }),
    ),
    select(
      'Sort by',
      'sort',
      [
        { value: 'date', label: 'Most recent' },
        { value: 'verdict', label: 'Best verdict' },
      ],
      filter.sort ?? 'date',
      (value) => (filter = { ...filter, sort: value === 'verdict' ? 'verdict' : 'date' }),
    ),
  );

  const list =
    shown.length > 0
      ? h(
          'ol',
          { class: 'library__list' },
          shown.map((entry) => h('li', {}, card(entry, ctx))),
        )
      : h(
          'div',
          { class: 'empty' },
          h(
            'p',
            { class: 'empty__title' },
            all.length === 0
              ? 'The shelves are empty, for now.'
              : 'No chronicle matches these filters.',
          ),
          h(
            'p',
            {},
            all.length === 0
              ? 'Every run you finish is written up here as a chronicle: its years, its key moments, and the name history gives you.'
              : 'Loosen a filter to see more of your history.',
          ),
        );

  return pageFrame(
    'The Library',
    'Your chronicles',
    all.length === 1
      ? 'One finished run, kept as history.'
      : `${all.length} finished runs, kept as history.`,
    controls,
    list,
  );
}

function card(entry: ChronicleEntry, ctx: PageContext): HTMLElement {
  const manifest = ctx.snapshot.entries.find((item) => item.manifest.id === entry.simId)?.manifest;
  const accent = manifest ? manifest.accent[ctx.appearance] : ctx.chartTokens.accent;
  const values = entry.series[entry.primarySignal] ?? [];
  const spark = svgFrom(
    sparkline(values, {
      label: entry.primarySignal,
      tokens: { ...ctx.chartTokens, ink: accent },
      width: 120,
      height: 34,
    }).markup,
  );
  spark.setAttribute('aria-hidden', 'true');
  return button(
    [
      manifest
        ? h('span', { class: 'library__emblem', style: `color:${accent}` }, emblem(manifest.emblem))
        : null,
      h(
        'span',
        { class: 'library__text' },
        h(
          'span',
          { class: 'library__sim' },
          `${manifest?.title ?? entry.simId}${entry.daily ? ` · Daily #${entry.daily.number}` : ''}`,
        ),
        h('span', { class: 'library__epithet' }, `“${entry.epithet.text}”`),
        h(
          'span',
          { class: 'library__meta' },
          [
            entry.outcome.verdict.label,
            entry.scenarioTitle,
            entry.replayOf ? 'a second chance' : null,
            formatDate(entry.finishedAt),
          ]
            .filter(Boolean)
            .join(' · '),
        ),
      ),
      h(
        'span',
        { class: 'library__strip', 'aria-hidden': 'true' },
        entry.timeline.map((turn) => h('span', { class: `strip-mark strip-mark--${turn.tone}` })),
      ),
      spark,
    ],
    () => ctx.actions.openChronicle(entry.id),
    { class: 'library__card', 'data-chronicle': entry.id },
  );
}
