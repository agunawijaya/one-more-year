/**
 * Situation Room: the world as data.
 *
 * A calm operations wall for people who love numbers. Every world is a live
 * feed tile: its demo runs in a compact instrument panel and its signals
 * stream beside it as crisp sparklines, each with its current value in
 * large tabular figures and its last change as a delta. A year ticker along
 * the top shows the demo worlds advancing in step. Today's briefing lists
 * the daily scenarios; runs in progress and recent chronicles sit in their
 * own panels; the streak and Legacy rank live in the status bar. Choosing a
 * tile opens its briefing panel.
 *
 * Light is a briefing room (white and pale grey, graphite, signal blue,
 * amber warnings); dark is the night shift (charcoal glass, cool cyan,
 * amber warnings and one magenta for disasters, soft depth, no glow).
 */
import {
  formatDate,
  formatDelta,
  formatStyled,
  sparkline,
  type Appearance,
  type DemoPalette,
  type SignalDef,
} from '@one-more-year/kit';
import { button, emblem, h, svgFrom } from '../../app/dom.ts';
import type { DemoSlot } from '../../app/demos.ts';
import { lengthText, renderDetail, type DetailView } from '../../chrome/detail.ts';
import { openDialog, type OpenDialog } from '../../chrome/dialogs.ts';
import { icon } from '../../chrome/icons.ts';
import {
  DOMAIN_NAMES,
  LENGTH_NAMES,
  filterOptions,
  matchesFilter,
  NO_FILTER,
  type CatalogFilter,
} from '../../data/filters.ts';
import type { HallEntry, HallSnapshot } from '../../data/hall-model.ts';
import { chartTokensFor } from '../colors.ts';
import { createLiveSeries, lastChange, type LiveSeries } from '../live-signals.ts';
import type { Theme, ThemeContext, ThemeView } from '../theme.ts';
import { PALETTES } from '../tokens.ts';
import './situation-room.css';

function demoPalette(appearance: Appearance): DemoPalette {
  const p = PALETTES['situation-room'][appearance];
  return {
    paper: p.surface,
    ink: p.ink,
    muted: p.inkSoft,
    accent: p.extra.signal ?? p.accent,
    line: p.extra.signal ?? p.accent,
    glow: p.extra['signal-soft'] ?? p.surface2,
    good: p.toneGood,
    warning: p.toneHard,
    disaster: p.toneDisaster,
  };
}

interface TileHandles {
  demo: DemoSlot | null;
  stop: (() => void) | null;
}

function mount(container: HTMLElement, first: HallSnapshot, ctx: ThemeContext): ThemeView {
  let snapshot = first;
  let filter: CatalogFilter = NO_FILTER;
  let highlighted = ctx.initialFocus;
  const tiles = new Map<string, TileHandles>();
  const live = new Map<string, LiveSeries>();
  let briefing: { dialog: OpenDialog; detail: DetailView } | null = null;

  const ticker = h('div', { class: 'room-ticker', 'aria-label': 'Year ticker' });
  const briefingStrip = h('section', {
    class: 'room-briefing-strip',
    'aria-labelledby': 'room-today',
  });
  const filters = h('div', { class: 'room-filters', role: 'group', 'aria-label': 'Filter worlds' });
  const grid = h('div', { class: 'room-grid' });
  const side = h('div', { class: 'room-side' });
  const status = h('footer', { class: 'room-status' });
  const count = h('p', { class: 'room-head__count tabular' });

  const root = h(
    'div',
    { class: 'room' },
    ticker,
    h(
      'div',
      { class: 'room-body' },
      h(
        'header',
        { class: 'room-head' },
        h(
          'div',
          {},
          h('p', { class: 'room-eyebrow' }, 'Operations wall'),
          h('h1', { class: 'room-head__title' }, 'Every world, live'),
          count,
        ),
        briefingStrip,
      ),
      h(
        'div',
        { class: 'room-layout' },
        h(
          'section',
          { class: 'room-feeds', 'aria-labelledby': 'room-feeds-title' },
          h(
            'div',
            { class: 'room-feeds__head' },
            h('h2', { id: 'room-feeds-title', class: 'room-section-title' }, 'Live feeds'),
            filters,
          ),
          grid,
        ),
        side,
      ),
    ),
    status,
  );
  container.append(root);

  function applyCosmetic(): void {
    const cosmetic = snapshot.legacy.active('situation-room');
    for (const [name, value] of Object.entries(cosmetic.tokens[ctx.appearance()]))
      root.style.setProperty(name, value);
  }

  // ---- ticker ---------------------------------------------------------------

  function drawTicker(): void {
    ticker.replaceChildren(
      h(
        'span',
        { class: 'room-ticker__label' },
        h('span', { class: 'room-dot', 'aria-hidden': 'true' }),
        'Live',
      ),
      h(
        'ol',
        { class: 'room-ticker__list' },
        snapshot.entries.map((entry) => {
          const series = live.get(entry.manifest.id);
          const primary = primarySignal(entry);
          const values = series?.values[primary.id];
          const latest = values?.at(-1);
          const change = lastChange(values);
          return h(
            'li',
            {
              class:
                `room-ticker__item ${entry.playable ? '' : 'room-ticker__item--offline'}`.trim(),
              'data-sim': entry.manifest.id,
            },
            h('span', { class: 'room-ticker__name' }, entry.manifest.title),
            entry.playable
              ? [
                  h(
                    'span',
                    { class: 'room-ticker__turn tabular' },
                    series
                      ? `${entry.manifest.turnUnit.charAt(0).toUpperCase()}${series.turn}`
                      : '…',
                  ),
                  h(
                    'span',
                    { class: 'room-ticker__value tabular' },
                    latest === undefined
                      ? ''
                      : `${primary.label} ${formatStyled(latest, primary.format)}`,
                  ),
                  change !== null
                    ? h(
                        'span',
                        { class: `room-delta ${deltaClass(change, primary)}` },
                        deltaText(change, primary),
                      )
                    : null,
                ]
              : h('span', { class: 'room-ticker__turn' }, 'offline'),
          );
        }),
      ),
      h('span', { class: 'room-ticker__date tabular' }, formatDate(snapshot.today)),
    );
  }

  // ---- today's briefing --------------------------------------------------------

  function drawBriefingStrip(): void {
    briefingStrip.replaceChildren(
      h(
        'h2',
        { id: 'room-today', class: 'room-section-title' },
        'Today’s briefing',
        h('span', { class: 'room-chip tabular' }, `#${snapshot.dailyNumber}`),
      ),
      snapshot.daily.length === 0
        ? h('p', { class: 'room-muted' }, 'Daily scenarios start with the first playable world.')
        : h(
            'ul',
            { class: 'room-briefing-strip__list' },
            snapshot.daily.map((daily) =>
              h(
                'li',
                {},
                button(
                  [
                    h('span', { class: 'room-briefing-strip__sim' }, daily.title),
                    h(
                      'span',
                      { class: 'room-briefing-strip__seed tabular' },
                      `seed ${daily.seed.toString(16).padStart(8, '0')}`,
                    ),
                    h(
                      'span',
                      {
                        class:
                          `room-pill ${daily.result ? 'room-pill--done' : daily.played ? 'room-pill--open' : ''}`.trim(),
                      },
                      daily.result ? 'Filed' : daily.played ? 'In progress' : 'Not started',
                    ),
                  ],
                  () =>
                    daily.result
                      ? ctx.actions.openChronicle(daily.result.chronicleId)
                      : ctx.actions.playDaily(daily.simId),
                  { class: 'room-briefing-strip__item', 'data-daily': daily.simId },
                ),
              ),
            ),
          ),
    );
  }

  // ---- filters -------------------------------------------------------------------

  function drawFilters(): void {
    const options = filterOptions(snapshot.entries.map((entry) => entry.manifest));
    const chip = (label: string, pressed: boolean, apply: () => void): HTMLButtonElement =>
      button(
        label,
        () => {
          apply();
          drawFilters();
          drawGrid();
        },
        { class: 'room-filter', 'aria-pressed': String(pressed) },
      );
    filters.replaceChildren(
      chip('All', filter.domain === null && filter.length === null, () => (filter = NO_FILTER)),
      ...(options.domains.length > 1
        ? options.domains.map((domain) =>
            chip(
              DOMAIN_NAMES[domain],
              filter.domain === domain,
              () => (filter = { ...filter, domain: filter.domain === domain ? null : domain }),
            ),
          )
        : []),
      ...(options.lengths.length > 1
        ? options.lengths.map((length) =>
            chip(
              LENGTH_NAMES[length],
              filter.length === length,
              () => (filter = { ...filter, length: filter.length === length ? null : length }),
            ),
          )
        : []),
    );
  }

  // ---- tiles ------------------------------------------------------------------------

  function disposeTiles(): void {
    for (const handles of tiles.values()) {
      handles.stop?.();
      handles.demo?.dispose();
    }
    tiles.clear();
  }

  function drawGrid(): void {
    disposeTiles();
    const shown = snapshot.entries.filter((entry) => matchesFilter(entry.manifest, filter));
    const liveCount = snapshot.entries.filter((entry) => entry.playable).length;
    count.textContent = `${snapshot.entries.length} ${snapshot.entries.length === 1 ? 'world' : 'worlds'} · ${liveCount} live · ${snapshot.entries.length - liveCount} in preparation`;
    grid.dataset.count = String(shown.length);
    grid.replaceChildren(...shown.map((entry, index) => tile(entry, index)));
  }

  function tile(entry: HallEntry, index: number): HTMLElement {
    const { manifest } = entry;
    const accent = manifest.accent[ctx.appearance()];
    const panel = h('div', {
      class: 'room-tile__panel',
      role: 'img',
      'aria-label': `${manifest.title}, playing by itself`,
    });
    const signals = h('dl', { class: 'room-tile__signals' });
    const turn = h('span', { class: 'room-pill room-pill--live tabular' });
    const handles: TileHandles = { demo: null, stop: null };

    if (entry.playable) {
      handles.demo = ctx.demos.mount(panel, manifest.id, 2027 + index);
      const series = createLiveSeries(manifest.signals, 20);
      handles.stop = handles.demo.subscribe((frame) => {
        const latest = series.push(frame);
        live.set(manifest.id, latest);
        turn.replaceChildren(
          h('span', { class: 'room-dot', 'aria-hidden': 'true' }),
          `Live · ${manifest.turnUnit} ${latest.turn}`,
        );
        drawSignals(signals, entry, latest);
        drawTicker();
      });
      turn.replaceChildren(h('span', { class: 'room-dot', 'aria-hidden': 'true' }), 'Live');
      drawSignals(signals, entry, null);
    } else {
      panel.append(
        h(
          'span',
          { class: 'room-tile__offline' },
          emblem(manifest.emblem),
          h('span', {}, 'Feed offline'),
        ),
      );
      turn.textContent = 'In preparation';
      turn.classList.replace('room-pill--live', 'room-pill--offline');
      drawSignals(signals, entry, null);
    }
    tiles.set(manifest.id, handles);

    const run = entry.runs[0];
    const actions = entry.playable
      ? h(
          'div',
          { class: 'room-tile__actions' },
          button([icon('play', 16), h('span', {}, 'Begin')], () => ctx.actions.begin(manifest.id), {
            class: 'button button--primary',
            'data-action': 'begin',
          }),
          run
            ? button(
                [
                  h('span', {}, 'Continue'),
                  h('span', { class: 'button__detail tabular' }, run.turnLabel),
                ],
                () => ctx.actions.continueRun(manifest.id, run.id),
                { class: 'button', 'data-action': 'continue' },
              )
            : null,
          button('Briefing', () => openBriefing(manifest.id), {
            class: 'button button--quiet',
            'data-action': 'brief',
          }),
        )
      : button('Briefing', () => openBriefing(manifest.id), {
          class: 'button button--quiet',
          'data-action': 'brief',
        });

    const element = h(
      'article',
      {
        class:
          `room-tile ${entry.playable ? '' : 'room-tile--offline'} ${manifest.id === highlighted ? 'room-tile--highlight' : ''}`
            .replace(/\s+/g, ' ')
            .trim(),
        'data-sim': manifest.id,
        style: `--sim-accent:${accent}`,
        'aria-labelledby': `room-tile-${manifest.id}`,
      },
      h(
        'header',
        { class: 'room-tile__head' },
        h('span', { class: 'room-tile__emblem' }, emblem(manifest.emblem)),
        h(
          'div',
          { class: 'room-tile__names' },
          h('h2', { class: 'room-tile__title', id: `room-tile-${manifest.id}` }, manifest.title),
          h(
            'p',
            { class: 'room-tile__meta' },
            entry.playable
              ? `${DOMAIN_NAMES[manifest.domain]} · ${lengthText(entry)}`
              : `${DOMAIN_NAMES[manifest.domain]} · ${manifest.typicalTurns[0] === manifest.typicalTurns[1] ? manifest.typicalTurns[0] : manifest.typicalTurns.join('–')} ${manifest.turnUnit}s`,
          ),
        ),
        turn,
        // A planned world has nothing to begin: its briefing sits in the header.
        entry.playable ? null : actions,
      ),
      h('div', { class: 'room-tile__body' }, panel, signals),
      // A planned world has no footer: its provenance is in the header line.
      entry.playable
        ? h(
            'footer',
            { class: 'room-tile__foot' },
            entry.best
              ? h(
                  'p',
                  { class: 'room-tile__best' },
                  h('span', { class: 'room-muted' }, 'Best · '),
                  `“${entry.best.epithet.text}”`,
                )
              : h('p', { class: 'room-tile__best room-muted' }, manifest.tagline),
            actions,
          )
        : null,
    );
    return element;
  }

  function drawSignals(list: HTMLElement, entry: HallEntry, series: LiveSeries | null): void {
    if (!entry.playable) {
      list.replaceChildren(
        h('dt', { class: 'room-signal__label' }, 'Signals planned'),
        h(
          'dd',
          { class: 'room-chips' },
          entry.manifest.signals.map((signal) => h('span', { class: 'room-chip' }, signal.label)),
        ),
        h('dd', { class: 'room-signal__after' }, `After ${entry.manifest.inspiredBy.uiTitle}`),
      );
      return;
    }
    const tokens = chartTokensFor('situation-room', ctx.appearance());
    const signalColour =
      getComputedStyle(root).getPropertyValue('--signal').trim() || tokens.accent;
    list.replaceChildren(
      ...entry.manifest.signals.map((signal) => {
        const values = series?.values[signal.id] ?? [];
        const latest = values.at(-1);
        const change = lastChange(values);
        const chart =
          values.length > 1
            ? svgFrom(
                sparkline(values, {
                  label: signal.label,
                  tokens: {
                    ...tokens,
                    ink: signalColour,
                    band: `${signalColour}1f`,
                    accent: signalColour,
                  },
                  width: 240,
                  height: 44,
                  area: true,
                  // The axis spans a whole run, so a young world's line grows across it.
                  slots: entry.manifest.typicalTurns[1] + 1,
                  track: true,
                  strokeWidth: 1.75,
                }).markup,
              )
            : h('span', { class: 'room-spark-placeholder', 'aria-hidden': 'true' });
        return h(
          'div',
          { class: 'room-signal' },
          h('dt', { class: 'room-signal__label' }, signal.label),
          h(
            'dd',
            { class: 'room-signal__figures' },
            h(
              'span',
              { class: 'room-signal__value tabular' },
              latest === undefined ? '—' : formatStyled(latest, signal.format),
            ),
            change !== null
              ? h(
                  'span',
                  { class: `room-delta ${deltaClass(change, signal)}` },
                  deltaText(change, signal),
                )
              : null,
          ),
          h('dd', { class: 'room-signal__chart' }, chart),
        );
      }),
    );
  }

  // ---- side panels: runs in progress and recent chronicles -------------------------------

  function drawSide(): void {
    const runs = snapshot.continueRuns.slice(0, 5);
    const chronicles = snapshot.chronicles.slice(0, 4);
    const tokens = chartTokensFor('situation-room', ctx.appearance());
    side.replaceChildren(
      h(
        'section',
        { class: 'room-panel', 'aria-labelledby': 'room-runs' },
        h(
          'h2',
          { id: 'room-runs', class: 'room-section-title' },
          'Runs in progress',
          h('span', { class: 'room-chip tabular' }, runs.length),
        ),
        runs.length === 0
          ? h(
              'p',
              { class: 'room-muted' },
              'Nothing open. Every run saves itself after each turn, so leaving is always safe.',
            )
          : h(
              'ul',
              { class: 'room-runs' },
              runs.map((run) => {
                const primary = run.manifest.primarySignal ?? run.manifest.signals[0]?.id ?? '';
                const signal = run.manifest.signals.find((item) => item.id === primary);
                const accent = run.manifest.accent[ctx.appearance()];
                const spark =
                  run.spark.length > 1
                    ? svgFrom(
                        sparkline(run.spark, {
                          label: primary,
                          tokens: { ...tokens, ink: accent, accent },
                          width: 84,
                          height: 26,
                        }).markup,
                      )
                    : null;
                spark?.setAttribute('aria-hidden', 'true');
                return h(
                  'li',
                  {},
                  button(
                    [
                      h('span', { class: 'room-runs__sim' }, run.manifest.title),
                      h('span', { class: 'room-runs__turn tabular' }, run.turnLabel),
                      h(
                        'span',
                        { class: 'room-runs__value tabular' },
                        signal ? formatStyled(run.signals[primary] ?? 0, signal.format) : '',
                      ),
                      spark,
                    ],
                    () => ctx.actions.continueRun(run.simId, run.id),
                    { class: 'room-runs__item', 'data-run': run.id },
                  ),
                );
              }),
            ),
      ),
      h(
        'section',
        { class: 'room-panel', 'aria-labelledby': 'room-chronicles' },
        h('h2', { id: 'room-chronicles', class: 'room-section-title' }, 'Recent chronicles'),
        chronicles.length === 0
          ? h(
              'p',
              { class: 'room-muted' },
              'Finished runs are filed here as chronicles you can reread and replay.',
            )
          : h(
              'table',
              { class: 'room-table' },
              h(
                'thead',
                {},
                h(
                  'tr',
                  {},
                  h('th', { scope: 'col' }, 'World'),
                  h('th', { scope: 'col' }, 'Epithet'),
                  h('th', { scope: 'col' }, 'Verdict'),
                ),
              ),
              h(
                'tbody',
                {},
                chronicles.map((chronicle) =>
                  h(
                    'tr',
                    {},
                    h(
                      'td',
                      {},
                      snapshot.entries.find((entry) => entry.manifest.id === chronicle.simId)
                        ?.manifest.title ?? chronicle.simId,
                    ),
                    h(
                      'td',
                      {},
                      button(
                        chronicle.epithet.text,
                        () => ctx.actions.openChronicle(chronicle.id),
                        { class: 'link-button' },
                      ),
                    ),
                    h(
                      'td',
                      {},
                      h(
                        'span',
                        { class: `room-verdict room-verdict--${chronicle.outcome.verdict.tier}` },
                        chronicle.outcome.verdict.label,
                      ),
                    ),
                  ),
                ),
              ),
            ),
        snapshot.chronicles.length > 0
          ? button('Open the Library', () => ctx.actions.openLibrary(), {
              class: 'button button--quiet',
            })
          : null,
      ),
      discoveriesPanel(),
    );
  }

  function discoveriesPanel(): HTMLElement {
    const playable = snapshot.entries.filter((entry) => entry.playable);
    return h(
      'section',
      { class: 'room-panel', 'aria-labelledby': 'room-discoveries' },
      h('h2', { id: 'room-discoveries', class: 'room-section-title' }, 'Discoveries'),
      h(
        'table',
        { class: 'room-table room-table--numbers' },
        h(
          'thead',
          {},
          h(
            'tr',
            {},
            h('th', { scope: 'col' }, 'World'),
            h('th', { scope: 'col' }, 'Codex'),
            h('th', { scope: 'col' }, 'Milestones'),
            h('th', { scope: 'col' }, 'Finished'),
          ),
        ),
        h(
          'tbody',
          {},
          playable.map((entry) =>
            h(
              'tr',
              {},
              h(
                'td',
                {},
                button(entry.manifest.title, () => ctx.actions.openCodex(entry.manifest.id), {
                  class: 'link-button',
                }),
              ),
              h(
                'td',
                { class: 'tabular' },
                entry.codex.total === null
                  ? `${entry.codex.discovered}`
                  : `${entry.codex.discovered}/${entry.codex.total}`,
              ),
              h(
                'td',
                { class: 'tabular' },
                entry.milestones.total === null
                  ? `${entry.milestones.unlocked}`
                  : `${entry.milestones.unlocked}/${entry.milestones.total}`,
              ),
              h('td', { class: 'tabular' }, entry.stats.runsFinished),
            ),
          ),
        ),
      ),
    );
  }

  // ---- status bar ----------------------------------------------------------------------------

  function drawStatus(): void {
    const { streak, legacy, storageDegraded } = snapshot;
    status.replaceChildren(
      h(
        'span',
        { class: 'room-status__item' },
        icon('calendar', 16),
        h('span', {}, 'Almanac streak'),
        h('strong', { class: 'tabular' }, streak.current),
        h('span', { class: 'room-muted' }, `vol. ${streak.volume}`),
      ),
      h(
        'span',
        { class: 'room-status__item' },
        h('span', {
          class: `room-dot ${storageDegraded ? 'room-dot--warning' : ''}`.trim(),
          'aria-hidden': 'true',
        }),
        storageDegraded
          ? 'Memory only: progress lasts until this tab closes'
          : 'Saved on this device · offline ready',
      ),
      button(
        [
          icon('legacy', 16),
          h('span', {}, legacy.standing.rank.title),
          h('strong', { class: 'tabular' }, `${legacy.standing.points} pts`),
          h('span', {
            class: 'room-status__meter',
            style: `--fill:${legacy.standing.progress}`,
            'aria-hidden': 'true',
          }),
        ],
        () => ctx.actions.openLegacy(),
        {
          class: 'room-status__item room-status__rank',
          'aria-label': `Legacy rank ${legacy.standing.rank.title}, ${legacy.standing.points} points`,
        },
      ),
    );
  }

  // ---- briefing panel ------------------------------------------------------------------------------

  function openBriefing(simId: string): void {
    const entry = snapshot.entries.find((item) => item.manifest.id === simId);
    if (!entry) return;
    ctx.actions.focus(simId);
    const detail = renderDetail(entry, {
      actions: ctx.actions,
      demos: ctx.demos,
      withDemo: true,
      seed: 3301,
    });
    detail.element.style.setProperty('--sim-accent', entry.manifest.accent[ctx.appearance()]);
    const dialog = openDialog({
      title: 'Briefing',
      kind: 'dialog--briefing',
      body: detail.element,
      onClose: () => {
        detail.dispose();
        briefing = null;
      },
    });
    briefing = { dialog, detail };
  }

  function drawAll(): void {
    applyCosmetic();
    drawTicker();
    drawBriefingStrip();
    drawFilters();
    drawGrid();
    drawSide();
    drawStatus();
  }

  drawAll();

  return {
    update(next) {
      // Tiles hold running demos, so they are rebuilt only when what they show changes.
      const shapeChanged = tileKey(next) !== tileKey(snapshot);
      snapshot = next;
      applyCosmetic();
      drawTicker();
      drawBriefingStrip();
      drawSide();
      drawStatus();
      if (shapeChanged) {
        drawFilters();
        drawGrid();
      }
    },
    focus(simId) {
      highlighted = simId;
      for (const element of grid.querySelectorAll<HTMLElement>('.room-tile')) {
        element.classList.toggle('room-tile--highlight', element.dataset.sim === simId);
      }
      grid
        .querySelector<HTMLElement>(`[data-sim='${simId ?? ''}']`)
        ?.scrollIntoView({ block: 'nearest' });
    },
    setAppearance() {
      drawAll();
    },
    dispose() {
      briefing?.dialog.close();
      disposeTiles();
      root.remove();
    },
  };
}

function tileKey(snapshot: HallSnapshot): string {
  return snapshot.entries
    .map((entry) =>
      [entry.manifest.id, entry.playable, entry.runs.length, entry.best?.id ?? ''].join(':'),
    )
    .join('|');
}

function primarySignal(entry: HallEntry): SignalDef {
  const id = entry.manifest.primarySignal ?? entry.manifest.signals[0]?.id;
  return (entry.manifest.signals.find((signal) => signal.id === id) ??
    entry.manifest.signals[0]) as SignalDef;
}

function deltaText(change: number, signal: SignalDef): string {
  return signal.format === 'percent' ? `${formatDelta(change * 100)} pts` : formatDelta(change);
}

/** Green when the change is good news, amber when it is bad, neutral for balances. */
function deltaClass(change: number, signal: SignalDef): string {
  if (change === 0 || signal.higherIsBetter === null) return 'room-delta--flat';
  return change > 0 === signal.higherIsBetter ? 'room-delta--up' : 'room-delta--down';
}

export const situationRoom: Theme = {
  id: 'situation-room',
  demoStyle: 'instrument',
  demoPalette,
  chartTokens: (appearance) => chartTokensFor('situation-room', appearance),
  mount,
};
